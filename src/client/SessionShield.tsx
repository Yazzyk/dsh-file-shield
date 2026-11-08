/**
 * 会话的「屏蔽」标签页：一个与「对话」「轨迹」同级的 Conversation View。
 *
 * 为什么是标签页而不是会话头部的按钮：会话级规则是"这一整段会话怎么被对待"，与
 * 对话、轨迹属于同一个层级的东西——用户找它的心智位置就在那排标签里，而不是某个
 * 需要先发现的图标按钮。放在标签页还顺带解决了空间：规则列表、文件浏览器、保存
 * 结论都需要高度，按钮弹窗里只能放下一小块。
 *
 * 会话 id 由注册时的 inject 工厂给出（`conversation.view` 是 session 作用域的 list
 * 座位），所以这个页面默认就锚在当前会话上，不需要再挑一次会话。
 *
 * @module dsh-file-shield/src/client/SessionShield
 */

import { Button, IconShieldOutlineRegular, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
// 仅类型：引入 'conversation.view' 座位与 SessionStandardProps 的合并声明，不产生运行时导入。
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { RuleEditor } from './LevelsPanel.tsx'
import type { NS } from './locales.ts'
import { StateError, readSessionCwd, readState, writeState } from './state.ts'

/** 注册项注入页面的业务面：本页所属的会话。 */
export interface SessionShieldFace {
  /** 会话 id，来自注册时的 inject 工厂。 */
  sessionId: string
  /** 系统目录选择器；没有 workspace UI 时为 undefined，编辑器会退回自带浏览器。 */
  pickDirectory: (() => Promise<string | null>) | undefined
  /** 系统文件对话框；纯浏览器拿不到真实路径时为 undefined。 */
  pickFile: (() => Promise<string | null>) | undefined
}

/** 完整的组件 props：运行时份额、locale 座位，以及注入的业务面。 */
export type SessionShieldProps =
  PropsRuntime<'conversation.view'>
  & PropsLocale<typeof NS>
  & InjectFace<SessionShieldFace>

/**
 * 渲染会话级屏蔽页。
 *
 * 每次进入都重新读一次状态：规则可能在别的标签页、别的会话或面板里被改过，
 * 缓存一份旧的会让人以为保存没生效。
 *
 * @param props - 组装后的 slot props。
 * @returns 会话工作区、会话 id、规则编辑器与保存栏。
 */
export function SessionShieldView(props: SessionShieldProps) {
  const { t, sessionId, pickDirectory, pickFile } = props
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [rules, setRules] = useState<readonly string[]>([])
  const [cwd, setCwd] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setFailure(undefined)
    readState(controller.signal)
      .then((state) => {
        if (controller.signal.aborted) return
        setRules(state.levels.sessions[sessionId] ?? [])
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFailure(error instanceof StateError ? error.code : String(error))
        setStatus('failed')
      })
    // 工作区路径只用于展示，取不到就显示「未知」，不让它拖垮整页。
    readSessionCwd(sessionId, controller.signal)
      .then((path) => { if (!controller.signal.aborted) setCwd(path) })
      .catch(() => { if (!controller.signal.aborted) setCwd(null) })
    return () => { controller.abort() }
  }, [sessionId, reload])

  /** 写入本会话这一层，并用宿主返回的状态刷新规则。 */
  const save = async (next: string[]): Promise<string | undefined> => {
    try {
      const state = await writeState({ scope: 'session', session: sessionId, rules: next })
      setRules(state.levels.sessions[sessionId] ?? [])
      return undefined
    } catch (error) {
      return error instanceof StateError ? error.code : 'unknown'
    }
  }

  return (
    <div className="dfs-panel">
      <header className="dfs-panelHead">
        <IconShieldOutlineRegular size={20} />
        <h2 className="dfs-panelTitle">{t('viewTab')}</h2>
        <Tag tone="neutral">{t('ruleCount', { count: rules.length })}</Tag>
      </header>
      <p className="dfs-note">{t('viewLead')}</p>

      <div className="dfs-head">
        <span className="dfs-status">{t('sessionCwd')}</span>
        <code className="dfs-path dfs-path-grow">{cwd ?? t('sessionCwdUnknown')}</code>
      </div>
      <div className="dfs-head">
        <span className="dfs-status">session</span>
        <code className="dfs-path dfs-path-grow">{sessionId}</code>
      </div>

      {status === 'loading' ? <p className="dfs-note">{t('loading')}</p> : null}
      {status === 'failed'
        ? (
          <div className="dfs-editor">
            <p className="dfs-note dfs-note-error">{t('loadFailed')} — {failure ?? 'unknown'}</p>
            <div className="dfs-buttons">
              <Button variant="outline" onClick={() => { setReload(value => value + 1) }}>{t('retry')}</Button>
            </div>
          </div>
        )
        : null}
      {status === 'ready' ? <RuleEditor t={t} rules={rules} writable pickDirectory={pickDirectory} pickFile={pickFile} onSave={save} /> : null}
    </div>
  )
}
