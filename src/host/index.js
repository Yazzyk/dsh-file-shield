/**
 * File Shield：拒绝目标路径命中部署规则的模型工具调用，并让被屏蔽路径不出现在搜索
 * 结果里。
 *
 * 规则列表住在插件行的 `config.deny`：组合层是本 bundle 自己 patch 里的默认值，用户层是
 * 由 Plugins 页面写进 profile patch 的同一个字段。
 *
 * `deny` 是 volatile 字段，因此那条写入只更新 loader 持有的配置引用，不会重启本插件；本
 * 插件监听 `loader/volatile-update` 后重新编译匹配器，所以页面上保存的规则对下一次工具
 * 调用立即生效。其余行字段属于组合决策，不是 volatile，Plugins 页面看不到它们。
 *
 * 本插件不拥有任何 service。它注册一个 pre-execute 决策、一个 post-execute 结果
 * 过滤器、一个可选的系统提示段落，以及——只在同时装配了 web server 与 connection
 * 信任围栏时——Plugins 页面选取文件所需的只读浏览器路由。
 *
 * @module dsh-file-shield
 */

import z from '@deepseek-ai/schemastery'
import { BROWSE_PATH, createBrowseHandler } from './browse.js'
import { readConfigField, resolveConfig } from './config.js'
import { createPreExecuteListener } from './guard.js'
import { createPostExecuteListener } from './results.js'
import { compileRules } from './rules.js'

/** loader 诊断使用的 Cordis 插件名。 */
export const name = 'file-shield'

/** 本插件读取的 service。`webServer`、`systemPrompt` 与 `connection` 均为可选。 */
export const inject = ['tools', 'fs']

/**
 * 插件行 config 的 schema。loader 按它校验该行，所以本插件读取的每个字段都必须出现在
 * 这里；对于绕过 loader 直接调用 `apply` 的调用方，`resolveConfig` 会再检查一遍取值。
 *
 * `deny` 标成 volatile：只有 volatile 字段能由 Plugins 页面编辑，也只有在 volatile
 * 路径上 loader 才会把变更提交进运行中的 fiber，而不是重启插件。
 */
export const Config = z.object({
  deny: z.array(z.string()).default([]).volatile(),
  matchCase: z.boolean().default(false),
  guidance: z.boolean().default(true),
  extraPathArgs: z.dict(z.array(z.string())).default({}),
  extraCommandArgs: z.dict(z.string()).default({}),
})

/**
 * 提示文本，其中不含任何已配置的规则：在这里写出被屏蔽路径等于在每次请求里泄露它。
 */
const GUIDANCE = 'Deployment policy blocks some paths from being read, searched, written, or edited. '
  + 'A blocked call returns an explicit policy error naming the path and the rule that matched it. '
  + 'Treat that error as final: do not retry the same path through another tool, do not read it with shell commands, '
  + 'and do not ask for contents you were refused.'

/**
 * 把未知的抛出值渲染成一行诊断信息。
 * @param {unknown} error - 抛出的值。
 * @returns {string} 单行描述。
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 本插件用到的 connection 信任面。宿主 `Context` 上没有 `connection` 的声明
 * （那是浏览器端 connection 包拥有的类型），所以这里就地声明所需的最小接口，
 * 与 `dsh-host-open-in-app` 的取法一致，避免为一个方法引入整包类型依赖。
 *
 * @typedef {object} ConnectionFence
 * @property {(request: { readonly headers: import('node:http').IncomingMessage['headers'] }) => 401 | 403 | undefined} requestRejection - 返回拒绝状态，或 undefined 放行。
 */

/**
 * 读取组合的 connection 服务。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 已确认挂载 connection 的上下文。
 * @returns {ConnectionFence} 信任围栏。
 */
function connectionOf(ctx) {
  return Reflect.get(ctx, 'connection')
}

/**
 * 注册守卫。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
 * @param {unknown} config - 本插件行的 `config` 块。
 */
export function apply(ctx, config) {
  const resolved = resolveConfig(config)
  /**
   * 按本次部署的大小写敏感性编译一个已配置的规则列表。
   * @param {readonly unknown[]} patterns - 要编译的规则。
   * @returns {import('./rules.js').Rule[]} 编译后的规则。
   */
  const compile = patterns => compileRules(patterns, { matchCase: resolved.matchCase })

  /**
   * 规则字段的当前值：loader 解析后它是 volatile 引用，直接调用 `apply` 时是字面数组。
   * @returns {readonly unknown[]} 最新规则列表。
   */
  const liveDeny = () => {
    const field = config === null || config === undefined
      ? undefined
      : (/** @type {{ deny?: unknown }} */ (config)).deny
    const value = readConfigField(field)
    return Array.isArray(value) ? value : []
  }

  /** 编译后的匹配器；每次提交变更后重建，工具调用读的就是它。 */
  let rules = compile(liveDeny())

  /**
   * 记录当前生效的规则数量。屏蔽规则本身不写进日志，数量足够诊断。
   * @returns {void}
   */
  const logRules = () => {
    if (rules.length === 0) {
      ctx.logger.info('file-shield: no rule configured yet; add paths on the plugin page or set config.deny')
    } else {
      ctx.logger.info(`file-shield: ${rules.length} rule(s) active`)
    }
  }

  // 规则列表是 volatile 字段：Plugins 页面保存时 loader 只提交这个引用，不重启插件，
  // 所以在这里重建匹配器，让新规则对下一次工具调用生效。
  ctx.on('loader/volatile-update', () => {
    rules = compile(liveDeny())
    logRules()
  })

  /**
   * 把模型给出的路径规范化为规则匹配所用的两种拼法。`targetKey` 是后端对同一文件的
   * 稳定身份，匹配时用它正是这个原因：诸如符号链接的别名会解析到同一个 key。
   * `displayPath` 是调用方写下的绝对路径，文件浏览器里选出的或手敲的规则就是这种
   * 拼法——在 macOS 上 `/tmp` 是指向 `/private/tmp` 的符号链接，两者不同，规则可能写成
   * 任一种。若后端的 key 不是路径形式，两种拼法都退回显示路径。
   *
   * @param {string} path - 模型给出的路径。
   * @param {string | undefined} cwd - 会话工作区，调用有时才有。
   * @param {AbortSignal | undefined} signal - 调用方的取消信号。
   * @returns {Promise<{ canonical: string, lexical: string, displayPath: string } | undefined>} 两种拼法；路径无法解析时为 undefined。
   */
  async function resolveTarget(path, cwd, signal) {
    try {
      const target = await ctx.fs.resolve(path, {
        ...cwd === undefined ? {} : { cwd },
        ...signal === undefined ? {} : { signal },
      })
      const key = String(target.targetKey)
      return {
        canonical: key === '' ? target.displayPath : key,
        lexical: target.displayPath,
        displayPath: target.displayPath,
      }
    } catch (error) {
      ctx.logger.debug(`file-shield: cannot resolve "${path}": ${messageOf(error)}`)
      return undefined
    }
  }

  // 前置注册，使规则在本插件要拒绝的调用上先于审批请求或任何其它策略监听器做出决定。
  ctx.on('tools/pre-execute', createPreExecuteListener({
    activeRules: () => rules,
    resolveTarget,
    extraPathArgs: resolved.extraPathArgs,
    extraCommandArgs: resolved.extraCommandArgs,
    logger: ctx.logger,
  }), { prepend: true })

  // 前置注册，使委托先到达后面每一个监听器，再由本过滤器改写它们最终确定的值。
  ctx.on('tools/post-execute', createPostExecuteListener({
    activeRules: () => rules,
    resolveTarget,
    logger: ctx.logger,
  }), { prepend: true })

  if (resolved.guidance) {
    ctx.inject(['systemPrompt'], (promptCtx) => {
      promptCtx.systemPrompt.section({
        name: 'file-shield:guidance',
        // 位于部署 persona（0）之后、每个工具段落（1000）之前。
        order: 50,
        interpolate: false,
        text: GUIDANCE,
      })
    })
  }

  // 浏览路由会列出任意绝对目录，因此只在组合的 connection 信任围栏可用、能对它把关时
  // 才挂载；没有该围栏时文件选择器保持不可用，而不是开放一个未认证的目录列举。
  ctx.inject(['webServer', 'connection'], (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'exact',
        path: BROWSE_PATH,
        handler: createBrowseHandler({
          authorize: request => connectionOf(webCtx).requestRejection(request),
        }),
      }),
      'file-shield browse route',
    )
  })

  logRules()
}
