# dsh-file-shield

一个 dsh（DeepSeek Harness）插件：把指定的文件或目录对 agent **完全屏蔽**。命中规则的路径，读取类工具在派发前就被拒绝，同路径的写入与编辑一并拒绝，搜索类工具也不会把被屏蔽文件的内容或路径带进对话。

规则既可以在 Web GUI 的 **Plugins → dsh-file-shield** 页面里手动点选文件或目录来增删，也可以在 profile 的 `cordis.patch.yml` 里作为部署默认写死。

最常见的用法是挡住**含敏感词或机密内容的文件**：这类文字一旦被读进对话，provider 的内容审核会让之后每个请求都返回 400，会话就此卡死；提前屏蔽它们，等于从源头掐掉这件事。

> A DeepSeek Harness (dsh) plugin that blocks an agent from reading, searching, writing, or editing chosen files and directories, keeping their contents — including text a provider rejects with a 400 — out of the conversation. Rules are picked from a file/directory browser on the plugin's own page in the Web GUI.

仓库主页：<https://github.com/Yazzyk/dsh-file-shield>

## 目录

- [适用场景：含敏感词的文件让对话报 400](#适用场景含敏感词的文件让对话报-400)
- [它拦什么](#它拦什么)
- [它不拦什么](#它不拦什么)
- [规则语义](#规则语义)
- [安装](#安装)
- [怎么配置](#怎么配置)
- [开发](#开发)
- [许可](#许可)

## 适用场景：含敏感词的文件让对话报 400

provider 的内容审核命中时，会直接拒绝整个请求（HTTP 400）。麻烦在于这是**会话级**的：一旦那些文字已经写进会话历史，之后每一轮请求都会带着它一起被拒，对话就卡死了，只能压缩上下文或新开会话。

把这个场景交给屏蔽列表就行：agent 从一开始就读不到这些文件，文字不会进入会话历史，后续请求里自然也不会出现。工作区里那些"每次搜索都命中、每次都被顺手读一遍"的文件尤其值得放进去——抓下来的行情快照、字典表、第三方原始数据。

这是**事前预防，不是事后修复**。本插件不改写已经提交的历史，已经被拒的会话仍然需要压缩上下文或新开会话才能继续；要处理已经进入会话的内容，那是改写类插件的活，不是这一层的职责。

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
| `bash`、`pwsh`（`workdir`） | 工作目录命中即拒绝 |
| `bash`、`pwsh`（`command`） | 命令文本里的路径命中即拒绝，覆盖 `cat`/`head`/`sed`/`cd … && cat …` 等形态 |
| `grep` 的 `matches[].path`、`glob` 的 `paths[]` | 结果里命中项被剔除，剩下部分交给工具自己的 renderer 重新渲染 |
| `bash`、`pwsh` 的 `stdout.text` / `stderr.text` | 含被屏蔽路径的行被逐行剔除，覆盖 `grep -rn` / `rg` / `find` 这类递归读取 |

剔除后如果一条都不剩，模型看到的是"无匹配"或空输出——和 ripgrep 静默跳过 `.gitignore` 条目的行为一致，且不泄露被屏蔽文件是否存在。

### 为什么 shell 要单独一道闸

`read`/`edit`/`grep` 这些工具都经由 `ctx.fs`，路径能被规范化后精确比对。shell 不经过 `ctx.fs`，它把命令文本直接交给子进程，而框架没有暴露任何 shell/subprocess 事件——`tools/pre-execute` 是唯一能拦住它的位置。所以插件对命令文本做静态提取：按 shell 元字符切词、跟随 `cd`、剥引号与 `ENV=` 前缀、展开 `~`，把每个候选词解析成绝对路径后用同一套规则匹配；不含 glob 元字符的绝对规则还会直接在命令原文里做字面查找，这样带空格的路径也能命中。

## 它不拦什么

- **刻意混淆的 shell 命令。** 变量拼接（`p=sec; cat $p`）、`base64 -d`、`$(...)` 二次求值、命令替换都能绕开文本提取。这是静态检查的固有上限：命令文本不等于命令语义。要堵死这条路只能靠操作系统级的读取限制（例如给子进程一个拒绝读这些路径的 `sandbox-exec` profile），那属于宿主能力，不是插件能做到的。
- **不带路径的命令输出。** `grep -h`、`awk`、`sed -n` 这类不打印文件名的输出没有可识别的路径，逐行剔除认不出来。
- **本插件不认识的读文件工具。** 别的插件新增的工具需要在 `config.extraPathArgs`（路径参数）或 `config.extraCommandArgs`（命令参数）里登记。
- **不经过工具层的 host 侧读取。** 技能加载、`@文件` 引用、附件等直接调用 `ctx.fs` 的消费者不受影响。
- **短相对规则的误伤。** 规则 `data` 与命令 `grep data file.txt` 无法从文本上区分：那个词到底是路径还是模式串。页面选出来的路径都是绝对路径，所以这条取舍主要影响手写的短相对规则。
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
        extraCommandArgs:
          some_shell_tool: script
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `deny` | `[]` | 规则列表。空列表是合法状态：新装插件不自己发明规则 |
| `matchCase` | `false` | 是否区分大小写 |
| `guidance` | `true` | 是否注入一条系统提示，说明被拒绝是策略而不是故障 |
| `extraPathArgs` | `{}` | 其它插件的读文件工具：工具名 → 路径参数名数组 |
| `extraCommandArgs` | `{}` | 其它插件的 shell 工具：工具名 → 命令参数名 |

设置层的用户规则会覆盖（而不是叠加）这一层的 `deny`；`matchCase`、`guidance`、`extraPathArgs`、`extraCommandArgs` 只在这一层。

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
