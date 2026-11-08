/**
 * 用系统对话框选**单个文件**。
 *
 * 为什么不能直接用 `uiWorkspace.pickDirectory()`：那个接口只返回目录，没有"选一个文件"这一档。
 * 浏览器里唯一能开系统文件对话框的入口是 `<input type="file">`，它给出的是 `File` 对象——
 * 里面没有绝对路径。桌面应用为此在 preload 里装了一个窄桥 `__DSH_HOST_PATHS__.pathFor(file)`
 * （`webUtils.getPathForFile`），把 `File` 换回真实路径；dsh 自己的输入框接文件引用走的也是它。
 *
 * 所以在普通浏览器里这条路走不通：拿不到路径就没法写成一条屏蔽规则。此时返回 null，
 * 由调用方退回插件自带的只读浏览器——那条路在远程/纯 Web 部署里是唯一可用的。
 *
 * @module dsh-file-shield/src/client/pick
 */

/** Electron preload 暴露的真实路径桥；纯浏览器里不存在。 */
interface HostPathBridge {
  pathFor: (file: File) => string
}

/**
 * 读取宿主路径桥。
 *
 * 每读一次现取而不是模块级缓存：桌面壳可能在页面已经跑起来之后才注入它
 * （`dshDesktopBoot` 的时序由外壳决定），缓存住 undefined 会让第一次失败之后一直失败。
 *
 * @returns 桥，或 undefined。
 */
function hostPathBridge(): HostPathBridge | undefined {
  const bridge = (globalThis as { __DSH_HOST_PATHS__?: HostPathBridge }).__DSH_HOST_PATHS__
  return bridge !== undefined && typeof bridge.pathFor === 'function' ? bridge : undefined
}

/** 当前文档是否具备"从系统对话框拿到真实路径"的能力。 */
export function canPickFileWithSystemDialog(): boolean {
  return hostPathBridge() !== undefined
}

/**
 * 打开系统文件对话框，返回所选文件的绝对路径。
 *
 * @returns 绝对路径；取消、或这个文档拿不到真实路径时返回 null。
 */
export function pickFileWithSystemDialog(): Promise<string | null> {
  const bridge = hostPathBridge()
  if (bridge === undefined) return Promise.resolve(null)
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    // 多选会让"一条规则"变成多条，但用户点一次只想加一条；多选留给人自己再点一次。
    input.multiple = false
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.style.opacity = '0'
    let settled = false
    /** 只结算一次：change 之后可能还有 blur/cancel 之类的事件。 */
    const settle = (value: string | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(value)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      settle(file === undefined ? null : (bridge.pathFor(file) || null))
    })
    // 取消不会触发 change。现代浏览器给了 cancel 事件，没有它时靠窗口重新获得焦点兜底——
    // 不这么做的输入框会永远挂在 body 上，而 Promise 永不结算。
    input.addEventListener('cancel', () => { settle(null) })
    window.addEventListener('focus', () => {
      window.setTimeout(() => { if (!settled && input.files?.length === 0) settle(null) }, 500)
    }, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}
