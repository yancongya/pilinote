import type { CSSProperties } from 'react'

interface VideoCardSkeletonProps {
  count?: number
  showHeader?: boolean
  dense?: boolean
  variant?: 'default' | 'initial' | 'append'
  className?: string
  style?: CSSProperties
}

export default function VideoCardSkeleton({
  count,
  showHeader,
  dense,
  variant = 'default',
  className = '',
  style
}: VideoCardSkeletonProps) {
  const resolvedCount = count ?? (variant === 'append' ? 3 : 6)
  const resolvedShowHeader = showHeader ?? variant === 'initial'
  const resolvedDense = dense ?? variant === 'append'

  return (
    <div
      className={`video-card-skeleton-list ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: resolvedDense ? '12px' : '16px',
        padding: resolvedDense ? '12px 0' : '16px 0',
        ...style
      }}
    >
      {resolvedShowHeader && (
        <div
          className="video-list-skeleton-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: resolvedDense ? '4px 16px 0' : '8px 16px 0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div
              className="skeleton-line"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                flexShrink: 0
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: 1 }}>
              <div className="skeleton-line" style={{ height: '18px', width: '42%', borderRadius: '999px' }} />
              <div className="skeleton-line" style={{ height: '14px', width: '28%', borderRadius: '999px' }} />
            </div>
          </div>
          <div
            className="skeleton-line"
            style={{
              width: '88px',
              height: '32px',
              borderRadius: '999px',
              flexShrink: 0
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: resolvedDense ? '12px' : '16px',
          padding: resolvedDense ? '0 12px 8px' : '0 16px 8px'
        }}
      >
        {Array.from({ length: resolvedCount }).map((_, index) => (
          <div
            key={index}
            className="video-card-skeleton"
            style={{
              width: 'calc(33.333% - 10px)',
              minWidth: '260px',
              flex: '1 1 280px',
              maxWidth: '380px',
              background: 'var(--color-bg-secondary)',
              borderRadius: '14px',
              overflow: 'hidden'
            }}
          >
            <div
              className="skeleton-cover"
              style={{ aspectRatio: '16/9', background: 'var(--color-bg-tertiary)' }}
            />

            <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="skeleton-line" style={{ height: '18px', width: '90%', borderRadius: '4px' }} />
              <div className="skeleton-line" style={{ height: '18px', width: '60%', borderRadius: '4px' }} />

              <div className="skeleton-line" style={{ height: '14px', width: '40%', marginTop: '4px', borderRadius: '4px' }} />

              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                <div className="skeleton-line" style={{ height: '12px', width: '50px', borderRadius: '4px' }} />
                <div className="skeleton-line" style={{ height: '12px', width: '50px', borderRadius: '4px' }} />
                <div className="skeleton-line" style={{ height: '12px', width: '50px', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-line {
          background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-border) 50%, var(--color-bg-tertiary) 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
