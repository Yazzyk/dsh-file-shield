/**
 * 会话顶部的盾牌按钮，以及它打开的会话级配置对话框。
 *
 * 会话级规则挂在会话本身上：同一条会话怎么被屏蔽，取决于它的 id，
 * 而不是某个项目的路径。因此这里同时展示会话的工作区（宿主记的那一个），
 * 让用户看清自己正在给哪段工作区加规则；规则本身与其他层叠加生效。
 *
 * @module dsh-file-shield/src/client/SessionShield
 */

import { Button, IconShieldOutlineRegular, Modal, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
// 仅类型：引入 'conversation.session.header.utilities' 座位，不产生运行时导入。
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { RuleEditor } from './LevelsPanel.tsx'
import type { NS } from './locales.ts'
import { StateError, readSessionCwd, readState, writeState } from './state.ts'

/** 注册项注入按钮的业务面：本按钮所属的会话。 */
export interface SessionShieldFace {
  /** 会话 id，来自注册时的 inject 工厂。 */
  sessionId: string
}

/** 完整的组件 props：运行时份额、locale 座位，以及注入的业务面。 */
export type SessionShieldProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<typeof NS>
  & InjectFace<SessionShieldFace>

/**
 * 渲染会话头部的盾牌按钮与它的对话框。
 *
 * @param props - 组装后的 slot props。
 * @returns 一个按钮；对话框打开时才挂载内容。
 */
export function SessionShieldAction(props: SessionShieldProps) {
  const { t, sessionId } = props
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={<IconShieldOutlineRegular size={16} />}
        aria-label={t('sessionButton')}
        title={t('sessionButton')}
        onClick={() => { setOpen(true) }}
      />
      {open
        ? <SessionShieldDialog t={t} sessionId={sessionId} onClose={() => { setOpen(false) }} />
        : null}
    </>
  )
}

/**
 * 会话级对话框本体。
 *
 * 每次打开都重新读一次状态：规则可能在别的标签页或别的会话里被改过，
 * 缓存一份旧的会让人以为保存没生效。
 *
 * @param props.t - 绑定到本插件命名空间的翻译函数。
 * @param props.sessionId - 本按钮所属的会话。
 * @param props.onClose - 关闭对话框。
 * @returns 含工作区路径与会话级规则编辑器的对话框。
 */
function SessionShieldDialog({ t, sessionId, onClose }: {
  t: SessionShieldProps['t']
  sessionId: string
  onClose: () => void
}) {
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
    // 工作区路径只用于展示，取不到就显示「未知」，不让它拖垮整块对话框。
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
    <Modal
      open
      onClose={onClose}
      closeLabel={t('close')}
      title={t('sessionTitle')}
      description={t('sessionNote')}
      footer={<Button variant="outline" onClick={onClose}>{t('close')}</Button>}
      contentClassName="dfs-dialogBody"
    >
      <div className="dfs-dialog">
        <div className="dfs-head">
          <span className="dfs-status">{t('sessionCwd')}</span>
          <code className="dfs-path dfs-path-grow">{cwd ?? t('sessionCwdUnknown')}</code>
        </div>
        <div className="dfs-head">
          <span className="dfs-status">session</span>
          <code className="dfs-path dfs-path-grow">{sessionId}</code>
          <Tag tone="neutral">{t('ruleCount', { count: rules.length })}</Tag>
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
        {status === 'ready'
          ? <RuleEditor t={t} rules={rules} writable onSave={save} />
          : null}
      </div>
    </Modal>
  )
}
