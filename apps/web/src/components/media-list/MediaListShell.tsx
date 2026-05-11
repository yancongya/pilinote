import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import MediaListState from './MediaListState'
import './MediaListShell.css'

export interface MediaListShellProps {
  title?: ReactNode
  countLabel?: ReactNode
  topBar?: ReactNode
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
  topBar,
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
  const shellRef = useRef<HTMLElement>(null)
  const topbarRef = useRef<HTMLDivElement>(null)
  const [portalReady, setPortalReady] = useState(false)
  const [topbarHeight, setTopbarHeight] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  // 桌面端强制样式修复
  const shellStyle: React.CSSProperties = isDesktop ? {
    marginTop: '-32px',
    paddingTop: 0
  } : {}

  useLayoutEffect(() => {
    const updateVisibility = () => {
      const rect = shellRef.current?.getBoundingClientRect()
      const isVisible = Boolean(rect && rect.width > 0 && rect.height > 0)
      const isMobileView = window.innerWidth <= 768
      setIsMobile(isMobileView)
      setIsDesktop(!isMobileView)
      // 只在移动端启用 portal
      setPortalReady(isVisible && isMobileView)
    }

    updateVisibility()
    window.addEventListener('resize', updateVisibility)

    const observer = new ResizeObserver(updateVisibility)
    if (shellRef.current) observer.observe(shellRef.current)

    return () => {
      window.removeEventListener('resize', updateVisibility)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const updateTopbarHeight = () => {
      setTopbarHeight(topbarRef.current?.getBoundingClientRect().height || 0)
    }

    updateTopbarHeight()

    const observer = new ResizeObserver(updateTopbarHeight)
    if (topbarRef.current) observer.observe(topbarRef.current)

    return () => observer.disconnect()
  }, [portalReady, topBar, controls, title, countLabel])

  const topbarNode = (
    <div
      ref={topbarRef}
      className={`media-list-shell-topbar${portalReady ? ' media-list-shell-topbar--portal' : ''}`}
    >
      {topBar ? (
        topBar
      ) : (
        <>
          <div className="section-header media-list-shell-header">
            <div className="section-title media-list-shell-title">
              <h2>{title}</h2>
              {countLabel !== undefined && <span className="video-count">{countLabel}</span>}
            </div>
          </div>

          {controls && <div className="media-list-shell-controls">{controls}</div>}
        </>
      )}
    </div>
  )

  return (
    <section ref={shellRef} className={shellClassName} style={shellStyle}>
      {portalReady ? createPortal(topbarNode, document.body) : topbarNode}
      {portalReady && (
        <div
          className="media-list-shell-topbar-spacer"
          style={{ height: topbarHeight || undefined }}
          aria-hidden="true"
        />
      )}

      <div className="media-list-shell-body" style={isDesktop ? { paddingTop: 0 } : {}}>
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
      </div>
    </section>
  )
}
