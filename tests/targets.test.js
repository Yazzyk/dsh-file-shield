import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commandArgFor, pathArgsFor, readPathArg, workspaceRoot } from '../src/host/targets.js'

test('targets: 每个内置的读取与写入工具都声明了自己的路径参数', () => {
  assert.deepEqual(pathArgsFor('read', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('read_image', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('write', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('edit', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('str_replace_editor', {}), ['path'])
  assert.deepEqual(pathArgsFor('grep', {}), ['path'])
  assert.deepEqual(pathArgsFor('glob', {}), ['path'])
})

test('targets: shell 工具按工作目录参数被检查', () => {
  assert.deepEqual(pathArgsFor('bash', {}), ['workdir'])
  assert.deepEqual(pathArgsFor('pwsh', {}), ['workdir'])
})

test('targets: shell 工具声明了命令参数', () => {
  assert.equal(commandArgFor('bash', {}), 'command')
  assert.equal(commandArgFor('pwsh', {}), 'command')
  assert.equal(commandArgFor('read', {}), undefined)
})

test('targets: 部署层登记的命令参数覆盖内置表', () => {
  assert.equal(commandArgFor('my_shell', { my_shell: 'script' }), 'script')
  assert.equal(commandArgFor('bash', { bash: 'script' }), 'script')
})

test('targets: 不带路径也不带命令的工具不会被检查', () => {
  assert.deepEqual(pathArgsFor('todo_write', {}), [])
  assert.equal(commandArgFor('todo_write', {}), undefined)
})

test('targets: 部署层登记的参数扩展内置表', () => {
  assert.deepEqual(pathArgsFor('read', { read: ['backup_path'] }), ['file_path', 'backup_path'])
  assert.deepEqual(pathArgsFor('my_reader', { my_reader: ['target'] }), ['target'])
})

test('targets: 只有非空白字符串的路径参数才会被读取', () => {
  assert.equal(readPathArg({ file_path: '/ws/.env' }, 'file_path'), '/ws/.env')
  assert.equal(readPathArg({ file_path: '  ' }, 'file_path'), undefined)
  assert.equal(readPathArg({ file_path: 7 }, 'file_path'), undefined)
  assert.equal(readPathArg({}, 'file_path'), undefined)
  assert.equal(readPathArg(undefined, 'file_path'), undefined)
  assert.equal(readPathArg('nope', 'file_path'), undefined)
})

test('targets: 工作区根来自发起调用的 agent 会话', () => {
  assert.equal(workspaceRoot({ agent: { session: { header: { cwd: '/ws' } } } }), '/ws')
  assert.equal(workspaceRoot({}), undefined)
  assert.equal(workspaceRoot({ agent: {} }), undefined)
})
