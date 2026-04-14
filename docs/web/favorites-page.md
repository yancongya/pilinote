# 收藏页前端实现

## 概述

收藏页（FavoritesContent）是 PiliNote 应用的核心功能之一，用于查看和管理 B 站收藏夹，支持浏览收藏夹列表、查看收藏夹详情、下载收藏夹内视频等功能。

## 文件位置

```
apps/web/src/pages/components/FavoritesContent.tsx
```

## 功能特性

### 核心功能

1. **收藏夹列表展示**
   - 显示收藏夹封面、标题、内容数量
   - 支持点击进入详情页
   - 空状态友好提示

2. **收藏夹详情展示**
   - 显示收藏夹内的视频列表
   - 支持无限滚动加载
   - 支持返回列表页

3. **下载集成**
   - 单视频下载
   - 多P视频下载（自动创建调度器）
   - 下载状态实时显示
   - 下载队列管理

4. **路由支持**
   - `/favorites` - 收藏夹列表
   - `/favorites/{id}` - 收藏夹详情
   - URL 同步和导航

5. **缓存优化**
   - 收藏夹列表缓存（5分钟过期）
   - 静默刷新机制
   - 切换 Tab 不闪烁

6. **登录验证**
   - 未登录显示登录提示
   - 登录后自动加载数据

7. **无障碍支持**
   - 键盘导航（Enter/Space 键）
   - ARIA 标签
   - 语义化 HTML

## 组件结构

```
FavoritesContent (主组件)
├── useAuthStore (认证状态)
├── useCacheStore (缓存管理)
├── useNewQueueStore (下载队列)
├── useState Hooks (本地状态)
│   ├── selectedFolder (当前选中收藏夹)
│   ├── folders (收藏夹列表)
│   ├── loading (加载状态)
│   ├── error (错误信息)
│   ├── alertModal (提示弹窗)
│   └── confirmModal (确认弹窗)
├── useEffect Hooks
│   ├── 同步下载队列数据
│   ├── 监听路由变化
│   └── 获取收藏夹列表
├── useCallback Hooks
│   ├── fetchFavoriteVideos (获取视频列表)
│   ├── handleSelectFolder (选择收藏夹)
│   ├── handleBackToFolders (返回列表)
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
    └── formatTime (时间格式化)
```

## 状态管理

### 本地状态

```typescript
// 当前选中的收藏夹
const [selectedFolder, setSelectedFolder] = useState<any>(null);

// 收藏夹列表（带缓存初始化）
const [folders, setFolders] = useState<any[]>(() => {
  const cached = getFoldersCache();
  return cached || [];
});

// 加载状态
const [loading, setLoading] = useState(false);

// 错误信息
const [error, setError] = useState('');

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

// 缓存管理
const {
  getFoldersCache,
  setFoldersCache
} = useCacheStore();

// 下载队列
const newQueueStore = useNewQueueStore();
```

### Refs

```typescript
// 追踪数据是否已加载
const foldersLoadedRef = useRef(false);
const tasksSyncedRef = useRef(false);
```

## 路由设计

### 路由结构

```
/favorites              -> 收藏夹列表
/favorites/{folder_id}  -> 收藏夹详情
```

### 路由同步机制

```typescript
// 1. 选择收藏夹时更新路由
const handleSelectFolder = (folder: any) => {
  setSelectedFolder(folder);
  navigate(`/favorites/${folder.id}`, { replace: true });
};

// 2. 返回列表时更新路由
const handleBackToFolders = () => {
  setSelectedFolder(null);
  navigate('/favorites', { replace: true });
};

// 3. 监听路由变化，支持直接访问 URL
useEffect(() => {
  const currentPath = window.location.pathname;
  const favoritesMatch = currentPath.match(/^\/favorites\/(\d+)$/);
  if (favoritesMatch && folders.length > 0) {
    const folderId = parseInt(favoritesMatch[1]);
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setSelectedFolder(folder);
    }
  }
}, [folders, setSelectedFolder]);
```

## 缓存机制

### 收藏夹列表缓存

```typescript
// 1. 初始化时从缓存恢复
const [folders, setFolders] = useState<any[]>(() => {
  const cached = getFoldersCache();
  return cached || [];
});

// 2. 获取收藏夹列表时使用缓存
useEffect(() => {
  const fetchFolders = async () => {
    if (!user?.mid || foldersLoadedRef.current) return;

    foldersLoadedRef.current = true;

    // 先检查缓存
    const cachedFolders = getFoldersCache();
    if (cachedFolders) {
      setFolders(cachedFolders);

      // 后台静默刷新
      try {
        const response = await apiService.getFolders();
        if (response.success && response.data) {
          setFolders(response.data);
          setFoldersCache(response.data);
        }
      } catch (err) {
        console.error('[Favorites] 后台刷新收藏夹失败:', err);
      }
      return;
    }

    // 无缓存时直接加载
    setLoading(true);
    try {
      const response = await apiService.getFolders();
      if (response.success && response.data) {
        setFolders(response.data);
        setFoldersCache(response.data);
      }
    } catch (err) {
      setError('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  fetchFolders();
}, [user, getFoldersCache, setFoldersCache]);
```

### 缓存策略

- **缓存时间**：5分钟
- **缓存键**：`folders-cache`
- **刷新策略**：静默刷新（先显示缓存，后台更新）

## 无限滚动

### Intersection Observer 实现

通过 `useVideoList` Hook 实现，使用 Intersection Observer 监听滚动位置。

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

### 防止重复加载

```typescript
const { videos, loading, loadingMore, hasMore, loadMoreRef } = useVideoList({
  fetchFn: fetchFavoriteVideos,
  pageSize: 10,
  deps: [],
  formatItem: (video: any) => ({
    id: video.id,
    bvid: video.bvid,
    title: video.title,
    // ... 其他字段
  })
});
```

## 下载集成

### 下载状态检查

```typescript
// 检查视频的下载状态
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
// 使用 useVideoDownload Hook
const { toggleDownload: baseToggleDownload } = useVideoDownload();

// 包装 toggleDownload，确保状态更新
const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
  const result = await baseToggleDownload(video, e);
  if (result.success) {
    // 如果需要跳转到视频库
    if (result.shouldNavigateToLibrary) {
      navigate('/downloads', { replace: true });
      // 延迟显示弹窗，让页面先跳转
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

### 下载状态显示

```typescript
// 传递给 VideoListContainer
<VideoListContainer
  videos={videos}
  loading={videosLoading}
  loadingMore={loadingMore}
  error={videosError}
  onDownloadToggle={toggleDownload}
  getDownloadStatus={getDownloadStatus}
  loadMoreRef={loadMoreRef}
  hasMore={hasMore}
  emptyText="暂无视频"
  cardClickable={true}
/>
```

## 错误处理

### 网络错误

```typescript
try {
  const response = await apiService.getFolders();
  if (response.success && response.data) {
    setFolders(response.data);
    setFoldersCache(response.data);
  } else {
    setError(response.message || '获取收藏夹列表失败');
  }
} catch (err) {
  setError('网络请求失败');
}
```

### 加载状态

```typescript
{loading && (
  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
    加载中...
  </div>
)}

{error && (
  <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>
    {error}
  </div>
)}
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

### 键盘导航

```typescript
<article
  key={folder.id}
  className="fav-folder-item"
  onClick={() => handleSelectFolder(folder)}
  role="listitem"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectFolder(folder);
    }
  }}
>
  {/* 收藏夹内容 */}
</article>
```

### ARIA 标签

```typescript
<section
  id="favorites-panel"
  role="tabpanel"
  aria-labelledby="favorites-tab"
  className="content-section"
>
  {/* 收藏页内容 */}
</section>

<div className="fav-folder-list" role="list" aria-label="收藏夹列表">
  {/* 收藏夹列表 */}
</div>

<button
  className="back-btn"
  onClick={(e) => {
    e.stopPropagation();
    handleBackToFolders();
  }}
  aria-label="返回收藏夹列表"
>
  <ArrowLeft />
</button>
```

## 性能优化

### 1. useCallback 缓存函数

```typescript
// 避免每次渲染创建新函数引用
const fetchFavoriteVideos = useCallback(async (page: number, pageSize: number) => {
  if (!selectedFolder || !user?.mid) {
    return { success: true, data: { list: [], total: 0 } };
  }
  return apiService.getFolderDetail(selectedFolder.id, page, pageSize);
}, [selectedFolder?.id, user?.mid]);
```

### 2. useRef 避免重复请求

```typescript
const foldersLoadedRef = useRef(false);

useEffect(() => {
  if (foldersLoadedRef.current) return;
  foldersLoadedRef.current = true;
  // ... 加载逻辑
}, [user]);
```

### 3. 缓存初始化

```typescript
// 初始化时从缓存恢复，避免首次渲染闪烁
const [folders, setFolders] = useState<any[]>(() => {
  const cached = getFoldersCache();
  return cached || [];
});
```

## 使用示例

### 基本使用

```typescript
import FavoritesContent from './components/FavoritesContent';

function App() {
  return (
    <div>
      <FavoritesContent />
    </div>
  );
}
```

### 带条件渲染

```typescript
import { useAuthStore } from './stores/auth';
import FavoritesContent from './components/FavoritesContent';
import LoginPrompt from './components/LoginPrompt';

function FavoritesPage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div>
      {isAuthenticated ? (
        <FavoritesContent />
      ) : (
        <LoginPrompt message="登录后可以查看和管理您的收藏夹" />
      )}
    </div>
  );
}
```

## 注意事项

1. **登录验证**：必须先登录才能查看收藏夹
2. **缓存时间**：收藏夹列表缓存时间为 5 分钟
3. **路由同步**：选择收藏夹时自动更新 URL，支持直接访问
4. **下载状态**：下载状态检查需要[新下载队列系统](downloads-list.md)支持
5. **错误处理**：所有网络请求都应该有错误处理和用户提示
6. **无障碍**：确保键盘导航和屏幕阅读器支持

## 相关组件

- [VideoListContainer](../components/video-list-container.md) - 视频列表容器
- [AlertModal](../components/alert-modal.md) - 提示弹窗
- [ConfirmModal](../components/confirm-modal.md) - 确认弹窗

## 相关 Hooks

- [useVideoList](../hooks/use-video-list.md) - 视频列表管理
- [useVideoDownload](../hooks/use-video-download.md) - 下载管理

## 相关文档

- [收藏夹 API](../api/favorites-api.md) - API 文档
- [收藏夹数据转换](../components/favorites-data-transformer.md) - 数据转换
- [收藏夹下载集成](../download/favorites-download.md) - 下载集成

---

[返回上级](./README.md)