# dsh-file-shield 设计

日期：2026-09-19
状态：已获用户批准，待用户复核本文档

## 1. 目标

让使用者把某些文件或目录对 agent **完全屏蔽**：

- 模型通过读取类工具（`read`、`read_image`、`grep`、`glob`、`str_replace_editor`）触达这些路径时，调用在派发前被拒绝；
- 同路径的写入与编辑（`write`、`edit`、`str_replace_editor` 的修改命令）一并拒绝；
- 搜索类工具即使整目录搜索，也不能把被屏蔽文件的内容或路径带回对话；
- 使用者可以在 GUI 里**手动点选**文件或目录来增删规则，不必手写配置。

屏蔽规则同时支持部署默认（`cordis.patch.yml` 里的 glob）与用户层（GUI 选择的路径）。

## 2. 为什么是这些接缝

| 能力 | 选用接缝 | 依据 |
|---|---|---|
| 拒绝模型工具调用 | `tools/pre-execute` 瀑布 | registry 自己落实 `deny`，工具体不执行，包装/旁路无法绕过（`packages/core/tools/src/index.ts:137-146`、`:1493-1503`） |
| 过滤搜索结果 | `tools/post-execute` 携带结构化 `value` | registry 用工具自己的 `output.render` 重新渲染，因此不必解析模型可见文本（`packages/core/tools/src/index.ts:1773-1784`） |
| 路径规范化 | `ctx.fs.resolve()` | 得到 canonical realpath，`..` 与符号链接别名无法逃逸（`packages/fs/fs/src/index.ts:107-116`） |
| 规则持久化与实时生效 | `ctx.settings.register()`（host）+ `ctx.settingsScope.bind()`（client） | 带 revision 栅栏的持久化命名空间；第三方插件已有先例 `dsh-better-sidebar/src/index.ts:806-836` |
| 插件页面 | `plugins.bundle.config` 键控槽，键 = 包名 | 渲染在 Plugins 页该插件卡片自己的页面上（`packages/client/ui-plugin-manager/src/client/slot-contract.ts:33-38`） |
| 选目录 | `ctx.uiWorkspace.pickDirectory()` | 直接返回所选绝对路径，官方选择器（`packages/client/ui-workspace/src/client/navigation.ts:64-66`） |
| 选文件 | 插件自建只读浏览路由 | 现有 `listDirectory` 只列目录，没有文件选择器（`packages/host/directory-picker/src/types.ts:21-39`） |

被否决的方案：

- **包装 `ctx.fs` 服务**：`ctx.fs` 由 `fs-local`/`fs-sandbox` 提供，二次 provide 不是文档化扩展点，会干扰 `sandboxMode` 与 observation-policy 的装配，且版本脆弱。
- **改 sandbox/permission-presets**：现有 sandbox 只按 workspace 限制写，没有读黑名单；改核心包违背"插件而非改动 loop"。
- **`dsh.client.external` 请求 `api-remotes/client` 直接调 `workspaceFiles.list`**：该字段按仓库约定只允许基础设施/传输/生成装配使用，特征插件请求它是越界。

## 3. 包形态

独立包 `/Users/yazzyk/workspace/dsh-file-shield`，host + client 双面，安装方式为 `link:`（本地目录）或 npm/Git。

```
dsh-file-shield/
  package.json          # dsh.bundle.patch + dsh.client
  cordis.patch.yml      # 插入本插件行（不预设规则）
  README.md             # 使用说明与已知边界
  docs/design.md        # 本文档
  build.mjs             # esbuild 双面构建
  tsconfig.json         # host 源检查
  tsconfig.client.json  # client 源检查（TSX）
  src/host/
    index.js            # apply / inject / name，装配各部件
    config.js           # 配置校验与默认值
    rules.js            # 规则编译与 glob 匹配
    targets.js          # 工具 -> 路径参数表；从 exec.arguments 取候选路径
    guard.js            # tools/pre-execute 决策
    results.js          # tools/post-execute 结果过滤
    browse.js           # GET /file-shield/browse 路由
    guidance.js         # 可选系统提示段
  src/client/
    index.tsx           # 槽注册
    Page.tsx            # 规则列表 + 保存/重置
    Browser.tsx         # 文件浏览器对话框
    api.ts              # 浏览路由的 fetch 封装
    locales.ts          # 本地字典
    page.css            # 样式（构建期内联）
  lib/
    index.js            # host 产物（构建生成，提交）
    client.js           # client 产物（构建生成，提交）
  tests/
    *.test.js           # node --test
```

Host 是纯 ESM JavaScript（JSDoc 类型 + `node --test`），client 是 TSX 经 esbuild 打成单文件 CJS 工厂包。两半都由 esbuild 产出到 `lib/`，仓库里不出现手写的构建产物。

## 4. 配置

`cordis.patch.yml` 插入一行，**不预设规则**（新装即惰性）：

```yaml
- insert:
    - id: file-shield
      name: dsh-file-shield
```

用户在 profile 的 `cordis.patch.yml` 覆盖该行 `config`（整段替换）：

```yaml
- insert:
    - id: file-shield
      name: dsh-file-shield
      config:
        deny:
          - '**/.env'
          - '**/.env.*'
          - '**/*.pem'
          - '~/.dsh/.credentials.yaml'
        matchCase: false
        guidance: true
        extraPathArgs:
          some_reader_tool:
            - target
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `deny` | `[]` | 规则列表：glob 或精确路径；相对规则锚定会话工作区 |
| `matchCase` | `false` | 是否区分大小写；默认失败关闭方向（macOS/Windows 大小写不敏感文件系统） |
| `guidance` | `true` | 是否注入一条系统提示，说明被屏蔽路径是策略而非错误 |
| `extraPathArgs` | `{}` | 其它插件新增的读文件工具：工具名 -> 参数名数组，合并进内置表 |

空 `deny` 是**合法**状态而非误配置：规则的主要所有者是 GUI 写入的设置层，新装插件必须可加载且不自作主张。加载时记一条 info。

## 5. 规则语义

- 规则字符串含 glob 元字符（`*?[]{}`）时按 glob 编译，否则按精确路径比较。
- 相对规则锚定到会话工作区 `exec.agent.session.header.cwd`；无 agent 时退回 provider 默认（即不传 `cwd`，由 `ctx.fs.resolve` 自行决定）。
- 每个目标按**两种拼法**参与匹配：`ctx.fs.resolve(候选路径, { cwd, signal })` 返回的 `FsTarget` 同时给出 `targetKey`（规范化身份，符号链接已解析）与 `displayPath`（调用方写下的绝对路径，链接保持原样），两者都拿来匹配。原因：macOS 的 `/tmp`、`/var` 是指向 `/private/...` 的符号链接，规则可能写成任一种，而文件浏览器给出的正是 display 拼法；只比规范化身份会让页面里选出的 `/tmp/...` 静默不生效。别名的防护不受影响——针对真实路径写的规则仍经 `targetKey` 命中。
- 内置 glob 编译支持 `**`（可匹配零层目录）、`*`、`?`、`[...]`；反斜杠转义下一个字符，因此路径中真实存在的 `*` 或 `[` 可以写成 `\*`、`\[`。自实现，不引第三方依赖。
- 空串与纯空白规则被忽略。
- `~` 前缀在规则中展开为宿主 home（仅限规则侧，模型输入不做展开）。

## 6. 拦截

### 6.1 派发前拒绝

`tools/pre-execute` 监听器：按内置表取出该工具的参数路径，逐个规范化并匹配。

| 工具 | 路径参数 |
|---|---|
| `read` / `read_image` / `write` / `edit` | `file_path` |
| `grep` / `glob` | `path` |
| `str_replace_editor` | `path` |
| 其它 | `extraPathArgs` 登记项 |

命中即返回：

```
{ kind: 'deny',
  reason: 'Access to "<displayPath>" is blocked by deployment policy (rule "<规则>").',
  info: { name: 'FileAccessBlockedError', code: 'FS_PERMISSION_DENIED', reason: '<规则>' } }
```

registry 会把它物化成 `Error: <reason>` 的失败结果，并保留结构化 `code`。用 `FS_PERMISSION_DENIED` 而非 `FS_SANDBOX_DENIED`，避免触发"用更宽沙箱重试"的语义。

参数中不含路径、或路径无法规范化（例如语法非法）时**不拦截**：这类调用会由工具自身按原有方式失败，策略层不制造新的失败面。

### 6.2 结果过滤

`tools/post-execute` 监听器，只处理 `grep` 与 `glob`：

- `grep`：`value.matches[].path`（相对会话工作区）逐个规范化并匹配，命中项剔除；
- `glob`：`value.paths[]` 同样处理。

返回 `{ kind: 'accept', value: <过滤后的值> }`，由 registry 调用工具自己的 `output.render` 重新渲染，因此不依赖渲染文本格式，持久化的 `presentationMeta` 也随之一致。

结果被完全过滤时不报错，模型看到"无匹配"。这与 ripgrep 静默跳过 `.gitignore` 条目的既有行为一致，且不泄露被屏蔽文件的存在。过滤按每次调用缓存规范化结果，避免逐条 realpath 的重复开销。

### 6.3 系统提示

`guidance: true` 时注册一段提示（`order: 50`、`interpolate: false`）：说明部分路径受部署策略保护、被拒绝是策略而非故障、不要改用 shell 或其它工具绕过、也不要猜测被隐藏的内容。提示中不罗列具体路径。

## 7. 浏览路由

Host 侧注册一条只读路由（`ctx.effect(() => ctx.webServer.register(...))`）：

```
GET /file-shield/browse?path=<绝对路径>
```

- 无 `path` 时列宿主 home。
- `200` 应答：`{ path, parent: string|null, home, entries: [{ name, type: 'file'|'directory'|'other', symlink }], truncated: boolean }`，条目按目录优先、同类按名字排序，超过 5000 条截断并置 `truncated`。符号链接报告它解析后的类型并带 `symlink: true`。
- `Cache-Control: no-store`；仅接受 `GET`，其它方法 `405`。
- 失败应答：`400`（路径缺失/非绝对/解码失败）、`404`（不存在）、`403`（权限拒绝）、`500`（其它 IO 失败），体为 `{ error: { code, message } }`。
- 使用 `lstat`，符号链接如实报告且不作为可进入项，避免环。
- 信任边界：每个请求先过 `ctx.connection.requestRejection()`——Host/Origin 围栏挡 DNS rebinding 与跨站请求，浏览器会话 Cookie 挡未认证调用；被拒时按围栏给的状态（`401`/`403`）回空体，不泄露任何目录信息。路由本身只读、无副作用、无路径写入能力、只列目录内容；绑定沿用 webServer 自身配置（默认回环）。这是本插件唯一的自建 HTTP 面。

Host 侧注入 `webServer` **与** `connection` 为**可选**：两者都在时挂载浏览路由，缺任一时路由不挂载（宁可让文件浏览器不可用，也不开一条无认证的目录列举），守卫本身不受影响。

## 8. GUI 页面

Client 半注册进 `plugins.bundle.config`，`key = 'dsh-file-shield'`：

- `view: 'summary'`：一行，形如"已屏蔽 N 条规则"。
- `view: 'page'`：
  - 规则列表：每条显示路径与删除按钮，glob 规则额外带一个标签（客户端无法可靠区分「文件」与「目录」，所以不做这个区分）；
  - **添加目录**：`uiWorkspace.pickDirectory()`；
  - **添加文件**：打开自带浏览器对话框，从宿主 home 开始逐层进入目录、点选文件；
  - **手动输入**：一个文本框用于粘贴路径或 glob；
  - **保存**：`settingsScope.set('deny', [...])`；
  - **恢复部署默认**：`settingsScope.unset('deny')`。
  - 显示当前是否已覆盖部署默认（`user` 层存在即视为覆盖），以及不可写状态（`writable === false` 或 `mode === 'memory'`）下的只读提示。

`inject = ['slots', 'settingsScope']`；`uiWorkspace` 用 `ctx.get('uiWorkspace')` 读取而非写进 `inject`——缺失时插件仍须激活，只是隐藏目录选择按钮。

文案全部来自本包字典；样式为普通 CSS，构建期内联成字符串，插件 fiber 内一次性注入 `<style>`，类名统一前缀 `dfs-`。

## 9. 构建

`build.mjs` 用 esbuild 产出两半：

- Host：`src/host/index.js` → `lib/index.js`，`format=esm`、`platform=node`，`external: schemastery` + node 内置模块。host 侧运行时**不导入任何 `@deepseek-ai/*`**，避免依赖加载器的裸标识符解析行为。
- Client：`src/client/index.tsx` → `lib/client.js`，`format=cjs`、`platform=browser`，external 为平台模块表：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`；banner/footer 包出 `window.__ModuleLoader__.load({ id, factory: (require) => { … return module.exports; } })`；`.css` 以 `text` loader 内联。
- 运行期依赖只有 `schemastery`（真实 dependency）。host 半在运行时不导入任何 `@deepseek-ai/*`：服务类型都是 `import type {}`，编译后擦除，所以插件不依赖加载器如何解析裸标识符。
- 类型来源（`@deepseek-ai/dsh-*` 与 client 侧各包、react 类型）只进 `devDependencies`，版本钉在已发布构建所用的 `0.1.6-alpha.2`（cordis `^4.0.2`），编译后不再需要。
- 构建器是 **esbuild** 而不是官方 preset：`packages/client/tsdown.client.ts` 不是已发布包，且会按 `packages/*/*/package.json` 查找包名、对仓外包名直接抛错，仓外插件无法复用。

产物提交进包，使 `link:` 安装后即可用；`--watch` 供 client HMR 开发。

## 10. 测试与验证

1. **单元测试**（`node --test`，跑源码）：
   - glob 编译：`**` 匹配零层目录、`*`/`?`/字符类、正则元字符转义、大小写开关；
   - 规则锚定与规范化匹配，含 `..`、符号链接别名、`~` 展开；
   - 工具参数表取值：命中/未命中/参数缺失/非法路径不拦；
   - deny 决策的完整字段；
   - `grep`/`glob` 结果过滤，含全部被过滤与空结果；
   - 配置校验：字段类型错误报错、`deny` 省略合法；
   - 浏览路由：正常列表、非 GET、非绝对路径、不存在、条目上限。
2. **真实组合**：全新临时 `DSH_HOME` 建 scratch profile → `dsh plugin --profile <scratch> add link:/Users/yazzyk/workspace/dsh-file-shield` → `--dump-config` 断言插件行出现且 bundle 层正确 → 有可用 key 时跑真实任务读被屏蔽文件，断言模型收到策略拒绝。
3. **安装与 GUI**：装到 `desktop` 与 `web`；用浏览器自动化打开 `http://127.0.0.1:43120`，进入 Plugins 页打开本插件页面，实际点选目录与文件、保存，再让 agent 读取被屏蔽文件并确认被拒。
4. 若 `plugins.bundle.config` 在已发布构建中对第三方 bundle 不渲染，改用 `plugins.row.config`（键 `dsh-file-shield#file-shield`），并同步修订本文档。

## 11. 实现与本文档的偏差

实现完成后记录的实际差异：

1. 浏览应答去掉了 `size` 字段（UI 用不到，省掉每条的 stat）。
2. 规则条目只对 glob 规则打标签：客户端无法可靠判断一个路径是文件还是目录。
3. 构建器换成 esbuild（原因见 §9）。
4. host 半新增 `services.d.ts`，把 `ctx.tools` / `ctx.fs` / `ctx.settings` / `ctx.systemPrompt` / `ctx.webServer` 的声明以 type-only 方式拉进来，使 `tsc` 能对着真实服务契约检查。

## 12. 已知边界

- **`bash`/`pwsh` 可绕过**：`cat` 之类的 shell 命令不在本插件的拦截面上。这是明确取舍（未采用可误伤且可绕过的命令文本匹配）。
- **其它插件新增的读文件工具不识别**，除非在 `extraPathArgs` 里登记。
- **host 侧 `ctx.fs` 消费者不在拦截面上**：技能加载、`@文件` 引用、附件等绕过工具层的读取不受影响。
- **grep/glob 结果静默剔除**，不给模型"有内容被隐藏"的提示。
- **规则不校验所指向的文件是否存在**：屏蔽先于存在的路径是合理用法。
- 页面只在 Plugins 页出现；若宿主未装载 plugin manager 或未暴露该槽，页面不存在（守卫不受影响）。
