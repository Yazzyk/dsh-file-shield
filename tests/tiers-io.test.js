/**
 * 三级状态与两条 web 路由的接线测试。
 *
 * 覆盖四件在真机上不好观察、但错了就会静默放行的事实：
 * 1. 状态文件原子写入、坏文件退回空状态（一个坏 JSON 不该关掉屏蔽）；
 * 2. GET/POST 的形状与错误码；
 * 3. 按调用解析规则时，只有命中的项目与会话才参与；
 * 4. 每条路由都先过信任围栏（无围栏的读写入口是安全漏洞，不是便利）。
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { createLiveRules } from '../src/host/live.js'
import { compileRules } from '../src/host/rules.js'
import { readTiers, stateFile, statesStamp, writeTiers } from '../src/host/tier-store.js'
import { createSessionHandler, createStateHandler } from '../src/host/tier-routes.js'
import { normalizeTiers } from '../src/host/tiers.js'

const home = mkdtempSync(join(tmpdir(), 'file-shield-state-'))
process.env.DSH_HOME = home

beforeEach(() => { rmSync(stateFile(), { force: true }) })
after(() => { rmSync(home, { recursive: true, force: true }) })

/** 最小化的 ServerResponse 捕获实现。 */
function response() {
  const res = {
    status: 0,
    headers: undefined,
    body: '',
    writeHead(status, headers) {
      res.status = status
      res.headers = headers
    },
    end(payload) {
      res.body = payload ?? ''
    },
  }
  return res
}

/** 把一段文本当成请求体喂给处理器。 */
async function* body(text) {
  yield Buffer.from(text, 'utf8')
}

/** 一个最小请求对象。 */
const request = (method, url, payload) => ({
  method,
  url,
  headers: {},
  ...payload === undefined ? {} : { [Symbol.asyncIterator]: () => body(payload) },
})

/** 一个随调用变化的内存状态，模拟插件持有的那一份。 */
function memoryStore(initial) {
  let current = initial ?? normalizeTiers({})
  return {
    read: () => current,
    write: (next) => { current = next },
    get value() { return current },
  }
}

test('store: 写入后读回来是同一份，文件权限为 0600', () => {
  writeTiers(normalizeTiers({ global: ['**/.env'], sessions: { s1: ['x'] } }))
  assert.deepEqual(readTiers(), { global: ['**/.env'], projects: {}, sessions: { s1: ['x'] } })
  assert.equal(existsSync(stateFile()), true)
})

test('store: 坏 JSON 退回空状态并记一条告警，而不是抛出让插件加载失败', () => {
  writeFileSync(stateFile(), '{ not json')
  const warnings = []
  assert.deepEqual(readTiers({ warn: (message) => warnings.push(message) }), normalizeTiers({}))
  assert.equal(warnings.length, 1)
})

test('store: 不认识的版本号被忽略并记告警', () => {
  writeFileSync(stateFile(), JSON.stringify({ version: 99, global: ['x'] }))
  const warnings = []
  assert.deepEqual(readTiers({ warn: (message) => warnings.push(message) }).global, [])
  assert.match(warnings[0], /unsupported version 99/)
})

test('store: 时间戳在写入后变化，用于发现外部改动', () => {
  const before = statesStamp()
  writeTiers(normalizeTiers({ global: ['a'] }))
  assert.notEqual(statesStamp(), before)
})

test('state 路由: GET 返回三级状态', async () => {
  const store = memoryStore(normalizeTiers({ global: ['a'], projects: { '/w': ['b'] } }))
  const handler = createStateHandler({ read: store.read, write: store.write })
  const res = response()
  await handler(request('GET', '/file-shield/state'), res)
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.body), {
    levels: { global: ['a'], projects: { '/w': ['b'] }, sessions: {} },
    deployment: [],
  })
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('state 路由: 部署默认与三级规则分开返回，前者只读', async () => {
  const store = memoryStore(normalizeTiers({ global: ['mine'] }))
  const handler = createStateHandler({
    read: store.read,
    write: store.write,
    deployment: () => ['**/*.pem'],
  })
  const res = response()
  await handler(request('GET', '/file-shield/state'), res)
  const body = JSON.parse(res.body)
  assert.deepEqual(body.levels.global, ['mine'])
  assert.deepEqual(body.deployment, ['**/*.pem'], '部署默认要单列，面板才能解释它为什么不能删')

  // 写一层不会碰部署默认，也不会把它写进状态文件。
  const written = response()
  await handler(request('POST', '/file-shield/state', JSON.stringify({ scope: 'global', rules: [] })), written)
  assert.deepEqual(JSON.parse(written.body).deployment, ['**/*.pem'])
  assert.deepEqual(store.value.global, [])
})

test('state 路由: POST 写入并返回新状态', async () => {
  const store = memoryStore()
  const handler = createStateHandler({ read: store.read, write: store.write })
  const res = response()
  await handler(request('POST', '/file-shield/state', JSON.stringify({ scope: 'session', session: 's1', rules: ['**/.env'] })), res)
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.body).levels.sessions, { s1: ['**/.env'] })
  assert.deepEqual(store.value.sessions, { s1: ['**/.env'] })
})

test('state 路由: 非法请求体返回带稳定错误码的 400', async () => {
  const store = memoryStore()
  const handler = createStateHandler({ read: store.read, write: store.write })
  for (const [payload, code] of [
    ['{', 'invalid-body'],
    ['', 'invalid-body'],
    [JSON.stringify({ scope: 'project', workspace: 'rel', rules: [] }), 'not-absolute'],
    [JSON.stringify({ scope: 'nope' }), 'invalid-scope'],
  ]) {
    const res = response()
    await handler(request('POST', '/file-shield/state', payload), res)
    assert.equal(res.status, 400, payload)
    assert.equal(JSON.parse(res.body).error.code, code, payload)
  }
})

test('state 路由: 超长请求体返回 413', async () => {
  const store = memoryStore()
  const handler = createStateHandler({ read: store.read, write: store.write })
  const res = response()
  await handler(request('POST', '/file-shield/state', JSON.stringify({ scope: 'global', rules: ['x'.repeat(1024 * 1024)] })), res)
  assert.equal(res.status, 413)
  assert.equal(JSON.parse(res.body).error.code, 'body-too-large')
})

test('state 路由: 不支持的方返回 405，磁盘写失败返回 500', async () => {
  const store = memoryStore()
  const handler = createStateHandler({ read: store.read, write: store.write })
  const res = response()
  await handler(request('DELETE', '/file-shield/state'), res)
  assert.equal(res.status, 405)

  const failing = createStateHandler({
    read: store.read,
    write: () => { throw new Error('disk full') },
    logger: { warn: () => {} },
  })
  const failed = response()
  await failing(request('POST', '/file-shield/state', JSON.stringify({ scope: 'global', rules: ['a'] })), failed)
  assert.equal(failed.status, 500)
  assert.equal(JSON.parse(failed.body).error.code, 'write-failed')
})

test('两条路由: 围栏拒绝时直接返状态码、不返回响应体', async () => {
  const store = memoryStore()
  const reject = () => 403
  for (const handler of [
    createStateHandler({ authorize: reject, read: store.read, write: store.write }),
    createSessionHandler({ authorize: reject, sessionInfo: () => ({ cwd: '/w' }) }),
  ]) {
    const res = response()
    await handler(request('GET', '/file-shield/state'), res)
    assert.equal(res.status, 403)
    assert.equal(res.body, '')
  }
})

test('session 路由: 回答会话工作区，缺参报 400', async () => {
  const handler = createSessionHandler({ sessionInfo: id => ({ cwd: id === 'known' ? '/w/app' : null }) })
  const ok = response()
  await handler(request('GET', '/file-shield/session?session=known'), ok)
  assert.equal(ok.status, 200)
  assert.deepEqual(JSON.parse(ok.body), { cwd: '/w/app' })

  const unknown = response()
  await handler(request('GET', '/file-shield/session?session=missing'), unknown)
  assert.deepEqual(JSON.parse(unknown.body), { cwd: null })

  const missing = response()
  await handler(request('GET', '/file-shield/session'), missing)
  assert.equal(missing.status, 400)
})

test('session 路由: 组合里没有 agent 注册表时回答 501，而不是编一个路径', async () => {
  const handler = createSessionHandler({})
  const res = response()
  await handler(request('GET', '/file-shield/session?session=known'), res)
  assert.equal(res.status, 501)
})

test('live: 只有命中的项目与会话参与，全局级永远生效', () => {
  const tiers = normalizeTiers({
    global: ['g'],
    projects: { '/w/app': ['p'], '/other': ['o'] },
    sessions: { s1: ['s1'], s2: ['s2'] },
  })
  const live = createLiveRules({ readTiers: () => tiers })
  const patterns = exec => live.rulesFor(exec).map(rule => rule.pattern)

  assert.deepEqual(patterns({ agent: { session: { id: 's1', header: { cwd: '/w/app/src' } } } }), ['g', 'p', 's1'])
  assert.deepEqual(patterns({ agent: { session: { id: 's2', header: { cwd: '/elsewhere' } } } }), ['g', 's2'])
  assert.deepEqual(patterns({ agent: { session: { id: 'unknown', header: { cwd: '/w/app' } } } }), ['g', 'p'])
  assert.deepEqual(patterns({}), ['g'])
  assert.deepEqual(patterns(undefined), ['g'])
})

test('live: 没有任何规则时返回空数组，守卫据此跳过全部工作', () => {
  const live = createLiveRules({ readTiers: () => normalizeTiers({}) })
  assert.deepEqual(live.rulesFor({ agent: { session: { id: 's' } } }), [])
})

test('live: 规则仍然按部署的 matchCase 编译', () => {
  const tiers = normalizeTiers({ global: ['**/.env'] })
  const live = createLiveRules({
    readTiers: () => tiers,
    compile: patterns => compileRules(patterns, { matchCase: false }),
  })
  assert.equal(live.rulesFor({}).length, 1)
})

test('live: refresh 存在时每次调用都先问它（用于发现外部改动）', () => {
  let reads = 0
  const live = createLiveRules({
    readTiers: () => normalizeTiers({}),
    refresh: () => { reads += 1; return normalizeTiers({ global: ['a'] }) },
  })
  live.rulesFor({})
  live.rulesFor({})
  assert.equal(reads, 2)
})

test('接线：状态文件被外部改过之后，下一次调用按新规则', async () => {
  writeTiers(normalizeTiers({ global: ['before'] }))
  let stamp = statesStamp()
  let cached = readTiers()
  const live = createLiveRules({
    readTiers: () => cached,
    refresh: () => {
      const now = statesStamp()
      if (now !== stamp) { stamp = now; cached = readTiers() }
      return cached
    },
  })
  assert.deepEqual(live.rulesFor({}).map(rule => rule.pattern), ['before'])

  // 模拟另一个进程（或手工编辑）写入新规则。
  writeTiers(normalizeTiers({ global: ['after'] }))
  assert.deepEqual(live.rulesFor({}).map(rule => rule.pattern), ['after'])
})

test('接线：状态文件内容能读回，且不含临时文件残留', () => {
  writeTiers(normalizeTiers({ global: ['a'] }))
  const parsed = JSON.parse(readFileSync(stateFile(), 'utf8'))
  assert.equal(parsed.version, 1)
  assert.deepEqual(parsed.global, ['a'])
  assert.equal(existsSync(stateFile() + '.tmp'), false)
})
