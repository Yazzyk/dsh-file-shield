// src/host/index.js
import z from "schemastery";

// src/host/browse.js
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
var BROWSE_PATH = "/file-shield/browse";
var MAX_ENTRIES = 5e3;
function readPathQuery(url) {
  const separator = (url ?? "").indexOf("?");
  if (separator === -1) return null;
  const query = (url ?? "").slice(separator + 1);
  if (query === "") return null;
  for (const part of query.split("&")) {
    if (!part.startsWith("path=")) continue;
    try {
      return decodeURIComponent(part.slice("path=".length));
    } catch {
      return void 0;
    }
  }
  return null;
}
function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  response.end(payload);
}
function failureOf(error) {
  switch (
    /** @type {NodeJS.ErrnoException} */
    error?.code
  ) {
    case "ENOENT":
      return { status: 404, code: "not-found" };
    case "ENOTDIR":
      return { status: 400, code: "not-a-directory" };
    case "EACCES":
    case "EPERM":
      return { status: 403, code: "permission-denied" };
    default:
      return { status: 500, code: "io-error" };
  }
}
async function classify(parent, entry) {
  if (entry.isDirectory()) return { type: "directory", symlink: false };
  if (entry.isFile()) return { type: "file", symlink: false };
  if (!entry.isSymbolicLink()) return { type: "other", symlink: false };
  try {
    const info = await stat(join(parent, entry.name));
    return { type: info.isDirectory() ? "directory" : info.isFile() ? "file" : "other", symlink: true };
  } catch {
    return { type: "other", symlink: true };
  }
}
function createBrowseHandler(options = {}) {
  const home = options.home ?? homedir();
  const authorize = options.authorize ?? (() => void 0);
  return async function browse(request, response) {
    const rejection = authorize(request);
    if (rejection !== void 0) {
      response.writeHead(rejection, { "cache-control": "no-store" });
      response.end();
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: { code: "method-not-allowed", message: `only GET is supported, received ${request.method ?? "no method"}` } });
      return;
    }
    const requested = readPathQuery(request.url);
    if (requested === void 0) {
      sendJson(response, 400, { error: { code: "invalid-path", message: "the path query is not valid percent-encoding" } });
      return;
    }
    const target = requested === null ? home : requested;
    if (!isAbsolute(target)) {
      sendJson(response, 400, { error: { code: "not-absolute", message: `"${target}" is not an absolute path` } });
      return;
    }
    let dirents;
    try {
      dirents = await readdir(target, { withFileTypes: true });
    } catch (error) {
      const { status, code } = failureOf(error);
      sendJson(response, status, { error: { code, message: `cannot list "${target}"` } });
      return;
    }
    const described = await Promise.all(dirents.map(async (entry) => ({
      name: entry.name,
      ...await classify(target, entry)
    })));
    described.sort((left, right) => {
      if (left.type !== right.type) {
        if (left.type === "directory") return -1;
        if (right.type === "directory") return 1;
      }
      return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
    });
    const parent = dirname(target);
    sendJson(response, 200, {
      path: target,
      parent: parent === target ? null : parent,
      home,
      entries: described.slice(0, MAX_ENTRIES),
      truncated: described.length > MAX_ENTRIES
    });
  };
}

// src/host/config.js
function resolveConfig(config) {
  const source = config === void 0 || config === null ? {} : config;
  if (typeof source !== "object" || Array.isArray(source)) {
    throw new Error("file-shield: config must be a mapping");
  }
  const { deny = [], matchCase = false, guidance = true, extraPathArgs = {} } = (
    /** @type {Record<string, unknown>} */
    source
  );
  if (!Array.isArray(deny)) throw new Error("file-shield: config.deny must be an array of strings");
  for (const entry of deny) {
    if (typeof entry !== "string") throw new Error("file-shield: config.deny must contain only strings");
  }
  if (typeof matchCase !== "boolean") throw new Error("file-shield: config.matchCase must be a boolean");
  if (typeof guidance !== "boolean") throw new Error("file-shield: config.guidance must be a boolean");
  if (typeof extraPathArgs !== "object" || extraPathArgs === null || Array.isArray(extraPathArgs)) {
    throw new Error("file-shield: config.extraPathArgs must be a mapping of tool name to argument keys");
  }
  const resolvedExtra = {};
  for (const [tool, keys] of Object.entries(extraPathArgs)) {
    if (tool.trim() === "") throw new Error("file-shield: config.extraPathArgs keys must be tool names");
    if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string" || key.trim() === "")) {
      throw new Error(`file-shield: config.extraPathArgs["${tool}"] must be an array of non-empty argument names`);
    }
    resolvedExtra[tool] = [...keys];
  }
  return { deny: [...deny], matchCase, guidance, extraPathArgs: resolvedExtra };
}

// src/host/rules.js
import { homedir as homedir2 } from "node:os";
import { isAbsolute as isAbsolute2, join as join2, posix, sep } from "node:path";
function toPosix(value) {
  return sep === "/" ? value : value.split(sep).join("/");
}
function escapeLiteral(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}
function classEnd(pattern, start) {
  let index = pattern[start] === "!" || pattern[start] === "^" ? start + 1 : start;
  if (pattern[index] === "]") index += 1;
  for (; index < pattern.length; index += 1) {
    if (pattern[index] === "]") return index;
  }
  return -1;
}
function globSource(pattern) {
  let source = "";
  let index = 0;
  while (index < pattern.length) {
    const character = pattern.charAt(index);
    if (character === "\\") {
      index += 1;
      if (index < pattern.length) {
        source += escapeLiteral(pattern.charAt(index));
        index += 1;
      }
      continue;
    }
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          source += "(?:.*/)?";
          index += 3;
          continue;
        }
        source += ".*";
        index += 2;
        continue;
      }
      source += "[^/]*";
      index += 1;
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      index += 1;
      continue;
    }
    if (character === "[") {
      const end = classEnd(pattern, index + 1);
      if (end === -1) {
        source += "\\[";
        index += 1;
        continue;
      }
      let body = pattern.slice(index + 1, end);
      const negated = body.startsWith("!") || body.startsWith("^");
      if (negated) body = body.slice(1);
      source += `[${negated ? "^" : ""}${body.replace(/\\/gu, "\\\\")}]`;
      index = end + 1;
      continue;
    }
    source += escapeLiteral(character);
    index += 1;
  }
  return source;
}
function compileRules(patterns, options = {}) {
  const { matchCase = false, home = homedir2() } = options;
  const flags = matchCase ? "" : "i";
  const rules = [];
  for (const entry of patterns ?? []) {
    if (typeof entry !== "string") continue;
    let pattern = entry.trim();
    if (pattern === "") continue;
    let absolute = false;
    if (pattern === "~" || pattern.startsWith("~/")) {
      pattern = join2(home, pattern.slice(1));
      absolute = true;
    } else if (isAbsolute2(pattern)) {
      absolute = true;
    }
    const spelling = toPosix(pattern);
    rules.push({ pattern: entry, absolute, regex: new RegExp(`^${globSource(spelling)}$`, flags) });
  }
  return rules;
}
function ancestors(value) {
  const chain = [value];
  let current = value;
  for (; ; ) {
    const parent = posix.dirname(current);
    if (parent === current || parent === "." || parent === "/" || parent === "") break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}
function relativeTo(root, absolute) {
  const relative = posix.relative(toPosix(root), toPosix(absolute));
  if (relative === "") return ".";
  if (relative === ".." || relative.startsWith("../")) return void 0;
  return relative;
}
function spellingsOf(target) {
  return target.canonical === target.lexical ? [target.canonical] : [target.canonical, target.lexical];
}
function relativesOf(root, target) {
  if (root === void 0) return [];
  const relatives = [];
  for (const absolute of spellingsOf(target)) {
    const relative = relativeTo(root, absolute);
    if (relative !== void 0) relatives.push(relative);
  }
  return relatives;
}
function matchRule(rules, absolute, relative) {
  if (rules.length === 0) return void 0;
  const absolutes = typeof absolute === "string" ? [absolute] : absolute;
  const relatives = relative === void 0 ? [] : typeof relative === "string" ? [relative] : relative;
  const absoluteChains = absolutes.map((candidate) => ancestors(toPosix(candidate)));
  const relativeChains = relatives.map((candidate) => ancestors(candidate));
  for (const rule of rules) {
    for (const chain of rule.absolute ? absoluteChains : relativeChains) {
      for (const candidate of chain) {
        if (rule.regex.test(candidate)) return rule.pattern;
      }
    }
  }
  return void 0;
}

// src/host/targets.js
var TOOL_PATH_ARGS = Object.freeze({
  read: Object.freeze(["file_path"]),
  read_image: Object.freeze(["file_path"]),
  write: Object.freeze(["file_path"]),
  edit: Object.freeze(["file_path"]),
  str_replace_editor: Object.freeze(["path"]),
  grep: Object.freeze(["path"]),
  glob: Object.freeze(["path"])
});
function pathArgsFor(toolName, extraPathArgs) {
  const builtin = (
    /** @type {Record<string, readonly string[]>} */
    TOOL_PATH_ARGS[toolName] ?? []
  );
  const extra = extraPathArgs[toolName] ?? [];
  return [...builtin, ...extra];
}
function readPathArg(args, key) {
  if (typeof args !== "object" || args === null) return void 0;
  const value = (
    /** @type {Record<string, unknown>} */
    args[key]
  );
  return typeof value === "string" && value.trim() !== "" ? value : void 0;
}
function workspaceRoot(exec) {
  return exec?.agent?.session?.header?.cwd;
}

// src/host/guard.js
var BLOCKED_ERROR = Object.freeze({
  name: "FileAccessBlockedError",
  /**
   * 文件系统策略拒绝。刻意不用 `FS_SANDBOX_DENIED`：那个错误码会让模型用更宽的沙箱
   * 权限重试调用，而部署规则没有“更宽”可给。
   */
  code: "FS_PERMISSION_DENIED"
});
function blockedDecision(displayPath, rule) {
  return {
    kind: "deny",
    reason: `Access to "${displayPath}" is blocked by deployment policy (rule "${rule}").`,
    info: { ...BLOCKED_ERROR, reason: rule }
  };
}
function createPreExecuteListener(options) {
  const { activeRules, resolveTarget, extraPathArgs, logger } = options;
  return async function guardPreExecute(exec, next) {
    const rules = activeRules();
    if (rules.length === 0) return next();
    const keys = pathArgsFor(exec.name, extraPathArgs);
    if (keys.length === 0) return next();
    const root = workspaceRoot(exec);
    for (const key of keys) {
      const requested = readPathArg(exec.arguments, key);
      if (requested === void 0) continue;
      const target = await resolveTarget(requested, root, exec.signal);
      if (target === void 0) continue;
      const rule = matchRule(rules, spellingsOf(target), relativesOf(root, target));
      if (rule === void 0) continue;
      logger?.debug(`file-shield: denied ${exec.name} on "${target.displayPath}" by rule "${rule}"`);
      return blockedDecision(target.displayPath, rule);
    }
    return next();
  };
}

// src/host/results.js
import { isAbsolute as isAbsolute3, posix as posix2 } from "node:path";
var RESULT_FILTERS = Object.freeze({
  grep: {
    key: "matches",
    pathOf: (entry) => {
      if (typeof entry !== "object" || entry === null) return void 0;
      const path = (
        /** @type {{ path?: unknown }} */
        entry.path
      );
      return typeof path === "string" ? path : void 0;
    }
  },
  glob: {
    key: "paths",
    pathOf: (entry) => typeof entry === "string" ? entry : void 0
  }
});
async function spellingsAt(requested, root, resolveTarget, cache, signal) {
  const joined = isAbsolute3(requested) ? requested : posix2.join(toPosix(root), toPosix(requested));
  const cached = cache.get(joined);
  if (cached !== void 0) return cached;
  const target = await resolveTarget(joined, root, signal);
  const spellings = target ?? { canonical: joined, lexical: joined, displayPath: joined };
  cache.set(joined, spellings);
  return spellings;
}
function createPostExecuteListener(options) {
  const { activeRules, resolveTarget, logger } = options;
  return async function filterSearchResults(exec, result, next) {
    const decision = await next();
    if (decision.kind !== "accept") return decision;
    const filter = RESULT_FILTERS[exec.name];
    if (filter === void 0) return decision;
    if (Object.hasOwn(decision, "content")) return decision;
    const rules = activeRules();
    if (rules.length === 0) return decision;
    const value = Object.hasOwn(decision, "value") ? decision.value : result.isError ? void 0 : result.value;
    if (typeof value !== "object" || value === null) return decision;
    const entries = value[filter.key];
    if (!Array.isArray(entries) || entries.length === 0) return decision;
    const root = workspaceRoot(exec) ?? process.cwd();
    const cache = /* @__PURE__ */ new Map();
    const kept = [];
    let removed = 0;
    for (const entry of entries) {
      const requested = filter.pathOf(entry);
      if (requested === void 0) {
        kept.push(entry);
        continue;
      }
      const absolute = await spellingsAt(requested, root, resolveTarget, cache, exec.signal);
      if (matchRule(rules, spellingsOf(absolute), relativesOf(root, absolute)) !== void 0) {
        removed += 1;
        continue;
      }
      kept.push(entry);
    }
    if (removed === 0) return decision;
    logger?.debug(`file-shield: withheld ${removed} ${exec.name} result(s)`);
    return {
      kind: "accept",
      value: { ...value, [filter.key]: kept },
      ...decision.additionalContexts === void 0 ? {} : { additionalContexts: decision.additionalContexts }
    };
  };
}

// src/host/index.js
var name = "file-shield";
var inject = ["tools", "fs"];
var SETTINGS_NAMESPACE = "file-shield";
var Config = z.object({
  deny: z.array(z.string()).default([]),
  matchCase: z.boolean().default(false),
  guidance: z.boolean().default(true),
  extraPathArgs: z.dict(z.array(z.string())).default({})
});
var SettingsSection = z.object({
  deny: z.array(z.string()).default([])
});
var GUIDANCE = "Deployment policy blocks some paths from being read, searched, written, or edited. A blocked call returns an explicit policy error naming the path and the rule that matched it. Treat that error as final: do not retry the same path through another tool, do not read it with shell commands, and do not ask for contents you were refused.";
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function connectionOf(ctx) {
  return Reflect.get(ctx, "connection");
}
function apply(ctx, config) {
  const resolved = resolveConfig(config);
  const compile = (patterns) => compileRules(patterns, { matchCase: resolved.matchCase });
  let source = () => ({ deny: resolved.deny });
  let rules = compile(resolved.deny);
  const rebuild = () => {
    const section = source();
    rules = compile(Array.isArray(section?.deny) ? section.deny : resolved.deny);
  };
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, SettingsSection, { deny: resolved.deny }, {
      setSource: (current) => {
        source = current;
        rebuild();
      },
      // 一次已提交的变更会改变已解析的段落，所以在这里重建编译后的匹配器，而不是留到
      // 下一次工具调用。
      onChange: () => {
        rebuild();
      }
    });
  });
  async function resolveTarget(path, cwd, signal) {
    try {
      const target = await ctx.fs.resolve(path, {
        ...cwd === void 0 ? {} : { cwd },
        ...signal === void 0 ? {} : { signal }
      });
      const key = String(target.targetKey);
      return {
        canonical: key === "" ? target.displayPath : key,
        lexical: target.displayPath,
        displayPath: target.displayPath
      };
    } catch (error) {
      ctx.logger.debug(`file-shield: cannot resolve "${path}": ${messageOf(error)}`);
      return void 0;
    }
  }
  ctx.on("tools/pre-execute", createPreExecuteListener({
    activeRules: () => rules,
    resolveTarget,
    extraPathArgs: resolved.extraPathArgs,
    logger: ctx.logger
  }), { prepend: true });
  ctx.on("tools/post-execute", createPostExecuteListener({
    activeRules: () => rules,
    resolveTarget,
    logger: ctx.logger
  }), { prepend: true });
  if (resolved.guidance) {
    ctx.inject(["systemPrompt"], (promptCtx) => {
      promptCtx.systemPrompt.section({
        name: "file-shield:guidance",
        // 位于部署 persona（0）之后、每个工具段落（1000）之前。
        order: 50,
        interpolate: false,
        text: GUIDANCE
      });
    });
  }
  ctx.inject(["webServer", "connection"], (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: "exact",
        path: BROWSE_PATH,
        handler: createBrowseHandler({
          authorize: (request) => connectionOf(webCtx).requestRejection(request)
        })
      }),
      "file-shield browse route"
    );
  });
  if (rules.length === 0) {
    ctx.logger.info("file-shield: no rule configured yet; add paths on the plugin page or set config.deny");
  } else {
    ctx.logger.info(`file-shield: ${rules.length} rule(s) active`);
  }
}
export {
  Config,
  SETTINGS_NAMESPACE,
  apply,
  inject,
  name
};
