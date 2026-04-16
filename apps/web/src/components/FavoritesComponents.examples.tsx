import { useState } from 'react'
import SectionHeader from './SectionHeader'
import VideoListControlsRefactored from './VideoListControls.refactored'
import { FolderOpen, Play, Heart } from 'lucide-react'

// 使用示例 1: 基本SectionHeader
export function BasicSectionHeaderExample() {
  return (
    <SectionHeader
      title="我的收藏"
      count="5个收藏夹"
      icon={<FolderOpen size={20} />}
    />
  )
}

// 使用示例 2: 带返回按钮的SectionHeader
export function SectionHeaderWithBackExample() {
  return (
    <SectionHeader
      title="编程教程"
      subtitle="收藏时间: 2024-01-15"
      count={128}
      showBackButton
      onBack={() => console.log('Back clicked')}
      icon={<Heart size={20} />}
    />
  )
}

// 使用示例 3: 带操作按钮的SectionHeader
export function SectionHeaderWithActionsExample() {
  return (
    <SectionHeader
      title="稍后再看"
      count={42}
      showBackButton
      onBack={() => console.log('Back clicked')}
      icon={<Play size={20} />}
      actions={
        <>
          <button>批量下载</button>
          <button>清空列表</button>
        </>
      }
    />
  )
}

// 使用示例 4: 基本VideoListControls
export function BasicVideoListControlsExample() {
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState('default')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')

  return (
    <VideoListControlsRefactored
      keyword={keyword}
      order={order}
      sortDirection={sortDirection}
      onKeywordChange={setKeyword}
      onOrderChange={setOrder}
      onSortDirectionChange={setSortDirection}
      sortOptions={[
        { value: 'default', label: '默认' },
        { value: 'view', label: '按播放量' },
        { value: 'pubtime', label: '按发布时间' },
        { value: 'favorite', label: '按收藏时间' }
      ]}
      loadedCount={24}
      totalCount={128}
      canLoadMore
      onLoadMore={() => console.log('Load more')}
      isLoading={false}
    />
  )
}

// 使用示例 5: 完整的收藏页面布局
export function CompleteFavoritesPageExample() {
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState('default')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [isFolderView, setIsFolderView] = useState(false)

  return (
    <div>
      <SectionHeader
        title={isFolderView ? "编程教程" : "我的收藏"}
        subtitle={isFolderView ? "收藏时间: 2024-01-15" : undefined}
        count={isFolderView ? 128 : "5个收藏夹"}
        showBackButton={isFolderView}
        onBack={() => setIsFolderView(false)}
        icon={<FolderOpen size={20} />}
      />

      {!isFolderView && (
        <div>
          {/* 文件夹列表 */}
          <div>文件夹列表...</div>
        </div>
      )}

      {isFolderView && (
        <>
          <VideoListControlsRefactored
            keyword={keyword}
            order={order}
            sortDirection={sortDirection}
            onKeywordChange={setKeyword}
            onOrderChange={setOrder}
            onSortDirectionChange={setSortDirection}
            sortOptions={[
              { value: 'default', label: '默认' },
              { value: 'view', label: '按播放量' },
              { value: 'pubtime', label: '按发布时间' },
              { value: 'favorite', label: '按收藏时间' }
            ]}
            loadedCount={24}
            totalCount={128}
            canLoadMore
            onLoadMore={() => console.log('Load more')}
            isLoading={false}
          />
          
          {/* 视频列表 */}
          <div>视频列表...</div>
        </>
      )}
    </div>
  )
}

// 使用示例 6: 视频库页面（带刷新和统计）
export function VideoLibraryPageExample() {
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState('default')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  return (
    <div>
      <SectionHeader
        title="视频库"
        count={156}
        icon={<Play size={20} />}
        actions={
          <button onClick={handleRefresh}>刷新</button>
        }
      />

      <VideoListControlsRefactored
        keyword={keyword}
        order={order}
        sortDirection={sortDirection}
        onKeywordChange={setKeyword}
        onOrderChange={setOrder}
        onSortDirectionChange={setSortDirection}
        sortOptions={[
          { value: 'default', label: '默认' },
          { value: 'pubtime', label: '按发布时间' },
          { value: 'duration', label: '按时长' }
        ]}
        videoCount={156}
        totalSize={1024 * 1024 * 1024 * 50} // 50GB
        formatFileSize={(bytes) => {
          const gb = bytes / (1024 * 1024 * 1024)
          return `${gb.toFixed(1)} GB`
        }}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      
      {/* 视频列表 */}
      <div>视频列表...</div>
    </div>
  )
}