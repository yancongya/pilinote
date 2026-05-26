# VideoListContainer 视频列表容器

## 概述

统一的视频列表容器组件，支持列表显示、批量选择、无限滚动和增量失败提示。

> 说明：收藏页、稍后再看页、历史记录页现在进一步抽出了 `MediaListShell` 作为上层壳层，`VideoListContainer` 负责真正的视频网格渲染和局部状态展示。
> 当前实现会把首屏错误和加载更多错误分开处理：首屏失败时显示整页错误，加载更多失败时只显示底部提示，不会替换已加载内容。

## 文件位置

`apps/web/src/components/VideoListContainer.tsx`

## Props

```typescript
interface VideoListContainerProps {
  videos: Video[]                                   // 视频列表
  loading: boolean                                  // 首屏加载状态
  loadingMore: boolean                              // 加载更多状态
  error: string                                     // 错误信息（首屏失败时整页展示）
  loadMoreError?: string                            // 加载更多失败提示（非阻塞）
  batchMode?: boolean                               // 批量模式
  selectedVideos?: Set<string>                      // 选中视频
  onToggleSelect?: (videoId: string) => void        // 切换选中
  onSelectAll?: () => void                          // 全选
  batchSelectHeader?: boolean                       // 显示批量头部
  onDownloadToggle?: (video: Video, e: MouseEvent) => void  // 下载切换
  getDownloadStatus?: (bvid: string) => 'none' | 'in_list' | 'downloaded'  // 下载状态
  extraHeader?: ReactNode                           // 额外头部
  extraActions?: ReactNode                          // 额外操作
  loadMoreRef?: RefObject<HTMLDivElement | null>    // 加载更多引用
  hasMore?: boolean                                 // 是否还有下一页
  emptyText?: string                                // 空状态文案
  renderVideoCard?: (video: Video) => ReactNode     // 自定义卡片渲染
  cardClickable?: boolean                           // 是否允许卡片点击
  className?: string                                // 额外类名
  initialLoadingSkeletonCount?: number              // 首屏骨架数量
  appendLoadingSkeletonCount?: number               // 加载更多骨架数量
  showLoadingSkeletonHeader?: boolean               // 首屏骨架是否显示头部
  loadingSkeletonDense?: boolean                    // 骨架是否紧凑
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
| 空状态 | 首屏加载、空列表和错误状态分离显示 |
| 增量失败 | 加载更多失败只显示底部提示，不覆盖已加载列表 |
| 响应式网格 | 支持自适应网格布局，从1列到4列 |

## 状态行为

- 首屏加载失败：显示整页错误状态
- 已有列表时请求失败：保留当前列表，只在底部显示非阻塞错误提示
- 加载更多失败：继续保留已加载卡片，等待下一次自动/手动触发
- `useVideoList` 负责分页缓存、首屏 sessionStorage 复用、请求去重和重试，`VideoListContainer` 只负责展示结果

## 响应式网格布局

### 网格断点

视频列表容器使用响应式网格布局，根据屏幕宽度自动调整列数：

| 断点 | 列数 | 间距 | 说明 |
|------|------|------|------|
| < 768px | 1列 | 16px | 移动端竖屏 |
| 768px - 1023px | 2列 | 20px | 平板/移动端横屏 |
| 1024px - 1279px | 3列 | 24px | 桌面端 |
| ≥ 1280px | 4列 | 24px | 大屏幕 |

### 实现方式

```tsx
// 视频列表容器添加响应式网格类
<div className="video-list video-grid" role="list" aria-label="视频列表">
  {/* 视频卡片 */}
</div>
```

```css
/* 响应式网格布局 */
.video-list.video-grid {
  display: grid !important;
  gap: 16px;
  
  /* 移动端：单列布局 */
  grid-template-columns: 1fr;
  
  /* 平板及以上：2列布局 */
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
  
  /* 桌面端：3列布局 */
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  
  /* 大屏幕：4列布局 */
  @media (min-width: 1280px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }
}
```

### 桌面端优化

在桌面端（≥1024px）对视频卡片进行了额外的样式优化：

```css
@media (min-width: 1024px) {
  .video-card {
    border-radius: 12px;
  }

  .video-info {
    padding: 12px;
  }

  .video-info h3 {
    font-size: 14px;
    margin-bottom: 6px;
  }

  .video-meta p {
    font-size: 12px;
  }

  .video-meta span {
    font-size: 11px;
  }

  .video-duration-overlay {
    font-size: 11px;
    padding: 3px 6px;
  }
}
```

### 布局效果

**移动端（< 768px）**：
```
┌─────────────────┐
│  视频卡片 1      │
├─────────────────┤
│  视频卡片 2      │
├─────────────────┤
│  视频卡片 3      │
└─────────────────┘
```

**平板端（768px - 1023px）**：
```
┌─────────────┬─────────────┐
│  视频卡片 1  │  视频卡片 2  │
├─────────────┼─────────────┤
│  视频卡片 3  │  视频卡片 4  │
└─────────────┴─────────────┘
```

**桌面端（1024px - 1279px）**：
```
┌──────────┬──────────┬──────────┐
│ 卡片 1   │ 卡片 2   │ 卡片 3   │
├──────────┼──────────┼──────────┤
│ 卡片 4   │ 卡片 5   │ 卡片 6   │
└──────────┴──────────┴──────────┘
```

**大屏幕（≥ 1280px）**：
```
┌────────┬────────┬────────┬────────┐
│ 卡片 1 │ 卡片 2 │ 卡片 3 │ 卡片 4 │
├────────┼────────┼────────┼────────┤
│ 卡片 5 │ 卡片 6 │ 卡片 7 │ 卡片 8 │
└────────┴────────┴────────┴────────┘
```

## 关联组件

- VideoListCard：源码位于 `apps/web/src/pages/components/VideoListCard.tsx`（当前无独立 docs 条目时以源码为准）
- [BatchActionsBar](batch-actions-bar.md) - 批量操作栏

---

[返回上级](./README.md)
