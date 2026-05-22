# 收藏夹

---
关联文档:
  - ../auth/login-flow.md    # 需要登录验证
  - ../auth/cookies.md      # Cookie 管理
  - ../auth/multi-account.md  # 登录状态验证 isAuthenticated
  - ../database/models.md   # User 模型
  - ../api/favorites-api.md # 收藏夹 API 完整文档
  - ../web/favorites-page.md # 收藏页前端实现
  - ../components/favorites-data-transformer.md # 数据转换
  - ../download/favorites-download.md # 下载集成

涉及文件:
  - apps/api/src/routers/favorites.py
  - apps/api/src/services/bilibili.py
  - apps/api/src/services/media_data_transformer.py
  - apps/api/src/services/headers_manager.py
  - apps/web/src/components/MainLayout.tsx  # isAuthenticated 登录检查
  - apps/web/src/pages/components/FavoritesContent.tsx
  - apps/web/src/hooks/useVideoList.ts  # 视频列表管理
  - apps/web/src/hooks/useVideoDownload.ts  # 下载管理
  - apps/web/src/stores/cache.ts  # 缓存管理
  - apps/web/src/stores/newQueue.ts  # 下载队列

依赖服务:
  - BilibiliService
  - HeadersManager
  - MediaDataTransformer
  - CacheStore
  - NewQueueStore
---

## 概述

收藏夹功能允许用户查看和管理 B 站收藏夹，包括：

- 查看收藏夹列表
- 浏览收藏夹内的视频
- 下载收藏夹内视频
- 查看订阅的收藏夹（我追的收藏夹）

## 功能特性

### 已实现功能

1. **收藏夹列表展示**
   - 显示收藏夹封面、标题、内容数量
   - 支持点击进入详情页
   - 空状态友好提示
   - 缓存优化（5分钟过期）
   - 静默刷新机制

2. **收藏夹详情展示**
   - 显示收藏夹内的视频列表
   - 支持无限滚动加载
   - 支持分页加载
   - 支持返回列表页
   - 路由同步（/favorites/{id}）

3. **下载集成**
   - 单视频下载
   - 多P视频下载（自动创建调度器）
   - 下载状态实时显示（在队列中、已下载）
   - 下载队列管理

4. **登录验证**
   - 未登录显示登录提示
   - 登录后自动加载数据
   - 使用 isAuthenticated 检查

5. **无障碍支持**
   - 键盘导航（Enter/Space 键）
   - ARIA 标签
   - 语义化 HTML

### 后端 API 支持（前端未实现）

1. **收藏夹搜索**
   - 关键词搜索
   - 类型筛选（视频/音频/文章）
   - 分区筛选

2. **收藏夹排序**
   - 收藏时间
   - 发布时间
   - 播放量

3. **订阅收藏夹**
   - 查看订阅的收藏夹列表
   - 收藏夹所有者信息

## 登录状态验证

**前端检查**：
```typescript
// apps/web/src/components/MainLayout.tsx
{isAuthenticated ? (
  <FavoritesContent />
) : (
  <LoginPrompt message="登录后可以查看和管理您的收藏夹" />
)}
```

使用 `isAuthenticated` 检查，而不是 `user?.sessdata`。

## 数据获取

### 1. 获取收藏夹列表

```
GET /api/favorites/folders?page=1&page_size=20
```

**后端流程**：
```
1. 前端调用 getFolders()
2. 后端 /api/favorites/folders
3. BilibiliService.get_folder_list()
4. 转换数据格式
5. 返回收藏夹列表
```

**前端调用**：
```typescript
// apps/web/src/pages/components/FavoritesContent.tsx
const response = await apiService.getFolders();
if (response.success && response.data) {
  setFolders(response.data);
  setFoldersCache(response.data);  // 缓存数据
}
```

**缓存策略**：
- 缓存时间：5分钟
- 缓存键：`folders-cache`
- 刷新策略：先显示缓存，后台静默刷新

### 2. 获取收藏夹详情

```
GET /api/favorites/folders/{folder_id}?page=1&page_size=20&keyword=&order=mtime
```

**参数**：
- `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 20，最大 100）
- `keyword`: 搜索关键词（默认空）
- `order`: 排序方式（mtime/cweight/view）
- `type`: 类型筛选（0=全部, 2=视频, 21=音频, 12=文章）
- `tid`: 分区 ID（默认 0）

**后端流程**：
```
1. 前端调用 getFolderDetail(folderId, page)
2. 后端路由 /api/favorites/folders/{folder_id}
3. BilibiliService.get_folder_detail()
4. MediaDataTransformer.transform_favorite_list()
5. 返回视频列表（CardListResponse）
```

**前端调用**：
```typescript
// apps/web/src/pages/components/FavoritesContent.tsx
const fetchFavoriteVideos = useCallback(async (page: number, pageSize: number) => {
  if (!selectedFolder || !user?.mid) {
    return { success: true, data: { list: [], total: 0 } };
  }
  return apiService.getFolderDetail(selectedFolder.id, page, pageSize);
}, [selectedFolder?.id, user?.mid]);

// 使用 useVideoList Hook 管理列表
const favoriteListCacheKey = selectedFolder
  ? `favorites:${user?.mid || 'anon'}:${selectedFolder.id}:${keyword.trim() || '__all__'}:${order}:${sortDirection}`
  : `favorites:root:${user?.mid || 'anon'}`

const { videos, loading, loadingMore, loadMoreError, hasMore, loadMoreRef } = useVideoList({
  fetchFn: fetchFavoriteVideos,
  pageSize: 10,
  deps: [],
  cacheKey: favoriteListCacheKey,
  autoLoad: Boolean(selectedFolder),
  formatItem: (video: any) => ({
    id: video.id,
    bvid: video.bvid,
    title: video.title,
    cover: video.cover,
    duration: formatDuration(video.duration),
    uploader: video.uploader?.name || '未知',
    views: formatNumber(video.view),
    // ... 其他字段
  })
});
```

**无限滚动**：
- 使用 Intersection Observer 监听滚动位置
- `useVideoList` 会做分页缓存、首屏 sessionStorage 复用、请求去重和短暂重试
- 加载更多失败时只显示底部提示，不会清空已加载内容
- rootMargin: 100px（提前触发）
- threshold: 0.1（10%可见触发）

### 3. 获取订阅的收藏夹

```
GET /api/favorites/collected?sessdata=xxx&up_mid=123&page=1&page_size=20
```

**后端流程**：
```
1. 前端调用 API（未实现前端调用）
2. 后端 /api/favorites/collected
3. BilibiliService.get_collected_folders()
4. 返回订阅的收藏夹列表
```

**注意**：此端点后端已实现，但前端未调用。

## 路由设计

### 路由结构

```
/favorites              -> 收藏夹列表
/favorites/{folder_id}  -> 收藏夹详情
```

### 路由同步

```typescript
// 选择收藏夹时更新路由
const handleSelectFolder = (folder: any) => {
  setSelectedFolder(folder);
  navigate(`/favorites/${folder.id}`, { replace: true });
};

// 返回列表时更新路由
const handleBackToFolders = () => {
  setSelectedFolder(null);
  navigate('/favorites', { replace: true });
};

// 监听路由变化，支持直接访问 URL
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

## 下载集成

### 下载流程

```
1. 用户点击下载按钮
2. 调用 useVideoDownload.toggleDownload()
3. 获取视频详情（检查是否多P）
4. 单P：创建单个下载任务
5. 多P：创建调度器，为每个分P创建任务
6. 提交到下载队列
7. 更新下载状态
```

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

### 多P视频处理

```typescript
// useVideoDownload Hook 内部实现
if (pages && pages.length > 1) {
  // 多P视频：创建调度器
  const scheduler = await newQueueStore.createScheduler({
    name: `系列-${video.title}`,
    type: 'series',
    meta: {
      aid: video.aid,
      bvid: video.bvid,
      title: video.title,
      uploader: video.uploader.name
    }
  });

  // 为每个分P创建任务
  for (const page of pages) {
    await newQueueStore.addTask({
      media_id: video.bvid,
      media_type: 'video',
      scheduler_id: scheduler.id,
      meta: {
        cid: page.cid,
        page: page.page,
        part_title: page.part,
        title: video.title,
        uploader: video.uploader.name
      }
    });
  }
} else {
  // 单P视频：创建单个任务
  await newQueueStore.addTask({
    media_id: video.bvid,
    media_type: 'video',
    meta: {
      cid: video.cid,
      title: video.title,
      uploader: video.uploader.name
    }
  });
}
```

## 数据转换

### 统一数据模型

使用 `MediaDataTransformer` 将 B 站 API 数据转换为统一的 `CardData` 格式。

```python
# apps/api/src/services/media_data_transformer.py
def transform_favorite_list(self, medias: List[Dict]) -> List[CardData]:
    """转换收藏夹视频列表为统一卡片格式"""
    cards = []
    for media in medias:
        if media.get('type') == 2:  # 视频类型
            card = self.transform_favorite_video(media)
            cards.append(card)
    return cards

def transform_favorite_video(self, media: Dict) -> CardData:
    """转换单个收藏夹视频"""
    return CardData(
        id=media.get('id', ''),
        bvid=media.get('id', ''),
        title=media.get('title', ''),
        cover=media.get('cover', ''),
        duration=self._format_duration(media.get('duration', 0)),
        uploader=self.normalize_uploader(media.get('upper', {})),
        stats=self.normalize_stats(media.get('cnt_info', {})),
        pubtime=media.get('pubtime', 0),
        cid=media.get('id', 0),  # 收藏夹中没有 cid，使用 id
        aid=media.get('id', 0)
    )
```

## 性能优化

### 1. 缓存机制

```typescript
// 收藏夹列表缓存
const [folders, setFolders] = useState<any[]>(() => {
  const cached = getFoldersCache();
  return cached || [];
});

// 静默刷新
const cachedFolders = getFoldersCache();
if (cachedFolders) {
  setFolders(cachedFolders);
  // 后台静默刷新
  const response = await apiService.getFolders();
  if (response.success && response.data) {
    setFolders(response.data);
    setFoldersCache(response.data);
  }
}
```

### 2. useCallback 缓存函数

```typescript
const fetchFavoriteVideos = useCallback(async (page: number, pageSize: number) => {
  // ...
}, [selectedFolder?.id, user?.mid]);
```

### 3. useRef 避免重复请求

```typescript
const foldersLoadedRef = useRef(false);

useEffect(() => {
  if (foldersLoadedRef.current) return;
  foldersLoadedRef.current = true;
  // ... 加载逻辑
}, [user]);
```

### 4. 使用 B 站原生 API

收藏夹详情 API 使用 B 站原生 API，避免 HTML 解析，加载速度提升 90% 以上。

## 注意事项

1. **登录验证**：必须先登录才能查看收藏夹
2. **缓存时间**：收藏夹列表缓存时间为 5 分钟
3. **路由同步**：选择收藏夹时自动更新 URL，支持直接访问
4. **下载状态**：下载状态检查需要新下载队列系统支持
5. **错误处理**：所有网络请求都应该有错误处理和用户提示
6. **无障碍**：确保键盘导航和屏幕阅读器支持

## 相关文档

- [收藏夹 API 完整文档](../api/favorites-api.md)
- [收藏页前端实现](../web/favorites-page.md)
- [收藏夹数据转换](../components/favorites-data-transformer.md)
- [收藏夹下载集成](../download/favorites-download.md)
- [BilibiliService](../components/bilibili-service.md)

---

[返回上级](./README.md)
