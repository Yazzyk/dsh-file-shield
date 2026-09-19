/**
 * 本插件依赖的宿主 service 声明，只以类型方式引入。
 * 构建出的宿主面不会 import 其中任何一个包；它们存在的意义是让 `tsc`
 * 按真实 service 契约检查本插件。
 *
 * @module dsh-file-shield/src/host/services
 */

import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-host-webserver'
