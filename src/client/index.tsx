/**
 * File Shield 的浏览器端：本 bundle 的 Plugins 页面上的规则编辑器。
 *
 * 页面以本包名注册进 `plugins.bundle.config`，
 * 这使页面出现在该 bundle 自己的卡片上。
 *
 * 页面的数据面是宿主 settings 服务为「本插件行」投影出的配置表单：行的 id 就是本 bundle
 * patch 声明的 `file-shield`，表单里的 `deny` 字段是宿主 schema 标成 volatile 的那一个。
 * 这个服务按机会性依赖读取：始终缺席只会让页面显示「不可用」，不会让本插件的 fiber
 * 一直等下去。
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
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import css from './page.css'
import { FileShieldPage, type FileShieldFace, type RulesSection } from './Page.tsx'
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
 * 注册页面。
 *
 * @param ctx - 浏览器端插件上下文。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'file-shield dictionaries')
  ctx.effect(() => injectStyles(), 'file-shield styles')

  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: BUNDLE,
    locale: NS,
    inject: (): FileShieldFace => ({
      form: rulesForm(ctx),
      pickDirectory: pickDirectoryOf(ctx),
    }),
  }, FileShieldPage))
}
