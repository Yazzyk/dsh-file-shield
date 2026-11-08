/**
 * 把 dsh 的 Workspace 读成插件能用的形状。
 *
 * "项目级"屏蔽指的是**对 dsh 工作区里的某个项目生效**，所以这一层的键不应该是随手敲的
 * 路径，而应该是 dsh 自己的 Workspace：它有稳定 id、有标题、有归属的会话。
 *
 * 由此带来两件事：
 *
 * 1. 面板能列出真实存在的工作区（带标题），而不是让用户对着一个目录浏览器猜；
 * 2. 判定"这个会话属于哪个工作区"时以 **dsh 的记录**为准，cwd 前缀只是回退——
 *    工作区的 path 是 dsh 规范化过的，而会话的 cwd 可能只是它下面某个子目录。
 *
 * Registry 是机会性服务：组合里没有 `dsh-workspace` 时本模块的读取一律返回空，
 * 插件其余部分照常工作（项目层退化为按 cwd 前缀匹配）。
 *
 * @module dsh-file-shield/src/host/workspaces
 */

/**
 * @typedef {object} WorkspaceView
 * @property {string} id - dsh 的 Workspace id。
 * @property {string} path - 该工作区的绝对路径（dsh 已规范化）。
 * @property {string} title - 工作区标题，面板上显示它而不是路径。
 * @property {number} sessions - 归属该工作区的会话数。
 */

/**
 * 读取 Workspace Registry。
 *
 * HTTP 处理与定时器跑在「非活跃上下文」里，直接读 `ctx.workspaceRegistry` 会抛
 * `cannot get required service ... in inactive context`；`ctx.get()` 不抛。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
 * @returns {{ list: () => any[], get?: (id: string) => any } | undefined} registry，或 undefined。
 */
export function workspaceRegistryOf(ctx) {
  const registry = typeof ctx.get === 'function' ? ctx.get('workspaceRegistry') : undefined
  return registry !== undefined && typeof registry.list === 'function' ? registry : undefined
}

/**
 * 全部工作区，按 dsh 的注册顺序。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
 * @returns {WorkspaceView[]} 工作区列表；没有 registry 时为空。
 */
export function listWorkspaces(ctx) {
  const registry = workspaceRegistryOf(ctx)
  if (registry === undefined) return []
  try {
    return registry.list().map(entity => ({
      id: String(entity.id),
      path: String(entity.path),
      title: typeof entity.title === 'string' && entity.title !== '' ? entity.title : String(entity.path),
      sessions: Array.isArray(entity.sessionIds) ? entity.sessionIds.length : 0,
    }))
  } catch {
    // registry 正在 boot（domain 还没开）时 list() 会抛；那一刻没有工作区可答，不该让路由 500。
    return []
  }
}

/**
 * 一个会话所属的工作区。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
 * @param {string} sessionId - 会话 id。
 * @param {string | undefined} cwd - 该会话的工作区绝对路径，回退匹配用。
 * @returns {WorkspaceView | undefined} 归属的工作区。
 */
export function workspaceOfSession(ctx, sessionId, cwd) {
  const all = listWorkspaces(ctx)
  for (const workspace of all) {
    const registry = workspaceRegistryOf(ctx)
    const entity = registry?.get === undefined ? undefined : (() => {
      try { return registry.get(workspace.id) } catch { return undefined }
    })()
    const sessionIds = entity !== undefined && Array.isArray(entity.sessionIds) ? entity.sessionIds : []
    /** @param {unknown} id */
    const holds = (id) => String(id) === sessionId
    if (sessionIds.some(holds)) return workspace
  }
  if (cwd === undefined) return undefined
  // 回退：dsh 没记录这个会话（脚本创建的、或组合里没有 workspace 包）时按路径归属。
  return all.find(workspace => cwd === workspace.path || cwd.startsWith(workspace.path.replace(/\/+$/u, '') + '/'))
}
