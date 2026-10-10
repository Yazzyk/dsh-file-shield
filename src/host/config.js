/**
 * 插件行配置：在加载时校验一次，绝不悄悄越过错误类型去取默认值。
 *
 * 空的 `deny` 列表是合法状态而非配置错误：规则列表由 Plugins 页面写入 profile patch，
 * 刚安装的插件必须在加载时不自己发明规则。
 *
 * `deny` 在 schema 里是 volatile 字段，因此 loader 交给 `apply` 的值是一个共享引用；
 * 引用协议由 `@deepseek-ai/cosmokit` 用同一个 symbol 在所有副本间标识，这里只按协议读取，
 * 不 import 那个包。
 *
 * @module dsh-file-shield/src/host/config
 */

/** volatile 引用协议的写入口；`Symbol.for` 让不同副本共享同一个身份。 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/**
 * 判断一个已解析的配置值是否是 loader 的 volatile 引用。
 *
 * @param {unknown} value - 已解析的配置值。
 * @returns {boolean} 是引用时为 true。
 */
export function isVolatileRef(value) {
  return typeof value === 'object' && value !== null && VOLATILE_WRITE in value
}

/**
 * 读取一个配置字段的当前值：volatile 字段取引用里的快照，普通字段就是它自己。
 *
 * @param {unknown} value - `config` 上的一个字段。
 * @returns {unknown} 该字段当前的字面值。
 */
export function readConfigField(value) {
  if (!isVolatileRef(value)) return value
  return (/** @type {{ get: () => unknown }} */ (value)).get()
}

/**
 * @typedef {object} FileShieldConfig
 * @property {string[]} deny - 规则：glob 或字面路径。
 * @property {boolean} matchCase - 规则匹配是否区分大小写。
 * @property {boolean} guidance - 模型是否收到策略提示段落。
 * @property {Record<string, string[]>} extraPathArgs - 额外工具名 → 路径参数名。
 * @property {Record<string, string>} extraCommandArgs - 额外工具名 → shell 命令参数名。
 */

/**
 * 校验该行的 `config` 块。
 *
 * @param {unknown} config - 本插件行的 `config` 块；裸 insert 时不存在。
 * @returns {FileShieldConfig} 解析后的配置。
 * @throws {Error} 字段存在但类型错误时抛出。
 */
export function resolveConfig(config) {
  const source = config === undefined || config === null ? {} : config
  if (typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('file-shield: config must be a mapping')
  }
  const {
    deny = [], matchCase = false, guidance = true, extraPathArgs = {}, extraCommandArgs = {},
  } = /** @type {Record<string, unknown>} */ (source)
  const denyValue = readConfigField(deny)

  if (!Array.isArray(denyValue)) throw new Error('file-shield: config.deny must be an array of strings')
  for (const entry of denyValue) {
    if (typeof entry !== 'string') throw new Error('file-shield: config.deny must contain only strings')
  }
  if (typeof matchCase !== 'boolean') throw new Error('file-shield: config.matchCase must be a boolean')
  if (typeof guidance !== 'boolean') throw new Error('file-shield: config.guidance must be a boolean')
  if (typeof extraPathArgs !== 'object' || extraPathArgs === null || Array.isArray(extraPathArgs)) {
    throw new Error('file-shield: config.extraPathArgs must be a mapping of tool name to argument keys')
  }
  /** @type {Record<string, string[]>} */
  const resolvedExtra = {}
  for (const [tool, keys] of Object.entries(extraPathArgs)) {
    if (tool.trim() === '') throw new Error('file-shield: config.extraPathArgs keys must be tool names')
    if (!Array.isArray(keys) || keys.some(key => typeof key !== 'string' || key.trim() === '')) {
      throw new Error(`file-shield: config.extraPathArgs["${tool}"] must be an array of non-empty argument names`)
    }
    resolvedExtra[tool] = [...keys]
  }
  if (typeof extraCommandArgs !== 'object' || extraCommandArgs === null || Array.isArray(extraCommandArgs)) {
    throw new Error('file-shield: config.extraCommandArgs must be a mapping of tool name to one command argument key')
  }
  /** @type {Record<string, string>} */
  const resolvedCommands = {}
  for (const [tool, key] of Object.entries(extraCommandArgs)) {
    if (tool.trim() === '') throw new Error('file-shield: config.extraCommandArgs keys must be tool names')
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error(`file-shield: config.extraCommandArgs["${tool}"] must be a non-empty argument name`)
    }
    resolvedCommands[tool] = key
  }

  return { deny: [...denyValue], matchCase, guidance, extraPathArgs: resolvedExtra, extraCommandArgs: resolvedCommands }
}
