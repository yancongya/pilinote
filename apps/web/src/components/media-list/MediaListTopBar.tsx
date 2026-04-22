import type { ReactNode } from 'react'
import './MediaListTopBar.css'

export interface MediaListTopBarProps {
  title: ReactNode
  countLabel?: ReactNode
  primaryActions?: ReactNode
  secondaryActions?: ReactNode
  filters?: ReactNode
  className?: string
}

export default function MediaListTopBar({
  title,
  countLabel,
  primaryActions,
  secondaryActions,
  filters,
  className = ''
}: MediaListTopBarProps) {
  const topBarClassName = `media-list-topbar ${className}`.trim()

  return (
    <div className={topBarClassName}>
      <div className="media-list-topbar-header">
        <div className="media-list-topbar-title">
          <div className="media-list-topbar-title-content">{title}</div>
          {countLabel !== undefined && <span className="video-count">{countLabel}</span>}
        </div>

        {(secondaryActions || primaryActions) && (
          <div className="media-list-topbar-actions">
            {secondaryActions && <div className="media-list-topbar-secondary">{secondaryActions}</div>}
            {primaryActions && <div className="media-list-topbar-primary">{primaryActions}</div>}
          </div>
        )}
      </div>

      {filters && <div className="media-list-topbar-filters">{filters}</div>}
    </div>
  )
}
