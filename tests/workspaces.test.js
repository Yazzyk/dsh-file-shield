/**
 * 把 dsh Workspace 读成"项目级"的键。
 *
 * 这一层的关键在于**归属来源**：项目级要对"dsh 工作区里的某个项目"生效，所以判定会话属于哪个
 * 项目要以 dsh 的 Workspace 记录为准——workspace 的 path 是规范化的根，而会话的 cwd 可能只是
 * 它下面的子目录。记录里没有这个会话时才退回 cwd 前缀。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLiveRules } from '../src/host/live.js'
import { normalizeTiers } from '../src/host/tiers.js'
import { listWorkspaces, workspaceOfSession, workspaceRegistryOf } from '../src/host/workspaces.js'

/** 一个最小的 registry 替身：真实 registry 的 list()/get() 是同步的。 */
function fakeRegistry(records) {
  const entities = new Map(records.map(record => [record.id, {
    ...record,
    get path() { return record.path },
    get title() { return record.title },
    get sessionIds() { return record.sessionIds },
  }]))
  return {
    list: () => [...entities.values()],
    get: (id) => entities.get(id),
  }
}

/** 一个只提供 workspaceRegistry 的假上下文。 */
function fakeCtx(registry) {
  return { get: (name) => (name === 'workspaceRegistry' ? registry : undefined) }
}

test('workspaces: 没有 registry 时返回空，而不是抛', () => {
  const ctx = fakeCtx(undefined)
  assert.equal(workspaceRegistryOf(ctx), undefined)
  assert.deepEqual(listWorkspaces(ctx), [])
  assert.equal(workspaceOfSession(ctx, 's1', '/w'), undefined)
})

test('workspaces: 列表带标题与会话数，标题缺失时退回路径', () => {
  const ctx = fakeCtx(fakeRegistry([
    { id: 'w1', path: '/Users/me/app', title: 'app', sessionIds: ['s1', 's2'] },
    { id: 'w2', path: '/Users/me/other', title: '', sessionIds: [] },
  ]))
  assert.deepEqual(listWorkspaces(ctx), [
    { id: 'w1', path: '/Users/me/app', title: 'app', sessions: 2 },
    { id: 'w2', path: '/Users/me/other', title: '/Users/me/other', sessions: 0 },
  ])
})

test('workspaces: 会话归属以 dsh 的记录为准，而不是 cwd 前缀', () => {
  const ctx = fakeCtx(fakeRegistry([
    { id: 'w1', path: '/Users/me/app', title: 'app', sessionIds: ['s1'] },
    { id: 'w2', path: '/Users/me/app/packages/inner', title: 'inner', sessionIds: [] },
  ]))
  // cwd 落在 inner 之内，但 dsh 把会话记在 app 名下 —— 归属是 app。
  assert.equal(workspaceOfSession(ctx, 's1', '/Users/me/app/packages/inner/x')?.id, 'w1')
})

test('workspaces: 记录里没有这个会话时退回 cwd 前缀', () => {
  const ctx = fakeCtx(fakeRegistry([
    { id: 'w1', path: '/Users/me/app', title: 'app', sessionIds: [] },
  ]))
  assert.equal(workspaceOfSession(ctx, 'script-session', '/Users/me/app/src')?.id, 'w1')
  assert.equal(workspaceOfSession(ctx, 'script-session', '/Users/me/elsewhere'), undefined)
})

test('workspaces: 前缀比较不吃掉兄弟目录', () => {
  const ctx = fakeCtx(fakeRegistry([
    { id: 'w1', path: '/Users/me/app', title: 'app', sessionIds: [] },
  ]))
  assert.equal(workspaceOfSession(ctx, 'x', '/Users/me/application'), undefined)
})

test('live: 项目层的键是 workspace 路径，cwd 的子目录也算命中', () => {
  const tiers = normalizeTiers({ projects: { '/Users/me/app': ['**/snapshots/*.csv'] } })
  const live = createLiveRules({
    readTiers: () => tiers,
    // dsh 把会话归到 app；cwd 只是它下面一个子目录。
    workspaceFor: () => '/Users/me/app',
  })
  const exec = { agent: { session: { id: 's1', header: { cwd: '/Users/me/app/src/deep' } } } }
  assert.deepEqual(live.rootsFor(exec), ['/Users/me/app'])
  assert.deepEqual(live.rulesFor(exec).map(rule => rule.pattern), ['**/snapshots/*.csv'])
})

test('live: workspace 与 cwd 分属两个项目时两条规则都生效（屏蔽只做加法）', () => {
  const tiers = normalizeTiers({ projects: { '/a': ['from-workspace'], '/a/inner': ['from-cwd'] } })
  const live = createLiveRules({
    readTiers: () => tiers,
    workspaceFor: () => '/a',
  })
  const exec = { agent: { session: { id: 's1', header: { cwd: '/a/inner/x' } } } }
  assert.deepEqual(live.rootsFor(exec).sort(), ['/a', '/a/inner'])
  assert.deepEqual(live.rulesFor(exec).map(rule => rule.pattern).sort(), ['from-cwd', 'from-workspace'])
})

test('live: 没有 workspace 信息时退回会话 cwd', () => {
  const tiers = normalizeTiers({ projects: { '/w/app': ['x'] } })
  const live = createLiveRules({ readTiers: () => tiers })
  const exec = { agent: { session: { id: 's1', header: { cwd: '/w/app/sub' } } } }
  assert.deepEqual(live.rootsFor(exec), ['/w/app'])
})
