/**
 * File Shield 的浏览器端：Plugins 卡片上的规则页、左侧面板里的三级配置窗口，
 * 以及会话顶部的会话级盾牌按钮。
 *
 * 三个入口共用同一份字典与本包的样式表：字典在 fiber 上注册一次，
 * 样式表注入一次并打上插件 id 标记，模块运行时据此认领与移除。
 *
 * Plugins 页面的数据面是宿主 settings 服务为「本插件行」投影出的配置表单：
 * 行的 id 就是本 bundle patch 声明的 `file-shield`，表单里的 `deny` 字段是
 * 宿主 schema 标成 volatile 的那一个。这个服务按机会性依赖读取：始终缺席只会
 * 让页面显示「不可用」，不会让本插件的 fiber 一直等下去。
 *
 * 三级配置窗口、会话的「屏蔽」标签页走插件自己的状态路由（见 `state.ts`），
 * 与 settings 表单无关：它们是两张不同的写入口，但读的是同一份生效规则。
 *
 * @module dsh-file-shield/src/client
 */

import type { Context } from '@deepseek-ai/cordis'
// 仅类型：提供 `ctx.slots`、`ctx.locale`、`ctx.uiWorkspace` 与 `ctx.configForms` 声明，
// 不产生运行时导入。
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
// 仅类型：声明 'main' 与 'conversation.view' 两个座位。
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { IconShieldOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './page.css'
import { FileShieldPage, type FileShieldFace, type RulesSection } from './Page.tsx'
import { LevelsPanel, type LevelsPanelFace } from './LevelsPanel.tsx'
import { SessionShieldView, type SessionShieldFace } from './SessionShield.tsx'
import { NS, en, zh } from './locales.ts'

/** 本包的名称，同时也是 Plugins 页面派发所用的 bundle 键。 */
const BUNDLE = 'dsh-file-shield'

/**
 * 本 bundle patch 声明的规则行 id。
 *
 * settings 服务按 profile 条目的 id 建立命名空间，而条目 id 就是 bundle patch 里那一行的
 * `id`，与官方插件（`locale`、`ui-conversation` 等）硬编码自己的行 id 是同一约定。
 */
const ENTRY_ID = 'file-shield'

/**
 * 左侧面板入口与它打开的主区页面共用的 id。
 *
 * 清单必须成对：`sidebar.panellist` 的 id 决定点哪一行，
 * `main` 的 key 决定那一行渲染谁；两者不同就会点出一个空面板。
 */
const PANEL_ID = 'file-shield'

/** 本插件等待的浏览器端服务。settings 按机会性依赖读取，因此不在这个列表里。 */
export const inject = ['slots', 'locale']

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
 * 读取本插件行的配置表单。
 *
 * 每次都从当前上下文取：settings 服务晚于本插件挂载时，页面在下一次渲染就能接上；
 * 部署里始终没有这个服务时返回 undefined，由页面显示「不可用」。
 *
 * @param ctx - 浏览器端插件上下文。
 * @returns 规则行的配置表单，或 undefined。
 */
function rulesForm(ctx: Context): ConfigForm<RulesSection> | undefined {
  return ctx.get('configForms')?.get<RulesSection>(ENTRY_ID)
}

/**
 * 读取系统目录选择器。
 *
 * 同样按渲染时机读取：workspace UI 是可选的，而且可能晚于本插件挂载；缺失只意味着
 * 失去系统目录选择器，插件自带的浏览器仍然可用。
 *
 * @param ctx - 浏览器端插件上下文。
 * @returns 打开官方目录选择器的函数，或 undefined。
 */
function pickDirectoryOf(ctx: Context): (() => Promise<string | null>) | undefined {
  const workspace = ctx.get('uiWorkspace')
  return workspace === undefined ? undefined : () => workspace.pickDirectory()
}

/**
 * 左侧面板列表里的盾牌图标。
 *
 * 面板行只借这个图标，标题与可访问名由注册项声明的 `label` 提供，
 * 因此这里不需要翻译。
 *
 * @param props.size - 面板行要求的方形边长。
 * @returns 与面板行同色的盾牌图标。
 */
function ShieldPanelIcon({ size }: { size: number }) {
  return <IconShieldOutlineRegular size={size} />
}

/**
 * 注册页面与两个新增入口。
 *
 * @param ctx - 浏览器端插件上下文。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'file-shield dictionaries')
  ctx.effect(() => injectStyles(), 'file-shield styles')
  // 面板行的 label 是读时才求值的 thunk，绑一次就能跟上语言切换。
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: BUNDLE,
    locale: NS,
    inject: (): FileShieldFace => ({
      form: rulesForm(ctx),
      pickDirectory: pickDirectoryOf(ctx),
    }),
  }, FileShieldPage))

  // 面板入口：主区页面与会话头部按钮都是 root/session 作用域，
  // 都不需要本插件自己声明子座位。
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: (): LevelsPanelFace => ({ pickDirectory: pickDirectoryOf(ctx) }),
  }, LevelsPanel))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 30,
    locale: NS,
    label: () => t('panel'),
  }, ShieldPanelIcon))

  // 会话级规则的入口是一个 **Conversation View**（与「对话」「轨迹」同级的那排标签），
  // 不是会话头部的图标按钮：那排标签才是"这一整段会话"的层级，按钮要先去发现它。
  // order 20 落在 chat(0) 与 trajectory(10) 之后、stats(40) 之前。
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'file-shield',
    order: 20,
    locale: NS,
    label: () => t('viewTab'),
    inject: (sessionId): SessionShieldFace => ({ sessionId }),
  }, SessionShieldView))
}
