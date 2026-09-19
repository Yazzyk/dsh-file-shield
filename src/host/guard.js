/**
 * `tools/pre-execute` 决策：在工具主体执行之前拒绝目标路径命中规则的调用。
 *
 * 本插件无法解析的调用交给 `next()` 而不是拒绝：无法解析的路径是工具自己会拒绝的畸形
 * 参数，策略层不应发明自己的失败模式。
 *
 * @module dsh-file-shield/src/host/guard
 */

import { matchRule, relativesOf, spellingsOf } from './rules.js'
import { pathArgsFor, readPathArg, workspaceRoot } from './targets.js'
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
 * @property {Record<string, readonly string[]>} extraPathArgs - 部署登记的工具 → 参数名。
 * @property {{ debug: (message: string) => void }} [logger] - 诊断输出。
 */

/**
 * 创建 pre-execute 监听器。
 *
 * @param {GuardOptions} options - 规则来源、路径解析与诊断。
 * @returns {(exec: any, next: () => Promise<any>) => Promise<any>} 瀑布监听器。
 */
export function createPreExecuteListener(options) {
  const { activeRules, resolveTarget, extraPathArgs, logger } = options
  return async function guardPreExecute(exec, next) {
    const rules = activeRules()
    if (rules.length === 0) return next()
    const keys = pathArgsFor(exec.name, extraPathArgs)
    if (keys.length === 0) return next()
    const root = workspaceRoot(exec)
    for (const key of keys) {
      const requested = readPathArg(exec.arguments, key)
      if (requested === undefined) continue
      const target = await resolveTarget(requested, root, exec.signal)
      if (target === undefined) continue
      const rule = matchRule(rules, spellingsOf(target), relativesOf(root, target))
      if (rule === undefined) continue
      logger?.debug(`file-shield: denied ${exec.name} on "${target.displayPath}" by rule "${rule}"`)
      return blockedDecision(target.displayPath, rule)
    }
    return next()
  }
}
