import assert from 'node:assert/strict'
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { BROWSE_PATH, MAX_ENTRIES, createBrowseHandler } from '../src/host/browse.js'

let root

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'file-shield-browse-'))
  await mkdir(join(root, 'zeta'))
  await mkdir(join(root, 'alpha'))
  await writeFile(join(root, '.env'), 'SECRET=1\n')
  await writeFile(join(root, 'note.txt'), 'hello\n')
  await symlink(join(root, 'alpha'), join(root, 'linked-dir'))
  await symlink(join(root, 'missing'), join(root, 'broken-link'))
})

after(async () => {
  const { rm } = await import('node:fs/promises')
  await rm(root, { recursive: true, force: true })
})

/** 最小化的 ServerResponse 捕获实现。 */
function response() {
  return {
    status: 0,
    headers: undefined,
    body: '',
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(payload) {
      this.body = payload ?? ''
    },
  }
}

/** 用一个请求目标驱动该处理函数。 */
async function browse(url, method = 'GET') {
  const res = response()
  await createBrowseHandler({ home: root })({ method, url }, res)
  return { status: res.status, headers: res.headers, body: JSON.parse(res.body) }
}

/** 让请求穿过一道以 `status` 拒绝的信任围栏，以此驱动该处理函数。 */
async function browseRejected(url, status) {
  const res = response()
  await createBrowseHandler({ home: root, authorize: () => status })({ method: 'GET', url }, res)
  return res
}

test('browse: 列出一层条目时先列目录，再列名称', async () => {
  const { status, body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(root)}`)
  assert.equal(status, 200)
  assert.deepEqual(body.entries.map(entry => entry.name), ['alpha', 'linked-dir', 'zeta', '.env', 'broken-link', 'note.txt'])
  assert.deepEqual(body.entries.map(entry => entry.type), ['directory', 'directory', 'directory', 'file', 'other', 'file'])
})

test('browse: 符号链接报告它解析出的类型，断链也不会抛错', async () => {
  const { body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(root)}`)
  const linked = body.entries.find(entry => entry.name === 'linked-dir')
  const broken = body.entries.find(entry => entry.name === 'broken-link')
  assert.deepEqual(linked, { name: 'linked-dir', type: 'directory', symlink: true })
  assert.deepEqual(broken, { name: 'broken-link', type: 'other', symlink: true })
})

test('browse: 隐藏条目也会列出，因为它们正是重点', async () => {
  const { body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(root)}`)
  assert.ok(body.entries.some(entry => entry.name === '.env'))
})

test('browse: 报告该层目录、其父目录和主目录', async () => {
  const { body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(join(root, 'alpha'))}`)
  assert.equal(body.path, join(root, 'alpha'))
  assert.equal(body.parent, root)
  assert.equal(body.home, root)
})

test('browse: 不带路径时列出主目录', async () => {
  const { body } = await browse(BROWSE_PATH)
  assert.equal(body.path, root)
})

test('browse: 含加号的文件名能完整穿过查询串', async () => {
  await writeFile(join(root, 'a+b.txt'), 'x\n')
  const { body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(root)}`)
  assert.ok(body.entries.some(entry => entry.name === 'a+b.txt'))
})

test('browse: 每个应答都是不可缓存的 JSON', async () => {
  const { headers } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(root)}`)
  assert.equal(headers['cache-control'], 'no-store')
  assert.match(headers['content-type'], /^application\/json/)
})

test('browse: 非 GET 方法被拒绝', async () => {
  const { status, body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(root)}`, 'POST')
  assert.equal(status, 405)
  assert.equal(body.error.code, 'method-not-allowed')
})

test('browse: 相对路径被拒绝', async () => {
  const { status, body } = await browse(`${BROWSE_PATH}?path=relative%2Fdir`)
  assert.equal(status, 400)
  assert.equal(body.error.code, 'not-absolute')
})

test('browse: 非法的百分号编码被拒绝', async () => {
  const { status, body } = await browse(`${BROWSE_PATH}?path=%E0%A4%A`)
  assert.equal(status, 400)
  assert.equal(body.error.code, 'invalid-path')
})

test('browse: 不存在的目录返回未找到', async () => {
  const { status, body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(join(root, 'nope'))}`)
  assert.equal(status, 404)
  assert.equal(body.error.code, 'not-found')
})

test('browse: 信任围栏先应答，且不泄露任何信息', async () => {
  const unauthorized = await browseRejected(`${BROWSE_PATH}?path=${encodeURIComponent(root)}`, 401)
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.body, '')
  assert.equal(unauthorized.headers['cache-control'], 'no-store')

  const untrustedOrigin = await browseRejected(BROWSE_PATH, 403)
  assert.equal(untrustedOrigin.status, 403)
  assert.equal(untrustedOrigin.body, '')
})

test('browse: 普通文件不是目录', async () => {
  const { status, body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(join(root, 'note.txt'))}`)
  assert.equal(status, 400)
  assert.equal(body.error.code, 'not-a-directory')
})

test('browse: 条目上限是对外公开的', () => {
  assert.equal(MAX_ENTRIES, 5000)
})

test('browse: 超出上限的一层会被截断并如实说明', async () => {
  const wide = await mkdtemp(join(tmpdir(), 'file-shield-wide-'))
  try {
    await Promise.all(Array.from({ length: MAX_ENTRIES + 1 }, (_, index) => writeFile(join(wide, `f${index}`), '')))
    const { body } = await browse(`${BROWSE_PATH}?path=${encodeURIComponent(wide)}`)
    assert.equal(body.truncated, true)
    assert.equal(body.entries.length, MAX_ENTRIES)
  } finally {
    const { rm } = await import('node:fs/promises')
    await rm(wide, { recursive: true, force: true })
  }
})
