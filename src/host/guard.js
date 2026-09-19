/**
 * `tools/pre-execute` 决策：在工具主体执行之前拒绝目标路径命中规则的调用。
 *
 * 两条检查路径：
 *
 * 1. **路径参数**（`read`/`write`/`edit`/`grep`/`glob`/… 的路径参数）交给
 *    `ctx.fs.resolve()` 规范化后比对，符号链接与 `..` 别名都逃不掉。
 * 2. **命令参数**（`bash`/`pwsh` 的命令文本）按 {@link module:dsh-file-shield/src/host/commands}
 *    提取候选路径后比对。shell 工具不经过 `ctx.fs`，框架也没有暴露 shell/subprocess
 *    事件，所以命令文本检查是唯一能拦住 `cat` 这类读取的位置；它是尽力而为的静态
 *    检查，覆盖模型自然写出的形态，不覆盖刻意混淆。
 *
 * 本插件无法解析的调用交给 `next()` 而不是拒绝：无法解析的路径是工具自己会拒绝的畸形
 * 参数，策略层不应发明自己的失败模式。
 *
 * @module dsh-file-shield/src/host/guard
 */

import { isAbsolute, resolve } from 'node:path'
import { commandPaths } from './commands.js'
import { matchRule, relativesOf, spellingsOf } from './rules.js'
import { commandArgFor, pathArgsFor, readPathArg, WORKDIR_ARG, workspaceRoot } from './targets.js'

/** 拒绝时携带的错误身份，供重试层与 UI 层据此分流。 */
export const BLOCKED_ERROR = Object.freeze({
  name: 'FileAccessBlockedError',
  /**
   * 文件系统策略拒绝。刻意不用 `FS_SANDBOX_DENIED`：那个错误码会让模型用更宽的沙箱
   * 权限重试调用，而部署规则没有“更宽”可给。
   */
  code: 'FS_PERMISSION_DENIED',
})

/**
 * 构造被拦下的调用返回的拒绝。注册表把 reason 物化成面向模型的 `Error: <reason>`，
 * 并保留 `info` 作为结构化身份。
 *
 * @param {string} displayPath - 采用面向模型拼法的路径。
 * @param {string} rule - 命中的已配置规则。
 * @returns {{ kind: 'deny', reason: string, info: { name: string, code: string, reason: string } }} pre-execute 决策。
 */
export function blockedDecision(displayPath, rule) {
  return {
    kind: 'deny',
    reason: `Access to "${displayPath}" is blocked by deployment policy (rule "${rule}").`,
    info: { ...BLOCKED_ERROR, reason: rule },
  }
}

/**
 * @typedef {object} GuardOptions
 * @property {() => import('./rules.js').Rule[]} activeRules - 当前已编译的规则。
 * @property {(path: string, cwd: string | undefined, signal: AbortSignal | undefined) => Promise<import('./rules.js').TargetSpellings | undefined>} resolveTarget - 规范化一个模型给出的路径。
 * @property {Record<string, readonly string[]>} extraPathArgs - 部署登记的工具 → 路径参数名。
 * @property {Record<string, string>} extraCommandArgs - 部署登记的工具 → 命令参数名。
 * @property {{ debug: (message: string) => void }} [logger] - 诊断输出。
 */

/**
 * 检查一个路径型参数。
 *
 * @param {any} exec - 工具执行。
 * @param {readonly string[]} keys - 要检查的参数名。
 * @param {import('./rules.js').Rule[]} rules - 当前规则。
 * @param {GuardOptions} options - 解析器与诊断。
 * @param {string | undefined} root - 会话工作区。
 * @returns {Promise<{ displayPath: string, rule: string } | undefined>} 命中项。
 */
async function hitPathArgs(exec, keys, rules, options, root) {
  for (const key of keys) {
    const requested = readPathArg(exec.arguments, key)
    if (requested === undefined) continue
    const target = await options.resolveTarget(requested, root, exec.signal)
    if (target === undefined) continue
    const rule = matchRule(rules, spellingsOf(target), relativesOf(root, target))
    if (rule !== undefined) return { displayPath: target.displayPath, rule }
  }
  return undefined
}

/**
 * 检查一段 shell 命令文本。
 *
 * 先做字面子串检查：不含 glob 元字符的规则直接在命令原文里找它的写法，这样带空格或
 * 带引号的路径也能命中，不必依赖切词。再做候选路径检查：把命令切成词、跟随 `cd`、
 * 解析成绝对路径，逐个用同一套匹配器比对。
 *
 * @param {any} exec - 工具执行。
 * @param {string} command - 命令文本。
 * @param {import('./rules.js').Rule[]} rules - 当前规则。
 * @param {GuardOptions} options - 解析器与诊断。
 * @param {string | undefined} root - 会话工作区。
 * @returns {Promise<{ displayPath: string, rule: string } | undefined>} 命中项。
 */
async function hitCommand(exec, command, rules, options, root) {
  // 只对绝对规则做字面查找：一条相对规则可能只是一个短词（`data`），拿它在命令原文里
  // 做子串匹配会误伤 `grep data file` 这类调用。相对规则交给下面的候选路径匹配。
  for (const rule of rules) {
    if (rule.absolute && !rule.glob && command.includes(rule.pattern.trim())) {
      return { displayPath: rule.pattern, rule: rule.pattern }
    }
  }

  const workdir = readPathArg(exec.arguments, WORKDIR_ARG)
  const base = workdir === undefined
    ? (root ?? process.cwd())
    : (isAbsolute(workdir) ? workdir : resolve(root ?? process.cwd(), workdir))
  for (const candidate of commandPaths(command, base)) {
    const target = await options.resolveTarget(candidate, undefined, exec.signal)
    if (target === undefined) continue
    const relatives = [...relativesOf(root, target), ...relativesOf(base, target)]
    const rule = matchRule(rules, spellingsOf(target), relatives)
    if (rule !== undefined) return { displayPath: target.displayPath, rule }
  }
  return undefined
}

/**
 * 创建 pre-execute 监听器。
 *
 * @param {GuardOptions} options - 规则来源、路径解析与诊断。
 * @returns {(exec: any, next: () => Promise<any>) => Promise<any>} 瀑布监听器。
 */
export function createPreExecuteListener(options) {
  const { activeRules, extraPathArgs, extraCommandArgs, logger } = options
  return async function guardPreExecute(exec, next) {
    const rules = activeRules()
    if (rules.length === 0) return next()
    const root = workspaceRoot(exec)

    const pathHit = await hitPathArgs(exec, pathArgsFor(exec.name, extraPathArgs), rules, options, root)
    if (pathHit !== undefined) {
      logger?.debug(`file-shield: denied ${exec.name} on "${pathHit.displayPath}" by rule "${pathHit.rule}"`)
      return blockedDecision(pathHit.displayPath, pathHit.rule)
    }

    const commandKey = commandArgFor(exec.name, extraCommandArgs)
    if (commandKey !== undefined) {
      const command = readPathArg(exec.arguments, commandKey)
      if (command !== undefined) {
        const commandHit = await hitCommand(exec, command, rules, options, root)
        if (commandHit !== undefined) {
          logger?.debug(`file-shield: denied ${exec.name} on "${commandHit.displayPath}" by rule "${commandHit.rule}"`)
          return blockedDecision(commandHit.displayPath, commandHit.rule)
        }
      }
    }

    return next()
  }
}
