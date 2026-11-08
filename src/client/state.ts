/**
 * 三级屏蔽状态路由的浏览器端客户端。
 *
 * 三条路由都挂在 dsh 的 web server 上，与本页面同源，因此请求带
 * `same-origin` 凭据就能通过浏览路由的鉴权。失败一律折成带宿主错误码的
 * {@link StateError}：页面要把「被拒绝」和「没这条路由」分开显示，
 * 不能统一说成「保存失败」。
 *
 * 三级是**叠加**的：部署默认、全局、该项目、该会话同时生效，
 * 因此这里没有任何「覆盖」语义的字段或动作，写一层只动一层。
 *
 * @module dsh-file-shield/src/client/state
 */

/** 三级规则表。 */
export interface ShieldLevels {
  /** 全局层。 */
  readonly global: readonly string[]
  /** 项目层；键是工作区的绝对路径。 */
  readonly projects: Readonly<Record<string, readonly string[]>>
  /** 会话层；键是会话 id。 */
  readonly sessions: Readonly<Record<string, readonly string[]>>
}

/** 本宿主的 dsh 工作区：项目级规则的键取它的 `path`。 */
export interface ShieldWorkspace {
  readonly id: string
  readonly path: string
  /** 工作区标题；面板显示它而不是路径。 */
  readonly title: string
  /** 归属该工作区的会话数。 */
  readonly sessions: number
}

/** `GET` / `POST /file-shield/state` 的响应体。 */
export interface ShieldState {
  readonly levels: ShieldLevels
  /** 部署默认（插件行的 `config.deny`），只读展示。 */
  readonly deployment: readonly string[]
  /** dsh 工作区列表；组合里没有 workspace 包时为空。 */
  readonly workspaces: readonly ShieldWorkspace[]
}

/** `POST /file-shield/state` 的请求体：一次只写一层。 */
export type StateWrite =
  | { readonly scope: 'global', readonly rules: readonly string[] }
  | { readonly scope: 'project', readonly workspace: string, readonly rules: readonly string[] }
  | { readonly scope: 'session', readonly session: string, readonly rules: readonly string[] }

/** 状态路由的路径。 */
export const STATE_ENDPOINT = '/file-shield/state'

/** 会话工作区查询路由的路径。 */
export const SESSION_ENDPOINT = '/file-shield/session'

/** 携带宿主稳定错误码的状态失败。 */
export class StateError extends Error {
  /**
   * @param code - 宿主的失败码（invalid-body / invalid-scope / not-absolute / …）；
   *   响应不是 JSON 时为 `invalid-response`。
   * @param message - 诊断消息。
   */
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'StateError'
  }
}

/**
 * 把一个字段收窄成规则列表。
 *
 * 响应是宿主的投影，字段缺失或类型不符时宁可显示空列表，也不要让页面在
 * 渲染期崩掉——空列表至少还能让用户重新录入。
 *
 * @param value - 待收窄的字段。
 * @returns 只含字符串的数组。
 */
function ruleList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * 把 `projects` / `sessions` 收窄成路径（或会话 id）到规则列表的表。
 *
 * @param value - 待收窄的字段。
 * @returns 新的普通对象；同级条目同样逐条收窄。
 */
function ruleMap(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null) return {}
  const table: Record<string, string[]> = {}
  for (const [key, list] of Object.entries(value)) table[key] = ruleList(list)
  return table
}

/**
 * 把 `workspaces` 收窄成工作区列表。
 *
 * 缺字段或条目形状不对时返回空数组：面板据此显示"这个宿主没有工作区列表"，
 * 而不是让整页失败——项目级仍然可以手输路径。
 *
 * @param value - 待收窄的字段。
 * @returns 工作区列表。
 */
function workspaceList(value: unknown): ShieldWorkspace[] {
  if (!Array.isArray(value)) return []
  const list: ShieldWorkspace[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as { id?: unknown, path?: unknown, title?: unknown, sessions?: unknown }
    if (typeof record.path !== 'string' || record.path === '') continue
    list.push({
      id: typeof record.id === 'string' ? record.id : record.path,
      path: record.path,
      title: typeof record.title === 'string' && record.title !== '' ? record.title : record.path,
      sessions: typeof record.sessions === 'number' ? record.sessions : 0,
    })
  }
  return list
}

/**
 * 把一份响应整形成 {@link ShieldState}。
 *
 * @param payload - 已解析的响应体。
 * @returns 字段齐备的状态；缺失字段按空处理。
 */
function toState(payload: unknown): ShieldState {
  const root = (typeof payload === 'object' && payload !== null ? payload : {}) as {
    levels?: unknown
    deployment?: unknown
    workspaces?: unknown
  }
  const levels = (typeof root.levels === 'object' && root.levels !== null ? root.levels : {}) as {
    global?: unknown
    projects?: unknown
    sessions?: unknown
  }
  return {
    levels: {
      global: ruleList(levels.global),
      projects: ruleMap(levels.projects),
      sessions: ruleMap(levels.sessions),
    },
    deployment: ruleList(root.deployment),
    workspaces: workspaceList(root.workspaces),
  }
}

/**
 * 发一次请求并解析 JSON。
 *
 * @param url - 同源路由的相对路径。
 * @param init - fetch 参数（方法、请求体、信号）。
 * @returns 解析后的响应体。
 * @throws {StateError} 响应不是 JSON，或宿主以非 2xx 拒绝时。
 */
async function request(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    ...init,
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new StateError('invalid-response', `the state route answered ${response.status} without JSON`)
  }
  if (!response.ok) {
    const error = (payload as { error?: { code?: unknown, message?: unknown } } | null)?.error
    throw new StateError(
      typeof error?.code === 'string' ? error.code : 'unknown',
      typeof error?.message === 'string' ? error.message : `the state route answered ${response.status}`,
    )
  }
  return payload
}

/**
 * 读取三级规则与部署默认。
 *
 * @param signal - 用于取消已被取代的读取。
 * @returns 当前状态。
 * @throws {StateError} 宿主拒绝时。
 */
export async function readState(signal?: AbortSignal): Promise<ShieldState> {
  return toState(await request(STATE_ENDPOINT, { signal }))
}

/**
 * 写入某一层的规则。
 *
 * 整个请求体只有一层，因此写全局不会碰项目与会话，反之亦然。
 *
 * @param body - 目标层与新的规则列表。
 * @param signal - 用于取消已被取代的写入。
 * @returns 写入后的整份状态（与 GET 同构）。
 * @throws {StateError} 宿主拒绝时（400 的 code 指出是请求体还是规则的问题）。
 */
export async function writeState(body: StateWrite, signal?: AbortSignal): Promise<ShieldState> {
  return toState(await request(STATE_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

/**
 * 查询一个会话的工作区绝对路径。
 *
 * 只用于展示：宿主没有记录该会话（或这条路由缺席）时返回 null，
 * 让对话框显示「未知」而不是整块失败。
 *
 * @param session - 会话 id。
 * @param signal - 用于取消已被取代的查询。
 * @returns 工作区绝对路径，或 null。
 * @throws {StateError} 宿主以非 2xx 拒绝时。
 */
export async function readSessionCwd(session: string, signal?: AbortSignal): Promise<string | null> {
  const payload = await request(`${SESSION_ENDPOINT}?session=${encodeURIComponent(session)}`, { signal })
  const cwd = (payload as { cwd?: unknown } | null)?.cwd
  return typeof cwd === 'string' ? cwd : null
}
