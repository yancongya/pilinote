interface VideoCardSkeletonProps {
  count?: number
}

export default function VideoCardSkeleton({ count = 6 }: VideoCardSkeletonProps) {
  return (
    <div className="video-card-skeleton-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px' }}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="video-card-skeleton"
          style={{
            width: 'calc(33.333% - 11px)',
            minWidth: '280px',
            flex: '1 1 300px',
            maxWidth: '400px',
            background: 'var(--color-bg-secondary)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* 封面占位 */}
          <div className="skeleton-cover" style={{ aspectRatio: '16/9', background: 'var(--color-bg-tertiary)' }} />

          {/* 信息区域 */}
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* 标题占位 */}
            <div className="skeleton-line" style={{ height: '18px', width: '90%', borderRadius: '4px' }} />
            <div className="skeleton-line" style={{ height: '18px', width: '60%', borderRadius: '4px' }} />

            {/* 作者占位 */}
            <div className="skeleton-line" style={{ height: '14px', width: '40%', marginTop: '4px', borderRadius: '4px' }} />

            {/* 统计行占位 */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <div className="skeleton-line" style={{ height: '12px', width: '50px', borderRadius: '4px' }} />
              <div className="skeleton-line" style={{ height: '12px', width: '50px', borderRadius: '4px' }} />
              <div className="skeleton-line" style={{ height: '12px', width: '50px', borderRadius: '4px' }} />
            </div>
          </div>
        </div>
      ))}
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