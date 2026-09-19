/**
 * 插件行配置：在加载时校验一次，绝不悄悄越过错误类型去取默认值。
 *
 * 空的 `deny` 列表是合法状态而非配置错误：规则列表通常由 Plugins 页面写入的
 * `file-shield` 设置命名空间拥有，刚安装的插件必须在加载时不自己发明规则。
 *
 * @module dsh-file-shield/src/host/config
 */

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

  if (!Array.isArray(deny)) throw new Error('file-shield: config.deny must be an array of strings')
  for (const entry of deny) {
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

  return { deny: [...deny], matchCase, guidance, extraPathArgs: resolvedExtra, extraCommandArgs: resolvedCommands }
}
