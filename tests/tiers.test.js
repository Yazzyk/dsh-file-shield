/**
 * 三级状态的纯计算与校验。
 *
 * 这一层不碰磁盘也不碰 HTTP：路由与持久化的错误都以这里的 `TierError.code` 为准，
 * 所以先把语义钉在这里。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyChange, emptyTiers, isWithin, MAX_LEVEL_KEYS, MAX_RULES_PER_LEVEL,
  normalizeTiers, parseChange, projectRootsFor, TierError,
} from '../src/host/tiers.js'

test('tiers: 空状态没有任何规则', () => {
  assert.deepEqual(emptyTiers(), { global: [], projects: {}, sessions: {} })
})

test('tiers: 缺字段的输入补成空状态，而不是报错', () => {
  assert.deepEqual(normalizeTiers({}), emptyTiers())
  assert.deepEqual(normalizeTiers(undefined), emptyTiers())
})

test('tiers: 规则去空白、去重复、丢掉空条目', () => {
  const tiers = normalizeTiers({ global: ['  **/.env ', '**/.env', '', '   ', '**/*.pem'] })
  assert.deepEqual(tiers.global, ['**/.env', '**/*.pem'])
})

test('tiers: 空列表不落键，状态文件不会堆空壳', () => {
  const tiers = normalizeTiers({ projects: { '/w/a': [], '/w/b': ['x'] }, sessions: { s1: [] } })
  assert.deepEqual(tiers.projects, { '/w/b': ['x'] })
  assert.deepEqual(tiers.sessions, {})
})

test('tiers: 非字符串条目与错误结构都以稳定错误码报出来', () => {
  assert.throws(() => normalizeTiers({ global: [7] }), (error) => error instanceof TierError && error.code === 'invalid-rules')
  assert.throws(() => normalizeTiers({ projects: [] }), /projects must be a mapping/)
  assert.throws(() => normalizeTiers('nope'), /must be a mapping/)
})

test('tiers: 单条规则超长会被拒绝', () => {
  assert.throws(() => normalizeTiers({ global: ['x'.repeat(5000)] }), (error) => error.code === 'rule-too-long')
})

test('tiers: 规则条数与条目数都有上限', () => {
  const many = Array.from({ length: MAX_RULES_PER_LEVEL + 1 }, (_, i) => 'r' + i)
  assert.throws(() => normalizeTiers({ global: many }), (error) => error.code === 'too-many-rules')
  const entries = {}
  for (let i = 0; i <= MAX_LEVEL_KEYS; i += 1) entries['/w/' + i] = ['r']
  assert.throws(() => normalizeTiers({ projects: entries }), (error) => error.code === 'too-many-entries')
})

test('tiers: 写入请求按 scope 校验，项目键必须是绝对路径', () => {
  assert.deepEqual(parseChange({ scope: 'global', rules: ['a'] }), { scope: 'global', rules: ['a'] })
  assert.deepEqual(parseChange({ scope: 'project', workspace: '/w/a', rules: [] }), { scope: 'project', workspace: '/w/a', rules: [] })
  assert.deepEqual(parseChange({ scope: 'session', session: 's1', rules: ['a'] }), { scope: 'session', session: 's1', rules: ['a'] })
  assert.throws(() => parseChange({ scope: 'project', workspace: 'rel', rules: [] }), (error) => error.code === 'not-absolute')
  assert.throws(() => parseChange({ scope: 'session', session: '  ', rules: [] }), (error) => error.code === 'invalid-scope')
  assert.throws(() => parseChange({ scope: 'everything', rules: [] }), (error) => error.code === 'invalid-scope')
  assert.throws(() => parseChange(null), (error) => error.code === 'invalid-body')
})

test('tiers: 三种写入都不改动入参状态', () => {
  const base = normalizeTiers({ global: ['g'], projects: { '/w/a': ['p'] }, sessions: { s1: ['s'] } })
  const frozen = JSON.stringify(base)
  applyChange(base, { scope: 'global', rules: ['g2'] })
  applyChange(base, { scope: 'project', workspace: '/w/a', rules: [] })
  applyChange(base, { scope: 'session', session: 's1', rules: ['s2'] })
  assert.equal(JSON.stringify(base), frozen)
})

test('tiers: 写入空列表等于删掉那一级的条目', () => {
  const base = normalizeTiers({ projects: { '/w/a': ['p'] }, sessions: { s1: ['s'] } })
  const noProject = applyChange(base, { scope: 'project', workspace: '/w/a', rules: [] })
  assert.deepEqual(noProject.projects, {})
  const noSession = applyChange(base, { scope: 'session', session: 's1', rules: [] })
  assert.deepEqual(noSession.sessions, {})
})

test('tiers: 新增条目撞到上限时报错，而不是静默丢弃', () => {
  const entries = {}
  for (let i = 0; i < MAX_LEVEL_KEYS; i += 1) entries['/w/' + i] = ['r']
  const full = normalizeTiers({ projects: entries })
  assert.throws(
    () => applyChange(full, { scope: 'project', workspace: '/w/new', rules: ['r'] }),
    (error) => error.code === 'too-many-entries',
  )
  // 覆盖已有条目不受上限影响。
  assert.deepEqual(applyChange(full, { scope: 'project', workspace: '/w/0', rules: ['r2'] }).projects['/w/0'], ['r2'])
})

test('isWithin: 含根本身，不吃掉同前缀的兄弟目录', () => {
  assert.equal(isWithin('/w/app', '/w/app'), true)
  assert.equal(isWithin('/w/app', '/w/app/sub/file.ts'), true)
  assert.equal(isWithin('/w/app/', '/w/app/sub'), true)
  assert.equal(isWithin('/w/app', '/w/application/x'), false)
  assert.equal(isWithin('/w/app', '/w'), false)
  assert.equal(isWithin('', '/w'), false)
})

test('isWithin: 大小写不敏感，否则 macOS 上路径大小写不同会让项目规则静默失效', () => {
  assert.equal(isWithin('/Users/Me/app', '/Users/me/app/src/a.ts'), true)
})

test('projectRootsFor: 一个工作区可能命中多个嵌套的项目根', () => {
  const tiers = normalizeTiers({ projects: { '/w': ['a'], '/w/app': ['b'], '/other': ['c'] } })
  assert.deepEqual(projectRootsFor(tiers, '/w/app/src'), ['/w', '/w/app'])
  assert.deepEqual(projectRootsFor(tiers, '/w/other'), ['/w'])
  assert.deepEqual(projectRootsFor(tiers, undefined), [])
})
