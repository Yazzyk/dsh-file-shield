/**
 * 规则编辑器打开的浏览器。它通过插件自己的只读浏览路由，
 * 一次列举宿主的一级目录，因为 harness 没有暴露任何列文件的
 * wire 方法。
 *
 * @module dsh-file-shield/src/client/Browser
 */

import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
import { BrowseError, browse, type BrowseListing } from './api.ts'
import type { NS } from './locales.ts'

/** 规则编辑器提供的 props；对话框自己持有列举状态。 */
export interface BrowserProps {
  t: TranslateNS<typeof NS>
  onCancel: () => void
  onPickFile: (path: string) => void
  onPickDirectory: (path: string) => void
}

/**
 * 渲染浏览对话框。
 *
 * @param props.t - 绑定到本插件命名空间的翻译函数。
 * @param props.onCancel - 关闭对话框。
 * @param props.onPickFile - 采用一个文件路径。
 * @param props.onPickDirectory - 采用当前列举的目录本身。
 * @returns 该对话框。
 */
export function DirectoryBrowser({ t, onCancel, onPickFile, onPickDirectory }: BrowserProps) {
  const [path, setPath] = useState<string | undefined>(undefined)
  const [listing, setListing] = useState<BrowseListing | undefined>(undefined)
  const [failure, setFailure] = useState<BrowseError | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailure(undefined)
    browse(path, controller.signal)
      .then((result) => { setListing(result) })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFailure(error instanceof BrowseError ? error : new BrowseError('unknown', String(error)))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => { controller.abort() }
  }, [path])

  const entries = listing?.entries ?? []
  const current = listing?.path

  return (
    <Modal
      open
      onClose={onCancel}
      closeLabel={t('cancel')}
      title={t('browseTitle')}
      description={current ?? ''}
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
          <Button
            variant="primary"
            disabled={current === undefined}
            onClick={() => { if (current !== undefined) onPickDirectory(current) }}
          >
            {t('browseChooseDirectory')}
          </Button>
        </>
      )}
    >
      <div className="dfs-browser">
        <div className="dfs-crumbs">
          <Button
            size="sm"
            variant="outline"
            disabled={listing?.parent === null || listing === undefined}
            onClick={() => { setPath(listing?.parent ?? undefined) }}
          >
            {t('browseUp')}
          </Button>
          <code className="dfs-path">{current ?? ''}</code>
        </div>
        {loading ? <p className="dfs-note">{t('loading')}</p> : null}
        {failure === undefined ? null : (
          <p className="dfs-note dfs-note-error">{t('browseFailed')} — {failure.code}</p>
        )}
        {!loading && failure === undefined && entries.length === 0 ? <p className="dfs-note">{t('browseEmpty')}</p> : null}
        {listing?.truncated === true ? <p className="dfs-note">{t('browseTruncated')}</p> : null}
        <ul className="dfs-list">
          {entries.map(entry => (
            <li key={entry.name}>
              <button
                type="button"
                className="dfs-row"
                disabled={entry.type === 'other'}
                onClick={() => {
                  const next = current === undefined ? entry.name : `${current}/${entry.name}`
                  if (entry.type === 'directory') setPath(next)
                  else onPickFile(next)
                }}
              >
                <span className="dfs-rowName">{entry.type === 'directory' ? `${entry.name}/` : entry.name}</span>
                {entry.symlink ? <span className="dfs-tag">link</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
