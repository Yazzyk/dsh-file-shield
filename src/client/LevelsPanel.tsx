/**
 * File Shield 在左侧面板列表里的入口，也就是点开后的配置窗口。
 *
 * 三级规则（全局 / 项目 / 会话）是**叠加**的：部署默认、全局、该项目、
 * 该会话同时到达 agent，所以每一段只编辑并提交自己那一层，界面上没有任何
 * 「覆盖」动作。会话层不在这里编辑——它属于会话本身，入口在会话顶部，
 * 这里只做只读汇总。
 *
 * @module dsh-file-shield/src/client/LevelsPanel
 */

import { Button, IconShieldOutlineRegular, Input, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
// 仅类型：引入 'main' 座位与全局 standard props，不产生运行时导入。
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// 仅类型：让 'sidebar.panellist' 的 label 与主区 key 使用同一份声明。
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { DirectoryBrowser } from './Browser.tsx'
import type { NS } from './locales.ts'
import { StateError, readState, writeState, type StateWrite, type ShieldState } from './state.ts'

/** 注册项注入面板的业务面。 */
export interface LevelsPanelFace {
  /** 打开官方目录选择器；没有挂载 workspace UI 时为 undefined。 */
  pickDirectory: (() => Promise<string | null>) | undefined
  /** 打开系统文件对话框；纯浏览器（拿不到真实路径）时为 undefined。 */
  pickFile: (() => Promise<string | null>) | undefined
}

/** 完整的组件 props：运行时份额、locale 座位，以及注入的业务面。 */
export type LevelsPanelProps =
  PropsRuntime<'main'>
  & PropsLocale<typeof NS>
  & InjectFace<LevelsPanelFace>

/** 规则是 glob 而不是字面路径时为 true。 */
export function isPattern(rule: string): boolean {
  return /[*?[\]{}]/u.test(rule)
}

/** 一次写入的结论：成功为 undefined，失败是宿主的错误码。 */
export type SaveOutcome = string | undefined

/** 规则编辑器提供的 props；编辑状态由编辑器自己持有。 */
export interface RuleEditorProps {
  t: TranslateNS<typeof NS>
  /** 服务端上该层当前的规则。 */
  rules: readonly string[]
  /** 是否允许编辑；状态路由不返回写能力，调用方传 true，拒绝由保存结论呈现。 */
  writable: boolean
  /**
   * 系统目录对话框。有它就先走它——那是使用者自己机器上的文件夹对话框，
   * 比插件自带的只读浏览器快得多；没有（远程浏览器、无 workspace UI）才退回自带浏览器。
   */
  pickDirectory?: (() => Promise<string | null>) | undefined
  /**
   * 系统文件对话框。桌面应用才拿得到真实路径（preload 的 `__DSH_HOST_PATHS__`），
   * 纯浏览器里 `File` 对象不带路径，因此它返回 null，调用方退回自带浏览器。
   */
  pickFile?: (() => Promise<string | null>) | undefined
  /** 把这组规则写到该层；返回宿主的拒绝码，成功时为 undefined。 */
  onSave: (rules: string[]) => Promise<SaveOutcome>
}

/**
 * 一层规则的编辑器：本地暂存、显式保存、显式失败。
 *
 * 只在点击保存时写入，所以屏幕上的内容就是一次保存会存下的内容；
 * 父级在保存成功时用宿主返回的状态刷新自己，暂存因此可以清空。
 *
 * @param props.t - 绑定到本插件命名空间的翻译函数。
 * @param props.rules - 该层当前的规则。
 * @param props.writable - 当前连接是否允许写入。
 * @param props.onSave - 写入该层。
 * @returns 规则列表、增删按钮与保存栏。
 */
export function RuleEditor({ t, rules, writable, pickDirectory, pickFile, onSave }: RuleEditorProps) {
  /** 暂存列表；`null` 表示"未编辑"，此时显示该层的当前规则。 */
  const [staged, setStaged] = useState<string[] | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [manual, setManual] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [failure, setFailure] = useState<string | undefined>(undefined)

  const current = staged ?? [...rules]

  /** 暂存一个新列表，并清掉上一次的保存结论。 */
  const update = (next: string[]) => {
    setStaged(next)
    setStatus('idle')
    setFailure(undefined)
  }
  const add = (candidate: string) => {
    const rule = candidate.trim()
    if (rule === '' || current.includes(rule)) return
    update([...current, rule])
  }
  const submitManual = () => {
    add(manual)
    setManual('')
  }

  /** 写入暂存列表，并把宿主的结论落到状态栏。 */
  const save = async () => {
    if (staged === null) return
    setStatus('saving')
    setFailure(undefined)
    const code = await onSave(staged)
    if (code === undefined) {
      setStaged(null)
      setStatus('saved')
    } else {
      setFailure(code)
      setStatus('failed')
    }
  }

  return (
    <div className="dfs-editor">
      {current.length === 0
        ? <p className="dfs-note">{t('emptyRules')}</p>
        : (
          <ul className="dfs-rules">
            {current.map(rule => (
              <li key={rule} className="dfs-rule">
                {isPattern(rule) ? <Tag tone="neutral">{t('kindPattern')}</Tag> : null}
                <code className="dfs-path">{rule}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!writable}
                  onClick={() => { update(current.filter(entry => entry !== rule)) }}
                >
                  {t('remove')}
                </Button>
              </li>
            ))}
          </ul>
        )}

      <div className="dfs-buttons">
        {/* 两个按钮都走系统对话框，一个选目录一个选文件：屏蔽一个 .env 与屏蔽整棵子树是两种真实需求。 */}
        {pickDirectory === undefined ? null : (
          <Button
            variant="outline"
            disabled={!writable}
            onClick={() => {
              void pickDirectory().then((picked) => { if (typeof picked === 'string') add(picked) })
            }}
          >
            {t('pickSystemDirectory')}
          </Button>
        )}
        {/*
          选文件只有一个入口：桌面应用里是系统文件对话框；纯浏览器拿不到 File 的真实路径
          （没有 preload 的 __DSH_HOST_PATHS__），同一个按钮原地变成应用内浏览器。
          两个按钮并排会让"选文件"看起来有两件不同的事，而它们作用完全相同。
        */}
        <Button
          variant={pickDirectory === undefined && pickFile === undefined ? 'outline' : 'ghost'}
          disabled={!writable}
          onClick={() => {
            if (pickFile === undefined) { setBrowsing(true); return }
            void pickFile().then((picked) => {
              if (typeof picked === 'string' && picked !== '') add(picked)
              else if (picked === null) setBrowsing(true)
            })
          }}
        >
          {pickFile === undefined ? t('addFile') : t('pickSystemFile')}
        </Button>
      </div>

      <div className="dfs-actions">
        <Input
          value={manual}
          placeholder={t('manualPlaceholder')}
          disabled={!writable}
          onChange={(event) => { setManual(event.currentTarget.value) }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            submitManual()
          }}
        />
        <Button variant="outline" disabled={!writable || manual.trim() === ''} onClick={submitManual}>
          {t('manualAdd')}
        </Button>
      </div>

      <div className="dfs-foot">
        <span className="dfs-status">
          {!writable
            ? t('readOnly')
            : status === 'saving'
              ? t('saving')
              : status === 'saved'
                ? t('saved')
                : status === 'failed' ? `${t('saveFailed')} — ${failure ?? 'unknown'}` : ''}
        </span>
        <div className="dfs-buttons">
          <Button
            variant="ghost"
            disabled={!writable || staged === null}
            onClick={() => {
              // 撤销回到服务端上那一层，而不是清空：清空本身是一次写入意图。
              setStaged(null)
              setStatus('idle')
              setFailure(undefined)
            }}
          >
            {t('discard')}
          </Button>
          <Button variant="primary" disabled={!writable || staged === null} onClick={() => { void save() }}>
            {t('save')}
          </Button>
        </div>
      </div>

      {browsing
        ? (
          <DirectoryBrowser
            t={t}
            onCancel={() => { setBrowsing(false) }}
            onPickFile={(path) => {
              add(path)
              setBrowsing(false)
            }}
            onPickDirectory={(path) => {
              add(path)
              setBrowsing(false)
            }}
          />
        )
        : null}
    </div>
  )
}

/**
 * 渲染面板。
 *
 * @param props - 组装后的 slot props。
 * @returns 三级配置窗口。
 */
export function LevelsPanel(props: LevelsPanelProps) {
  const { t, pickDirectory, pickFile } = props
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [state, setState] = useState<ShieldState | undefined>(undefined)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [reload, setReload] = useState(0)
  /** 展开中的项目（绝对路径）；一次只展开一个，避免长列表互相挤占。 */
  const [open, setOpen] = useState<string | null>(null)
  /** 刚选好、尚未保存过规则的项目目录。 */
  const [pending, setPending] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setFailure(undefined)
    readState(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setState(next)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFailure(error instanceof StateError ? error.code : String(error))
        setStatus('failed')
      })
    return () => { controller.abort() }
  }, [reload])

  /**
   * 写入一层，并把宿主返回的整份状态落回本地。
   *
   * @param body - 目标层与规则。
   * @returns 成功为 undefined，失败为宿主的错误码。
   */
  const write = async (body: StateWrite): Promise<SaveOutcome> => {
    try {
      const next = await writeState(body)
      setState(next)
      setStatus('ready')
      return undefined
    } catch (error) {
      return error instanceof StateError ? error.code : 'unknown'
    }
  }

  if (status === 'loading') return <p className="dfs-note">{t('loading')}</p>
  if (status === 'failed') {
    return (
      <div className="dfs-page">
        <p className="dfs-note dfs-note-error">{t('loadFailed')} — {failure ?? 'unknown'}</p>
        <div className="dfs-buttons">
          <Button variant="outline" onClick={() => { setReload(value => value + 1) }}>{t('retry')}</Button>
        </div>
      </div>
    )
  }
  if (state === undefined) return <p className="dfs-note">{t('loading')}</p>

  const projects = Object.entries(state.levels.projects)
    .sort(([left], [right]) => left.localeCompare(right))
  const sessions = Object.entries(state.levels.sessions)
    .sort(([left], [right]) => left.localeCompare(right))
  const extra = pending !== null && !(pending in state.levels.projects) ? pending : undefined

  /** 采用一个目录作为项目层的新键，并展开它。 */
  const pickProject = (path: string) => {
    setPending(path)
    setOpen(path)
    setBrowsing(false)
  }

  return (
    <div className="dfs-panel">
      <header className="dfs-panelHead">
        <IconShieldOutlineRegular size={20} />
        <h2 className="dfs-panelTitle">{t('title')}</h2>
      </header>
      <p className="dfs-note">{t('panelIntro')}</p>

      <section className="dfs-level">
        <div className="dfs-head">
          <h4 className="dfs-heading">{t('deploymentHeading')}</h4>
          <Tag tone="quiet">{t('readOnlyShort')}</Tag>
        </div>
        <p className="dfs-note">{t('deploymentNote')}</p>
        {state.deployment.length === 0
          ? <p className="dfs-note">{t('deploymentEmpty')}</p>
          : (
            <ul className="dfs-rules">
              {state.deployment.map(rule => (
                <li key={rule} className="dfs-rule">
                  {isPattern(rule) ? <Tag tone="neutral">{t('kindPattern')}</Tag> : null}
                  <code className="dfs-path">{rule}</code>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="dfs-level">
        <div className="dfs-head">
          <h4 className="dfs-heading">{t('globalHeading')}</h4>
          <Tag tone={state.levels.global.length === 0 ? 'neutral' : 'info'}>
            {state.levels.global.length === 0 ? t('summaryNone') : t('ruleCount', { count: state.levels.global.length })}
          </Tag>
        </div>
        <p className="dfs-note">{t('globalNote')}</p>
        <RuleEditor
          t={t}
          rules={state.levels.global}
          writable
          pickDirectory={pickDirectory}
          pickFile={pickFile}
          onSave={(rules) => write({ scope: 'global', rules })}
        />
      </section>

      <section className="dfs-level">
        <div className="dfs-head">
          <h4 className="dfs-heading">{t('projectsHeading')}</h4>
        </div>
        <p className="dfs-note">{t('projectsNote')}</p>

        {/* dsh 的工作区列表：项目级的键取它的路径，所以先给"点一个项目"，再给手动入口。 */}
        {state.workspaces.length === 0
          ? <p className="dfs-note">{t('projectsNoWorkspace')}</p>
          : (
            <ul className="dfs-rules">
              {state.workspaces.map(workspace => {
                const has = workspace.path in state.levels.projects
                return (
                  <li key={workspace.id}>
                    <button
                      type="button"
                      className="dfs-row"
                      onClick={() => {
                        if (has) { setOpen(workspace.path); return }
                        pickProject(workspace.path)
                      }}
                    >
                      <span className="dfs-rowName">{workspace.title}</span>
                      <code className="dfs-path">{workspace.path}</code>
                      <Tag tone={has ? 'info' : 'quiet'}>
                        {has ? t('ruleCount', { count: state.levels.projects[workspace.path]?.length ?? 0 }) : t('projectUse')}
                      </Tag>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

        {projects.length === 0 && extra === undefined ? <p className="dfs-note">{t('projectsEmpty')}</p> : null}

        {projects.map(([workspace, rules]) => (
          <div className="dfs-levelRow" key={workspace}>
            <button
              type="button"
              className="dfs-row"
              aria-expanded={open === workspace}
              onClick={() => { setOpen(open === workspace ? null : workspace) }}
            >
              <code className="dfs-path dfs-path-grow">{workspace}</code>
              <Tag tone="neutral">{t('ruleCount', { count: rules.length })}</Tag>
              <span className="dfs-hint">{open === workspace ? t('collapse') : t('expand')}</span>
            </button>
            {open === workspace
              ? (
                <RuleEditor
                  t={t}
                  rules={rules}
                  writable
                  pickDirectory={pickDirectory}
                  pickFile={pickFile}
                  onSave={(next) => write({ scope: 'project', workspace, rules: next })}
                />
              )
              : null}
          </div>
        ))}

        {extra === undefined ? null : (
          <div className="dfs-levelRow">
            <div className="dfs-row dfs-row-static">
              <code className="dfs-path dfs-path-grow">{extra}</code>
              <Tag tone="warning">{t('projectNew')}</Tag>
            </div>
            <RuleEditor
              t={t}
              rules={[]}
              writable
              pickDirectory={pickDirectory}
              pickFile={pickFile}
              onSave={async (next) => {
                const outcome = await write({ scope: 'project', workspace: extra, rules: next })
                // 目录一旦在服务端有自己的条目，就交给上面的列表显示，
                // 否则同一个目录会同时出现两段编辑器。
                if (outcome === undefined) setPending(null)
                return outcome
              }}
            />
          </div>
        )}

        <div className="dfs-buttons">
          {/*
            项目层的键必须是目录，所以主入口就是系统选择器；应用内浏览是它在远程浏览器 /
            没有 workspace UI 时的替身（那时拿不到本机对话框）。
          */}
          {pickDirectory === undefined ? null : (
            <Button
              variant="outline"
              onClick={() => {
                void pickDirectory().then((picked) => { if (typeof picked === 'string') pickProject(picked) })
              }}
            >
              {t('addSystemDirectory')}
            </Button>
          )}
          <Button
            variant={pickDirectory === undefined ? 'outline' : 'ghost'}
            onClick={() => { setBrowsing(true) }}
          >
            {t('projectAdd')}
          </Button>
        </div>
      </section>

      <section className="dfs-level">
        <div className="dfs-head">
          <h4 className="dfs-heading">{t('sessionsHeading')}</h4>
          <Tag tone="neutral">{t('sessionTotal', { count: sessions.length })}</Tag>
        </div>
        <p className="dfs-note">{t('sessionsNote')}</p>
        {sessions.length === 0
          ? <p className="dfs-note">{t('sessionsEmpty')}</p>
          : (
            <ul className="dfs-rules">
              {sessions.map(([session, rules]) => (
                <li key={session} className="dfs-rule">
                  <code className="dfs-path dfs-path-grow">{session}</code>
                  <Tag tone="neutral">{t('ruleCount', { count: rules.length })}</Tag>
                </li>
              ))}
            </ul>
          )}
      </section>

      {browsing
        ? (
          <DirectoryBrowser
            t={t}
            onCancel={() => { setBrowsing(false) }}
            onPickDirectory={(path) => { pickProject(path) }}
            onPickFile={(path) => {
              // 项目层的键必须是目录，选中文件时取它所在的目录。
              const cut = path.lastIndexOf('/')
              pickProject(cut > 0 ? path.slice(0, cut) : path)
            }}
          />
        )
        : null}
    </div>
  )
}