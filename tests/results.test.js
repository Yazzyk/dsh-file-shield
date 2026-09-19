import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPostExecuteListener } from '../src/host/results.js'
import { compileRules } from '../src/host/rules.js'

/** 对单个规则集施加过滤，身份解析器与插件接线一致。 */
function filter(patterns, { canonical: canonicalPath = {}, logger } = {}) {
  const rules = compileRules(patterns, { home: '/home/tester' })
  return createPostExecuteListener({
    activeRules: () => rules,
    resolveTarget: async path => {
      const canonical = canonicalPath[path] ?? path
      return { canonical, lexical: path, displayPath: path }
    },
    ...logger === undefined ? {} : { logger },
  })
}

const exec = (name, cwd = '/ws') => ({
  name,
  arguments: {},
  signal: undefined,
  agent: { session: { header: { cwd } } },
})

/** 用一个已定局的派发结果和一个裸 accept 决定来驱动该监听器。 */
const accept = value => async () => ({ kind: 'accept', value })

test('results: 被屏蔽的 grep 匹配被剔除，其余部分保留', async () => {
  const listener = filter(['**/.env'])
  const value = {
    matches: [
      { path: '.env', lineNumber: 2, line: 'SECRET=1' },
      { path: 'app.ts', lineNumber: 9, line: 'ok' },
      { path: 'config/.env', lineNumber: 1, line: 'TOKEN=2' },
    ],
  }
  const decision = await listener(exec('grep'), { isError: false, value }, accept(value))
  assert.equal(decision.kind, 'accept')
  assert.deepEqual(decision.value.matches, [{ path: 'app.ts', lineNumber: 9, line: 'ok' }])
})

test('results: 被屏蔽的 glob 路径被剔除', async () => {
  const listener = filter(['**/*.pem'])
  const value = { root: '.', paths: ['keys/a.pem', 'src/index.ts'] }
  const decision = await listener(exec('glob'), { isError: false, value }, accept(value))
  assert.deepEqual(decision.value, { root: '.', paths: ['src/index.ts'] })
})

test('results: 被整体剔除的结果读起来就是无匹配', async () => {
  const listener = filter(['**/.env'])
  const value = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  const decision = await listener(exec('grep'), { isError: false, value }, accept(value))
  assert.deepEqual(decision.value.matches, [])
})

test('results: 未被触碰的结果保留原决定对象本身', async () => {
  const listener = filter(['**/.env'])
  const value = { matches: [{ path: 'app.ts', lineNumber: 1, line: 'x' }] }
  const decision = { kind: 'accept' }
  assert.equal(await listener(exec('grep'), { isError: false, value }, async () => decision), decision)
})

test('results: 过滤的是已被后续监听器替换过的值', async () => {
  const listener = filter(['**/.env'])
  const replaced = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  const original = { matches: [{ path: 'app.ts', lineNumber: 1, line: 'x' }] }
  const decision = await listener(exec('grep'), { isError: false, value: original }, accept(replaced))
  assert.deepEqual(decision.value.matches, [])
})

test('results: 只替换了渲染文本的结果不做处理', async () => {
  const listener = filter(['**/.env'])
  const value = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  const content = [{ type: 'text', text: 'rewritten' }]
  const decision = await listener(exec('grep'), { isError: false, value }, async () => ({ kind: 'accept', content }))
  assert.deepEqual(decision.content, content)
  assert.equal(decision.value, undefined)
})

test('results: 阻断类决定原样穿过', async () => {
  const listener = filter(['**/.env'])
  const block = { kind: 'block', feedback: [{ type: 'text', text: 'no' }] }
  const value = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  assert.equal(await listener(exec('grep'), { isError: false, value }, async () => block), block)
})

test('results: 失败的结果没有可过滤的值', async () => {
  const listener = filter(['**/.env'])
  const decision = { kind: 'accept' }
  assert.equal(await listener(exec('grep'), { isError: true }, async () => decision), decision)
})

test('results: 没有结果过滤的工具不会被检查', async () => {
  const listener = filter(['**/.env'])
  const value = { lines: [{ number: 1, text: 'SECRET=1' }] }
  const decision = { kind: 'accept' }
  assert.equal(await listener(exec('read'), { isError: false, value }, async () => decision), decision)
})

test('results: 结构异常的结果交给工具自己处理', async () => {
  const listener = filter(['**/.env'])
  for (const value of [undefined, null, 'text', { matches: 'nope' }, { matches: [] }]) {
    const decision = { kind: 'accept' }
    assert.equal(await listener(exec('grep'), { isError: false, value }, async () => decision), decision)
  }
})

test('results: 读不出路径的条目保留而不是剔除', async () => {
  const listener = filter(['**/.env'])
  const value = { matches: [{ lineNumber: 1, line: 'x' }, { path: '.env', lineNumber: 1, line: 'y' }] }
  const decision = await listener(exec('grep'), { isError: false, value }, accept(value))
  assert.deepEqual(decision.value.matches, [{ lineNumber: 1, line: 'x' }])
})

test('results: 规则看到的是规范化后的别名目标', async () => {
  const listener = filter(['/real/.env'], { canonical: { '/ws/alias.txt': '/real/.env' } })
  const value = { matches: [{ path: 'alias.txt', lineNumber: 1, line: 'x' }] }
  const decision = await listener(exec('grep'), { isError: false, value }, accept(value))
  assert.deepEqual(decision.value.matches, [])
})

test('results: 按路径显示形式写出的规则同样会剔除', async () => {
  // 报告出的路径位于 macOS 的 `/tmp` 链接之下，所以文件浏览器产出的规则
  // 匹配的是显示形式而不是真实路径。
  const listener = filter(['/tmp/ws/**'], { canonical: { '/tmp/ws/.env': '/private/tmp/ws/.env' } })
  const value = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  const decision = await listener(exec('grep', '/tmp/ws'), { isError: false, value }, accept(value))
  assert.deepEqual(decision.value.matches, [])
})

test('results: 替换值时附加上下文得以保留', async () => {
  const listener = filter(['**/.env'])
  const contexts = [{ role: 'user', content: [{ type: 'text', text: 'note' }] }]
  const value = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  const decision = await listener(exec('grep'), { isError: false, value }, async () => ({ kind: 'accept', additionalContexts: contexts }))
  assert.deepEqual(decision.additionalContexts, contexts)
})

test('results: 剔除批次会以 debug 级别记入日志', async () => {
  const lines = []
  const listener = filter(['**/.env'], { logger: { debug: message => lines.push(message) } })
  const value = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  await listener(exec('grep'), { isError: false, value }, accept(value))
  assert.match(lines[0], /withheld 1 grep result\(s\)/)
})

test('results: 没有 agent 的调用按工作目录解析', async () => {
  const listener = filter(['**/.env'])
  const value = { matches: [{ path: '.env', lineNumber: 1, line: 'x' }] }
  const decision = await listener({ name: 'grep', arguments: {}, signal: undefined }, { isError: false, value }, accept(value))
  assert.deepEqual(decision.value.matches, [])
})
