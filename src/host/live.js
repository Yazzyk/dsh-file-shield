/**
 * 把三级状态编译成"某一次调用该用哪些规则"的解析器。
 *
 * 关键决定：**规则按调用现算，不是在保存时合并成一份**。理由是生效范围本身就是调用的一部分——
 * 同一个 agent 在不同会话里、或同一会话换了工作区，生效的项目规则不同；保存时合并只能得到
 * "最后一次保存时的那份"。
 *
 * 项目层的键是 **dsh Workspace 的路径**（dsh 自己规范化过的那一个），不是随手敲的目录：
 * "项目级"要表达的是"对 dsh 工作区里的某个项目生效"。所以会话属于哪个项目，优先看 dsh 的
 * Workspace 记录——workspace 的 path 是规范化的根，而会话的 cwd 可能只是它下面某个子目录；
 * 记录里没有这个会话时（脚本建的、或组合里没装 workspace 包）才退回 cwd 前缀匹配。
 *
 * 现算的代价是每次工具调用多一次数组拼接，那比一次 JSON 解析便宜得多；而规则总数有人为上限
 * （见 `tiers.js`），所以这里不需要缓存。
 *
 * @module dsh-file-shield/src/host/live
 */

import { compileRules } from './rules.js'
import { isWithin, projectRootsFor } from './tiers.js'

/**
 * @typedef {object} LiveOptions
 * @property {() => import('./tiers.js').Tiers} readTiers - 当前三级状态。
 * @property {(patterns: readonly string[]) => import('./rules.js').Rule[]} [compile] - 规则编译器，测试可替换。
 * @property {() => import('./tiers.js').Tiers} [refresh] - 发现状态文件被外部改过时先重读，返回最新状态。
 * @property {(exec: any) => string | undefined} [workspaceFor] - 该调用所属项目的根路径；缺省用会话 cwd。
 */

/**
 * 一次调用命中的项目根：既认 dsh 的工作区路径，也认它下面的子目录。
 *
 * 两者都算而不是二选一：屏蔽只做加法。dsh 把会话归到工作区 A、而 cwd 落在项目 B 之内时，
 * A 与 B 的规则同时生效。
 *
 * @param {import('./tiers.js').Tiers} tiers - 当前三级状态。
 * @param {any} exec - 待执行的工具调用。
 * @param {(exec: any) => string | undefined} workspaceFor - 该调用所属项目的根路径。
 * @returns {string[]} 命中的项目键。
 */
function rootsOf(tiers, exec, workspaceFor) {
  const roots = new Set(projectRootsFor(tiers, workspaceFor(exec)))
  const cwd = exec?.agent?.session?.header?.cwd
  if (typeof cwd === 'string') {
    for (const key of Object.keys(tiers.projects)) {
      if (isWithin(key, cwd)) roots.add(key)
    }
  }
  return [...roots]
}

/**
 * 创建按调用解析的规则视图。
 *
 * @param {LiveOptions} options - 状态来源与工作区解析。
 * @returns {{ rulesFor: (exec: any) => import('./rules.js').Rule[], rootsFor: (exec: any) => string[] }} 解析器。
 */
export function createLiveRules(options) {
  const {
    readTiers,
    compile = patterns => compileRules(patterns),
    refresh,
    workspaceFor = exec => exec?.agent?.session?.header?.cwd,
  } = options

  /** 每次调用只读一遍状态（refresh 可能是一次磁盘 stat），供下面两个查询共用。 */
  const read = () => (refresh === undefined ? readTiers() : refresh())

  return {
    /** @param {any} exec */
    rootsFor(exec) {
      return rootsOf(read(), exec, workspaceFor)
    },
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
      const tiers = read()
      const sessionId = exec?.agent?.session?.id
      const patterns = [...tiers.global]
      for (const root of rootsOf(tiers, exec, workspaceFor)) {
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
