/**
 * File Shield：拒绝目标路径命中部署规则的模型工具调用，并让被屏蔽路径不出现在搜索
 * 结果里。
 *
 * 规则有三个来源，**叠加生效**（取并集，高层不覆盖底层——屏蔽只做加法才安全）：
 *
 * 1. **部署默认**：插件行的 `config.deny`。组合层是本 bundle 自己 patch 里的默认值，用户层
 *    由 Plugins 页面写进 profile patch 的同一个字段；
 * 2. **三级规则**：全局 / 项目（以工作区绝对路径为键）/ 会话（以会话 id 为键），由侧边栏的
 *    面板与会话顶部的盾牌按钮维护，落在 `$DSH_HOME/state/dsh-file-shield/tiers.json`。
 *
 * 两者不重复：部署默认属于"这一层组合"，随 profile 一起分发；三级规则属于**使用者的数据**，
 * 键是工作区路径与会话 id，会随会话增删，所以不放进 settings 命名空间。
 *
 * `deny` 是 volatile 字段，因此那条写入只更新 loader 持有的配置引用，不会重启本插件；本
 * 插件监听 `loader/volatile-update` 后重新编译匹配器，所以页面上保存的规则对下一次工具
 * 调用立即生效。其余行字段属于组合决策，不是 volatile，Plugins 页面看不到它们。
 *
 * 本插件不拥有任何 service。它注册一个 pre-execute 决策、一个 post-execute 结果
 * 过滤器、一个可选的系统提示段落，以及——只在同时装配了 web server 与 connection
 * 信任围栏时——面板所需的三条路由：只读目录浏览、三级规则读写、会话工作区查询。
 *
 * @module dsh-file-shield
 */

import z from '@deepseek-ai/schemastery'
import { BROWSE_PATH, createBrowseHandler } from './browse.js'
import { readConfigField, resolveConfig } from './config.js'
import { createPreExecuteListener } from './guard.js'
import { createLiveRules } from './live.js'
import { createPostExecuteListener } from './results.js'
import { compileRules } from './rules.js'
import { readTiers, statesStamp, writeTiers } from './tier-store.js'
import { createSessionHandler, createStateHandler, SESSION_PATH, STATE_PATH } from './tier-routes.js'

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
 * 一个会话的工作区绝对路径。
 *
 * 浏览器端只拿得到会话 id（会话头部那排按钮的注入参数就是它），而项目级规则的键是工作区
 * 路径——这一跳只能由宿主补上。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
 * @param {string} sessionId - 会话 id。
 * @returns {{ cwd: string | null }} 工作区；会话不在此宿主内时为 null。
 */
function sessionCwd(ctx, sessionId) {
  // HTTP 处理与定时器跑在「非活跃上下文」里，直接读 `ctx.agents` 会抛
  // `cannot get required service "agents" in inactive context`；`ctx.get()` 不抛。
  const agents = typeof ctx.get === 'function' ? ctx.get('agents') : undefined
  // agents.get 的形参是品牌化的 SessionId；这里拿到的是 URL 查询串里的普通字符串。
  // 一个不存在的 id 只会得到 undefined，而"这个会话在不在本宿主里"正是本函数要回答的。
  const lookup = agents !== undefined && typeof agents.get === 'function'
    ? /** @type {(id: string) => any} */ (agents.get.bind(agents))
    : undefined
  const agent = lookup === undefined ? undefined : lookup(sessionId)
  const cwd = agent?.session?.header?.cwd
  return { cwd: typeof cwd === 'string' ? cwd : null }
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

  /** 部署默认编译后的匹配器；只在 loader 提交变更后重建。 */
  let deploymentRules = compile(liveDeny())

  /**
   * 三级状态：文件读不出来时退回空状态（一个坏 JSON 不该关掉屏蔽）。
   * 用"文件时间戳变了才重读"来发现外部改动，避免每次工具调用都读盘。
   */
  let stateStamp = statesStamp()
  let tiersState = readTiers(ctx.logger)

  /**
   * 三级状态的当前值；状态文件被外部改过时先重读。
   * @returns {import('./tiers.js').Tiers} 当前状态。
   */
  const currentTiers = () => {
    const stamp = statesStamp()
    if (stamp !== stateStamp) {
      stateStamp = stamp
      tiersState = readTiers(ctx.logger)
    }
    return tiersState
  }

  /** 三级规则按调用现算的匹配器。 */
  const liveTiers = createLiveRules({ readTiers: currentTiers })

  /**
   * 记录当前生效的规则数量。屏蔽规则本身不写进日志，数量足够诊断。
   * @returns {void}
   */
  const logRules = () => {
    const tiers = currentTiers()
    const projects = Object.keys(tiers.projects).length
    const sessions = Object.keys(tiers.sessions).length
    if (deploymentRules.length === 0 && tiers.global.length === 0 && projects === 0 && sessions === 0) {
      ctx.logger.info('file-shield: no rule configured yet; add paths on the panel or set config.deny')
      return
    }
    ctx.logger.info(
      `file-shield: ${deploymentRules.length} deployment rule(s) + ${tiers.global.length} global, `
      + `${projects} project tier(s), ${sessions} session tier(s) active`,
    )
  }

  // 规则列表是 volatile 字段：Plugins 页面保存时 loader 只提交这个引用，不重启插件，
  // 所以在这里重建匹配器，让新规则对下一次工具调用生效。
  ctx.on('loader/volatile-update', () => {
    deploymentRules = compile(liveDeny())
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

  /**
   * 一次调用要用的全部规则：部署默认 + 该调用命中的三级规则。
   *
   * 三级规则按调用现算而不是保存时合并：生效范围本身就是调用的一部分（同一 agent 在不同
   * 会话、或同一会话换了工作区，命中的项目规则不同），保存时合并只能得到"最后一次保存时的
   * 那份"。代价只是一次数组拼接。
   *
   * @param {any} exec - 待执行的工具调用。
   * @returns {import('./rules.js').Rule[]} 这次调用要用的规则。
   */
  const rulesForCall = exec => {
    const tiers = liveTiers.rulesFor(exec)
    return tiers.length === 0 ? deploymentRules : [...deploymentRules, ...tiers]
  }

  // 前置注册，使规则在本插件要拒绝的调用上先于审批请求或任何其它策略监听器做出决定。
  ctx.on('tools/pre-execute', createPreExecuteListener({
    activeRules: rulesForCall,
    resolveTarget,
    extraPathArgs: resolved.extraPathArgs,
    extraCommandArgs: resolved.extraCommandArgs,
    logger: ctx.logger,
  }), { prepend: true })

  // 前置注册，使委托先到达后面每一个监听器，再由本过滤器改写它们最终确定的值。
  ctx.on('tools/post-execute', createPostExecuteListener({
    activeRules: rulesForCall,
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

  // 这三条路由分别会列目录、读写规则、回答会话工作区，都是暴露宿主信息的面，因此只在组合的
  // connection 信任围栏可用、能对它把关时才挂载；没有该围栏时面板保持不可用，而不是开放
  // 未认证的读写入口。
  ctx.inject(['webServer', 'connection'], (webCtx) => {
    /** @param {{ readonly headers: import('node:http').IncomingMessage['headers'] }} request */
    const authorize = request => connectionOf(webCtx).requestRejection(request)

    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'exact',
        path: BROWSE_PATH,
        handler: createBrowseHandler({ authorize }),
      }),
      'file-shield browse route',
    )

    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'exact',
        path: STATE_PATH,
        handler: createStateHandler({
          authorize,
          read: () => currentTiers(),
          // 部署默认只读展示：面板要能回答"这条为什么不能删"。
          deployment: () => deploymentRules.map(rule => rule.pattern),
          write: (next) => {
            writeTiers(next)
            // 写成功立刻把内存态与文件对齐：不然在那之后、下一次时间戳变化之前，工具调用还会
            // 按旧规则放行，而页面已经显示"已保存"。
            tiersState = next
            stateStamp = statesStamp()
            logRules()
          },
          logger: webCtx.logger,
        }),
      }),
      'file-shield state route',
    )

    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'exact',
        path: SESSION_PATH,
        handler: createSessionHandler({
          authorize,
          sessionInfo: sessionId => sessionCwd(webCtx, sessionId),
        }),
      }),
      'file-shield session route',
    )
  })

  logRules()
}
