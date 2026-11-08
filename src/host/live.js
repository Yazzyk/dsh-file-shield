/**
 * 把三级状态编译成"某一次调用该用哪些规则"的解析器。
 *
 * 关键决定：**规则按调用现算，不是在保存时合并成一份**。理由是生效范围本身就是调用的一部分——
 * 同一个 agent 在不同会话里、或同一会话里换了工作区，生效的项目规则不同；保存时合并只能得到
 * "最后一次保存时的那份"。
 *
 * 现算的代价是每次工具调用多一次数组拼接，那比一次 JSON 解析便宜得多；而规则总数有人为上限
 * （见 `tiers.js`），所以这里不需要缓存。
 *
 * @module dsh-file-shield/src/host/live
 */

import { compileRules } from './rules.js'
import { projectRootsFor } from './tiers.js'

/**
 * @typedef {object} LiveOptions
 * @property {() => import('./tiers.js').Tiers} readTiers - 当前三级状态。
 * @property {(patterns: readonly string[]) => import('./rules.js').Rule[]} [compile] - 规则编译器，测试可替换。
 * @property {() => import('./tiers.js').Tiers} [refresh] - 发现状态文件被外部改过时先重读，返回最新状态。
 */

/**
 * 创建按调用解析的规则视图。
 *
 * @param {LiveOptions} options - 状态来源。
 * @returns {{ rulesFor: (exec: any) => import('./rules.js').Rule[] }} 解析器。
 */
export function createLiveRules(options) {
  const { readTiers, compile = patterns => compileRules(patterns), refresh } = options
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
      const tiers = refresh === undefined ? readTiers() : refresh()
      const workspace = exec?.agent?.session?.header?.cwd
      const sessionId = exec?.agent?.session?.id
      const patterns = [...tiers.global]
      for (const root of projectRootsFor(tiers, workspace)) {
        const rules = tiers.projects[root]
        if (rules !== undefined) patterns.push(...rules)
      }
      if (typeof sessionId === 'string' && tiers.sessions[sessionId] !== undefined) {
        patterns.push(...tiers.sessions[sessionId])
      }
      return patterns.length === 0 ? [] : compile(patterns)
    },
  }
}
