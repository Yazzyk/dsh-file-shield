/**
 * 三级屏蔽规则的状态模型：全局 / 项目 / 会话。
 *
 * 为什么是三级而不是一层：部署默认（`config.deny`）只能由部署者改，而"哪些文件不该被这个
 * agent 读"在不同粒度上的答案不一样——`.env` 通配规则是全局的，某个仓库里的行情快照是项目级的，
 * 而一次会话里临时打开又不想被读到的东西只属于那次会话。
 *
 * 三级的语义是**叠加**：命中的规则取并集，会话级不覆盖全局级。理由是"屏蔽"这件事只做加法才
 * 安全——若高层能覆盖底层，一次手滑就能把部署策略整段关掉。
 *
 * 本模块只做纯计算与校验，读写磁盘由 {@link module:dsh-file-shield/src/host/tier-store} 负责，
 * 编译成匹配器由 {@link module:dsh-file-shield/src/host/tiers} 的 {@link createTierRules} 负责。
 *
 * @module dsh-file-shield/src/host/tiers
 */

import { toPosix } from './rules.js'

/** 单条规则的长度上限：规则是要进配置与 web 请求的文本，不该无限长。 */
const MAX_RULE_LENGTH = 4096

/** 每一级最多保留多少条规则：挡住误把整个文件粘进输入框的情形。 */
export const MAX_RULES_PER_LEVEL = 500

/** 一个三级状态里最多记住多少个项目 / 会话，避免状态文件无界增长。 */
export const MAX_LEVEL_KEYS = 200

/**
 * 带稳定错误码的校验失败。路由层把它映射成 400，测试直接断言 code。
 */
export class TierError extends Error {
  /**
   * @param {string} code - 稳定的错误码。
   * @param {string} message - 面向人的说明。
   */
  constructor(code, message) {
    super(message)
    this.name = 'TierError'
    this.code = code
  }
}

/**
 * @typedef {object} Tiers - 三级规则的字面状态。
 * @property {string[]} global - 对所有会话生效的规则。
 * @property {Record<string, string[]>} projects - 项目工作区绝对路径 → 只在该工作区内生效的规则。
 * @property {Record<string, string[]>} sessions - 会话 id → 只在该会话内生效的规则。
 */

/**
 * 空状态：新装插件就是这一份，它不预设任何规则。
 * @returns {Tiers} 空状态。
 */
export function emptyTiers() {
  return { global: [], projects: {}, sessions: {} }
}

/**
 * 校验并复制一份规则列表。
 *
 * @param {unknown} value - 待校验的值。
 * @param {string} where - 出错信息里的字段名。
 * @returns {string[]} 去掉首尾空白后的规则副本。
 * @throws {TierError} 不是字符串数组、条目为空或超长时。
 */
function cleanRules(value, where) {
  if (!Array.isArray(value)) throw new TierError('invalid-rules', `${where} must be an array of strings`)
  if (value.length > MAX_RULES_PER_LEVEL) {
    throw new TierError('too-many-rules', `${where} holds more than ${MAX_RULES_PER_LEVEL} rules`)
  }
  /** @type {string[]} */
  const rules = []
  for (const entry of value) {
    if (typeof entry !== 'string') throw new TierError('invalid-rules', `${where} must contain only strings`)
    const rule = entry.trim()
    if (rule === '') continue
    if ([...rule].length > MAX_RULE_LENGTH) {
      throw new TierError('rule-too-long', `${where} has a rule longer than ${MAX_RULE_LENGTH} characters`)
    }
    if (!rules.includes(rule)) rules.push(rule)
  }
  return rules
}

/**
 * 校验一个键（项目工作区或会话 id）。
 *
 * @param {unknown} value - 待校验的值。
 * @param {string} where - 出错信息里的字段名。
 * @param {boolean} absolute - 是否必须是绝对路径。
 * @returns {string} 去掉首尾空白的键。
 * @throws {TierError} 缺失、为空、或要求绝对路径却不是绝对路径时。
 */
function cleanKey(value, where, absolute) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TierError('invalid-scope', `${where} must be a non-empty string`)
  }
  const key = value.trim()
  if (absolute && !key.startsWith('/')) {
    throw new TierError('not-absolute', `${where} must be an absolute path, received "${key}"`)
  }
  return key
}

/**
 * 把一份来路不明的磁盘内容或请求体校验成 {@link Tiers}。
 *
 * 未知字段被丢弃而不是报错：状态文件可能被更高版本写过，读旧字段不该让插件加载失败。
 *
 * @param {unknown} raw - 磁盘内容或请求体。
 * @returns {Tiers} 校验后的状态。
 * @throws {TierError} 结构不合法时。
 */
export function normalizeTiers(raw) {
  const source = raw === undefined || raw === null ? {} : raw
  if (typeof source !== 'object' || Array.isArray(source)) {
    throw new TierError('invalid-body', 'the tier state must be a mapping')
  }
  const record = /** @type {Record<string, unknown>} */ (source)
  /** @type {Tiers} */
  const tiers = emptyTiers()
  tiers.global = cleanRules(record.global ?? [], 'global')
  for (const [field, target] of /** @type {const} */ ([['projects', tiers.projects], ['sessions', tiers.sessions]])) {
    const block = record[field] ?? {}
    if (typeof block !== 'object' || block === null || Array.isArray(block)) {
      throw new TierError('invalid-body', `${field} must be a mapping of key to rules`)
    }
    const entries = Object.entries(/** @type {Record<string, unknown>} */ (block))
    if (entries.length > MAX_LEVEL_KEYS) {
      throw new TierError('too-many-entries', `${field} holds more than ${MAX_LEVEL_KEYS} entries`)
    }
    for (const [key, value] of entries) {
      const rules = cleanRules(value, `${field}["${key}"]`)
      // 空列表等同于"这一级没有额外规则"：不落键，状态文件就不会堆满空壳。
      if (rules.length > 0) target[key] = rules
    }
  }
  return tiers
}

/**
 * 一次写入请求：设置某一级的规则列表，或（`rules: []` 时）删掉那一级的条目。
 * @typedef {{ scope: 'global', rules: string[] }
 *   | { scope: 'project', workspace: string, rules: string[] }
 *   | { scope: 'session', session: string, rules: string[] }} TierChange
 */

/**
 * 校验一次写入请求。
 *
 * @param {unknown} body - 已解析的 JSON 请求体。
 * @returns {TierChange} 校验后的变更。
 * @throws {TierError} 结构不合法时。
 */
export function parseChange(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new TierError('invalid-body', 'the change must be a mapping')
  }
  const record = /** @type {Record<string, unknown>} */ (body)
  const scope = record.scope
  if (scope === 'global') return { scope, rules: cleanRules(record.rules ?? [], 'rules') }
  if (scope === 'project') {
    return {
      scope,
      workspace: cleanKey(record.workspace, 'workspace', true),
      rules: cleanRules(record.rules ?? [], 'rules'),
    }
  }
  if (scope === 'session') {
    return {
      scope,
      session: cleanKey(record.session, 'session', false),
      rules: cleanRules(record.rules ?? [], 'rules'),
    }
  }
  throw new TierError('invalid-scope', 'scope must be one of global, project, session')
}

/**
 * 把一次变更应用到状态上，返回新状态（不改动入参）。
 *
 * @param {Tiers} tiers - 当前状态。
 * @param {TierChange} change - 已校验的变更。
 * @returns {Tiers} 新状态。
 */
export function applyChange(tiers, change) {
  /** @type {Tiers} */
  const next = {
    global: [...tiers.global],
    projects: Object.fromEntries(Object.entries(tiers.projects).map(([key, rules]) => [key, [...rules]])),
    sessions: Object.fromEntries(Object.entries(tiers.sessions).map(([key, rules]) => [key, [...rules]])),
  }
  if (change.scope === 'global') {
    next.global = [...change.rules]
    return next
  }
  const block = change.scope === 'project' ? next.projects : next.sessions
  const key = change.scope === 'project' ? change.workspace : change.session
  if (change.rules.length === 0) delete block[key]
  else {
    if (block[key] === undefined && Object.keys(block).length >= MAX_LEVEL_KEYS) {
      throw new TierError('too-many-entries', `at most ${MAX_LEVEL_KEYS} entries are kept per level`)
    }
    block[key] = [...change.rules]
  }
  return next
}

/**
 * 一个路径是否落在某个根之内（含根本身）。
 *
 * 大小写不敏感：macOS 与 Windows 的默认文件系统就是这样，区分大小写的比较会让
 * `/Users/Me/proj` 记录的项目规则在 `/Users/me/proj` 的会话里静默失效。
 *
 * @param {string} root - 绝对根路径。
 * @param {string} candidate - 待比较的绝对路径。
 * @returns {boolean} 落在根之内时为 true。
 */
export function isWithin(root, candidate) {
  const base = toPosix(root).replace(/\/+$/u, '').toLowerCase()
  const path = toPosix(candidate).replace(/\/+$/u, '').toLowerCase()
  if (base === '' || path === '') return false
  return path === base || path.startsWith(`${base}/`)
}

/**
 * 对一次工具调用生效的项目根：会话工作区落在其内的那些项目条目。
 *
 * @param {Tiers} tiers - 当前状态。
 * @param {string | undefined} workspace - 会话工作区。
 * @returns {string[]} 生效的项目根，按配置顺序。
 */
export function projectRootsFor(tiers, workspace) {
  if (workspace === undefined) return []
  return Object.keys(tiers.projects).filter(root => isWithin(root, workspace))
}
