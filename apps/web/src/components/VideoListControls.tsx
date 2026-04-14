import { useState } from 'react'
import './VideoListControls.css'

export interface VideoListControlsProps {
  /** 搜索关键词 */
  keyword: string
  /** 排序方式 */
  order: string
  /** 排序方向 */
  sortDirection: 'desc' | 'asc'
  /** 搜索回调 */
  onKeywordChange: (keyword: string) => void
  /** 排序回调 */
  onOrderChange: (order: string) => void
  /** 排序方向回调 */
  onSortDirectionChange: (direction: 'desc' | 'asc') => void
  /** 是否显示搜索框 */
  showSearch?: boolean
  /** 是否显示排序 */
  showSort?: boolean
  /** 是否显示排序方向切换 */
  showSortDirection?: boolean
  /** 排序选项 */
  sortOptions: { value: string; label: string }[]
  /** 额外的类名 */
  className?: string
  /** 已加载的视频数量 */
  loadedCount?: number
  /** 总视频数量 */
  totalCount?: number
  /** 是否可以加载更多 */
  canLoadMore?: boolean
  /** 加载更多回调 */
  onLoadMore?: () => void
  /** 是否正在加载 */
  isLoading?: boolean
  /** 系列数量 */
  seriesCount?: number
  /** 视频数量 */
  videoCount?: number
  /** 总大小（字节） */
  totalSize?: number
  /** 刷新回调 */
  onRefresh?: () => void
  /** 是否正在刷新 */
  isRefreshing?: boolean
  /** 格式化文件大小 */
  formatFileSize?: (bytes: number) => string
  /** 更新NFO回调 */
  onUpdateNfo?: () => void
  /** 是否正在更新NFO */
  isUpdatingNfo?: boolean
  /** NFO更新进度 */
  nfoUpdateProgress?: { success: number; failed: number; total: number }
}

export default function VideoListControls({
  keyword,
  order,
  sortDirection,
  onKeywordChange,
  onOrderChange,
  onSortDirectionChange,
  showSearch = true,
  showSort = true,
  showSortDirection = true,
  sortOptions,
  className = '',
  loadedCount,
  totalCount,
  canLoadMore = false,
  onLoadMore,
  isLoading = false,
  seriesCount,
  videoCount,
  totalSize,
  onRefresh,
  isRefreshing = false,
  formatFileSize,
  onUpdateNfo,
  isUpdatingNfo = false,
  nfoUpdateProgress
}: VideoListControlsProps) {
  const [searchInput, setSearchInput] = useState(keyword)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onKeywordChange(searchInput)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    onKeywordChange('')
  }

  const handleSortDirectionToggle = () => {
    onSortDirectionChange(sortDirection === 'desc' ? 'asc' : 'desc')
  }

  const handleLoadMore = () => {
    if (onLoadMore && !isLoading) {
      onLoadMore()
    }
  }

  const handleRefresh = () => {
    // 优先调用NFO更新功能，如果存在的话
    if (onUpdateNfo && !isUpdatingNfo) {
      onUpdateNfo()
    } else if (onRefresh && !isRefreshing) {
      onRefresh()
    }
  }

  const isOperating = isRefreshing || isUpdatingNfo
  const refreshLabel = isUpdatingNfo ? '更新中...' : (isRefreshing ? '刷新中...' : '刷新')
  const refreshTitle = onUpdateNfo ? '刷新列表并更新NFO' : '刷新列表'

  return (
    <div className={`video-list-controls ${className}`}>
      <div className="controls-wrapper">
        {/* 搜索框 */}
        {showSearch && (
          <form className="search-box" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="搜索视频..."
              className="search-input"
            />
            {searchInput && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={handleClearSearch}
                aria-label="清除搜索"
              >
                ✕
              </button>
            )}
            <button type="submit" className="search-btn" aria-label="搜索">
              🔍
            </button>
          </form>
        )}

        {/* 排序选择器 */}
        {showSort && (
          <div className="sort-box">
            <label htmlFor="sort-select" className="sort-label">
              排序:
            </label>
            <select
              id="sort-select"
              value={order}
              onChange={(e) => onOrderChange(e.target.value)}
              className="sort-select"
            >
              {sortOptions.map((option: { value: string; label: string }) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            {/* 排序方向切换按钮 */}
            {showSortDirection && order !== 'default' && (
              <button
                className="sort-direction-btn"
                onClick={handleSortDirectionToggle}
                aria-label={`当前${sortDirection === 'desc' ? '降序' : '升序'}，点击切换`}
                title={sortDirection === 'desc' ? '降序排列' : '升序排列'}
              >
                {sortDirection === 'desc' ? '⬇️' : '⬆️'}
              </button>
            )}
          </div>
        )}

        {/* 已加载视频数量显示和加载更多按钮 */}
        {loadedCount !== undefined && totalCount !== undefined && (
          <div className="load-info-box">
            <span className="load-info-text">
              已加载 {loadedCount} / {totalCount} 个视频
            </span>
            {canLoadMore && onLoadMore && (
              <button
                className="load-more-btn"
                onClick={handleLoadMore}
                disabled={isLoading}
                title="加载更多视频"
              >
                {isLoading ? '加载中...' : '加载更多'}
              </button>
            )}
          </div>
        )}

        {/* 统计信息和刷新按钮 */}
        {(seriesCount !== undefined || videoCount !== undefined || totalSize !== undefined || onRefresh || onUpdateNfo) && (
          <div className="info-refresh-box">
            {/* 统计信息 */}
            {(seriesCount !== undefined || videoCount !== undefined || totalSize !== undefined) && (
              <div className="library-stats-info">
                {seriesCount !== undefined && (
                  <>
                    <span className="stat-item">{seriesCount} 个系列</span>
                    <span className="stats-divider">·</span>
                  </>
                )}
                {videoCount !== undefined && (
                  <>
                    <span className="stat-item">{videoCount} 个视频</span>
                    <span className="stats-divider">·</span>
                  </>
                )}
                {totalSize !== undefined && totalSize > 0 && formatFileSize && (
                  <span className="stat-item">{formatFileSize(totalSize)}</span>
                )}
              </div>
            )}
            
            {/* 统一刷新按钮 */}
            {(onRefresh || onUpdateNfo) && (
              <button
                className="library-refresh-btn"
                onClick={handleRefresh}
                disabled={isOperating}
                aria-label="刷新"
                title={refreshTitle}
              >
                <span className={`refresh-icon ${isOperating ? 'rotating' : ''}`}>🔄</span>
                <span>{refreshLabel}</span>
              </button>
            )}
            
            {/* NFO更新进度显示 */}
            {isUpdatingNfo && nfoUpdateProgress && nfoUpdateProgress.total > 0 && (
              <div className="nfo-update-progress">
                <span>成功: {nfoUpdateProgress.success}</span>
                <span>失败: {nfoUpdateProgress.failed}</span>
                <span>总计: {nfoUpdateProgress.total}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}