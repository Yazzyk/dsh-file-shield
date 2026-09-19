/**
 * File Shield 的浏览器端：本 bundle 的 Plugins 页面上的规则编辑器。
 *
 * 页面以本包名注册进 `plugins.bundle.config`，
 * 这使页面出现在该 bundle 自己的卡片上。
 * 页面渲染的一切都通过注册项的业务面注入，
 * 所以组件从不接触插件上下文。
 *
 * @module dsh-file-shield/src/client
 */

import type { Context } from '@deepseek-ai/cordis'
// 仅类型：提供 `ctx.slots`、`ctx.locale`、`ctx.uiWorkspace` 与
// `ctx.settingsScope` 声明，不产生运行时导入。
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import css from './page.css'
import { FileShieldPage, type FileShieldFace, type RulesSection } from './Page.tsx'
import { NS, en, zh } from './locales.ts'

/** 本包的名称，同时也是 Plugins 页面派发所用的 bundle 键。 */
const BUNDLE = 'dsh-file-shield'

/** 宿主端安装的设置命名空间。 */
const SETTINGS_NAMESPACE = 'file-shield'

/** 本插件等待的浏览器端服务。 */
export const inject = ['slots', 'settingsScope', 'locale']

/**
 * 每个 fiber 注入一次本插件的样式表，并打上插件 id 标记，
 * 使模块运行时可以认领并移除它。
 *
 * @returns 移除该 style 元素的清理函数。
 */
function injectStyles(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = BUNDLE
  tag.textContent = css
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

/**
 * 注册页面。
 *
 * @param ctx - 浏览器端插件上下文。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'file-shield dictionaries')
  ctx.effect(() => injectStyles(), 'file-shield styles')

  const scope = ctx.settingsScope.bind<RulesSection>({ namespace: SETTINGS_NAMESPACE })
  // 机会性读取：workspace UI 是可选的，缺失只意味着失去系统目录
  // 选择器（插件自带的浏览器仍然可用）。
  const workspace = ctx.get('uiWorkspace') as { pickDirectory: () => Promise<string | null> } | undefined

  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: BUNDLE,
    locale: NS,
    inject: (): FileShieldFace => ({
      scope,
      pickDirectory: workspace === undefined ? undefined : () => workspace.pickDirectory(),
    }),
  }, FileShieldPage))
}
