/**
 * 本插件依赖的宿主 service 声明，只以类型方式引入。
 * 构建出的宿主面不会 import 其中任何一个包；它们存在的意义是让 `tsc`
 * 按真实 service 契约检查本插件。
 *
 * @module dsh-file-shield/src/host/services
 */

import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-host-webserver'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * loader 在不重启插件的前提下提交了一个 volatile 配置引用。
     *
     * 事件由 `@deepseek-ai/cordis-plugin-loader` 在拥有它的 fiber 上发出，官方宿主包
     * 目前没有为它提供声明，所以这里按实际负载补上：已提交字段的路径列表。
     *
     * @param paths - 已提交的 volatile 字段路径；本插件只关心 `deny`。
     */
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}
