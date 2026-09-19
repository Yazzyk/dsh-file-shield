/**
 * Plugins 页面用来选取文件的只读目录浏览器。
 *
 * 宿主没有列出文件的 wire 方法：目录选择器能力只列目录，`workspaceFiles.list` 又限于
 * 单个会话工作区。因此选取文件需要这条路由。
 *
 * 这条路由只读取目录条目，别的什么都不做。它从不写入、从不创建、从不返回文件内容；
 * 只接受 GET，返回 `no-store`，报告符号链接时不会把它当作可自行进入的目录来跟随，
 * 只依据 `stat` 给出的解析结果。
 *
 * 由于它列举的是任意绝对目录，处理器在触碰文件系统之前会先向注入的 `authorize` 询问
 * 是否拒绝。调用方传入组合的 connection 信任围栏，它拒绝 Host/Origin 不是本服务器的
 * 请求（DNS rebinding、跨站），以及没有浏览器会话 Cookie 的请求。不传 `authorize`
 * 构造的处理器放行所有调用方，单元测试用的就是这种。
 *
 * @module dsh-file-shield/src/host/browse
 */

import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'

/** 这条路由占用的精确路径名。 */
export const BROWSE_PATH = '/file-shield/browse'

/** 完整结果上限：条目更多的层级会报告 `truncated`。 */
export const MAX_ENTRIES = 5000

/**
 * 读取 `path` 查询值，但不做表单解码，使文件名里的 `+` 得以保留。
 *
 * @param {string | undefined} url - 请求目标。
 * @returns {string | null | undefined} 解码后的路径；缺失时为 `null`，编码非法时为 undefined。
 */
function readPathQuery(url) {
  const separator = (url ?? '').indexOf('?')
  if (separator === -1) return null
  const query = (url ?? '').slice(separator + 1)
  if (query === '') return null
  for (const part of query.split('&')) {
    if (!part.startsWith('path=')) continue
    try {
      return decodeURIComponent(part.slice('path='.length))
    } catch {
      return undefined
    }
  }
  return null
}

/**
 * 写出一个 JSON 响应；每个响应都不可缓存且自描述。
 * @param {import('node:http').ServerResponse} response - 要写出的响应。
 * @param {number} status - HTTP 状态码。
 * @param {unknown} body - JSON 响应体。
 */
function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

/**
 * 把文件系统故障映射为浏览器报告的状态码与错误码。
 * @param {unknown} error - `readdir` 抛出的值。
 * @returns {{ status: number, code: string }} 状态码与稳定的错误码。
 */
function failureOf(error) {
  switch (/** @type {NodeJS.ErrnoException} */ (error)?.code) {
    case 'ENOENT': return { status: 404, code: 'not-found' }
    case 'ENOTDIR': return { status: 400, code: 'not-a-directory' }
    case 'EACCES':
    case 'EPERM': return { status: 403, code: 'permission-denied' }
    default: return { status: 500, code: 'io-error' }
  }
}

/**
 * 对一个目录条目归类，把符号链接解析为它指向的东西的种类。
 *
 * @param {string} parent - 被列举的目录。
 * @param {import('node:fs').Dirent} entry - 原始条目。
 * @returns {Promise<{ type: 'file' | 'directory' | 'other', symlink: boolean }>} 报告的种类。
 */
async function classify(parent, entry) {
  if (entry.isDirectory()) return { type: 'directory', symlink: false }
  if (entry.isFile()) return { type: 'file', symlink: false }
  if (!entry.isSymbolicLink()) return { type: 'other', symlink: false }
  try {
    const info = await stat(join(parent, entry.name))
    return { type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other', symlink: true }
  } catch {
    // 失效链接仍是用户可能想看到的条目，因此报告它而不是丢掉。
    return { type: 'other', symlink: true }
  }
}

/**
 * 创建路由处理器。
 *
 * @param {{ home?: string, authorize?: (request: import('node:http').IncomingMessage) => number | undefined }} [options] - 未给出 `path` 时列举的层级，以及每次列举前都会询问的信任围栏。
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>} 处理器。
 */
export function createBrowseHandler(options = {}) {
  const home = options.home ?? homedir()
  const authorize = options.authorize ?? (() => undefined)
  return async function browse(request, response) {
    const rejection = authorize(request)
    if (rejection !== undefined) {
      // 围栏自己决定状态码（401 未认证、403 来源不可信），并且不返回响应体，
      // 使被拒的调用方什么也学不到。
      response.writeHead(rejection, { 'cache-control': 'no-store' })
      response.end()
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: { code: 'method-not-allowed', message: `only GET is supported, received ${request.method ?? 'no method'}` } })
      return
    }
    const requested = readPathQuery(request.url)
    if (requested === undefined) {
      sendJson(response, 400, { error: { code: 'invalid-path', message: 'the path query is not valid percent-encoding' } })
      return
    }
    const target = requested === null ? home : requested
    if (!isAbsolute(target)) {
      sendJson(response, 400, { error: { code: 'not-absolute', message: `"${target}" is not an absolute path` } })
      return
    }

    let dirents
    try {
      dirents = await readdir(target, { withFileTypes: true })
    } catch (error) {
      const { status, code } = failureOf(error)
      sendJson(response, status, { error: { code, message: `cannot list "${target}"` } })
      return
    }

    const described = await Promise.all(dirents.map(async (entry) => ({
      name: entry.name,
      ...await classify(target, entry),
    })))
    described.sort((left, right) => {
      if (left.type !== right.type) {
        if (left.type === 'directory') return -1
        if (right.type === 'directory') return 1
      }
      return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    })

    const parent = dirname(target)
    sendJson(response, 200, {
      path: target,
      parent: parent === target ? null : parent,
      home,
      entries: described.slice(0, MAX_ENTRIES),
      truncated: described.length > MAX_ENTRIES,
    })
  }
}
