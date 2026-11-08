/**
 * 构建产物的冒烟测试：`lib/index.js` 与 `lib/client.js` 都是**提交进仓库**的，
 * 所以"源码改了忘了重新构建"会以一个能加载、但行为是旧的包发出去。
 *
 * 这里对产物本身做最小但有意义的检查：
 *
 * - host 半：真起一个 http server，用真实请求打三条路由，并驱动 pre-execute 守卫；
 * - client 半：按 Web 模块加载器的握手喂进一个假 `__ModuleLoader__`，检查它注册了
 *   三个座位且名字正确（名字错了页面就是一片空白，而类型检查发现不了运行时注册）。
 *
 * 这些断言不碰浏览器：它们验证的是"包能被加载、接线是对的"，不是渲染效果。
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

const home = mkdtempSync(join(tmpdir(), 'file-shield-bundle-'))
process.env.DSH_HOME = home

const ROOT = new URL('..', import.meta.url)
const hostEntry = new URL('lib/index.js', ROOT).pathname
const clientEntry = new URL('lib/client.js', ROOT).pathname

/** 只保留插件实际使用的宿主面，并收集它挂到 webServer 上的路由。 */
function hostContext(options = {}) {
  const routes = []
  const listeners = new Map()
  const ctx = {
    logger: { info: () => {}, warn: () => {}, debug: () => {} },
    on: (name, listener) => { listeners.set(name, listener) },
    effect: () => () => {},
    get: () => options.agents,
    fs: { resolve: async path => ({ targetKey: path, displayPath: path }) },
    inject: (deps, callback) => {
      if (!deps.includes('webServer')) return
      callback({
        logger: ctx.logger,
        webServer: { register: route => { routes.push(route); return () => {} } },
        effect: (factory) => { factory(); return () => {} },
        connection: { requestRejection: options.reject ?? (() => undefined) },
      })
    },
  }
  return { ctx, routes, listeners }
}

/** 用收集到的路由起一个一次性服务器。 */
async function serve(routes) {
  const server = createServer((request, response) => {
    const path = (request.url ?? '').split('?')[0]
    for (const route of routes) {
      if (route.path === path) { void route.handler(request, response); return }
    }
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end('{"error":{"code":"not-found"}}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  return {
    base,
    close: () => new Promise(resolve => server.close(resolve)),
    async get(path) {
      const response = await fetch(base + path)
      return { status: response.status, body: await response.json().catch(() => null) }
    },
    async post(path, payload) {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return { status: response.status, body: await response.json().catch(() => null) }
    },
  }
}

let host
let http

before(async () => {
  host = hostContext()
  const plugin = await import(hostEntry)
  plugin.apply(host.ctx, { deny: ['**/*.pem'] })
  http = await serve(host.routes)
})

after(async () => {
  await http?.close()
  rmSync(home, { recursive: true, force: true })
})

test('产物: host 半挂上三条路由', () => {
  assert.deepEqual(
    host.routes.map(route => route.path).sort(),
    ['/file-shield/browse', '/file-shield/session', '/file-shield/state'],
  )
})

test('产物: GET /file-shield/state 返回三级状态与只读的部署默认', async () => {
  const { status, body } = await http.get('/file-shield/state')
  assert.equal(status, 200)
  assert.deepEqual(body.levels, { global: [], projects: {}, sessions: {} })
  assert.deepEqual(body.deployment, ['**/*.pem'], '部署默认单列，面板据此解释它为什么不能删')
})

test('产物: POST 写入后从磁盘读回来是同一份，错误请求带稳定错误码', async () => {
  const wrote = await http.post('/file-shield/state', { scope: 'session', session: 's1', rules: ['notes.md'] })
  assert.equal(wrote.status, 200)
  assert.deepEqual(wrote.body.levels.sessions, { s1: ['notes.md'] })

  const reread = await http.get('/file-shield/state')
  assert.deepEqual(reread.body.levels.sessions, { s1: ['notes.md'] })

  const bad = await http.post('/file-shield/state', { scope: 'project', workspace: 'relative', rules: [] })
  assert.equal(bad.status, 400)
  assert.equal(bad.body.error.code, 'not-absolute')
})

test('产物: 会话路由与浏览路由都在，且没有 agent 注册表时如实回答', async () => {
  const session = await http.get('/file-shield/session?session=s1')
  assert.equal(session.status, 200)
  assert.deepEqual(session.body, { cwd: null })

  const browse = await http.get('/file-shield/browse')
  assert.equal(browse.status, 200)
  assert.ok(Array.isArray(browse.body.entries))
})

test('产物: 围栏拒绝时路由返状态码且不返回响应体', async () => {
  const fenced = hostContext({ reject: () => 403 })
  const plugin = await import(hostEntry)
  plugin.apply(fenced.ctx, { deny: [] })
  const fencedHttp = await serve(fenced.routes)
  try {
    for (const path of ['/file-shield/state', '/file-shield/session?session=x', '/file-shield/browse']) {
      const response = await fetch(fencedHttp.base + path)
      assert.equal(response.status, 403, path)
      assert.equal(await response.text(), '', path)
    }
  } finally {
    await fencedHttp.close()
  }
})

test('产物: 部署默认与三级规则在守卫上按调用叠加', async () => {
  const guard = host.listeners.get('tools/pre-execute')
  assert.equal(typeof guard, 'function', '宿主半必须注册 pre-execute 决策')
  const next = async () => ({ kind: 'allow' })
  const call = (path, session) => ({
    name: 'read',
    arguments: { file_path: path },
    signal: undefined,
    agent: { session: { id: session, header: { cwd: '/ws' } } },
  })
  assert.equal((await guard(call('/ws/key.pem', 's1'), next)).kind, 'deny', '部署默认生效')
  assert.equal((await guard(call('/ws/notes.md', 's1'), next)).kind, 'deny', '会话级规则对该会话生效')
  assert.equal((await guard(call('/ws/notes.md', 'other'), next)).kind, 'allow', '别的会话不受影响')
})

test('产物: client 半按加载器握手注册三个座位，名字与清单成对', () => {
  const registrations = []
  const disposers = []
  // 产物是加载器脚本而不是模块：顶层直接调 `window.__ModuleLoader__.load({ id, factory })`，
  // 所以这里用一个沙箱把它当真脚本跑一遍，而不是 `import`。
  let factory
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: ({ id, factory: loaded }) => {
          assert.equal(id, 'dsh-file-shield', '包 id 必须是加载器编目的那个')
          factory = loaded
        },
      },
    },
    document: {
      createElement: () => ({ dataset: {}, textContent: '', remove: () => {} }),
      head: { appendChild: () => {} },
    },
    console,
    require: createRequire(clientEntry),
  }
  runInNewContext(readFileSync(clientEntry, 'utf8'), sandbox)
  assert.equal(typeof factory, 'function', '握手必须给出工厂函数')

  // 平台模块由浏览器外壳提供（产物把它们留成 external）：这里给最小替身，
  // 因为要检查的是**注册接线**，不是渲染。
  const stub = () => ({})
  const platformRequire = (id) => {
    if (id === 'react') return { useState: stub, useEffect: stub, useMemo: stub, useSyncExternalStore: stub }
    if (id === 'react/jsx-runtime') return { jsx: stub, jsxs: stub, Fragment: 'Fragment' }
    return new Proxy({}, { get: (_, key) => (key === 'default' ? stub : stub) })
  }
  const exports = factory(platformRequire)
  assert.equal(typeof exports.apply, 'function', '工厂必须导出 apply')

  // 每个套件都先注册字典与样式，再用 slots.inject 推迟到座位声明出现：
  // 真正的宿主只在对应的座位被别人声明之后才调那个工厂，这里直接立即调用它。
  const t = (key) => key
  const ctx = {
    effect: (factory) => { disposers.push(factory()); return () => {} },
    locale: { register: () => () => {}, bind: () => t },
    get: () => undefined,
    slots: {
      inject: (name, factory) => {
        assert.equal(typeof name, 'string')
        factory()
        return () => {}
      },
      register: (options) => { registrations.push(options); return () => {} },
    },
  }
  exports.apply(ctx)
  assert.deepEqual(
    registrations.map(entry => entry.name),
    ['plugins.bundle.config', 'main', 'sidebar.panellist', 'conversation.session.header.utilities'],
  )
  const panel = registrations[2]
  const main = registrations[1]
  assert.equal(panel.id, main.key, '侧边栏清单的 id 必须与主区页面的 key 相同')
  assert.equal(panel.id, 'file-shield')
  assert.equal(typeof panel.label, 'function')
  for (const dispose of disposers) dispose()
})
