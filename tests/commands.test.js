import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { test } from 'node:test'
import { commandPaths, commandWords, markedWords } from '../src/host/commands.js'

test('commands: 绝对路径原样保留，命令名不计入候选', () => {
  assert.deepEqual(commandPaths('cat /a/b/c.go', '/ws'), ['/a/b/c.go'])
})

test('commands: 相对路径按起始目录解析', () => {
  assert.deepEqual(commandPaths('head -c 40 rel/f.go', '/ws'), ['/ws/40', '/ws/rel/f.go'])
})

test('commands: 跟随命令里的 cd', () => {
  assert.deepEqual(commandPaths('cd /x && cat y.txt', '/ws'), ['/x', '/x/y.txt'])
})

test('commands: 管道每个段各有一个命令名，重定向按分隔符切开', () => {
  assert.deepEqual(commandPaths('grep -rn foo . | wc -l', '/ws'), ['/ws/foo', '/ws'])
  assert.deepEqual(commandPaths('wc -c </a/b.go', '/ws'), ['/a/b.go'])
})

test('commands: 环境变量赋值前缀被剥掉，且不占用命令名位置', () => {
  assert.deepEqual(commandPaths('FOO=/z python3 -c x', '/ws'), ['/z', '/ws/x'])
})

test('commands: 词两端的引号被剥掉', () => {
  assert.deepEqual(commandPaths('cat "/a/b.go"', '/ws'), ['/a/b.go'])
  assert.deepEqual(commandPaths("cat '/a/b.go'", '/ws'), ['/a/b.go'])
})

test('commands: ~ 展开成主目录', () => {
  assert.deepEqual(commandPaths('cat ~/x', '/ws'), [`${homedir()}/x`])
})

test('commands: 选项不进入候选', () => {
  assert.deepEqual(commandWords('ls -la --color /tmp'), ['ls', '/tmp'])
})

test('commands: 命令名只在命令段首位', () => {
  assert.deepEqual(
    markedWords('ls | cat x').map(word => [word.token, word.commandName]),
    [['ls', true], ['cat', true], ['x', false]],
  )
})

test('commands: 空命令没有任何候选', () => {
  assert.deepEqual(commandPaths('', '/ws'), [])
  assert.deepEqual(commandPaths('   ', '/ws'), [])
})
