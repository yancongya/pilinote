# 稍后再看页前端实现

## 概述

稍后再看页（WatchLaterContent）是 PiliNote 应用的核心功能之一，用于查看和管理 B 站稍后再看列表，支持查看观看进度、下载视频等功能。

## 文件位置

```
apps/web/src/pages/components/WatchLaterContent.tsx
```

## 路由配置

### 页面路由
- **稍后再看页**：`/watch-later`
- **视频详情页**：`/video/{bvid}`

### 路由配置代码

```typescript
// apps/web/src/App.tsx
<Route path="/watch-later" element={<MainLayout />} />
<Route path="/video/:videoId" element={<VideoDetailPage />} />

// apps/web/src/components/MainLayout.tsx
const getActiveTabFromPath = () => {
  const path = location.pathname
  if (path === '/watch-later') return 'watch-later'
  if (path === '/favorites' || path.startsWith('/favorites/')) return 'favorites'
  if (path === '/new-downloads') return 'new-downloads'
  return 'home'
}
```

### 视频卡片点击行为

- 稍后再看页面的视频卡片可点击（`cardClickable={true}`）
- 点击后跳转到视频详情页：`/video/{bvid}`
- 详情页显示完整视频信息

## 功能特性

### 核心功能

1. **稍后再看列表展示**
   - 显示视频封面、标题、时长、观看进度
   - 支持无限滚动加载
   - 支持分页加载
   - 支持点击进入视频详情页

2. **观看进度显示**
   - 显示视频已观看的进度
   - 进度条可视化
   - 格式化进度显示（如"已观看 50%"）

3. **视频详情页**
   - 点击视频卡片跳转到详情页
   - 路由：`/video/{bvid}`
   - 显示完整视频信息

4. **下载集成**
   - 单视频下载
   - 多P视频下载（自动创建调度器）
   - 下载状态实时显示（在队列中、已下载）
   - 下载队列管理

5. **登录验证**
   - 未登录显示登录提示
   - 登录后自动加载数据

6. **无障碍支持**
   - ARIA 标签
   - 语义化 HTML

## 组件结构

```
WatchLaterContent (主组件)
├── useAuthStore (认证状态)
├── useNewQueueStore (下载队列)
├── useState Hooks (本地状态)
│   ├── totalCount (总数量)
│   ├── alertModal (提示弹窗)
│   └── confirmModal (确认弹窗)
├── useEffect Hooks
│   ├── 同步下载队列数据
│   └── 更新总数
├── useCallback Hooks
│   ├── fetchWatchLaterVideos (获取视频列表)
│   └── toggleDownload (切换下载状态)
├── Custom Hooks
│   ├── useVideoList (视频列表管理)
│   └── useVideoDownload (下载管理)
├── Sub-components
│   ├── VideoListContainer (视频列表容器)
│   ├── AlertModal (提示弹窗)
│   └── ConfirmModal (确认弹窗)
└── Utilities
    ├── formatDuration (时长格式化)
    ├── formatNumber (数字格式化)
    ├── formatProgress (进度格式化)
    └── formatTime (时间格式化)
```

## 状态管理

### 本地状态

```typescript
// 视频总数
const [totalCount, setTotalCount] = useState(0);

// 提示弹窗
const [alertModal, setAlertModal] = useState<{
  show: boolean;
  title: string;
  message: string;
  type: 'success' | 'error';
}>({
  show: false,
  title: '',
  message: '',
  type: 'success'
});

// 确认弹窗
const [confirmModal, setConfirmModal] = useState<{
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}>({
  show: false,
  title: '',
  message: '',
  onConfirm: () => {}
});
```

### 全局状态

```typescript
// 认证状态
const { user } = useAuthStore();

// 下载队列
const newQueueStore = useNewQueueStore();
```

### Refs

```typescript
// 追载数据是否已加载
const tasksSyncedRef = useRef(false);
```

## 数据获取

### 获取稍后再看列表

```typescript
// 使用 useCallback 缓存 fetchFn
const fetchWatchLaterVideos = useCallback(async (page: number, pageSize: number) => {
  if (!user?.mid) {
    return { success: false, message: '缺少必要参数' };
  }
  // 调用 getWatchLaterList 时不需要传递 sessdata，后端会从 cookie 中获取
  const response = await apiService.getWatchLaterList(page, pageSize);
  return response;
}, [user?.mid]);

// 使用 useVideoList Hook 管理列表
const { videos, loading, hasMore, loadMoreRef } = useVideoList({
  fetchFn: fetchWatchLaterVideos,
  pageSize: 20,
  deps: [],
  formatItem: (video: any) => ({
    id: video.id,
    bvid: video.bvid,
    title: video.title,
    cover: video.cover,
    duration: formatDuration(video.duration),
    durationSeconds: video.duration,
    progress: video.progress,
    watched: formatProgress(video.progress, video.duration),
    uploader: video.uploader?.name || '未知',
    views: formatNumber(video.view),
    danmaku: video.danmaku ? formatNumber(video.danmaku) : '0',
    comments: video.comment ? formatNumber(video.comment) : '0',
    likes: video.like ? formatNumber(video.like) : '0',
    coins: video.coin ? formatNumber(video.coin) : '0',
    favorites: video.favorite ? formatNumber(video.favorite) : '0',
    shares: video.share ? formatNumber(video.share) : '0',
    time: formatTime(video.add_time),
    // 保留原始数据用于下载
    cid: video.cid,
    aid: video.aid,
    pic: video.cover,
    originalDuration: video.duration,
    owner: video.uploader,
    pubtime: video.add_time
  })
});
```

## 无限滚动

稍后再看页使用 `useVideoList` Hook 实现无限滚动，与收藏页实现相同。

```typescript
// useVideoList Hook 内部实现
const loadMoreRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        loadMore();
      }
    },
    {
      rootMargin: '100px',  // 提前 100px 触发
      threshold: 0.1        // 10% 可见时触发
    }
  );

  if (loadMoreRef.current) {
    observer.observe(loadMoreRef.current);
  }

  return () => {
    if (loadMoreRef.current) {
      observer.unobserve(loadMoreRef.current);
    }
  };
}, [loading, hasMore, loadMore]);
```

## 下载集成

稍后再看页的下载集成与收藏页完全相同，支持单视频和多P视频下载。

### 下载状态检查

```typescript
const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
  const tasks = newQueueStore.tasks;
  const newSystemTasks = Object.values(tasks);
  
  // 检查是否在队列中（未完成的任务）
  const hasActiveTask = newSystemTasks.some(task =>
    task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
  );
  
  if (hasActiveTask) {
    return 'in_list';
  }
  
  // 检查是否已下载完成（已完成的任务）
  const hasCompletedTask = newSystemTasks.some(task =>
    task.media_id === bvid && task.state === 'completed'
  );
  
  if (hasCompletedTask) {
    return 'downloaded';
  }
  
  return 'none';
};
```

### 下载功能

```typescript
const { toggleDownload: baseToggleDownload } = useVideoDownload();

const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
  const result = await baseToggleDownload(video, e);
  if (result.success) {
    if (result.shouldNavigateToLibrary) {
      navigate('/downloads', { replace: true });
      setTimeout(() => {
        setAlertModal({
          show: true,
          title: '操作成功',
          message: result.message,
          type: 'success'
        });
      }, 100);
    } else {
      setAlertModal({
        show: true,
        title: '操作成功',
        message: result.message,
        type: 'success'
      });
    }
  } else {
    setAlertModal({
      show: true,
      title: '操作失败',
      message: result.message,
      type: 'error'
    });
  }
}, [baseToggleDownload, navigate]);
```

## 观看进度

### 进度格式化

```typescript
// utils/videoFormatters.ts
export const formatProgress = (progress: number, duration: number): string => {
  if (!duration || duration <= 0) {
    return '未观看';
  }
  
  const percent = (progress / duration) * 100;
  
  if (percent >= 100) {
    return '已看完';
  } else if (percent >= 90) {
    return '快看完了';
  } else if (percent >= 50) {
    return `已观看 ${Math.round(percent)}%`;
  } else if (percent > 0) {
    return `已观看 ${Math.round(percent)}%`;
  } else {
    return '未观看';
  }
};
```

### 进度显示

```typescript
// 视频卡片中的进度显示
<div className="video-progress">
  <div className="progress-bar">
    <div 
      className="progress-fill" 
      style={{ width: `${(video.progress / video.durationSeconds) * 100}%` }}
    />
  </div>
  <span className="progress-text">{video.watched}</span>
</div>
```

## 错误处理

### 网络错误

```typescript
try {
  const response = await apiService.getWatchLaterList(page, pageSize);
  if (response.success) {
    return response.data;
  } else {
    return { success: false, message: response.message || '获取稍后再看失败' };
  }
} catch (err) {
  return { success: false, message: '网络请求失败' };
}
```

### 加载状态

```typescript
<VideoListContainer
  videos={videos}
  loading={videosLoading}
  loadingMore={loadingMore}
  error={videosError}
  // ...
/>
```

### 用户提示

```typescript
<AlertModal
  isOpen={alertModal.show}
  onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'success' })}
  title={alertModal.title}
  message={alertModal.message}
  type={alertModal.type}
/>
```

## 无障碍支持

### ARIA 标签

```typescript
<section
  id="watchlater-panel"
  role="tabpanel"
  aria-labelledby="watchlater-tab"
  className="content-section"
>
  {/* 稍后再看内容 */}
</section>
```

## 性能优化

### 1. useCallback 缓存函数

```typescript
const fetchWatchLaterVideos = useCallback(async (page: number, pageSize: number) => {
  // ...
}, [user?.mid]);
```

### 2. useRef 避免重复请求

```typescript
const tasksSyncedRef = useRef(false);

useEffect(() => {
  if (tasksSyncedRef.current) return;
  tasksSyncedRef.current = true;
  // ... 加载逻辑
}, []);
```

## 使用示例

### 基本使用

```typescript
import WatchLaterContent from './components/WatchLaterContent';

function App() {
  return (
    <div>
      <WatchLaterContent />
    </div>
  );
}
```

### 带条件渲染

```typescript
import { useAuthStore } from './stores/auth';
import WatchLaterContent from './components/WatchLaterContent';
import LoginPrompt from './components/LoginPrompt';

function WatchLaterPage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div>
      {isAuthenticated ? (
        <WatchLaterContent />
      ) : (
        <LoginPrompt message="登录后可以查看和管理您的稍后再看" />
      )}
    </div>
  );
}
```

## 注意事项

1. **登录验证**：必须先登录才能查看稍后再看
2. **观看进度**：观看进度由 B 站记录，无法本地修改
3. **下载状态**：下载状态检查需要新下载队列系统支持
4. **错误处理**：所有网络请求都应该有错误处理和用户提示
5. **无障碍**：确保屏幕阅读器支持

## 与收藏页的区别

| 特性 | 稍后再看 | 收藏夹 |
|------|----------|--------|
| 结构 | 列表 + 详情页（可点击） | 列表 + 详情页（文件夹） |
| 路由 | `/watch-later` → `/video/{bvid}` | `/favorites` → `/favorites/{id}` |
| 缓存 | 无缓存 | 收藏夹列表缓存 |
| 观看进度 | 支持 | 不支持 |
| 返回功能 | 不需要 | 需要（从详情页返回列表） |
| 数据来源 | B站API：`/x/v2/history/toview` | B站API：`/fav/v2/fav/folder/list` |
| 分页 | 支持无限滚动 | 支持无限滚动 |

## 相关组件

- [VideoListContainer](../components/video-list-container.md) - 视频列表容器
- [AlertModal](../components/alert-modal.md) - 提示弹窗
- [ConfirmModal](../components/confirm-modal.md) - 确认弹窗

## 相关 Hooks

- [useVideoList](../hooks/use-video-list.md) - 视频列表管理
- [useVideoDownload](../hooks/use-video-download.md) - 下载管理

## 相关文档

- [稍后再看 API](../api/watchlater-api.md) - API 文档
- [稍后再看数据转换](../components/toview-data-transformer.md) - 数据转换
- [稍后再看下载集成](../download/watchlater-download.md) - 下载集成

---

[返回上级](./README.md)