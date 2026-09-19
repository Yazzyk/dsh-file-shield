import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveConfig } from '../src/host/config.js'

test('config: 缺少 config 块时就是空规则列表', () => {
  assert.deepEqual(resolveConfig(undefined), {
    deny: [], matchCase: false, guidance: true, extraPathArgs: {}, extraCommandArgs: {},
  })
})

test('config: 空的 deny 列表仍然合法', () => {
  assert.deepEqual(resolveConfig({ deny: [] }).deny, [])
})

test('config: 值是复制的，不是别名引用', () => {
  const deny = ['**/.env']
  const config = resolveConfig({ deny })
  deny.push('**/*.pem')
  assert.deepEqual(config.deny, ['**/.env'])
})

test('config: 字段类型错误会显式报错', () => {
  assert.throws(() => resolveConfig({ deny: '**/.env' }), /config\.deny must be an array of strings/)
  assert.throws(() => resolveConfig({ deny: ['ok', 7] }), /config\.deny must contain only strings/)
  assert.throws(() => resolveConfig({ matchCase: 'yes' }), /config\.matchCase must be a boolean/)
  assert.throws(() => resolveConfig({ guidance: 1 }), /config\.guidance must be a boolean/)
  assert.throws(() => resolveConfig({ extraPathArgs: [] }), /config\.extraPathArgs must be a mapping/)
  assert.throws(() => resolveConfig({ extraPathArgs: { read: 'file_path' } }), /must be an array of non-empty argument names/)
  assert.throws(() => resolveConfig({ extraPathArgs: { read: [''] } }), /must be an array of non-empty argument names/)
  assert.throws(() => resolveConfig({ extraPathArgs: { ' ': ['path'] } }), /keys must be tool names/)
  assert.throws(() => resolveConfig({ extraCommandArgs: [] }), /config\.extraCommandArgs must be a mapping/)
  assert.throws(() => resolveConfig({ extraCommandArgs: { my_shell: ['command'] } }), /must be a non-empty argument name/)
  assert.throws(() => resolveConfig({ extraCommandArgs: { my_shell: '' } }), /must be a non-empty argument name/)
  assert.throws(() => resolveConfig({ extraCommandArgs: { ' ': 'command' } }), /keys must be tool names/)
  assert.throws(() => resolveConfig('nope'), /config must be a mapping/)
})

test('config: 额外的工具路径参数会被接受', () => {
  const config = resolveConfig({ extraPathArgs: { my_reader: ['target', 'source'] } })
  assert.deepEqual(config.extraPathArgs, { my_reader: ['target', 'source'] })
})

test('config: 额外的命令参数会被接受', () => {
  const config = resolveConfig({ extraCommandArgs: { my_shell: 'script' } })
  assert.deepEqual(config.extraCommandArgs, { my_shell: 'script' })
})
