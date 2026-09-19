import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ancestors, compileRules, globSource, matchRule, relativeTo, toPosix } from '../src/host/rules.js'

const home = '/home/tester'

/** 用固定的主目录编译，使 `~` 展开可确定。 */
const compile = (patterns, options = {}) => compileRules(patterns, { home, ...options })

test('glob: ** 跨越目录，也可以匹配零层目录', () => {
  assert.equal(globSource('**/.env'), '(?:.*/)?\\.env')
  assert.equal(globSource('a/**/b'), 'a/(?:.*/)?b')
  assert.equal(globSource('a/**'), 'a/.*')
})

test('glob: * 和 ? 从不跨越分隔符', () => {
  assert.equal(globSource('a/*.txt'), 'a/[^/]*\\.txt')
  assert.equal(globSource('a?.txt'), 'a[^/]\\.txt')
})

test('glob: 反斜杠转义下一个字符', () => {
  assert.equal(globSource('a\\*b'), 'a\\*b')
  const rules = compile(['/ws/a\\*b'])
  assert.equal(matchRule(rules, '/ws/a*b', undefined), '/ws/a\\*b')
  assert.equal(matchRule(rules, '/ws/axb', undefined), undefined)
})

test('glob: 字符类被原样传递，包括取反', () => {
  const rules = compile(['/ws/[ab].txt', '/ws/[!c].md'])
  assert.equal(matchRule(rules, '/ws/a.txt', undefined), '/ws/[ab].txt')
  assert.equal(matchRule(rules, '/ws/c.txt', undefined), undefined)
  assert.equal(matchRule(rules, '/ws/d.md', undefined), '/ws/[!c].md')
  assert.equal(matchRule(rules, '/ws/c.md', undefined), undefined)
})

test('glob: 未闭合的字符类按字面方括号处理', () => {
  const rules = compile(['/ws/a[b'])
  assert.equal(matchRule(rules, '/ws/a[b', undefined), '/ws/a[b')
})

test('rules: 不带尾斜杠的目录规则覆盖其下全部内容', () => {
  const rules = compile(['/srv/secret'])
  assert.equal(matchRule(rules, '/srv/secret', undefined), '/srv/secret')
  assert.equal(matchRule(rules, '/srv/secret/deep/file.txt', undefined), '/srv/secret')
  assert.equal(matchRule(rules, '/srv/secretive', undefined), undefined)
})

test('rules: 相对规则只匹配相对于工作区的书写形式', () => {
  const rules = compile(['.env'])
  assert.equal(matchRule(rules, '/ws/.env', '.env'), '.env')
  assert.equal(matchRule(rules, '/ws/sub/.env', 'sub/.env'), undefined)
  // 工作区之外没有可匹配的相对形式。
  assert.equal(matchRule(rules, '/elsewhere/.env', undefined), undefined)
})

test('rules: 相对目录规则覆盖其下的整棵树', () => {
  const rules = compile(['secret'])
  assert.equal(matchRule(rules, '/ws/secret/a.txt', 'secret/a.txt'), 'secret')
  assert.equal(matchRule(rules, '/ws/other/a.txt', 'other/a.txt'), undefined)
})

test('rules: 绝对规则无论相对形式如何都生效', () => {
  const rules = compile(['/etc/shadow'])
  assert.equal(matchRule(rules, '/etc/shadow', undefined), '/etc/shadow')
})

test('rules: ~ 展开为宿主的主目录并算作绝对规则', () => {
  const rules = compile(['~/.dsh/.credentials.yaml'])
  assert.equal(rules[0].absolute, true)
  assert.equal(matchRule(rules, '/home/tester/.dsh/.credentials.yaml', undefined), '~/.dsh/.credentials.yaml')
  assert.equal(matchRule(rules, '/home/other/.dsh/.credentials.yaml', undefined), undefined)
})

test('rules: 除非设置了 matchCase，匹配不区分大小写', () => {
  assert.equal(matchRule(compile(['**/.env']), '/ws/.ENV', '.ENV'), '**/.env')
  assert.equal(matchRule(compile(['**/.env'], { matchCase: true }), '/ws/.ENV', '.ENV'), undefined)
})

test('rules: 空条目和非字符串条目被丢弃', () => {
  assert.deepEqual(compile(['', '   ', 42, null]), [])
})

test('rules: 按配置顺序报告第一个命中的规则', () => {
  const rules = compile(['**/*.pem', '/ws/keys'])
  assert.equal(matchRule(rules, '/ws/keys/a.pem', 'keys/a.pem'), '**/*.pem')
})

test('rules: 未命中的路径返回 undefined', () => {
  assert.equal(matchRule(compile(['**/.env']), '/ws/app.ts', 'app.ts'), undefined)
  assert.equal(matchRule([], '/ws/.env', '.env'), undefined)
})

test('relativeTo: 越出工作区返回 undefined，根返回 .', () => {
  assert.equal(relativeTo('/ws', '/ws/a/b'), 'a/b')
  assert.equal(relativeTo('/ws', '/ws'), '.')
  assert.equal(relativeTo('/ws', '/other/a'), undefined)
  assert.equal(relativeTo('/ws', '/ws2/a'), undefined)
})

test('ancestors: 由近及远，到根之前停下', () => {
  assert.deepEqual(ancestors('/a/b/c'), ['/a/b/c', '/a/b', '/a'])
  assert.deepEqual(ancestors('a/b'), ['a/b', 'a'])
  assert.deepEqual(ancestors('a'), ['a'])
})

test('toPosix: 保持分隔符写法稳定', () => {
  assert.equal(toPosix('/a/b'), '/a/b')
})
