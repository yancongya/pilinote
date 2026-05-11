# PiliNote 缓存机制说明

## 概述

PiliNote 使用两层缓存机制来优化用户体验和减少不必要的 API 请求：

1. **`useCacheStore`** - 用于列表级别的持久化缓存（localStorage）
2. **`useVideoList` Hook** - 用于分页视频数据的内存和 sessionStorage 缓存

---

## 缓存分工

### 1. `useCacheStore` (stores/cache.ts)

**用途**：缓存非分页的列表数据，持久化到 localStorage

**缓存内容**：

| 缓存项 | 说明 | 过期时间 |
|--------|------|---------|
| `foldersCache` | 收藏夹列表 | 5分钟 |
| `folderVideosCache` | 收藏夹视频详情（按 cacheKey 分组） | 5分钟 |
| `subscriptionSourcesCache` | 订阅源列表（按类型和关键词分组） | 5分钟 |

**特点**：
- 持久化到 localStorage（通过 Zustand persist 中间件）
- 5分钟过期时间
- 支持后台静默刷新（先返回缓存，后台更新）
- 适合不经常变化的列表数据

**使用示例**：

```typescript
import { useCacheStore } from '../../stores/cache'

const { 
  getFoldersCache, 
  setFoldersCache,
  getSubscriptionSourcesCache,
  setSubscriptionSourcesCache
} = useCacheStore()

// 获取缓存
const cachedFolders = getFoldersCache()
if (cachedFolders) {
  setFolders(cachedFolders)
  // 后台静默刷新...
}

// 设置缓存
setFoldersCache(folders)
```

---

### 2. `useVideoList` Hook (hooks/useVideoList.ts)

**用途**：管理分页视频列表的加载、缓存和无限滚动

**缓存机制**：
- **内存缓存** (`pageResponseCache`)：跨组件共享，页面刷新后清空
- **sessionStorage 缓存**：仅缓存首页数据，标签页关闭后清空
- **请求去重** (`inflightRequestCache`)：防止重复请求

**特点**：
- 自动处理分页逻辑
- 支持无限滚动（Intersection Observer）
- 自动重试失败请求
- 缓存过期自动清理

**使用示例**：

```typescript
import { useVideoList } from '../../hooks/useVideoList'

const { 
  videos, 
  loading, 
  loadingMore, 
  hasMore, 
  loadMoreRef 
} = useVideoList({
  fetchFn: async (page, pageSize) => {
    return await apiService.getHistoryList(page, pageSize)
  },
  pageSize: 20,
  cacheKey: `history:${userId}:${keyword}`,
  formatItem: (video) => ({
    id: video.id,
    bvid: video.bvid,
    title: video.title,
    // ...
  })
})
```

---

## 各视频源的缓存使用

| 视频源 | 列表缓存 | 视频缓存 | 说明 |
|--------|---------|---------|------|
| **收藏夹** | `useCacheStore.foldersCache` | `useVideoList` + `useCacheStore.folderVideosCache` | 收藏夹列表和视频都缓存 |
| **稍后再看** | ❌ | `useVideoList` | 仅视频列表缓存 |
| **历史记录** | ❌ | `useVideoList` | 仅视频列表缓存 |
| **订阅** | `useCacheStore.subscriptionSourcesCache` | `useVideoList` | 订阅源列表和视频都缓存 |

---

## 缓存键（cacheKey）规范

### `useCacheStore` 缓存键

```typescript
// 收藏夹列表：固定键
'foldersCache'

// 收藏夹视频：folderId:page:pageSize:keyword:order:sortDirection
`${folderId}:${page}:${pageSize}:${keyword || '__all__'}:${order}:${sortDirection}`

// 订阅源列表：subscriptions:sourceType:keyword
`subscriptions:${sourceType}:${keyword || '__all__'}`
```

### `useVideoList` 缓存键

```typescript
// 收藏夹视频
`favorites:${userId}:${folderId}:${keyword || '__all__'}:${order}:${sortDirection}`

// 稍后再看
`watchlater:${userId}:${keyword || '__all__'}:${order}:${sortDirection}`

// 历史记录
`history:${userId}:${keyword || '__all__'}:${order}:${sortDirection}`

// 订阅视频
`subscriptions:${sourceType}:${sourceId}:${keyword || '__all__'}:${order}:${sortDirection}`
```

---

## 缓存清理

### 手动清理所有缓存

```typescript
import { useCacheStore } from '../../stores/cache'

const { clearAllCache } = useCacheStore()
clearAllCache()
```

### 自动清理

- **过期清理**：访问缓存时自动检查过期时间（5分钟）
- **内存清理**：页面刷新后内存缓存自动清空
- **sessionStorage 清理**：标签页关闭后自动清空

---

## 最佳实践

### 1. 何时使用 `useCacheStore`

✅ **适合**：
- 不经常变化的列表数据（收藏夹列表、订阅源列表）
- 需要跨标签页共享的数据
- 需要持久化的数据

❌ **不适合**：
- 分页数据（使用 `useVideoList`）
- 实时性要求高的数据
- 数据量特别大的列表

### 2. 何时使用 `useVideoList`

✅ **适合**：
- 分页视频列表
- 需要无限滚动的列表
- 需要自动重试的请求

❌ **不适合**：
- 非分页的简单列表
- 需要跨标签页共享的数据

### 3. 缓存键设计原则

- 包含所有影响数据的参数（userId、keyword、order 等）
- 使用 `__all__` 表示空关键词
- 保持一致的格式和分隔符

### 4. 后台静默刷新模式

```typescript
// 先返回缓存，提升用户体验
const cached = getCache()
if (cached) {
  setData(cached)
  // 后台静默刷新
  fetchLatestData().then(latest => {
    setData(latest)
    setCache(latest)
  })
  return
}

// 无缓存时正常加载
setLoading(true)
const data = await fetchLatestData()
setData(data)
setCache(data)
setLoading(false)
```

---

## 修改历史

### 2024-XX-XX
- ✅ 移除未使用的 `watchLaterCache`（稍后再看使用 `useVideoList` 缓存即可）
- ✅ 添加 `subscriptionSourcesCache` 用于订阅源列表缓存
- ✅ 在 `SubscriptionsContent.tsx` 中实现订阅源缓存逻辑
- ✅ 统一缓存机制文档

---

## 相关文件

- `apps/web/src/stores/cache.ts` - 缓存 Store 定义
- `apps/web/src/hooks/useVideoList.ts` - 视频列表 Hook
- `apps/web/src/pages/components/FavoritesContent.tsx` - 收藏夹实现
- `apps/web/src/pages/components/WatchLaterContent.tsx` - 稍后再看实现
- `apps/web/src/pages/components/HistoryContent.tsx` - 历史记录实现
- `apps/web/src/pages/components/SubscriptionsContent.tsx` - 订阅实现
