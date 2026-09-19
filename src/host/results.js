/**
 * `tools/post-execute` 过滤器：让被屏蔽路径不出现在搜索工具返回的结构化值里。
 *
 * 只要被屏蔽文件“可能”位于被搜索目录下就拒绝 `grep` 或 `glob`，会拒掉大半个工作区，
 * 因此这些调用照常执行，改为过滤它们的结构化结果。替换值（而不是渲染后的文本）让
 * 注册表用工具自己的 renderer 重新渲染，于是面向模型的文本与持久化的展示元数据保持
 * 一致，而本模块无需了解这两种格式。
 *
 * 条目被全部剔除的结果读起来就是“无匹配”。这与 ripgrep 对待被忽略文件的行为一致，
 * 也不会泄露被屏蔽文件是否存在。
 *
 * @module dsh-file-shield/src/host/results
 */

import { isAbsolute, posix } from 'node:path'
import { matchRule, relativesOf, spellingsOf, toPosix } from './rules.js'
import { workspaceRoot } from './targets.js'

/**
 * 值得过滤的结果结构：数组字段，以及如何读取单个条目的路径。
 * @type {Record<string, { key: string, pathOf: (entry: unknown) => string | undefined }>}
 */
const RESULT_FILTERS = Object.freeze({
  grep: {
    key: 'matches',
    pathOf: (entry) => {
      if (typeof entry !== 'object' || entry === null) return undefined
      const path = /** @type {{ path?: unknown }} */ (entry).path
      return typeof path === 'string' ? path : undefined
    },
  },
  glob: {
    key: 'paths',
    pathOf: (entry) => (typeof entry === 'string' ? entry : undefined),
  },
})

/**
 * 把一个模型给出的路径规范化为规则匹配所用的身份。
 * @typedef {(path: string, cwd: string | undefined, signal: AbortSignal | undefined) => Promise<import('./rules.js').TargetSpellings | undefined>} ResolveTarget
 */

/**
 * 规范化一个结果路径，并按调用缓存，使大结果不会重复做同一次文件系统解析。
 *
 * @param {string} requested - 搜索工具报告的路径。
 * @param {string} root - 搜索所运行的目录。
 * @param {ResolveTarget} resolveTarget - 规范化函数。
 * @param {Map<string, import('./rules.js').TargetSpellings>} cache - 按调用使用的解析缓存。
 * @param {AbortSignal | undefined} signal - 调用方的取消信号。
 * @returns {Promise<import('./rules.js').TargetSpellings>} 两种拼法；解析失败时只返回字面拼接得到的那一个。
 */
async function spellingsAt(requested, root, resolveTarget, cache, signal) {
  const joined = isAbsolute(requested) ? requested : posix.join(toPosix(root), toPosix(requested))
  const cached = cache.get(joined)
  if (cached !== undefined) return cached
  const target = await resolveTarget(joined, root, signal)
  const spellings = target ?? { canonical: joined, lexical: joined, displayPath: joined }
  cache.set(joined, spellings)
  return spellings
}

/**
 * @typedef {object} ResultFilterOptions
 * @property {() => import('./rules.js').Rule[]} activeRules - 当前已编译的规则。
 * @property {ResolveTarget} resolveTarget - 规范化一个已报告的路径。
 * @property {{ debug: (message: string) => void }} [logger] - 诊断输出。
 */

/**
 * 创建 post-execute 监听器。
 *
 * @param {ResultFilterOptions} options - 规则来源、路径解析与诊断。
 * @returns {(exec: any, result: any, next: () => Promise<any>) => Promise<any>} 瀑布监听器。
 */
export function createPostExecuteListener(options) {
  const { activeRules, resolveTarget, logger } = options
  return async function filterSearchResults(exec, result, next) {
    // 先委托：本监听器位于链首，因此它检查的决策是其它监听器已经确定下来的那个。
    const decision = await next()
    if (decision.kind !== 'accept') return decision
    const filter = RESULT_FILTERS[exec.name]
    if (filter === undefined) return decision
    // 另一个监听器替换了渲染后的文本；本过滤器只处理结构化值，不应改写不是它产生的
    // 渲染结果。
    if (Object.hasOwn(decision, 'content')) return decision

    const rules = activeRules()
    if (rules.length === 0) return decision
    const value = Object.hasOwn(decision, 'value') ? decision.value : (result.isError ? undefined : result.value)
    if (typeof value !== 'object' || value === null) return decision
    const entries = value[filter.key]
    if (!Array.isArray(entries) || entries.length === 0) return decision

    const root = workspaceRoot(exec) ?? process.cwd()
    const cache = new Map()
    const kept = []
    let removed = 0
    for (const entry of entries) {
      const requested = filter.pathOf(entry)
      if (requested === undefined) {
        kept.push(entry)
        continue
      }
      const absolute = await spellingsAt(requested, root, resolveTarget, cache, exec.signal)
      if (matchRule(rules, spellingsOf(absolute), relativesOf(root, absolute)) !== undefined) {
        removed += 1
        continue
      }
      kept.push(entry)
    }
    if (removed === 0) return decision
    logger?.debug(`file-shield: withheld ${removed} ${exec.name} result(s)`)
    return {
      kind: 'accept',
      value: { ...value, [filter.key]: kept },
      ...decision.additionalContexts === undefined ? {} : { additionalContexts: decision.additionalContexts },
    }
  }
}
