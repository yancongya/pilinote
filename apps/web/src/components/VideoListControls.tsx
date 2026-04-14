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
  isLoading = false
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
      </div>
    </div>
  )
}