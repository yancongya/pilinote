import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import VideoCardSkeleton from '../VideoCardSkeleton'

export type MediaListStateKind = 'loading' | 'loadingMore' | 'empty' | 'error'

export interface MediaListStateProps {
  kind: MediaListStateKind
  message?: ReactNode
  title?: ReactNode
  action?: ReactNode
  skeletonCount?: number
  showHeader?: boolean
  dense?: boolean
  className?: string
}

export default function MediaListState({
  kind,
  message,
  title,
  action,
  skeletonCount,
  showHeader,
  dense,
  className = ''
}: MediaListStateProps) {
  const shellStyle = {
    padding: kind === 'loadingMore' ? '8px 16px 0' : '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  }

  const panelStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    border: '1px solid var(--color-border)',
    borderRadius: '16px',
    background: 'var(--color-bg-secondary)',
    padding: '18px 16px'
  }

  const contentStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    minWidth: 0
  }

  if (kind === 'loading') {
    return (
      <div
        className={`media-list-state media-list-state--loading ${className}`.trim()}
        role="status"
        aria-live="polite"
        style={shellStyle}
      >
        <VideoCardSkeleton
          count={skeletonCount ?? 6}
          showHeader={showHeader ?? false}
          dense={dense ?? false}
          variant="initial"
        />
      </div>
    )
  }

  if (kind === 'loadingMore') {
    return (
      <div
        className={`media-list-state media-list-state--loading-more ${className}`.trim()}
        role="status"
        aria-live="polite"
        style={shellStyle}
      >
        <div
          className="media-list-state-loading-indicator"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'var(--color-text-secondary)',
            fontSize: '13px'
          }}
        >
          <LoaderCircle className="media-list-state-loading-icon" size={18} />
          <span>{message ?? '正在加载更多视频...'}</span>
        </div>
        <VideoCardSkeleton
          count={skeletonCount ?? 3}
          dense={dense ?? true}
          showHeader={showHeader ?? false}
          variant="append"
        />
      </div>
    )
  }

  const isError = kind === 'error'
  const icon = isError ? (
    <AlertCircle size={24} />
  ) : (
    <Inbox size={24} />
  )

  const defaultTitle = isError ? '加载失败' : '暂无内容'
  const defaultMessage = isError ? '请稍后重试' : '当前没有可显示的视频'

  return (
    <div
      className={`media-list-state media-list-state--${kind} ${className}`.trim()}
      role="status"
      aria-live={isError ? 'assertive' : 'polite'}
      style={panelStyle}
    >
      <div
        className="media-list-state-icon"
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '999px',
          background: isError ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-bg-primary)',
          color: isError ? 'var(--color-error-500)' : 'var(--color-text-secondary)',
          flexShrink: 0
        }}
      >
        {icon}
      </div>
      <div className="media-list-state-content" style={contentStyle}>
        <div className="media-list-state-title" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {title ?? defaultTitle}
        </div>
        <div className="media-list-state-message" style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {message ?? defaultMessage}
        </div>
        {action && <div className="media-list-state-action">{action}</div>}
      </div>
    </div>
  )
}
