import { useState } from 'react'
import styled, { css } from 'styled-components'
import { Search, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import Button from './Button'
import Input from './Input'
import Select from './Select'

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

// Styled Components
const ControlsContainer = styled.div`
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-md);
  transition: border-color 0.2s ease;
`

const ControlsWrapper = styled.div`
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
`

const SearchContainer = styled.div<{ $showSearch: boolean }>`
  flex: 1;
  min-width: 200px;
  max-width: 400px;
  position: relative;
  display: flex;
  align-items: center;
  
  ${({ $showSearch }) =>
    !$showSearch &&
    css`
      display: none;
    `}
  
  @media (max-width: 768px) {
    max-width: 200px;
    min-width: 150px;
    order: 1;
  }
  
  @media (max-width: 480px) {
    min-width: 120px;
    max-width: 150px;
  }
`

const SearchInputWrapper = styled.div`
  position: relative;
  width: 100%;
`

const SearchIcon = styled(Search)`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
  width: 16px;
  height: 16px;
  pointer-events: none;
`

const ClearButton = styled.button`
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;
  transition: all 0.15s ease;
  z-index: 1;

  &:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  &:active {
    transform: translateY(-50%) scale(0.95);
  }
`

const SortContainer = styled.div<{ $showSort: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  
  ${({ $showSort }) =>
    !$showSort &&
    css`
      display: none;
    `}
  
  @media (max-width: 768px) {
    gap: var(--spacing-xs);
    order: 2;
  }
`

const SortLabel = styled.label`
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
  font-weight: 500;
  
  @media (max-width: 768px) {
    display: none;
  }
`

const SortDirectionButton = styled(Button)`
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  
  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
    min-width: 28px;
  }
`

const LoadInfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
    order: 4;
  }
`

const LoadInfoText = styled.span`
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  font-weight: 500;
  
  @media (max-width: 768px) {
    font-size: 12px;
  }
`

const InfoRefreshContainer = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
  white-space: nowrap;
  
  @media (max-width: 768px) {
    flex: 1;
    gap: var(--spacing-sm);
    order: 3;
    min-width: 0;
  }
`

const StatsInfo = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  
  @media (max-width: 768px) {
    font-size: 11px;
    gap: 4px;
  }
`

const StatsDivider = styled.span`
  color: var(--color-text-tertiary);
  
  @media (max-width: 768px) {
    font-size: 10px;
  }
`

const StatItem = styled.span`
  display: inline-block;
`

const RefreshButton = styled(Button).attrs({ variant: 'ghost', size: 'sm' })`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  white-space: nowrap;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-xs);
    
    span:last-child {
      display: none;
    }
  }
`

const RefreshIcon = styled(RefreshCw)<{ $isOperating: boolean }>`
  transition: transform 0.3s ease;
  
  ${({ $isOperating }) =>
    $isOperating &&
    css`
      animation: spin 1s linear infinite;
    `}
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const NfoUpdateProgress = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-info-50);
  border: 1px solid var(--color-info-200);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  color: var(--color-info-600);
  
  span {
    white-space: nowrap;
  }
`

export default function VideoListControlsRefactored({
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
    <ControlsContainer className={className}>
      <ControlsWrapper>
        {/* 搜索框 */}
        {showSearch && (
          <SearchContainer $showSearch={showSearch}>
            <SearchInputWrapper>
              <Input
                type="text"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="搜索视频..."
                fullWidth
                style={{ paddingRight: '48px' }}
              />
              {searchInput && (
                <ClearButton
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="清除搜索"
                >
                  ✕
                </ClearButton>
              )}
              <SearchIcon />
            </SearchInputWrapper>
          </SearchContainer>
        )}

        {/* 排序选择器 */}
        {showSort && (
          <SortContainer $showSort={showSort}>
            <SortLabel htmlFor="sort-select">排序:</SortLabel>
            <Select
              id="sort-select"
              value={order}
              onChange={(e) => onOrderChange(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            {/* 排序方向切换按钮 */}
            {showSortDirection && order !== 'default' && (
              <SortDirectionButton
                variant="ghost"
                size="sm"
                onClick={handleSortDirectionToggle}
                aria-label={`当前${sortDirection === 'desc' ? '降序' : '升序'}，点击切换`}
                title={sortDirection === 'desc' ? '降序排列' : '升序排列'}
              >
                {sortDirection === 'desc' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </SortDirectionButton>
            )}
          </SortContainer>
        )}

        {/* 已加载视频数量显示和加载更多按钮 */}
        {loadedCount !== undefined && totalCount !== undefined && (
          <LoadInfoContainer>
            <LoadInfoText>
              已加载 {loadedCount} / {totalCount} 个视频
            </LoadInfoText>
            {canLoadMore && onLoadMore && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoading}
                title="加载更多视频"
              >
                {isLoading ? '加载中...' : '加载更多'}
              </Button>
            )}
          </LoadInfoContainer>
        )}

        {/* 统计信息和刷新按钮 */}
        {(seriesCount !== undefined || videoCount !== undefined || totalSize !== undefined || onRefresh || onUpdateNfo) && (
          <InfoRefreshContainer>
            {/* 统计信息 */}
            {(seriesCount !== undefined || videoCount !== undefined || totalSize !== undefined) && (
              <StatsInfo>
                {seriesCount !== undefined && (
                  <>
                    <StatItem>{seriesCount} 个系列</StatItem>
                    <StatsDivider>·</StatsDivider>
                  </>
                )}
                {videoCount !== undefined && (
                  <>
                    <StatItem>{videoCount} 个视频</StatItem>
                    <StatsDivider>·</StatsDivider>
                  </>
                )}
                {totalSize !== undefined && totalSize > 0 && formatFileSize && (
                  <StatItem>{formatFileSize(totalSize)}</StatItem>
                )}
              </StatsInfo>
            )}

            {/* 统一刷新按钮 */}
            {(onRefresh || onUpdateNfo) && (
              <RefreshButton
                onClick={handleRefresh}
                disabled={isOperating}
                aria-label="刷新"
                title={refreshTitle}
              >
                <RefreshIcon size={16} $isOperating={isOperating} />
                <span>{refreshLabel}</span>
              </RefreshButton>
            )}

            {/* NFO更新进度显示 */}
            {isUpdatingNfo && nfoUpdateProgress && nfoUpdateProgress.total > 0 && (
              <NfoUpdateProgress>
                <span>成功: {nfoUpdateProgress.success}</span>
                <span>失败: {nfoUpdateProgress.failed}</span>
                <span>总计: {nfoUpdateProgress.total}</span>
              </NfoUpdateProgress>
            )}
          </InfoRefreshContainer>
        )}
      </ControlsWrapper>
    </ControlsContainer>
  )
}