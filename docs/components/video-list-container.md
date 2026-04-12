# VideoListContainer 视频列表容器

## 概述

统一的视频列表容器组件，支持列表显示、批量选择、无限滚动。

## 文件位置

`apps/web/src/components/VideoListContainer.tsx`

## Props

```typescript
interface VideoListContainerProps {
  videos: Video[]                // 视频列表
  loading: boolean              // 加载状态
  loadingMore: boolean          // 加载更多状态
  error: string                 // 错误信息
  batchMode?: boolean          // 批量模式
  selectedVideos?: Set<string>  // 选中视频
  onToggleSelect?: (videoId: string) => void    // 切换选中
  onSelectAll?: () => void       // 全选
  batchSelectHeader?: boolean  // 显示批量头部
  onDownloadToggle?: (video: Video, e: MouseEvent) => void  // 下载切换
  getDownloadStatus?: (bvid: string) => 'none' | 'in_list' | 'downloaded'  // 下载状态
  extraHeader?: ReactNode        // 额外头部
  extraActions?: ReactNode      // 额外操作
  loadMoreRef?: RefObject<HTMLDivElement>  // 加载更多引用
}
```

## Video 接口

```typescript
interface Video {
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
}
```

## 使用示例

```tsx
import VideoListContainer from './components/VideoListContainer'

function MyComponent() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedVideos, setSelectedVideos] = useState(new Set())

  return (
    <VideoListContainer
      videos={videos}
      loading={loading}
      loadingMore={false}
      error=""
      batchMode={batchMode}
      selectedVideos={selectedVideos}
      onToggleSelect={(id) => {
        const newSet = new Set(selectedVideos)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedVideos(newSet)
      }}
      getDownloadStatus={(bvid) => 'none'}
    />
  )
}
```

## 功能特性

| 特性 | 说明 |
|------|------|
| 批量选择 | 支持多选视频 |
| 下载状态 | 显示已下载/下载中状态 |
| 无限滚动 | 支持 loadMoreRef 实现 |
| 空状态 | 加载中和空列表显示 |

## 关联组件

- [VideoListCard](video-list-card.md) - 视频卡片
- [BatchActionsBar](batch-actions-bar.md) - 批量操作栏

---

[返回上级](./README.md)