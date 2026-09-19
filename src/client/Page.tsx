/**
 * 本 bundle 的 Plugins 卡片上的 File Shield 页面。
 *
 * 页面在本地暂存编辑，只在点击保存时写入，
 * 所以屏幕上的内容就是一次保存会存下的内容。
 * 规则列表读自宿主插件安装的 `file-shield` 设置段；
 * 用户层缺失意味着 `cordis.patch.yml` 里的部署默认生效。
 *
 * @module dsh-file-shield/src/client/Page
 */

import { Button, Input, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useMemo, useState, useSyncExternalStore } from 'react'
// 仅类型：引入 `plugins.bundle.config` 座位与 `ctx.settingsScope`，不产生运行时导入。
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { DirectoryBrowser } from './Browser.tsx'
import type { NS } from './locales.ts'

/** 本页面编辑的设置段。 */
export interface RulesSection {
  deny?: string[]
}

/** 注册项注入页面的业务面。 */
export interface FileShieldFace {
  /** 绑定在 `file-shield` 设置命名空间上的作用域。 */
  scope: SettingsScope<RulesSection>
  /** 打开官方目录选择器；没有挂载 workspace UI 时为 undefined。 */
  pickDirectory: (() => Promise<string | null>) | undefined
}

/** 完整的组件 props：运行时份额、locale 座位，以及注入的业务面。 */
export type FileShieldPageProps =
  PropsRuntime<'plugins.bundle.config'>
  & PropsLocale<typeof NS>
  & InjectFace<FileShieldFace>

/** 两个规则列表是否以相同顺序持有相同条目。 */
function sameRules(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index])
}

/** 规则是 glob 而不是字面路径时为 true。 */
function isPattern(rule: string): boolean {
  return /[*?[\]{}]/u.test(rule)
}

/**
 * 渲染页面。
 *
 * @param props - 组装后的 slot props。
 * @returns 摘要视图的一行文本，或页面视图的表单。
 */
export function FileShieldPage(props: FileShieldPageProps) {
  const { t, view, scope, pickDirectory } = props
  const subscribe = useMemo(() => (listener: () => void) => scope.subscribe(listener), [scope])
  const snapshot = useSyncExternalStore(subscribe, () => scope.getSnapshot(), () => scope.getSnapshot())

  /** 暂存列表；`null` 表示"未编辑"，此时显示已存储的设置段。 */
  const [staged, setStaged] = useState<string[] | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [manual, setManual] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  const stored = snapshot.value?.deny ?? []
  const rules = staged ?? stored
  const userLayer = snapshot.user
  const overridden = typeof userLayer === 'object' && userLayer !== null && 'deny' in userLayer

  if (view === 'summary') {
    return rules.length === 0 ? t('summaryNone') : t('summaryCount', { count: rules.length })
  }
  if (snapshot.status === 'unavailable') return <p className="dfs-note">{t('unavailable')}</p>
  if (snapshot.status === 'loading') return <p className="dfs-note">{t('loading')}</p>

  const writable = snapshot.writable

  /** 暂存一个新列表，并清掉上一次的保存结论。 */
  const update = (next: string[]) => {
    setStaged(next)
    setStatus('idle')
  }
  const add = (candidate: string) => {
    const rule = candidate.trim()
    if (rule === '' || rules.includes(rule)) return
    update([...rules, rule])
  }
  const submitManual = () => {
    add(manual)
    setManual('')
  }

  /** 写入暂存列表，并根据结果设置段报告宿主的结论。 */
  const save = async () => {
    if (staged === null) return
    setStatus('saving')
    await scope.set('deny', staged)
    const accepted = scope.getSnapshot().value?.deny
    if (accepted !== undefined && sameRules(accepted, staged)) {
      setStaged(null)
      setStatus('saved')
    } else {
      setStatus('failed')
    }
  }

  /** 清除用户层，使部署默认重新生效。 */
  const reset = async () => {
    setStatus('saving')
    await scope.unset('deny')
    const layer = scope.getSnapshot().user
    if (typeof layer !== 'object' || layer === null || !('deny' in layer)) {
      setStaged(null)
      setStatus('saved')
    } else {
      setStatus('failed')
    }
  }

  return (
    <div className="dfs-page">
      <div className="dfs-head">
        <h4 className="dfs-heading">{t('rulesHeading')}</h4>
        <Tag tone="neutral">{overridden ? t('overridden') : t('usingDefault')}</Tag>
      </div>

      {rules.length === 0
        ? <p className="dfs-note">{t('emptyRules')}</p>
        : (
          <ul className="dfs-rules">
            {rules.map(rule => (
              <li key={rule} className="dfs-rule">
                {isPattern(rule) ? <Tag tone="neutral">{t('kindPattern')}</Tag> : null}
                <code className="dfs-path">{rule}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!writable}
                  onClick={() => { update(rules.filter(entry => entry !== rule)) }}
                >
                  {t('remove')}
                </Button>
              </li>
            ))}
          </ul>
        )}

      <div className="dfs-actions">
        <Button variant="outline" disabled={!writable} onClick={() => { setBrowsing(true) }}>{t('addFile')}</Button>
        <Button
          variant="outline"
          disabled={!writable || pickDirectory === undefined}
          onClick={() => {
            void pickDirectory?.().then((picked) => { if (typeof picked === 'string') add(picked) })
          }}
        >
          {t('addSystemDirectory')}
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
              : status === 'saved' ? t('saved') : status === 'failed' ? t('saveFailed') : ''}
        </span>
        <div className="dfs-actions">
          <Button variant="ghost" disabled={!writable || !overridden} onClick={() => { void reset() }}>{t('reset')}</Button>
          <Button variant="primary" disabled={!writable || staged === null} onClick={() => { void save() }}>{t('save')}</Button>
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
