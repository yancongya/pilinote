import type { ReactNode } from 'react'

import MediaListState from './MediaListState'

export interface MediaListShellProps {
  title: ReactNode
  countLabel?: ReactNode
  controls?: ReactNode
  children?: ReactNode
  loading?: boolean
  loadingMore?: boolean
  error?: ReactNode
  hasItems?: boolean
  emptyText?: ReactNode
  refreshingHint?: ReactNode
  className?: string
  contentClassName?: string
  loadingSkeletonCount?: number
  loadingMoreSkeletonCount?: number
}

export default function MediaListShell({
  title,
  countLabel,
  controls,
  children,
  loading = false,
  loadingMore = false,
  error,
  hasItems = false,
  emptyText,
  refreshingHint,
  className = '',
  contentClassName = '',
  loadingSkeletonCount,
  loadingMoreSkeletonCount
}: MediaListShellProps) {
  const shellClassName = `content-section media-list-shell ${className}`.trim()

  return (
    <section className={shellClassName}>
      <div className="section-header media-list-shell-header">
        <div className="section-title media-list-shell-title">
          <h2>{title}</h2>
          {countLabel !== undefined && <span className="video-count">{countLabel}</span>}
        </div>
      </div>

      {controls && <div className="media-list-shell-controls">{controls}</div>}

      {loading ? (
        <MediaListState
          kind="loading"
          skeletonCount={loadingSkeletonCount}
          className="media-list-shell-state"
        />
      ) : error ? (
        <MediaListState
          kind="error"
          message={error}
          className="media-list-shell-state"
        />
      ) : !hasItems ? (
        <MediaListState
          kind="empty"
          message={emptyText}
          className="media-list-shell-state"
        />
      ) : (
        <>
          {refreshingHint && (
            <div className="media-list-shell-refreshing" role="status" aria-live="polite">
              {refreshingHint}
            </div>
          )}
          <div className={contentClassName}>{children}</div>
          {loadingMore && (
            <MediaListState
              kind="loadingMore"
              skeletonCount={loadingMoreSkeletonCount}
              className="media-list-shell-state"
            />
          )}
        </>
      )}
    </section>
  )
}
