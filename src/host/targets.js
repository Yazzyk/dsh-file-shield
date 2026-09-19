/**
 * 每个面向模型的工具把要操作的路径放在哪里。
 *
 * 这张表是显式列出的，而不是“看起来像路径的每个字符串参数”：工具的参数会喂给策略，
 * 写错参数名要么拦下无关调用，要么静默漏掉真正的那个。部署自己新增的读取工具通过
 * `config.extraPathArgs` 登记。
 *
 * @module dsh-file-shield/src/host/targets
 */

/** 内置工具名 → 存放该工具读写路径的参数名。 */
export const TOOL_PATH_ARGS = Object.freeze({
  read: Object.freeze(['file_path']),
  read_image: Object.freeze(['file_path']),
  write: Object.freeze(['file_path']),
  edit: Object.freeze(['file_path']),
  str_replace_editor: Object.freeze(['path']),
  grep: Object.freeze(['path']),
  glob: Object.freeze(['path']),
})

/**
 * 一个工具要检查的全部参数名，内置的在前。
 *
 * @param {string} toolName - 被派发的工具名。
 * @param {Record<string, readonly string[]>} extraPathArgs - 部署登记的追加项。
 * @returns {string[]} 要检查的参数名；该工具不带路径时为空。
 */
export function pathArgsFor(toolName, extraPathArgs) {
  const builtin = /** @type {Record<string, readonly string[]>} */ (TOOL_PATH_ARGS)[toolName] ?? []
  const extra = extraPathArgs[toolName] ?? []
  return [...builtin, ...extra]
}

/**
 * 读取一个取值为路径的参数；缺失、非字符串或空白一律视为“未提供路径”。
 *
 * @param {unknown} args - 解析后的工具参数。
 * @param {string} key - 参数名。
 * @returns {string | undefined} 路径；该调用未提供时为 undefined。
 */
export function readPathArg(args, key) {
  if (typeof args !== 'object' || args === null) return undefined
  const value = /** @type {Record<string, unknown>} */ (args)[key]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * 工具解析相对路径所依据的会话工作区根。
 *
 * @param {{ agent?: { session?: { header?: { cwd?: string } } } }} exec - 工具执行。
 * @returns {string | undefined} 绝对的工作区根；没有 agent 的调用为 undefined。
 */
export function workspaceRoot(exec) {
  return exec?.agent?.session?.header?.cwd
}
