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
  | 'summaryNone'
  | 'summaryCount'
  | 'rulesHeading'
  | 'emptyRules'
  | 'addFile'
  | 'addDirectory'
  | 'addSystemDirectory'
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
  | 'loading'
  | 'unavailable'
  | 'readOnly'
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
  summaryNone: '未屏蔽任何文件',
  summaryCount: '已屏蔽 {count} 条规则',
  rulesHeading: '已屏蔽的路径',
  emptyRules: '还没有规则。agent 目前可以读取工作区内的任何文件。',
  addFile: '选择文件…',
  addDirectory: '选择目录…',
  addSystemDirectory: '系统目录选择器…',
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
  loading: '正在读取规则…',
  unavailable: 'Host 未提供 file-shield 设置，规则暂不可编辑。',
  readOnly: '当前连接不写入 Host，规则只读。',
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
  summaryNone: 'No file is blocked',
  summaryCount: '{count} rule(s) blocked',
  rulesHeading: 'Blocked paths',
  emptyRules: 'No rules yet. The agent can read anything in the workspace.',
  addFile: 'Pick a file…',
  addDirectory: 'Pick a directory…',
  addSystemDirectory: 'System directory picker…',
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
  loading: 'Reading rules…',
  unavailable: 'The Host serves no file-shield settings, so the rules cannot be edited here.',
  readOnly: 'This connection does not write to the Host; the rules are read-only.',
  browseTitle: 'Pick a file to block',
  browseUp: 'Up one level',
  browseChooseDirectory: 'Block this directory',
  browseEmpty: 'This directory is empty',
  browseFailed: 'Cannot list this directory',
  browseTruncated: 'Too many entries; only a part is shown',
  cancel: 'Cancel',
  kindPattern: 'Rule',
}
