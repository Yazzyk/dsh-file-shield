/**
 * File Shield 插件页面的字典。两个随附语言携带同一套键，
 * 由带类型的注册表在注册时强制校验。
 *
 * @module dsh-file-shield/src/client/locales
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** 本插件的 locale 命名空间。 */
export const NS = 'fileShield'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    fileShield: FileShieldKey
  }
}

/** 本页面渲染的全部文本。 */
export type FileShieldKey =
  | 'title'
  | 'panel'
  | 'panelIntro'
  | 'summaryNone'
  | 'summaryCount'
  | 'rulesHeading'
  | 'emptyRules'
  | 'addFile'
  | 'addDirectory'
  | 'addSystemDirectory'
  | 'pickSystemDirectory'
  | 'manualPlaceholder'
  | 'manualAdd'
  | 'remove'
  | 'overridden'
  | 'usingDefault'
  | 'save'
  | 'saving'
  | 'saved'
  | 'saveFailed'
  | 'reset'
  | 'discard'
  | 'expand'
  | 'collapse'
  | 'retry'
  | 'loading'
  | 'loadFailed'
  | 'unavailable'
  | 'readOnly'
  | 'readOnlyShort'
  | 'deploymentHeading'
  | 'deploymentNote'
  | 'deploymentEmpty'
  | 'globalHeading'
  | 'globalNote'
  | 'projectsHeading'
  | 'projectsNote'
  | 'projectsEmpty'
  | 'projectAdd'
  | 'sessionsHeading'
  | 'sessionsNote'
  | 'sessionsEmpty'
  | 'ruleCount'
  | 'sessionTotal'
  | 'projectNew'
  | 'projectUse'
  | 'projectsNoWorkspace'
  | 'viewTab'
  | 'viewLead'
  | 'sessionCwd'
  | 'sessionCwdUnknown'
  | 'sessionNote'
  | 'close'
  | 'browseTitle'
  | 'browseUp'
  | 'browseChooseDirectory'
  | 'browseEmpty'
  | 'browseFailed'
  | 'browseTruncated'
  | 'cancel'
  | 'kindPattern'

export const zh: Record<FileShieldKey, string> = {
  title: '文件屏蔽',
  panel: '文件屏蔽',
  panelIntro: '屏蔽规则分三级叠加生效：部署默认、全局、项目、会话同时作用于 agent。每一段只写自己那一层，不会顶替其他层。',
  summaryNone: '未屏蔽任何文件',
  summaryCount: '已屏蔽 {count} 条规则',
  rulesHeading: '已屏蔽的路径',
  emptyRules: '还没有规则。agent 目前可以读取工作区内的任何文件。',
  addFile: '选择文件…',
  addDirectory: '选择目录…',
  addSystemDirectory: '系统目录选择器…',
  pickSystemDirectory: '选择目录…',
  manualPlaceholder: '输入路径或 glob，例如 **/.env',
  manualAdd: '添加',
  remove: '移除',
  overridden: '已覆盖部署默认',
  usingDefault: '使用部署默认',
  save: '保存',
  saving: '正在保存…',
  saved: '已保存',
  saveFailed: '保存失败，Host 未接受该值',
  reset: '恢复部署默认',
  discard: '撤销改动',
  expand: '展开',
  collapse: '收起',
  retry: '重试',
  loading: '正在读取规则…',
  loadFailed: '无法读取屏蔽状态',
  unavailable: 'Host 未提供 file-shield 设置，规则暂不可编辑。',
  readOnly: '当前连接不写入 Host，规则只读。',
  readOnlyShort: '只读',
  deploymentHeading: '部署默认',
  deploymentNote: '来自部署的 cordis.patch.yml，只读；在这里无法修改。',
  deploymentEmpty: '部署没有预设任何屏蔽规则。',
  globalHeading: '全局规则',
  globalNote: '对所有项目与会话生效，与项目、会话级规则叠加。',
  projectsHeading: '项目规则',
  projectsNote: '对 dsh 工作区里的某个项目生效；一个项目一段规则，与其他层叠加。下面列出的是这个宿主已有的工作区，也可以手动加一个没登记的目录。',
  projectsEmpty: '还没有项目级规则。',
  projectAdd: '选择项目目录…',
  sessionsHeading: '会话规则',
  sessionsNote: '会话级规则在会话的「屏蔽」标签页里配置，这里只做汇总。',
  sessionsEmpty: '没有会话级规则。',
  ruleCount: '{count} 条规则',
  sessionTotal: '{count} 个会话有规则',
  projectNew: '新目录：保存后才会生效',
  projectUse: '选中',
  projectsNoWorkspace: '这个宿主没有 dsh 工作区列表（组合里没装 workspace 包）；用下面的浏览按钮手动选目录。',
  viewTab: '屏蔽',
  viewLead: '这个会话的规则只作用于当前会话，与部署默认、全局、项目级叠加生效。',
  sessionCwd: '工作区',
  sessionCwdUnknown: '未知',
  sessionNote: '本会话的规则与部署默认、全局、项目层叠加生效，不会顶替它们。',
  close: '关闭',
  browseTitle: '选择要屏蔽的文件',
  browseUp: '上一级',
  browseChooseDirectory: '屏蔽当前目录',
  browseEmpty: '这个目录是空的',
  browseFailed: '无法列出该目录',
  browseTruncated: '条目过多，只显示了一部分',
  cancel: '取消',
  kindPattern: '规则',
}

export const en: Record<FileShieldKey, string> = {
  title: 'File Shield',
  panel: 'File Shield',
  panelIntro: 'Shield rules apply in stacked levels: the deployment default, global, project, and session rules all reach the agent at once. Each section writes only its own level and never replaces another.',
  summaryNone: 'No file is blocked',
  summaryCount: '{count} rule(s) blocked',
  rulesHeading: 'Blocked paths',
  emptyRules: 'No rules yet. The agent can read anything in the workspace.',
  addFile: 'Pick a file…',
  addDirectory: 'Pick a directory…',
  addSystemDirectory: 'System directory picker…',
  pickSystemDirectory: 'Pick a directory…',
  manualPlaceholder: 'Path or glob, for example **/.env',
  manualAdd: 'Add',
  remove: 'Remove',
  overridden: 'Overriding the deployment default',
  usingDefault: 'Using the deployment default',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved',
  saveFailed: 'Save failed; the Host did not accept the value',
  reset: 'Reset to deployment default',
  discard: 'Discard changes',
  expand: 'Expand',
  collapse: 'Collapse',
  retry: 'Retry',
  loading: 'Reading rules…',
  loadFailed: 'Cannot read the shield state',
  unavailable: 'The Host serves no file-shield settings, so the rules cannot be edited here.',
  readOnly: 'This connection does not write to the Host; the rules are read-only.',
  readOnlyShort: 'Read-only',
  deploymentHeading: 'Deployment default',
  deploymentNote: 'Comes from the deployment cordis.patch.yml and is read-only here.',
  deploymentEmpty: 'The deployment presets no shield rules.',
  globalHeading: 'Global rules',
  globalNote: 'Applies to every project and session, stacked on the project and session rules.',
  projectsHeading: 'Project rules',
  projectsNote: 'Applies to one project inside a dsh workspace; one section per project, stacked with the other levels. The list below is this host\'s own workspaces; you can also add an unregistered directory.',
  projectsEmpty: 'No project-level rules yet.',
  projectAdd: 'Pick a project directory…',
  sessionsHeading: 'Session rules',
  sessionsNote: 'Session rules are edited in the session\'s Shield tab; this is a summary.',
  sessionsEmpty: 'No session-level rules.',
  ruleCount: '{count} rule(s)',
  sessionTotal: '{count} session(s) with rules',
  projectNew: 'New directory: takes effect once saved',
  projectUse: 'Select',
  projectsNoWorkspace: 'This host exposes no dsh workspace list; pick a directory with the browser below.',
  viewTab: 'Shield',
  viewLead: 'Rules here apply to this session only; they stack with the deployment default, the global tier, and project tiers.',
  sessionCwd: 'Workspace',
  sessionCwdUnknown: 'unknown',
  sessionNote: 'This session\'s rules stack on the deployment default, global, and project levels; they do not replace them.',
  close: 'Close',
  browseTitle: 'Pick a file to block',
  browseUp: 'Up one level',
  browseChooseDirectory: 'Block this directory',
  browseEmpty: 'This directory is empty',
  browseFailed: 'Cannot list this directory',
  browseTruncated: 'Too many entries; only a part is shown',
  cancel: 'Cancel',
  kindPattern: 'Rule',
}