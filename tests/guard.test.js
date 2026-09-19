import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPreExecuteListener } from '../src/host/guard.js'
import { compileRules } from '../src/host/rules.js'

const ALLOW = { kind: 'allow' }
const next = async () => ALLOW

/** 按插件实际的接线方式，对一个规则集和一个身份解析器施加守卫。 */
function guard(patterns, options = {}) {
  const rules = compileRules(patterns, { home: '/home/tester' })
  const resolved = []
  const listener = createPreExecuteListener({
    activeRules: () => rules,
    resolveTarget: async (path, cwd, signal) => {
      resolved.push({ path, cwd, signal })
      if (options.unresolvable === true) return undefined
      const canonical = options.absolute ?? path
      const lexical = options.lexical ?? path
      return { canonical, lexical, displayPath: lexical }
    },
    extraPathArgs: options.extraPathArgs ?? {},
    extraCommandArgs: options.extraCommandArgs ?? {},
    ...options.logger === undefined ? {} : { logger: options.logger },
  })
  return { listener, resolved }
}

const call = (name, args, cwd = '/ws') => ({
  name,
  arguments: args,
  signal: undefined,
  agent: { session: { header: { cwd } } },
})

test('guard: 被屏蔽的读取会带着路径和规则被拒绝', async () => {
  const { listener } = guard(['**/.env'])
  const decision = await listener(call('read', { file_path: '/ws/.env' }), next)
  assert.equal(decision.kind, 'deny')
  assert.equal(decision.reason, 'Access to "/ws/.env" is blocked by deployment policy (rule "**/.env").')
  assert.deepEqual(decision.info, { name: 'FileAccessBlockedError', code: 'FS_PERMISSION_DENIED', reason: '**/.env' })
})

test('guard: 拒绝码不是那个会招致放宽权限重试的沙箱码', async () => {
  const { listener } = guard(['**/.env'])
  const decision = await listener(call('read', { file_path: '/ws/.env' }), next)
  assert.notEqual(decision.info.code, 'FS_SANDBOX_DENIED')
})

test('guard: 对同一路径的写入和编辑同样被屏蔽', async () => {
  const { listener } = guard(['**/.env'])
  for (const tool of ['write', 'edit']) {
    const decision = await listener(call(tool, { file_path: '/ws/.env' }), next)
    assert.equal(decision.kind, 'deny', `${tool} 应当被拒绝`)
  }
})

test('guard: 编辑器工具按它自己的参数名被屏蔽', async () => {
  const { listener } = guard(['/ws/secret'])
  assert.equal((await listener(call('str_replace_editor', { command: 'view', path: '/ws/secret' }), next)).kind, 'deny')
})

test('guard: 未命中的调用原样向下传递', async () => {
  const { listener } = guard(['**/.env'])
  assert.equal(await listener(call('read', { file_path: '/ws/app.ts' }), next), ALLOW)
})

test('guard: shell 命令里的相对路径按工作区解析后被拦下', async () => {
  const { listener } = guard(['**/.env'])
  const decision = await listener(call('bash', { command: 'cat .env' }), next)
  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /\.env/)
})

test('guard: 与规则无关的命令原样向下传递', async () => {
  const { listener } = guard(['/etc/shadow'])
  assert.equal(await listener(call('bash', { command: 'ls -la /tmp' }), next), ALLOW)
})

test('guard: 缺失或空白的路径参数会向下传递', async () => {
  const { listener, resolved } = guard(['**/.env'])
  assert.equal(await listener(call('read', {}), next), ALLOW)
  assert.equal(await listener(call('read', { file_path: '  ' }), next), ALLOW)
  assert.deepEqual(resolved, [])
})

test('guard: 无法解析的路径不会变成策略拒绝', async () => {
  const { listener } = guard(['**/.env'], { unresolvable: true })
  assert.equal(await listener(call('read', { file_path: '\u0000bad' }), next), ALLOW)
})

test('guard: 会话工作区会交给解析器', async () => {
  const { listener, resolved } = guard(['**/.env'])
  await listener(call('read', { file_path: '.env' }, '/ws'), next)
  assert.deepEqual(resolved, [{ path: '.env', cwd: '/ws', signal: undefined }])
})

test('guard: 没有 agent 的调用其工作区根未知', async () => {
  const { listener, resolved } = guard(['/etc/shadow'])
  const decision = await listener({ name: 'read', arguments: { file_path: '/etc/shadow' }, signal: undefined }, next)
  assert.equal(decision.kind, 'deny')
  assert.deepEqual(resolved, [{ path: '/etc/shadow', cwd: undefined, signal: undefined }])
})

test('guard: 匹配使用规范化身份，而不是书写形式', async () => {
  // `notes.txt` 是被屏蔽文件的别名；只有规范化才能看出来。
  const { listener } = guard(['/real/.env'], { absolute: '/real/.env' })
  assert.equal((await listener(call('read', { file_path: 'notes.txt' }), next)).kind, 'deny')
})

test('guard: 按路径显示形式写出的规则同样命中', async () => {
  // macOS 的 `/tmp` 是指向 `/private/tmp` 的符号链接：规则和文件浏览器
  // 报告出的路径带的都是显示形式。
  const { listener } = guard(['/tmp/canary/**'], { absolute: '/private/tmp/canary/.env', lexical: '/tmp/canary/.env' })
  const decision = await listener(call('read', { file_path: '/tmp/canary/.env' }), next)
  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /rule "\/tmp\/canary\/\*\*"/)
})

test('guard: 针对真实位置写出的规则一样拦得住别名', async () => {
  const { listener } = guard(['/private/tmp/canary/**'], { absolute: '/private/tmp/canary/.env', lexical: '/tmp/canary/.env' })
  assert.equal((await listener(call('read', { file_path: '/tmp/canary/.env' }), next)).kind, 'deny')
})

test('guard: 相对规则匹配落在工作区内的那一种书写形式', async () => {
  // 工作区本身就是经由该链接抵达的，所以相对于它只有显示形式
  // 能写出来。
  const { listener } = guard(['sub/.env'], { absolute: '/private/tmp/ws/sub/.env', lexical: '/tmp/ws/sub/.env' })
  assert.equal((await listener(call('read', { file_path: '/tmp/ws/sub/.env' }, '/tmp/ws'), next)).kind, 'deny')
})

test('guard: 相对规则永远不伸到工作区之外', async () => {
  // 该别名解析到工作区之外，那里不存在相对形式的写法。
  const { listener } = guard(['**/.env'], { absolute: '/real/.env' })
  assert.equal(await listener(call('read', { file_path: 'notes.txt' }), next), ALLOW)
})

test('guard: 没有规则就完全不做工作', async () => {
  const { listener, resolved } = guard([])
  assert.equal(await listener(call('read', { file_path: '/ws/.env' }), next), ALLOW)
  assert.deepEqual(resolved, [])
})

test('guard: 部署层登记的路径参数会被检查', async () => {
  const { listener } = guard(['**/.env'], { extraPathArgs: { my_reader: ['target'] } })
  assert.equal((await listener(call('my_reader', { target: '/ws/.env' }), next)).kind, 'deny')
})

test('guard: 参数列表中第一个被屏蔽的键决定结果', async () => {
  const { listener } = guard(['**/.env'], { extraPathArgs: { my_reader: ['primary', 'secondary'] } })
  const decision = await listener(call('my_reader', { primary: '/ws/app.ts', secondary: '/ws/.env' }), next)
  assert.equal(decision.kind, 'deny')
})

test('guard: 拒绝会以 debug 级别记入日志', async () => {
  const lines = []
  const { listener } = guard(['**/.env'], { logger: { debug: message => lines.push(message) } })
  await listener(call('read', { file_path: '/ws/.env' }), next)
  assert.match(lines[0], /denied read on "\/ws\/\.env" by rule "\*\*\/\.env"/)
})

test('guard: shell 命令里的绝对路径被拦下', async () => {
  const { listener } = guard(['/etc/shadow'])
  const decision = await listener(call('bash', { command: 'cat /etc/shadow' }), next)
  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /rule "\/etc\/shadow"/)
})

test('guard: shell 命令里的相对路径按会话工作区解析', async () => {
  const { listener } = guard(['backend/data/secret.go'])
  assert.equal((await listener(call('bash', { command: 'head -c 40 backend/data/secret.go' }, '/proj'), next)).kind, 'deny')
})

test('guard: shell 命令里 cd 之后的相对路径按新目录解析', async () => {
  const { listener } = guard(['/proj/secret.txt'])
  assert.equal((await listener(call('bash', { command: 'cd /proj && cat secret.txt' }), next)).kind, 'deny')
})

test('guard: 带空格的绝对路径由字面查找命中', async () => {
  const { listener } = guard(['/tmp/my secret.txt'])
  assert.equal((await listener(call('bash', { command: 'cat "/tmp/my secret.txt"' }), next)).kind, 'deny')
})

test('guard: 被屏蔽的 workdir 本身就是一次命中', async () => {
  const { listener } = guard(['/proj/secret'])
  assert.equal((await listener(call('bash', { command: 'ls', workdir: '/proj/secret' }), next)).kind, 'deny')
})

test('guard: 相对 workdir 连同会话工作区一起交给解析器', async () => {
  const { listener, resolved } = guard(['/proj/secret'])
  await listener(call('bash', { command: 'ls', workdir: 'secret' }, '/proj'), next)
  assert.deepEqual(resolved[0], { path: 'secret', cwd: '/proj', signal: undefined })
})

test('guard: 命令里的相对规则按工作区相对形式命中', async () => {
  const { listener } = guard(['data'])
  assert.equal((await listener(call('bash', { command: 'ls data' }), next)).kind, 'deny')
})

test('guard: 短相对规则会命中同名的普通参数，这是已记录的取舍', async () => {
  // `data` 只是一个词：静态提取无法区分它是路径还是 grep 的模式串。页面选出来的
  // 路径都是绝对路径，所以这条取舍主要影响手写的短相对规则。
  const { listener } = guard(['data'])
  assert.equal((await listener(call('bash', { command: 'grep data file.txt' }), next)).kind, 'deny')
})

test('guard: 部署层登记的命令参数会被检查', async () => {
  const { listener } = guard(['/etc/shadow'], { extraCommandArgs: { my_shell: 'script' } })
  assert.equal((await listener(call('my_shell', { script: 'cat /etc/shadow' }), next)).kind, 'deny')
})

test('guard: shell 命令被拒绝时也会记日志', async () => {
  const lines = []
  const { listener } = guard(['/etc/shadow'], { logger: { debug: message => lines.push(message) } })
  await listener(call('bash', { command: 'cat /etc/shadow' }), next)
  assert.match(lines[0], /denied bash on "\/etc\/shadow" by rule "\/etc\/shadow"/)
})
