/**
 * 三级规则状态的持久化：一个小的 JSON 文件，原子替换。
 *
 * 为什么不用宿主 settings：settings 命名空间按"一个插件一份配置"投影，而这里的键是项目
 * 绝对路径与会话 id——是**数据**，不是配置项。放进去会让每次会话开合都写一份用户配置，
 * 也会让 Plugins 页面把几十个会话 id 当成可编辑字段渲染出来。
 *
 * 写入用"临时文件 + rename"：rename 在同一文件系统内是原子的，进程被杀在写一半时最多
 * 留下一个临时文件，不会让状态文件变成半截 JSON 而让插件下次加载失败。
 *
 * @module dsh-file-shield/src/host/tier-store
 */

import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { emptyTiers, normalizeTiers } from './tiers.js'

/** 状态文件的格式版本；将来改结构时用它识别旧文件。 */
const STATE_VERSION = 1

/**
 * 解析宿主数据根。与 dsh 自己的解析顺序一致：显式配置 > `$DSH_HOME` > `~/.dsh`。
 *
 * 这里不引 `@deepseek-ai/dsh-home-paths`：本插件只用一个子路径，为一次 `join` 引入一个包
 * 不值得；顺序照抄，空值当未设置（空白环境变量若被当成路径，会把状态写到当前目录）。
 *
 * @returns {string} 绝对的数据根。
 */
export function resolveHome() {
  const configured = process.env.DSH_HOME
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim()
  return join(homedir(), '.dsh')
}

/**
 * 状态文件的绝对路径。
 * @returns {string} `~/.dsh/state/dsh-file-shield/tiers.json`。
 */
export function stateFile() {
  return join(resolveHome(), 'state', 'dsh-file-shield', 'tiers.json')
}

/**
 * 读取状态。文件不存在、损坏或版本不认识时退回空状态并记一条诊断——
 * 一个坏文件不该让整个插件加载失败，那等于用一个 JSON 文件的错误关掉屏蔽。
 *
 * @param {{ warn?: (message: string) => void }} [logger] - 诊断输出。
 * @returns {import('./tiers.js').Tiers} 当前状态。
 */
export function readTiers(logger) {
  const file = stateFile()
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error)?.code !== 'ENOENT') {
      logger?.warn?.(`file-shield: cannot read ${file}: ${String(error)}`)
    }
    return emptyTiers()
  }
  try {
    const parsed = JSON.parse(raw)
    const version = parsed?.version ?? STATE_VERSION
    if (version !== STATE_VERSION) {
      logger?.warn?.(`file-shield: ignoring ${file}: unsupported version ${String(version)}`)
      return emptyTiers()
    }
    return normalizeTiers(parsed)
  } catch (error) {
    logger?.warn?.(`file-shield: ignoring ${file}: ${error instanceof Error ? error.message : String(error)}`)
    return emptyTiers()
  }
}

/**
 * 原子写入状态。
 *
 * @param {import('./tiers.js').Tiers} tiers - 要写入的状态。
 * @returns {void}
 * @throws {Error} 磁盘写入失败时（调用方据此向 UI 报 500，而不是假装保存成功）。
 */
export function writeTiers(tiers) {
  const file = stateFile()
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  const payload = JSON.stringify({ version: STATE_VERSION, ...tiers }, null, 2)
  try {
    writeFileSync(temporary, `${payload}\n`, { mode: 0o600 })
    renameSync(temporary, file)
  } catch (error) {
    try { rmSync(temporary, { force: true }) } catch {}
    throw error
  }
}

/**
 * 状态文件的修改时间，用于"文件被外部改过就重读"的廉价判断。
 *
 * 没有这一条，手工编辑状态文件（或另一个 dsh 进程写入）不会生效，而使用者会以为规则
 * 已经改了。用 mtime + size 而不是内容哈希：读到才算成本，这里只想发现"变了"。
 *
 * @returns {string} `${mtimeMs}:${size}`，文件不存在时为 `absent`。
 */
export function statesStamp() {
  try {
    const info = statSync(stateFile())
    return `${info.mtimeMs}:${info.size}`
  } catch {
    return 'absent'
  }
}
