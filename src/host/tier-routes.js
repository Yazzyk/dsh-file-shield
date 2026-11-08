/**
 * 三级规则的数据面：两条 web 路由，供浏览器端读写。
 *
 * 为什么走插件自己的路由而不是宿主 settings：三级状态里既有全局规则，也有以**项目绝对
 * 路径**和**会话 id**为键的条目。那是数据（会随会话增删），不是"一个插件的配置项"；放进
 * settings 会让 Plugins 页面把几十个会话 id 当成可编辑字段渲染出来，也会让每次会话开合都
 * 写一份用户配置。
 *
 * 两条路由都先过组合的 connection 信任围栏，和浏览路由同一套把关：围栏挡 DNS rebinding
 * 与跨站请求，浏览器会话 Cookie 挡未认证调用。没有围栏时整组路由不挂载，而不是开放一个
 * 未认证的读写入口。
 *
 * @module dsh-file-shield/src/host/tier-routes
 */

import { applyChange, parseChange, TierError } from './tiers.js'

/** 读写三级规则的精确路径。 */
export const STATE_PATH = '/file-shield/state'

/** 查会话工作区的精确路径。 */
export const SESSION_PATH = '/file-shield/session'

/** 请求体上限：规则是短文本，1 MiB 已经宽到足以挡住误把整个文件当规则提交的情形。 */
const MAX_BODY_BYTES = 1024 * 1024

/**
 * 写出一个 JSON 响应；每个响应都不可缓存。
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
 * 写出一个带稳定错误码的失败。
 * @param {import('node:http').ServerResponse} response - 要写出的响应。
 * @param {number} status - HTTP 状态码。
 * @param {string} code - 稳定错误码。
 * @param {string} message - 面向人的说明。
 */
function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } })
}

/**
 * 读取整个请求体并解析成 JSON。
 *
 * 超过上限时**不**继续读取：直接断开并把 413 报回去。继续读会让一个坏请求占住内存。
 *
 * @param {import('node:http').IncomingMessage} request - 请求。
 * @returns {Promise<unknown>} 解析后的 JSON。
 * @throws {TierError} 超限、非法 JSON 或空体时。
 */
async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      throw new TierError('body-too-large', `the request body exceeds ${MAX_BODY_BYTES} bytes`)
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') throw new TierError('invalid-body', 'the request body is empty')
  try {
    return JSON.parse(text)
  } catch {
    throw new TierError('invalid-body', 'the request body is not valid JSON')
  }
}

/**
 * 读取查询串里的一个参数，不做表单解码，使 `+` 之类的字符原样保留。
 * @param {string | undefined} url - 请求目标。
 * @param {string} name - 参数名。
 * @returns {string | null} 参数值；缺失时为 null。
 */
function readQuery(url, name) {
  const separator = (url ?? '').indexOf('?')
  if (separator === -1) return null
  for (const part of (url ?? '').slice(separator + 1).split('&')) {
    if (!part.startsWith(`${name}=`)) continue
    try {
      return decodeURIComponent(part.slice(name.length + 1))
    } catch {
      return null
    }
  }
  return null
}

/**
 * @param {import('node:http').IncomingMessage} request - 请求；围栏只看头，处理器不看别的。
 * @returns {number | undefined} 接受时 undefined。
 */
function acceptAll(request) {
  return undefined
}

/**
 * @typedef {object} TierRouteOptions
 * @property {(request: { readonly headers: import('node:http').IncomingMessage['headers'] }) => number | undefined} [authorize] - 信任围栏：返回拒绝状态，或 undefined 放行。
 * @property {() => import('./tiers.js').Tiers} [read] - 读取当前状态；只有状态路由需要。
 * @property {(tiers: import('./tiers.js').Tiers) => void} [write] - 持久化新状态；只有状态路由需要。
 * @property {() => readonly string[]} [deployment] - 部署默认（插件行的 `config.deny`），供面板只读展示。
 * @property {() => readonly { id: string, path: string, title: string, sessions: number }[]} [workspaces] - 本宿主的 dsh 工作区；面板据此让人挑"哪个项目"。
 * @property {(sessionId: string) => { cwd: string | null } } [sessionInfo] - 查会话工作区；缺省时路由回答 501。
 * @property {{ warn: (message: string) => void }} [logger] - 诊断输出。
 */

/**
 * 状态路由的应答形状：`{ levels, deployment }`。
 *
 * 把两级来源分开是有意的：`levels` 是使用者自己的规则（可写），`deployment` 是部署默认
 * （只读，由 profile patch 或 Plugins 页面管）。合成一个平铺的数组会让面板无法区分
 * "这条为什么不能删"，而那是这个页面最需要说清的一件事。
 *
 * @param {import('./tiers.js').Tiers} tiers - 三级状态。
 * @param {readonly string[]} deployment - 部署默认规则。
 * @param {readonly { id: string, path: string, title: string, sessions: number }[]} workspaces - 本宿主的 dsh 工作区。
 * @returns 应答体：三级状态、部署默认、以及可选的 dsh 工作区列表。
 */
function stateView(tiers, deployment, workspaces) {
  // workspaces 只在状态路由存在；它的缺省是空数组，面板据此知道"这个宿主没有工作区列表"。
  return { levels: tiers, deployment, workspaces }
}

/**
 * 创建 `/file-shield/state` 的处理器：GET 读，POST 写。
 *
 * @param {TierRouteOptions} options - 状态读写与围栏。
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>} 处理器。
 */
export function createStateHandler(options) {
  const { authorize = acceptAll, logger } = options
  // read / write 只有状态路由需要；缺了它们是组合错误，调用时立刻抛而不是静默返空。
  const read = options.read ?? (() => { throw new TierError('unsupported', 'this composition exposes no tier state') })
  const write = options.write ?? (() => { throw new TierError('unsupported', 'this composition exposes no tier state') })
  const deployment = options.deployment ?? (() => [])
  const workspaces = options.workspaces ?? (() => [])
  return async function stateRoute(request, response) {
    const rejection = authorize(request)
    if (rejection !== undefined) {
      response.writeHead(rejection, { 'cache-control': 'no-store' })
      response.end()
      return
    }
    if (request.method === 'GET') {
      sendJson(response, 200, stateView(read(), deployment(), workspaces()))
      return
    }
    if (request.method !== 'POST') {
      sendError(response, 405, 'method-not-allowed', `only GET and POST are supported, received ${request.method ?? 'no method'}`)
      return
    }
    try {
      const change = parseChange(await readJsonBody(request))
      const next = applyChange(read(), change)
      write(next)
      sendJson(response, 200, stateView(next, deployment(), workspaces()))
    } catch (error) {
      if (error instanceof TierError) {
        sendError(response, error.code === 'body-too-large' ? 413 : 400, error.code, error.message)
        return
      }
      logger?.warn(`file-shield: cannot save tier rules: ${error instanceof Error ? error.message : String(error)}`)
      sendError(response, 500, 'write-failed', 'the tier rules could not be saved')
    }
  }
}

/**
 * 创建 `/file-shield/session` 的处理器：给一个会话 id，回答它的工作区绝对路径。
 *
 * 浏览器端只能拿到会话 id（`conversation.session.header.utilities` 的注入参数就是它），
 * 而项目级规则的键是工作区路径——这一跳只能由宿主补上。
 *
 * @param {TierRouteOptions} options - 会话查询与围栏。
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>} 处理器。
 */
export function createSessionHandler(options) {
  const { authorize = acceptAll, sessionInfo } = options
  return async function sessionRoute(request, response) {
    const rejection = authorize(request)
    if (rejection !== undefined) {
      response.writeHead(rejection, { 'cache-control': 'no-store' })
      response.end()
      return
    }
    if (request.method !== 'GET') {
      sendError(response, 405, 'method-not-allowed', `only GET is supported, received ${request.method ?? 'no method'}`)
      return
    }
    if (sessionInfo === undefined) {
      sendError(response, 501, 'unsupported', 'this composition exposes no agent registry')
      return
    }
    const sessionId = readQuery(request.url, 'session')
    if (sessionId === null || sessionId.trim() === '') {
      sendError(response, 400, 'invalid-session', 'the session query is required')
      return
    }
    sendJson(response, 200, sessionInfo(sessionId.trim()))
  }
}
