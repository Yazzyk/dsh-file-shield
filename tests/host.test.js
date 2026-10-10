/**
 * 宿主面的接线测试：schema 里的 volatile 声明，以及 loader 提交新规则后守卫的行为。
 *
 * 这里用一个只记录监听器的假上下文，模拟 loader 在 profile patch 变更时走的
 * volatile-only 路径：写引用 + 发 `loader/volatile-update`，不重启插件。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Config, apply } from '../src/host/index.js'

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
  assert.equal(info.at(-1), 'file-shield: 1 rule(s) active')
})

test('host: 直接以字面 config 调用 apply 时仍然按该列表工作', async () => {
  const { ctx, listeners } = harness()
  apply(ctx, { deny: ['**/.env'] })
  const guard = listeners.get('tools/pre-execute')
  assert.equal((await guard(call('read', { file_path: '/ws/.env' }), next)).kind, 'deny')
  assert.equal((await guard(call('read', { file_path: '/ws/key.pem' }), next)).kind, 'allow')
})
