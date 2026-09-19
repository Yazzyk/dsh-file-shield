/**
 * 插件只读浏览路由的浏览器端客户端。
 *
 * @module dsh-file-shield/src/client/api
 */

/** 所列一级目录中的一个条目。 */
export interface BrowseEntry {
  readonly name: string
  readonly type: 'file' | 'directory' | 'other'
  readonly symlink: boolean
}

/** 所列的一级目录。 */
export interface BrowseListing {
  readonly path: string
  readonly parent: string | null
  readonly home: string
  readonly entries: readonly BrowseEntry[]
  readonly truncated: boolean
}

/** 宿主插件注册的路由。 */
export const BROWSE_ENDPOINT = '/file-shield/browse'

/** 携带宿主稳定错误码的浏览失败。 */
export class BrowseError extends Error {
  /**
   * @param code - 宿主的失败码；响应不是 JSON 时为 `invalid-response`。
   * @param message - 诊断消息。
   */
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'BrowseError'
  }
}

/**
 * 列举宿主上的一级目录。
 *
 * @param path - 要列举的绝对目录；省略时列举宿主 home。
 * @param signal - 用于取消已被取代的列举。
 * @returns 所列的这一级。
 * @throws {BrowseError} 宿主拒绝，或响应不是一份列举结果时。
 */
export async function browse(path: string | undefined, signal: AbortSignal): Promise<BrowseListing> {
  const query = path === undefined ? '' : `?path=${encodeURIComponent(path)}`
  const response = await fetch(`${BROWSE_ENDPOINT}${query}`, {
    signal,
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new BrowseError('invalid-response', `the browse route answered ${response.status} without JSON`)
  }
  if (!response.ok) {
    const error = (payload as { error?: { code?: unknown, message?: unknown } } | null)?.error
    throw new BrowseError(
      typeof error?.code === 'string' ? error.code : 'unknown',
      typeof error?.message === 'string' ? error.message : `the browse route answered ${response.status}`,
    )
  }
  return payload as BrowseListing
}
