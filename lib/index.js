// src/host/index.js
import z from "@deepseek-ai/schemastery";

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
var VOLATILE_WRITE = Symbol.for("cosmokit.volatile.write");
function isVolatileRef(value) {
  return typeof value === "object" && value !== null && VOLATILE_WRITE in value;
}
function readConfigField(value) {
  if (!isVolatileRef(value)) return value;
  return (
    /** @type {{ get: () => unknown }} */
    value.get()
  );
}
function resolveConfig(config) {
  const source = config === void 0 || config === null ? {} : config;
  if (typeof source !== "object" || Array.isArray(source)) {
    throw new Error("file-shield: config must be a mapping");
  }
  const {
    deny = [],
    matchCase = false,
    guidance = true,
    extraPathArgs = {},
    extraCommandArgs = {}
  } = (
    /** @type {Record<string, unknown>} */
    source
  );
  const denyValue = readConfigField(deny);
  if (!Array.isArray(denyValue)) throw new Error("file-shield: config.deny must be an array of strings");
  for (const entry of denyValue) {
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
  if (typeof extraCommandArgs !== "object" || extraCommandArgs === null || Array.isArray(extraCommandArgs)) {
    throw new Error("file-shield: config.extraCommandArgs must be a mapping of tool name to one command argument key");
  }
  const resolvedCommands = {};
  for (const [tool, key] of Object.entries(extraCommandArgs)) {
    if (tool.trim() === "") throw new Error("file-shield: config.extraCommandArgs keys must be tool names");
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error(`file-shield: config.extraCommandArgs["${tool}"] must be a non-empty argument name`);
    }
    resolvedCommands[tool] = key;
  }
  return { deny: [...denyValue], matchCase, guidance, extraPathArgs: resolvedExtra, extraCommandArgs: resolvedCommands };
}

// src/host/guard.js
import { isAbsolute as isAbsolute4, resolve as resolve2 } from "node:path";

// src/host/commands.js
import { homedir as homedir2 } from "node:os";
import { isAbsolute as isAbsolute2, join as join2, resolve } from "node:path";
var SEGMENT_SEPARATORS = /[|&;()\n\r\t`]/gu;
var PLAIN_SEPARATORS = /[<>]/gu;
var SEGMENT_BREAK = "\0";
var ASSIGNMENT_PREFIX = /^[A-Za-z_][A-Za-z0-9_]*=/u;
function unquote(token) {
  let result = token;
  while (result.startsWith("'") || result.startsWith('"')) result = result.slice(1);
  while (result.endsWith("'") || result.endsWith('"')) result = result.slice(0, -1);
  return result;
}
function expandHome(token) {
  if (token === "~") return homedir2();
  if (token.startsWith("~/")) return join2(homedir2(), token.slice(2));
  return token;
}
function markedWords(command) {
  const words = [];
  let atSegmentStart = true;
  for (const raw of command.replace(SEGMENT_SEPARATORS, ` ${SEGMENT_BREAK} `).replace(PLAIN_SEPARATORS, " ").split(/\s+/u)) {
    if (raw === SEGMENT_BREAK) {
      atSegmentStart = true;
      continue;
    }
    const hadAssignment = ASSIGNMENT_PREFIX.test(raw);
    const token = unquote(raw).replace(ASSIGNMENT_PREFIX, "");
    if (token === "" || token.startsWith("-")) continue;
    words.push({ token, commandName: atSegmentStart && !hadAssignment });
    if (!hadAssignment) atSegmentStart = false;
  }
  return words;
}
function commandPaths(command, base) {
  const words = markedWords(command);
  const paths = [];
  let current = base;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word === void 0) continue;
    const expanded = expandHome(word.token);
    if (expanded === "cd") {
      const next = words[index + 1];
      if (next === void 0) continue;
      const destination = expandHome(next.token);
      current = isAbsolute2(destination) ? destination : resolve(current, destination);
      paths.push(current);
      index += 1;
      continue;
    }
    if (word.commandName) continue;
    paths.push(isAbsolute2(expanded) ? expanded : resolve(current, expanded));
  }
  return paths;
}

// src/host/rules.js
import { homedir as homedir3 } from "node:os";
import { isAbsolute as isAbsolute3, join as join3, posix, sep } from "node:path";
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
var GLOB_METACHARACTERS = /[*?[\]{}]/u;
function staticPrefix(spelling) {
  const meta = spelling.search(GLOB_METACHARACTERS);
  if (meta === -1) return spelling;
  const head = spelling.slice(0, meta);
  const cut = head.lastIndexOf("/");
  return cut <= 0 ? "" : head.slice(0, cut);
}
function compileRules(patterns, options = {}) {
  const { matchCase = false, home = homedir3() } = options;
  const flags = matchCase ? "" : "i";
  const rules = [];
  for (const entry of patterns ?? []) {
    if (typeof entry !== "string") continue;
    let pattern = entry.trim();
    if (pattern === "") continue;
    let absolute = false;
    if (pattern === "~" || pattern.startsWith("~/")) {
      pattern = join3(home, pattern.slice(1));
      absolute = true;
    } else if (isAbsolute3(pattern)) {
      absolute = true;
    }
    const spelling = toPosix(pattern);
    rules.push({
      pattern: entry,
      absolute,
      glob: GLOB_METACHARACTERS.test(spelling),
      prefix: staticPrefix(spelling),
      regex: new RegExp(`^${globSource(spelling)}$`, flags)
    });
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
  glob: Object.freeze(["path"]),
  // shell 工具没有“路径参数”，但它的 workdir 本身就是一个路径；命令文本另行检查。
  bash: Object.freeze(["workdir"]),
  pwsh: Object.freeze(["workdir"])
});
var TOOL_COMMAND_ARGS = Object.freeze({
  bash: "command",
  pwsh: "command"
});
var WORKDIR_ARG = "workdir";
function pathArgsFor(toolName, extraPathArgs) {
  const builtin = (
    /** @type {Record<string, readonly string[]>} */
    TOOL_PATH_ARGS[toolName] ?? []
  );
  const extra = extraPathArgs[toolName] ?? [];
  return [...builtin, ...extra];
}
function commandArgFor(toolName, extraCommandArgs) {
  return extraCommandArgs[toolName] ?? /** @type {Record<string, string>} */
  TOOL_COMMAND_ARGS[toolName];
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
async function hitPathArgs(exec, keys, rules, options, root) {
  for (const key of keys) {
    const requested = readPathArg(exec.arguments, key);
    if (requested === void 0) continue;
    const target = await options.resolveTarget(requested, root, exec.signal);
    if (target === void 0) continue;
    const rule = matchRule(rules, spellingsOf(target), relativesOf(root, target));
    if (rule !== void 0) return { displayPath: target.displayPath, rule };
  }
  return void 0;
}
async function hitCommand(exec, command, rules, options, root) {
  for (const rule of rules) {
    if (rule.absolute && !rule.glob && command.includes(rule.pattern.trim())) {
      return { displayPath: rule.pattern, rule: rule.pattern };
    }
  }
  const workdir = readPathArg(exec.arguments, WORKDIR_ARG);
  const base = workdir === void 0 ? root ?? process.cwd() : isAbsolute4(workdir) ? workdir : resolve2(root ?? process.cwd(), workdir);
  for (const candidate of commandPaths(command, base)) {
    const target = await options.resolveTarget(candidate, void 0, exec.signal);
    if (target === void 0) continue;
    const relatives = [...relativesOf(root, target), ...relativesOf(base, target)];
    const rule = matchRule(rules, spellingsOf(target), relatives);
    if (rule !== void 0) return { displayPath: target.displayPath, rule };
  }
  return void 0;
}
function createPreExecuteListener(options) {
  const { activeRules, extraPathArgs, extraCommandArgs, logger } = options;
  return async function guardPreExecute(exec, next) {
    const rules = activeRules(exec);
    if (rules.length === 0) return next();
    const root = workspaceRoot(exec);
    const pathHit = await hitPathArgs(exec, pathArgsFor(exec.name, extraPathArgs), rules, options, root);
    if (pathHit !== void 0) {
      logger?.debug(`file-shield: denied ${exec.name} on "${pathHit.displayPath}" by rule "${pathHit.rule}"`);
      return blockedDecision(pathHit.displayPath, pathHit.rule);
    }
    const commandKey = commandArgFor(exec.name, extraCommandArgs);
    if (commandKey !== void 0) {
      const command = readPathArg(exec.arguments, commandKey);
      if (command !== void 0) {
        const commandHit = await hitCommand(exec, command, rules, options, root);
        if (commandHit !== void 0) {
          logger?.debug(`file-shield: denied ${exec.name} on "${commandHit.displayPath}" by rule "${commandHit.rule}"`);
          return blockedDecision(commandHit.displayPath, commandHit.rule);
        }
      }
    }
    return next();
  };
}

// src/host/tiers.js
var MAX_RULE_LENGTH = 4096;
var MAX_RULES_PER_LEVEL = 500;
var MAX_LEVEL_KEYS = 200;
var TierError = class extends Error {
  /**
   * @param {string} code - 稳定的错误码。
   * @param {string} message - 面向人的说明。
   */
  constructor(code, message) {
    super(message);
    this.name = "TierError";
    this.code = code;
  }
};
function emptyTiers() {
  return { global: [], projects: {}, sessions: {} };
}
function cleanRules(value, where) {
  if (!Array.isArray(value)) throw new TierError("invalid-rules", `${where} must be an array of strings`);
  if (value.length > MAX_RULES_PER_LEVEL) {
    throw new TierError("too-many-rules", `${where} holds more than ${MAX_RULES_PER_LEVEL} rules`);
  }
  const rules = [];
  for (const entry of value) {
    if (typeof entry !== "string") throw new TierError("invalid-rules", `${where} must contain only strings`);
    const rule = entry.trim();
    if (rule === "") continue;
    if ([...rule].length > MAX_RULE_LENGTH) {
      throw new TierError("rule-too-long", `${where} has a rule longer than ${MAX_RULE_LENGTH} characters`);
    }
    if (!rules.includes(rule)) rules.push(rule);
  }
  return rules;
}
function cleanKey(value, where, absolute) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TierError("invalid-scope", `${where} must be a non-empty string`);
  }
  const key = value.trim();
  if (absolute && !key.startsWith("/")) {
    throw new TierError("not-absolute", `${where} must be an absolute path, received "${key}"`);
  }
  return key;
}
function normalizeTiers(raw) {
  const source = raw === void 0 || raw === null ? {} : raw;
  if (typeof source !== "object" || Array.isArray(source)) {
    throw new TierError("invalid-body", "the tier state must be a mapping");
  }
  const record = (
    /** @type {Record<string, unknown>} */
    source
  );
  const tiers = emptyTiers();
  tiers.global = cleanRules(record.global ?? [], "global");
  for (
    const [field, target] of
    /** @type {const} */
    [["projects", tiers.projects], ["sessions", tiers.sessions]]
  ) {
    const block = record[field] ?? {};
    if (typeof block !== "object" || block === null || Array.isArray(block)) {
      throw new TierError("invalid-body", `${field} must be a mapping of key to rules`);
    }
    const entries = Object.entries(
      /** @type {Record<string, unknown>} */
      block
    );
    if (entries.length > MAX_LEVEL_KEYS) {
      throw new TierError("too-many-entries", `${field} holds more than ${MAX_LEVEL_KEYS} entries`);
    }
    for (const [key, value] of entries) {
      const rules = cleanRules(value, `${field}["${key}"]`);
      if (rules.length > 0) target[key] = rules;
    }
  }
  return tiers;
}
function parseChange(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new TierError("invalid-body", "the change must be a mapping");
  }
  const record = (
    /** @type {Record<string, unknown>} */
    body
  );
  const scope = record.scope;
  if (scope === "global") return { scope, rules: cleanRules(record.rules ?? [], "rules") };
  if (scope === "project") {
    return {
      scope,
      workspace: cleanKey(record.workspace, "workspace", true),
      rules: cleanRules(record.rules ?? [], "rules")
    };
  }
  if (scope === "session") {
    return {
      scope,
      session: cleanKey(record.session, "session", false),
      rules: cleanRules(record.rules ?? [], "rules")
    };
  }
  throw new TierError("invalid-scope", "scope must be one of global, project, session");
}
function applyChange(tiers, change) {
  const next = {
    global: [...tiers.global],
    projects: Object.fromEntries(Object.entries(tiers.projects).map(([key2, rules]) => [key2, [...rules]])),
    sessions: Object.fromEntries(Object.entries(tiers.sessions).map(([key2, rules]) => [key2, [...rules]]))
  };
  if (change.scope === "global") {
    next.global = [...change.rules];
    return next;
  }
  const block = change.scope === "project" ? next.projects : next.sessions;
  const key = change.scope === "project" ? change.workspace : change.session;
  if (change.rules.length === 0) delete block[key];
  else {
    if (block[key] === void 0 && Object.keys(block).length >= MAX_LEVEL_KEYS) {
      throw new TierError("too-many-entries", `at most ${MAX_LEVEL_KEYS} entries are kept per level`);
    }
    block[key] = [...change.rules];
  }
  return next;
}
function isWithin(root, candidate) {
  const base = toPosix(root).replace(/\/+$/u, "").toLowerCase();
  const path = toPosix(candidate).replace(/\/+$/u, "").toLowerCase();
  if (base === "" || path === "") return false;
  return path === base || path.startsWith(`${base}/`);
}
function projectRootsFor(tiers, workspace) {
  if (workspace === void 0) return [];
  return Object.keys(tiers.projects).filter((root) => isWithin(root, workspace));
}

// src/host/live.js
function createLiveRules(options) {
  const { readTiers: readTiers2, compile = (patterns) => compileRules(patterns), refresh } = options;
  return {
    /**
     * 一次调用生效的规则：全局 + 命中的项目 + 该会话。
     *
     * 部署默认（`config.deny`）不在这里拼接：它由 loader 提供的 volatile 引用承载，改动会
     * 触发 `loader/volatile-update`，调用方自己把两份拼起来即可——这样部署层仍然是"编译一次、
     * 变更时重编译"，不必每次调用都重编一遍那段不会变的规则。
     *
     * @param {any} exec - 待执行的工具调用。
     * @returns {import('./rules.js').Rule[]} 这次调用要用的规则。
     */
    rulesFor(exec) {
      const tiers = refresh === void 0 ? readTiers2() : refresh();
      const workspace = exec?.agent?.session?.header?.cwd;
      const sessionId = exec?.agent?.session?.id;
      const patterns = [...tiers.global];
      for (const root of projectRootsFor(tiers, workspace)) {
        const rules = tiers.projects[root];
        if (rules !== void 0) patterns.push(...rules);
      }
      if (typeof sessionId === "string" && tiers.sessions[sessionId] !== void 0) {
        patterns.push(...tiers.sessions[sessionId]);
      }
      return patterns.length === 0 ? [] : compile(patterns);
    }
  };
}

// src/host/results.js
import { isAbsolute as isAbsolute5, posix as posix2 } from "node:path";
var COMMAND_OUTPUT_TOOLS = Object.freeze(/* @__PURE__ */ new Set(["bash", "pwsh"]));
var COMMAND_STREAMS = Object.freeze(["stdout", "stderr"]);
function redactLines(text, rules) {
  if (text === "") return void 0;
  const kept = [];
  let removed = 0;
  for (const line of text.split("\n")) {
    if (line !== "" && rules.some((rule) => rule.prefix !== "" && line.includes(rule.prefix))) {
      removed += 1;
      continue;
    }
    kept.push(line);
  }
  return removed === 0 ? void 0 : { text: kept.join("\n"), removed };
}
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
  const joined = isAbsolute5(requested) ? requested : posix2.join(toPosix(root), toPosix(requested));
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
    if (Object.hasOwn(decision, "content")) return decision;
    const rules = activeRules(exec);
    if (rules.length === 0) return decision;
    const value = Object.hasOwn(decision, "value") ? decision.value : result.isError ? void 0 : result.value;
    if (typeof value !== "object" || value === null) return decision;
    if (COMMAND_OUTPUT_TOOLS.has(exec.name)) return filterCommandOutput(decision, value, rules, logger);
    const filter = RESULT_FILTERS[exec.name];
    if (filter === void 0) return decision;
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
function filterCommandOutput(decision, value, rules, logger) {
  const replacement = { ...value };
  let removed = 0;
  for (const stream of COMMAND_STREAMS) {
    const current = value[stream];
    if (typeof current !== "object" || current === null || typeof current.text !== "string") continue;
    const redacted = redactLines(current.text, rules);
    if (redacted === void 0) continue;
    removed += redacted.removed;
    replacement[stream] = { ...current, text: redacted.text };
  }
  if (removed === 0) return decision;
  logger?.debug(`file-shield: withheld ${removed} command output line(s)`);
  return {
    kind: "accept",
    value: replacement,
    ...decision.additionalContexts === void 0 ? {} : { additionalContexts: decision.additionalContexts }
  };
}

// src/host/tier-store.js
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir as homedir4 } from "node:os";
import { dirname as dirname2, join as join4 } from "node:path";
var STATE_VERSION = 1;
function resolveHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === "string" && configured.trim() !== "") return configured.trim();
  return join4(homedir4(), ".dsh");
}
function stateFile() {
  return join4(resolveHome(), "state", "dsh-file-shield", "tiers.json");
}
function readTiers(logger) {
  const file = stateFile();
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if (
      /** @type {NodeJS.ErrnoException} */
      error?.code !== "ENOENT"
    ) {
      logger?.warn?.(`file-shield: cannot read ${file}: ${String(error)}`);
    }
    return emptyTiers();
  }
  try {
    const parsed = JSON.parse(raw);
    const version = parsed?.version ?? STATE_VERSION;
    if (version !== STATE_VERSION) {
      logger?.warn?.(`file-shield: ignoring ${file}: unsupported version ${String(version)}`);
      return emptyTiers();
    }
    return normalizeTiers(parsed);
  } catch (error) {
    logger?.warn?.(`file-shield: ignoring ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return emptyTiers();
  }
}
function writeTiers(tiers) {
  const file = stateFile();
  mkdirSync(dirname2(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  const payload = JSON.stringify({ version: STATE_VERSION, ...tiers }, null, 2);
  try {
    writeFileSync(temporary, `${payload}
`, { mode: 384 });
    renameSync(temporary, file);
  } catch (error) {
    try {
      rmSync(temporary, { force: true });
    } catch {
    }
    throw error;
  }
}
function statesStamp() {
  try {
    const info = statSync(stateFile());
    return `${info.mtimeMs}:${info.size}`;
  } catch {
    return "absent";
  }
}

// src/host/tier-routes.js
var STATE_PATH = "/file-shield/state";
var SESSION_PATH = "/file-shield/session";
var MAX_BODY_BYTES = 1024 * 1024;
function sendJson2(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  response.end(payload);
}
function sendError(response, status, code, message) {
  sendJson2(response, status, { error: { code, message } });
}
async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new TierError("body-too-large", `the request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (text === "") throw new TierError("invalid-body", "the request body is empty");
  try {
    return JSON.parse(text);
  } catch {
    throw new TierError("invalid-body", "the request body is not valid JSON");
  }
}
function readQuery(url, name2) {
  const separator = (url ?? "").indexOf("?");
  if (separator === -1) return null;
  for (const part of (url ?? "").slice(separator + 1).split("&")) {
    if (!part.startsWith(`${name2}=`)) continue;
    try {
      return decodeURIComponent(part.slice(name2.length + 1));
    } catch {
      return null;
    }
  }
  return null;
}
function acceptAll(request) {
  return void 0;
}
function stateView(tiers, deployment) {
  return { levels: tiers, deployment };
}
function createStateHandler(options) {
  const { authorize = acceptAll, logger } = options;
  const read = options.read ?? (() => {
    throw new TierError("unsupported", "this composition exposes no tier state");
  });
  const write = options.write ?? (() => {
    throw new TierError("unsupported", "this composition exposes no tier state");
  });
  const deployment = options.deployment ?? (() => []);
  return async function stateRoute(request, response) {
    const rejection = authorize(request);
    if (rejection !== void 0) {
      response.writeHead(rejection, { "cache-control": "no-store" });
      response.end();
      return;
    }
    if (request.method === "GET") {
      sendJson2(response, 200, stateView(read(), deployment()));
      return;
    }
    if (request.method !== "POST") {
      sendError(response, 405, "method-not-allowed", `only GET and POST are supported, received ${request.method ?? "no method"}`);
      return;
    }
    try {
      const change = parseChange(await readJsonBody(request));
      const next = applyChange(read(), change);
      write(next);
      sendJson2(response, 200, stateView(next, deployment()));
    } catch (error) {
      if (error instanceof TierError) {
        sendError(response, error.code === "body-too-large" ? 413 : 400, error.code, error.message);
        return;
      }
      logger?.warn(`file-shield: cannot save tier rules: ${error instanceof Error ? error.message : String(error)}`);
      sendError(response, 500, "write-failed", "the tier rules could not be saved");
    }
  };
}
function createSessionHandler(options) {
  const { authorize = acceptAll, sessionInfo } = options;
  return async function sessionRoute(request, response) {
    const rejection = authorize(request);
    if (rejection !== void 0) {
      response.writeHead(rejection, { "cache-control": "no-store" });
      response.end();
      return;
    }
    if (request.method !== "GET") {
      sendError(response, 405, "method-not-allowed", `only GET is supported, received ${request.method ?? "no method"}`);
      return;
    }
    if (sessionInfo === void 0) {
      sendError(response, 501, "unsupported", "this composition exposes no agent registry");
      return;
    }
    const sessionId = readQuery(request.url, "session");
    if (sessionId === null || sessionId.trim() === "") {
      sendError(response, 400, "invalid-session", "the session query is required");
      return;
    }
    sendJson2(response, 200, sessionInfo(sessionId.trim()));
  };
}

// src/host/index.js
var name = "file-shield";
var inject = ["tools", "fs"];
var Config = z.object({
  deny: z.array(z.string()).default([]).volatile(),
  matchCase: z.boolean().default(false),
  guidance: z.boolean().default(true),
  extraPathArgs: z.dict(z.array(z.string())).default({}),
  extraCommandArgs: z.dict(z.string()).default({})
});
var GUIDANCE = "Deployment policy blocks some paths from being read, searched, written, or edited. A blocked call returns an explicit policy error naming the path and the rule that matched it. Treat that error as final: do not retry the same path through another tool, do not read it with shell commands, and do not ask for contents you were refused.";
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function sessionCwd(ctx, sessionId) {
  const agents = typeof ctx.get === "function" ? ctx.get("agents") : void 0;
  const lookup = agents !== void 0 && typeof agents.get === "function" ? (
    /** @type {(id: string) => any} */
    agents.get.bind(agents)
  ) : void 0;
  const agent = lookup === void 0 ? void 0 : lookup(sessionId);
  const cwd = agent?.session?.header?.cwd;
  return { cwd: typeof cwd === "string" ? cwd : null };
}
function connectionOf(ctx) {
  return Reflect.get(ctx, "connection");
}
function apply(ctx, config) {
  const resolved = resolveConfig(config);
  const compile = (patterns) => compileRules(patterns, { matchCase: resolved.matchCase });
  const liveDeny = () => {
    const field = config === null || config === void 0 ? void 0 : (
      /** @type {{ deny?: unknown }} */
      config.deny
    );
    const value = readConfigField(field);
    return Array.isArray(value) ? value : [];
  };
  let deploymentRules = compile(liveDeny());
  let stateStamp = statesStamp();
  let tiersState = readTiers(ctx.logger);
  const currentTiers = () => {
    const stamp = statesStamp();
    if (stamp !== stateStamp) {
      stateStamp = stamp;
      tiersState = readTiers(ctx.logger);
    }
    return tiersState;
  };
  const liveTiers = createLiveRules({ readTiers: currentTiers });
  const logRules = () => {
    const tiers = currentTiers();
    const projects = Object.keys(tiers.projects).length;
    const sessions = Object.keys(tiers.sessions).length;
    if (deploymentRules.length === 0 && tiers.global.length === 0 && projects === 0 && sessions === 0) {
      ctx.logger.info("file-shield: no rule configured yet; add paths on the panel or set config.deny");
      return;
    }
    ctx.logger.info(
      `file-shield: ${deploymentRules.length} deployment rule(s) + ${tiers.global.length} global, ${projects} project tier(s), ${sessions} session tier(s) active`
    );
  };
  ctx.on("loader/volatile-update", () => {
    deploymentRules = compile(liveDeny());
    logRules();
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
  const rulesForCall = (exec) => {
    const tiers = liveTiers.rulesFor(exec);
    return tiers.length === 0 ? deploymentRules : [...deploymentRules, ...tiers];
  };
  ctx.on("tools/pre-execute", createPreExecuteListener({
    activeRules: rulesForCall,
    resolveTarget,
    extraPathArgs: resolved.extraPathArgs,
    extraCommandArgs: resolved.extraCommandArgs,
    logger: ctx.logger
  }), { prepend: true });
  ctx.on("tools/post-execute", createPostExecuteListener({
    activeRules: rulesForCall,
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
    const authorize = (request) => connectionOf(webCtx).requestRejection(request);
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: "exact",
        path: BROWSE_PATH,
        handler: createBrowseHandler({ authorize })
      }),
      "file-shield browse route"
    );
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: "exact",
        path: STATE_PATH,
        handler: createStateHandler({
          authorize,
          read: () => currentTiers(),
          // 部署默认只读展示：面板要能回答"这条为什么不能删"。
          deployment: () => deploymentRules.map((rule) => rule.pattern),
          write: (next) => {
            writeTiers(next);
            tiersState = next;
            stateStamp = statesStamp();
            logRules();
          },
          logger: webCtx.logger
        })
      }),
      "file-shield state route"
    );
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: "exact",
        path: SESSION_PATH,
        handler: createSessionHandler({
          authorize,
          sessionInfo: (sessionId) => sessionCwd(webCtx, sessionId)
        })
      }),
      "file-shield session route"
    );
  });
  logRules();
}
export {
  Config,
  apply,
  inject,
  name
};
