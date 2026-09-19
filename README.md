# dsh-file-shield

一个 dsh（DeepSeek Harness）插件：把指定的文件或目录对 agent **完全屏蔽**。命中规则的路径，读取类工具在派发前就被拒绝，同路径的写入与编辑一并拒绝，搜索类工具也不会把被屏蔽文件的内容或路径带进对话。

规则既可以在 Web GUI 的 **Plugins → dsh-file-shield** 页面里手动点选文件或目录来增删，也可以在 profile 的 `cordis.patch.yml` 里作为部署默认写死。

> A DeepSeek Harness (dsh) plugin that blocks an agent from reading, searching, writing, or editing chosen files and directories, with a file/directory picker on the plugin's own page in the Web GUI.

仓库主页：<https://github.com/Yazzyk/dsh-file-shield>

## 目录

- [它拦什么](#它拦什么)
- [它不拦什么](#它不拦什么)
- [规则语义](#规则语义)
- [安装](#安装)
- [怎么配置](#怎么配置)
- [开发](#开发)
- [许可](#许可)

## 它拦什么

拦截点是 `tools/pre-execute`：插件返回 `deny`，工具主体根本不执行，所以不是"读完再过滤"，而是调用本身被 registry 拒绝。模型看到的是：

```
Error: Access to "/tmp/shield-target/secret.env" is blocked by deployment policy (rule "/tmp/shield-target/**").
```

结构化错误码是 `FS_PERMISSION_DENIED`（不是 `FS_SANDBOX_DENIED`——后者会让模型尝试用更宽的沙箱权限重试，而部署规则没有"更宽"可给）。

| 工具 | 处理 |
|---|---|
| `read`、`read_image`、`write`、`edit`（`file_path`） | 命中即拒绝 |
| `str_replace_editor`（`path`） | 命中即拒绝 |
| `grep`、`glob`（`path`） | 参数命中即拒绝 |
| `grep` 的 `matches[].path`、`glob` 的 `paths[]` | 结果里命中项被剔除，剩下部分交给工具自己的 renderer 重新渲染 |

剔除后如果一条都不剩，模型看到的是"无匹配"——和 ripgrep 静默跳过 `.gitignore` 条目的行为一致，且不泄露被屏蔽文件是否存在。

## 它不拦什么

- **`bash` / `pwsh` 里的 `cat`。** shell 命令可以读到被屏蔽文件。这是明确的取舍：命令文本匹配既可绕开（变量拼接）又会误伤，因此没有做。
- **本插件不认识的读文件工具。** 别的插件新增的工具需要在该插件的 `config.extraPathArgs` 里登记参数名。
- **不经过工具层的 host 侧读取。** 技能加载、`@文件` 引用、附件等直接调用 `ctx.fs` 的消费者不受影响。
- **`matchCase` 默认关闭**（大小写不敏感）。macOS 与 Windows 的文件系统默认大小写不敏感，规范化后的路径可能不是规则里的拼法，敏感比较会静默漏掉规则。

## 规则语义

- 规则是 glob 或字面路径。含 `*`、`?`、`[]`、`{}` 时按 glob 编译，否则按字面路径比较；`\` 可以转义下一个字符。
- 以 `/` 开头（或 `~` 展开后）的规则是**绝对规则**，对规范化后的绝对路径匹配。
- 其他规则是**工作区相对规则**，只对相对于会话工作区的路径匹配，不会伸到工作区之外。
- 匹配时同时比较目标路径和它的每一级祖先目录，所以写一个目录就等于屏蔽它下面的整棵树。
- 每个目标按**两种拼法**参与匹配：`ctx.fs.resolve()` 给出的稳定身份（`targetKey`，符号链接已解析），以及 `displayPath`（调用方写下的绝对路径，链接保持原样）。macOS 的 `/tmp`、`/var` 是指向 `/private/...` 的符号链接，两者不同，而规则可能写成任一种——文件浏览器选出来的路径就是 display 拼法。只比较规范化身份会让页面里选的 `/tmp/...` 静默失效，所以两种都比。别名的安全性不受影响：针对真实路径写的规则仍然通过规范化身份生效，`ln -s .env notes.txt` 之后再读 `notes.txt` 一样会被拦下。
- 相对规则的锚点是 `exec.agent.session.header.cwd`；没有 agent 的调用没有锚点，此时只有绝对规则生效。

## 安装

### 从 GitHub（推荐）

```sh
dsh plugin --profile <profile> add github:Yazzyk/dsh-file-shield
```

`lib/` 的构建产物已提交进仓库，所以这条路径**不需要任何构建脚本**，pnpm 默认的构建脚本门禁不会拦它。需要锁定版本时在末尾加 `#<commit>`：

```sh
dsh plugin --profile <profile> add github:Yazzyk/dsh-file-shield#<commit>
```

包声明了 `dsh.bundle`，安装后会自动加入该 profile 的 `dsh.profile.bundles`。重启该 profile 使宿主面生效（浏览器端可以热重载，宿主面不行）。

### 从本地目录

适合改源码时：

```sh
dsh plugin --profile <profile> add link:/绝对路径/dsh-file-shield
```

### 确认与卸载

用 `--dump-config` 确认多了一层 `# == dsh-file-shield`，并核对行 `id: file-shield`、`name: dsh-file-shield`。

```sh
dsh --profile <profile> --dump-config
dsh plugin --profile <profile> remove dsh-file-shield
```

## 怎么配置

### 从插件页面（日常用法）

侧边栏 **Plugins** → **Installed** → `dsh-file-shield`：

- **选择文件…** 打开插件自带的浏览器，逐层进入目录并点选文件；
- **系统目录选择器…** 调用 dsh 自己的目录选择器（需要装载 workspace UI）；
- 也可以直接输入路径或 glob；
- **保存** 把规则写进 `file-shield` 设置命名空间（用户层），**恢复部署默认** 清掉用户层。

写进设置层的规则立即对下一次工具调用生效，不需要重启。因为宿主没有暴露列文件的接口（目录选择器只列目录、`workspaceFiles.list` 限于会话工作区），选文件用的是一条插件自己的只读路由 `GET /file-shield/browse?path=<绝对路径>`：只接受 GET、只列目录内容、`Cache-Control: no-store`，并且每个请求都先过 `ctx.connection.requestRejection()`——Host/Origin 围栏挡 DNS rebinding 与跨站请求，浏览器会话 Cookie 挡未认证调用。该路由只在同时装配了 `webServer` 与 `connection` 的组合里挂载；缺其中任一时文件浏览器不可用，而不是以无认证方式开放目录列举。

### 从 `cordis.patch.yml`（部署默认）

profile 的 patch 层可以整段替换该行的 `config`：

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
| `deny` | `[]` | 规则列表。空列表是合法状态：新装插件不自己发明规则 |
| `matchCase` | `false` | 是否区分大小写 |
| `guidance` | `true` | 是否注入一条系统提示，说明被拒绝是策略而不是故障 |
| `extraPathArgs` | `{}` | 其它插件的读文件工具：工具名 → 参数名数组 |

设置层的用户规则会覆盖（而不是叠加）这一层的 `deny`；`matchCase`、`guidance`、`extraPathArgs` 只在这一层。

## 开发

```sh
pnpm install
pnpm run build      # esbuild 产出 lib/index.js（host）与 lib/client.js（client）
pnpm run watch      # 构建 watcher，配合 client HMR
pnpm test           # node --test，跑 src/ 下的纯函数
pnpm run typecheck  # host 与 client 两个 program
```

`lib/` 的产物提交进仓库，所以 `link:` 安装后无需构建即可使用；改动源码后必须重新 `pnpm run build`（client 半的热更新需要 watcher 持续重写 `lib/client.js`）。

宿主面与浏览器端的生效边界不同：`lib/client.js` 变化可以被 client HMR 推到已打开的页面；`lib/index.js` 变化需要重启 profile，因为宿主模块由 Loader 以 ESM `import` 加载，进程内不会重新求值。

## 许可

[MIT](LICENSE)。
