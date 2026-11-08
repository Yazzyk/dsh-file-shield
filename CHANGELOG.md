# 更新日志

本文件记录本插件的可见变化。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-11-08

分级屏蔽（issue #1）。这是本次的主线：规则从一层变成三层，并各自有了配置入口。

### 新增

- **三级屏蔽：全局 / 项目 / 会话。** 三级与部署默认**叠加**生效（取并集，高层不覆盖底层）——
  屏蔽只做加法才安全，若高层能覆盖底层，一次手滑就把部署策略整段关掉了。
  - 全局：所有会话都生效；
  - 项目：对 **dsh 工作区里的某个项目**生效，键是 dsh Workspace 的 `path`；
  - 会话：只对那一个会话生效，键是会话 id。
- **侧边栏面板**（`sidebar.panellist` + `main`）：部署默认只读展示、全局段与项目段可编辑、
  会话段只读汇总；项目段直接列出本宿主已有的 dsh 工作区（显示标题而不是路径）。
- **会话的「屏蔽」标签页**（`conversation.view`，order 20）：与「对话」「轨迹」同级，
  默认锚在当前会话上，编辑会话级规则并显示该会话的工作区。
- **两条新路由**：`GET/POST /file-shield/state`（读写三级状态）、
  `GET /file-shield/session`（会话 id → 工作区），与既有浏览路由同一套 connection 信任围栏。
- **按调用现算生效规则**：守卫在每次工具调用时按该调用所属的项目与会话拼出规则，
  保存后对下一次调用立即生效，不需要重启插件。状态文件被外部改过会被发现（比 `mtime:size`）。
- **选目录走操作系统对话框**：`uiWorkspace.pickDirectory()`。
- **选文件走操作系统对话框**：`<input type="file">` + 桌面壳 preload 的
  `__DSH_HOST_PATHS__.pathFor(file)`（`electron.webUtils.getPathForFile`）把 `File` 换回真实路径。

### 变更

- 项目层的判定以 **dsh 的 Workspace 记录**为准（`record.sessionIds`），而不是只看 cwd 前缀：
  workspace 的 path 是规范化的根，而会话的 cwd 可能只是它下面某个子目录。没有记录时才退回前缀匹配。
- 状态持久化到 `$DSH_HOME/state/dsh-file-shield/tiers.json`（0600，临时文件 + rename 原子写入），
  不进 settings 命名空间——键是项目路径与会话 id，会随会话增删，那是数据不是配置项。

### 移除（不兼容）

- **应用内的文件/目录选择弹窗整体删除**：`src/client/Browser.tsx`、`src/client/api.ts`、
  `src/host/browse.js` 与 `GET /file-shield/browse` 路由。
  理由是"同一个动作只该有一个界面"——两个选择器并存时，用户要先猜这次会弹哪一个。
  插件现在只挂两条路由，暴露面比之前更小。
- 依赖 `/file-shield/browse` 的外部调用会得到 404；改用系统对话框或直接写规则。

### 验证

- `npm test`：149 通过 / 0 失败。
- `pnpm run typecheck`：host 与 client 两个 program 全绿。
- `pnpm run build`：`lib/index.js` 与 `lib/client.js` 重新产出。
- 真机：临时 `DSH_HOME` 建 scratch profile，`link:` 安装，`--dump-config` 确认插件行与 bundle 层。

### 已知边界

- 项目层用大小写不敏感的前缀比较（macOS / Windows 默认文件系统如此）。
- 三级路由只在同时装配 `webServer` 与 `connection` 时挂载；缺任一时面板不可用。
- 浏览器里的人工点击（面板渲染、对话框交互）未自动化验证。
