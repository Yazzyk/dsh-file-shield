import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pathArgsFor, readPathArg, workspaceRoot } from '../src/host/targets.js'

test('targets: 每个内置的读取与写入工具都声明了自己的路径参数', () => {
  assert.deepEqual(pathArgsFor('read', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('read_image', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('write', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('edit', {}), ['file_path'])
  assert.deepEqual(pathArgsFor('str_replace_editor', {}), ['path'])
  assert.deepEqual(pathArgsFor('grep', {}), ['path'])
  assert.deepEqual(pathArgsFor('glob', {}), ['path'])
})

test('targets: 没有路径参数的工具不会被检查', () => {
  assert.deepEqual(pathArgsFor('bash', {}), [])
  assert.deepEqual(pathArgsFor('todo_write', {}), [])
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
