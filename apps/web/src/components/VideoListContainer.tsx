import { ReactNode, RefObject } from 'react'
import VideoListCard from '../pages/components/VideoListCard.refactored'
import VideoCardSkeleton from './VideoCardSkeleton'

export interface Video {
  id: string
  bvid: string
  title: string
  cover: string
  duration: string
  uploader: string
  views: string
  danmaku: string
  comments: string
  likes: string
  coins: string
  favorites: string
  shares: string
  time: string
  [key: string]: any
}

export interface VideoListContainerProps {
  /** 视频列表 */
  videos: Video[]
  /** 加载中状态 */
  loading: boolean
  /** 加载更多状态 */
  loadingMore: boolean
  /** 错误信息 */
  error: string
  /** 批量模式状态 */
  batchMode?: boolean
  /** 选中的视频集合 */
  selectedVideos?: Set<string>
  /** 切换选中回调 */
  onToggleSelect?: (videoId: string) => void
  /** 全选回调 */
  onSelectAll?: () => void
  /** 是否显示批量选择头部 */
  batchSelectHeader?: boolean
  /** 下载切换回调 */
  onDownloadToggle?: (video: Video, e: React.MouseEvent) => void
  /** 获取下载状态 */
  getDownloadStatus?: (bvid: string) => 'none' | 'in_list' | 'downloaded'
  /** 额外的头部内容 */
  extraHeader?: ReactNode
  /** 额外的操作按钮 */
  extraActions?: ReactNode
  /** 加载更多的 ref，用于无限滚动 */
  loadMoreRef?: RefObject<HTMLDivElement | null>
  /** 是否有更多数据 */
  hasMore?: boolean
  /** 空状态提示文本 */
  emptyText?: string
  /** 自定义视频卡片渲染 */
  renderVideoCard?: (video: Video) => ReactNode
  /** 视频卡片是否可点击 */
  cardClickable?: boolean
  /** 视频列表的额外类名 */
  className?: string
}

export default function VideoListContainer({
  videos,
  loading,
  loadingMore,
  error,
  batchMode = false,
  selectedVideos = new Set(),
  onToggleSelect,
  onSelectAll,
  batchSelectHeader = false,
  onDownloadToggle,
  getDownloadStatus,
  extraHeader,
  extraActions,
  loadMoreRef,
  hasMore = true,
  emptyText = '暂无视频',
  renderVideoCard,
  cardClickable = true,
  className = ''
}: VideoListContainerProps) {
  return (
    <div className={`video-list-container ${className}`}>
      {/* 额外的头部内容 */}
      {extraHeader && <div className="video-list-extra-header">{extraHeader}</div>}

      {/* 加载状态 */}
      {loading && <VideoCardSkeleton count={6} />}

      {/* 错误状态 */}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-error-500)' }}>
          {error.includes('请求频率过高') || error.includes('API暂时限制') ? (
            <>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>请求频率过高</div>
              <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>请稍后再试</div>
            </>
          ) : (
            error
          )}
        </div>
      )}

      {/* 视频列表 */}
      {!loading && !error && (
        <div className="video-list video-grid" role="list" aria-label="视频列表">
          {/* 批量选择头部 */}
          {batchMode && batchSelectHeader && onSelectAll && (
            <div className="batch-select-header">
              <button
                className="select-all-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectAll()
                }}
              >
                {selectedVideos.size === videos.length ? '取消全选' : '全选'}
              </button>
              <span className="selected-count">
                已选择 {selectedVideos.size} / {videos.length} 个视频
              </span>
            </div>
          )}

          {/* 视频列表内容 */}
          {videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-tertiary)' }}>
              {emptyText}
            </div>
          ) : (
            <>
              {/* 视频卡片列表 */}
              {videos.map((video) =>
                renderVideoCard ? (
                  renderVideoCard(video)
                ) : (
                  <VideoListCard
                    key={video.bvid || video.id}  // 使用bvid作为key，确保唯一性
                    {...video}
                    onDownloadToggle={onDownloadToggle}
                    downloadStatus={getDownloadStatus?.(video.bvid)}
                    batchMode={batchMode}
                    selected={selectedVideos.has(video.bvid || video.id)}
                    onToggleSelect={onToggleSelect ? () => onToggleSelect(video.bvid || video.id) : undefined}
                    clickable={!batchMode && cardClickable}
                  />
                )
              )}

              {/* 加载更多状态 */}
              {loadingMore && <VideoCardSkeleton count={3} />}

              {/* 没有更多数据提示 */}
              {!hasMore && videos.length > 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-tertiary)' }}>
                  没有更多视频了
                </div>
              )}

              {/* 加载更多的触发元素 */}
              {hasMore && loadMoreRef && (
                <div
                  ref={loadMoreRef}
                  style={{ height: '1px', visibility: 'hidden' }}
                />
              )}
            </>
          )}

          {/* 额外的操作按钮 */}
          {extraActions && (
            <div className="video-list-extra-actions">{extraActions}</div>
          )}
        </div>
      )}
    </div>
  )
}