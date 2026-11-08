/**
 * 宿主面的接线测试：schema 里的 volatile 声明，以及 loader 提交新规则后守卫的行为。
 *
 * 这里用一个只记录监听器的假上下文，模拟 loader 在 profile patch 变更时走的
 * volatile-only 路径：写引用 + 发 `loader/volatile-update`，不重启插件。
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { Config, apply } from '../src/host/index.js'

// 三级规则读的是 $DSH_HOME 下的状态文件。测试必须把它指到一个临时目录，否则会读到（并
// 依赖）开发者本机真实的规则，那会让"空规则"这类断言随环境漂移。
const home = mkdtempSync(join(tmpdir(), 'file-shield-home-'))
process.env.DSH_HOME = home
after(() => { rmSync(home, { recursive: true, force: true }) })

/** volatile 引用协议的写入口，与 loader 用的是同一个 symbol。 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** 只保留本插件实际使用的宿主面：事件注册、service 注入与日志。 */
function harness() {
  const listeners = new Map()
  const info = []
  const ctx = {
    logger: { info: (message) => info.push(message), warn: () => {}, debug: () => {} },
    on: (name, listener) => { listeners.set(name, listener) },
    inject: () => {},
    effect: () => () => {},
    // 宿主面按需读取的服务：本插件只用 agents 回答"这个会话的工作区是哪"。
    get: () => undefined,
    fs: { resolve: async (path) => ({ targetKey: path, displayPath: path }) },
  }
  return { ctx, listeners, info }
}

const call = (name, args, cwd = '/ws') => ({
  name,
  arguments: args,
  signal: undefined,
  agent: { session: { header: { cwd } } },
})
const next = async () => ({ kind: 'allow' })

test('host: Config 把 deny 声明为 volatile 字段', () => {
  const parsed = Config({ deny: ['**/.env'] })
  assert.equal(typeof parsed.deny?.get, 'function', 'deny 必须是 volatile 引用，Plugins 页面才能写它')
  assert.deepEqual(parsed.deny.get(), ['**/.env'])
  assert.equal(Config({}).matchCase, false, '其余字段保持普通值')
})

test('host: loader 提交新的 volatile 规则后、不重启插件也按新规则拒绝', async () => {
  const parsed = Config({ deny: ['**/.env'] })
  const { ctx, listeners, info } = harness()
  apply(ctx, parsed)

  const guard = listeners.get('tools/pre-execute')
  assert.equal(typeof guard, 'function', 'apply 必须注册 pre-execute 决策')
  assert.equal((await guard(call('read', { file_path: '/ws/.env' }), next)).kind, 'deny')
  assert.equal((await guard(call('read', { file_path: '/ws/key.pem' }), next)).kind, 'allow')

  // loader 的 volatile-only 提交：写引用，再在拥有它的 fiber 上发事件。
  parsed.deny[VOLATILE_WRITE](['**/*.pem'])
  listeners.get('loader/volatile-update')([['deny']])

  assert.equal((await guard(call('read', { file_path: '/ws/.env' }), next)).kind, 'allow', '旧规则必须立刻失效')
  const decision = await guard(call('read', { file_path: '/ws/key.pem' }), next)
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.reason, 'Access to "/ws/key.pem" is blocked by deployment policy (rule "**/*.pem").')
  assert.equal(info.at(-1), 'file-shield: 1 deployment rule(s) + 0 global, 0 project tier(s), 0 session tier(s) active')
})

test('host: 直接以字面 config 调用 apply 时仍然按该列表工作', async () => {
  const { ctx, listeners } = harness()
  apply(ctx, { deny: ['**/.env'] })
  const guard = listeners.get('tools/pre-execute')
  assert.equal((await guard(call('read', { file_path: '/ws/.env' }), next)).kind, 'deny')
  assert.equal((await guard(call('read', { file_path: '/ws/key.pem' }), next)).kind, 'allow')
})
test('host: 三级规则按调用叠加，会话级只影响那一个会话', async () => {
  const { ctx, listeners } = harness()
  apply(ctx, { deny: ['**/*.pem'] })
  // 直接写状态文件，模拟面板保存后的状态（面板走的是同一份文件）。
  const { writeTiers } = await import('../src/host/tier-store.js')
  const { normalizeTiers } = await import('../src/host/tiers.js')
  writeTiers(normalizeTiers({
    global: ['**/.env'],
    projects: { '/ws/app': ['snapshot.csv'] },
    sessions: { mine: ['notes.md'] },
  }))

  const guard = listeners.get('tools/pre-execute')
  assert.equal((await guard(call('read', { file_path: '/ws/.env' }), next)).kind, 'deny', '全局级对所有会话生效')
  assert.equal((await guard(call('read', { file_path: '/ws/key.pem' }), next)).kind, 'deny', '部署默认没有被三级规则顶掉')

  const inProject = { name: 'read', arguments: { file_path: '/ws/app/snapshot.csv' }, signal: undefined, agent: { session: { id: 'mine', header: { cwd: '/ws/app' } } } }
  assert.equal((await guard(inProject, next)).kind, 'deny', '项目级只在命中的工作区里生效')

  const outside = { name: 'read', arguments: { file_path: '/ws/app/snapshot.csv' }, signal: undefined, agent: { session: { id: 'other', header: { cwd: '/ws/other' } } } }
  assert.equal((await guard(outside, next)).kind, 'allow', '别的项目里同一条规则不该生效')

  const sessionCall = { name: 'read', arguments: { file_path: '/ws/notes.md' }, signal: undefined, agent: { session: { id: 'mine', header: { cwd: '/ws' } } } }
  assert.equal((await guard(sessionCall, next)).kind, 'deny', '会话级只影响那个会话')
  const strangerCall = { name: 'read', arguments: { file_path: '/ws/notes.md' }, signal: undefined, agent: { session: { id: 'other', header: { cwd: '/ws' } } } }
  assert.equal((await guard(strangerCall, next)).kind, 'allow')
})

test('host: 搜索结果过滤同样吃三级规则', async () => {
  const { ctx, listeners } = harness()
  apply(ctx, { deny: [] })
  const { writeTiers } = await import('../src/host/tier-store.js')
  const { normalizeTiers } = await import('../src/host/tiers.js')
  writeTiers(normalizeTiers({ sessions: { mine: ['secret.env'] } }))

  const filter = listeners.get('tools/post-execute')
  const value = { matches: [{ path: 'secret.env', lineNumber: 1, line: 'TOKEN=1' }, { path: 'app.ts', lineNumber: 2, line: 'ok' }] }
  const exec = { name: 'grep', arguments: {}, signal: undefined, agent: { session: { id: 'mine', header: { cwd: '/ws' } } } }
  const decision = await filter(exec, { isError: false, value }, async () => ({ kind: 'accept', value }))
  assert.deepEqual(decision.value.matches, [{ path: 'app.ts', lineNumber: 2, line: 'ok' }])
})

test('host: 面板路由声明在 webServer + connection 之后，缺一个就一条都不挂载', () => {
  const { ctx } = harness()
  const injections = []
  const callbacks = []
  const registered = []
  ctx.inject = (deps, callback) => { injections.push(deps); callbacks.push(callback) }
  ctx.effect = () => () => {}
  apply(ctx, { deny: [] })

  assert.deepEqual(injections, [['systemPrompt'], ['webServer', 'connection']], '两条都是按服务可用性延迟的注入')
  assert.deepEqual(registered, [], '服务没就位时不该注册任何路由')

  // 让路由组真的跑一遍：三条路由都注册，且每条都以同一个信任围栏把关。
  const webCtx = {
    logger: ctx.logger,
    webServer: { register: (route) => { registered.push(route.path); return () => {} } },
    effect: (factory) => { factory(); return () => {} },
    connection: { requestRejection: () => 403 },
  }
  callbacks[1](webCtx)
  assert.deepEqual(registered, ['/file-shield/browse', '/file-shield/state', '/file-shield/session'])
})
