/**
 * dsh-file-shield 的双面构建。
 *
 * 宿主面是给 Node 跑的普通 ESM JavaScript，`schemastery` 保持为安装后包的
 * 真实依赖。浏览器端是单个 CJS 工厂包，形如 Web 模块加载器要求的样子：
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * 只有加载器能应答的平台模块是外部依赖，其余全部内联；`.css` 以文本形式
 * 引入，因此包会自己注入样式表。两份产物都写到 `lib/`，也就是本包发布的
 * 内容。
 *
 * @module dsh-file-shield/build
 */

import { build, context } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('.', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/** Web 模块加载器给本包编目的插件 id。 */
const id = manifest.name

/**
 * 浏览器外壳通过那张冻结模块表共享的模块说明符。它们在工厂内部保持为
 * `require(...)` 调用；其余任何裸说明符都会被内联进包里。
 * @see 宿主 `packages/client/web/src/platform.ts` 中的 PLATFORM_MODULES。
 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/**
 * 完整的前导片段：交给加载器的握手，以及产出的包体所期待的 CommonJS 局部
 * 变量。宿主的构建预设把它们拆在 `banner` 与 `intro` 两处；esbuild 只有
 * `banner`，所以两件事都写在这里，且局部变量必须排在产出代码之前。
 */
const prelude = [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
].join('\n')

/** @type {import('esbuild').BuildOptions} */
const hostOptions = {
  entryPoints: ['src/host/index.js'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  logLevel: 'info',
  external: ['schemastery'],
}

/** @type {import('esbuild').BuildOptions} */
const clientOptions = {
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  logLevel: 'info',
  external: PLATFORM_MODULES,
  loader: { '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: prelude },
  footer: { js: 'return module.exports; } });' },
}

if (process.argv.includes('--watch')) {
  const contexts = await Promise.all([context(hostOptions), context(clientOptions)])
  await Promise.all(contexts.map(running => running.watch()))
  console.log(`dsh-file-shield: watching (${packageRoot})`)
} else {
  await Promise.all([build(hostOptions), build(clientOptions)])
}
