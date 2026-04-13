# 稍后再看

---
关联文档:
  - ../api/watchlater-api.md - 完整 API 文档
  - ../web/watchlater-page.md - 前端实现文档
  - ../components/toview-data-transformer.md - 数据转换文档
  - ../download/watchlater-download.md - 下载集成文档
  - ../auth/login-flow.md - 登录流程
  - ../auth/cookies.md - Cookie 管理
  - ../database/models.md - User 模型

涉及文件:
  - apps/web/src/pages/components/WatchLaterContent.tsx - 稍后再看页主组件
  - apps/web/src/hooks/useVideoList.ts - 视频列表管理 Hook
  - apps/web/src/hooks/useVideoDownload.ts - 下载管理 Hook
  - apps/web/src/stores/newQueue.ts - 下载队列 Store
  - apps/web/src/stores/auth.ts - 认证 Store
  - apps/api/src/routers/watchlater.py - 稍后再看 API 路由
  - apps/api/src/routers/media.py - 媒体 API 路由
  - apps/api/src/services/bilibili.py - BilibiliService
  - apps/api/src/services/media_data_transformer.py - 数据转换器

依赖服务:
  - BilibiliService - B站API服务
  - HeadersManager - 请求头管理
  - MediaDataTransformer - 数据转换
  - NewQueueStore - 下载队列
---

## 功能概述

稍后再看是 B 站提供的功能，允许用户将感兴趣的视频标记为"稍后再看"，方便后续观看。PiliNote 的稍后再看功能支持：

- ✅ 查看稍后再看视频列表
- ✅ 显示观看进度和进度条
- ✅ 无限滚动加载
- ✅ 视频下载（单P和多P）
- ✅ 下载状态实时显示
- ✅ 统计数据展示

## 前端组件

### 组件结构

```
WatchLaterContent (主组件)
├── 状态管理
│   ├── useState - 本地状态
│   │   ├── totalCount (视频总数)
│   │   ├── alertModal (提示弹窗)
│   │   └── confirmModal (确认弹窗)
│   └── 全局状态
│       ├── useAuthStore (认证)
│       └── useNewQueueStore (下载队列)
│
├── 数据获取
│   └── useVideoList Hook
│       ├── 无限滚动
│       ├── 分页加载
│       └── 数据格式化
│
├── 下载集成
│   └── useVideoDownload Hook
│       ├── 单P视频下载
│       ├── 多P视频下载
│       └── 下载状态管理
│
└── UI 组件
    ├── VideoListContainer (视频列表)
    ├── AlertModal (提示弹窗)
    └── ConfirmModal (确认弹窗)
```

### 核心功能

#### 1. 登录验证

未登录时显示提示信息：

```typescript
if (!user?.mid) {
  return (
    <section className="content-section">
      <p>请先登录以查看稍后再看</p>
    </section>
  );
}
```

#### 2. 视频列表展示

显示视频封面、标题、时长、观看进度、UP主等：

```typescript
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
    progress: video.progress,              // 观看进度（秒）
    watched: formatProgress(               // 格式化进度文本
      video.progress, 
      video.duration
    ),
    uploader: video.uploader?.name || '未知',
    views: formatNumber(video.view),
    danmaku: formatNumber(video.danmaku),
    comments: formatNumber(video.comment),
    likes: formatNumber(video.like),
    coins: formatNumber(video.coin),
    favorites: formatNumber(video.favorite),
    shares: formatNumber(video.share),
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

#### 3. 观看进度

支持查看视频观看进度：

```typescript
// 进度格式化
formatProgress(progress: number, duration: number): string {
  const percent = (progress / duration) * 100;
  
  if (percent >= 100) return '已看完';
  if (percent >= 90) return '快看完了';
  if (percent >= 50) return `已观看 ${Math.round(percent)}%`;
  if (percent > 0) return `已观看 ${Math.round(percent)}%`;
  return '未观看';
}
```

进度显示示例：
- `已看完` - 观看进度 100%
- `快看完了` - 观看进度 90-99%
- `已观看 50%` - 观看进度 50%
- `未观看` - 观看进度 0%

#### 4. 无限滚动

使用 Intersection Observer 实现无限滚动：

```typescript
// 触发元素
<div ref={loadMoreRef} />

// Intersection Observer
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
```

#### 5. 下载集成

支持单视频和多P视频下载：

```typescript
// 下载状态检查
const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
  const tasks = newQueueStore.tasks;
  const newSystemTasks = Object.values(tasks);
  
  // 检查是否在队列中
  const hasActiveTask = newSystemTasks.some(task =>
    task.media_id === bvid && 
    !['completed', 'cancelled'].includes(task.state)
  );
  
  if (hasActiveTask) return 'in_list';
  
  // 检查是否已下载完成
  const hasCompletedTask = newSystemTasks.some(task =>
    task.media_id === bvid && 
    task.state === 'completed'
  );
  
  if (hasCompletedTask) return 'downloaded';
  
  return 'none';
};

// 切换下载状态
const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
  const result = await baseToggleDownload(video, e);
  
  if (result.success) {
    setAlertModal({
      show: true,
      title: '操作成功',
      message: result.message,
      type: 'success'
    });
  } else {
    setAlertModal({
      show: true,
      title: '操作失败',
      message: result.message,
      type: 'error'
    });
  }
}, [baseToggleDownload]);
```

## 后端 API

### API 端点

#### 1. 获取稍后再看列表

```
GET /api/watchlater/list?pn=1&ps=20
```

**参数**：
- `pn`: 页码（默认 1）
- `ps`: 每页数量（默认 20，最大 100）

**响应**：
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": "BV1xx411c7mD",
        "bvid": "BV1xx411c7mD",
        "title": "视频标题",
        "cover": "https://example.com/cover.jpg",
        "duration": 630,
        "progress": 315,
        "uploader": {
          "name": "UP主名称",
          "mid": 123456789,
          "face": "https://example.com/avatar.jpg"
        },
        "stat": {
          "view": 100000,
          "danmaku": 5000,
          "comment": 2000,
          "like": 5000,
          "coin": 1000,
          "collect": 2000,
          "share": 500
        },
        "add_time": 1640000000,
        "pubtime": 1640000000,
        "cid": 123456789,
        "aid": 987654321
      }
    ],
    "count": 50
  },
  "total": 50
}
```

#### 2. 获取稍后再看媒体信息（统一接口）

```
GET /api/media/watchlater?pn=1&ps=20
```

**响应**：返回统一的 `CardData` 格式

### 后端流程

```
1. 前端调用 apiService.getWatchLaterList(pn, ps)
2. 后端路由 /api/watchlater/list
3. BilibiliService.get_watch_later()
   - 调用 B 站 API: /x/v2/history/toview/web
   - 传递 SESSDATA 和 mid
4. MediaDataTransformer.transform_watchlater_list()
   - 转换数据格式
   - 统一字段命名
5. 返回视频列表
```

**关键文件**：
- 前端: `apps/web/src/services/api.ts` - `getWatchLaterList()`
- 后端: `apps/api/src/routers/watchlater.py` - `/api/watchlater/list`
- 后端: `apps/api/src/routers/media.py` - `/api/media/watchlater`
- 数据转换: `apps/api/src/services/media_data_transformer.py` - `transform_watchlater_list()`

## 数据转换

### B站 API 原始数据

```json
{
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "pic": "https://example.com/cover.jpg",
  "duration": 630,
  "pubtime": 1640000000,
  "add_time": 1640000000,
  "progress": 315,
  "owner": {
    "name": "UP主名称",
    "mid": 123456789,
    "face": "https://example.com/avatar.jpg"
  },
  "stat": {
    "view": 100000,
    "danmaku": 5000,
    "comment": 2000,
    "like": 5000,
    "coin": 1000,
    "collect": 2000,
    "share": 500
  },
  "cid": 123456789,
  "aid": 987654321
}
```

### CardData 统一格式

```json
{
  "id": "BV1xx411c7mD",
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "cover": "https://example.com/cover.jpg",
  "duration": "10:30",
  "uploader": {
    "name": "UP主名称",
    "mid": 123456789,
    "face": "https://example.com/avatar.jpg"
  },
  "stats": {
    "view": 100000,
    "danmaku": 5000,
    "comment": 2000,
    "like": 5000,
    "coin": 1000,
    "favorite": 2000,
    "share": 500
  },
  "pubtime": 1640000000,
  "cid": 123456789,
  "aid": 987654321
}
```

### 字段映射

| B站字段 | CardData 字段 | 说明 |
|---------|---------------|------|
| `bvid` | `id`, `bvid` | 视频 ID |
| `title` | `title` | 视频标题 |
| `pic` | `cover` | 视频封面 |
| `duration` | `duration` | 视频时长（格式化） |
| `owner` | `uploader` | UP 主信息 |
| `owner.name` | `uploader.name` | UP 主名称 |
| `owner.mid` | `uploader.mid` | UP 主 ID |
| `owner.face` | `uploader.face` | UP 主头像 |
| `stat.view` | `stats.view` | 播放量 |
| `stat.danmaku` | `stats.danmaku` | 弹幕数 |
| `stat.comment` | `stats.comment` | 评论数 |
| `stat.like` | `stats.like` | 点赞数 |
| `stat.coin` | `stats.coin` | 投币数 |
| `stat.collect` | `stats.favorite` | 收藏数 |
| `stat.share` | `stats.share` | 分享数 |
| `pubtime` | `pubtime` | 发布时间戳 |
| `cid` | `cid` | 视频 CID |
| `aid` | `aid` | 视频 AID |

### 观看进度处理

观看进度（`progress`）不在 `CardData` 中，由前端单独处理：

```typescript
// 前端 formatItem
formatItem: (video: any) => ({
  // ... 其他字段
  durationSeconds: video.duration,      // 保留原始时长（秒）
  progress: video.progress,             // 观看进度（秒）
  watched: formatProgress(              // 格式化进度文本
    video.progress, 
    video.duration
  ),
})
```

## 性能优化

### 1. 使用 B 站原生 API

稍后再看使用 B 站原生 API 直接获取数据，避免 HTML 解析。

### 2. 统一数据转换

使用 `MediaDataTransformer` 进行统一的数据转换，确保数据格式一致性。

### 3. 分页加载

支持分页，避免一次性加载大量数据。

### 4. 缓存优化

前端使用 `useCallback` 缓存函数，避免重复创建。

```typescript
const fetchWatchLaterVideos = useCallback(async (page: number, pageSize: number) => {
  // ...
}, [user?.mid]);
```

## 注意事项

1. **登录验证**：必须先登录才能查看稍后再看
2. **观看进度**：观看进度由 B 站记录，无法本地修改
3. **下载状态**：下载状态检查需要新下载队列系统支持
4. **错误处理**：所有网络请求都应该有错误处理和用户提示
5. **无障碍**：确保屏幕阅读器支持

## 与收藏夹的区别

| 特性 | 稍后再看 | 收藏夹 |
|------|----------|--------|
| 数据来源 | `/x/v2/history/toview/web` | `/fav/v2/fav/folder/list` |
| 结构 | 单一列表 | 列表 + 详情 |
| 观看进度 | 支持 | 不支持 |
| 排序 | 按添加时间 | 支持多种排序 |
| 搜索 | 不支持 | 支持 |
| 数量限制 | 最多 1000 个 | 无限制 |
| 路由 | 无路由 | /favorites 和 /favorites/{id} |
| 缓存 | 无缓存 | 收藏夹列表缓存 |

## 相关文档

- [稍后再看 API 完整文档](../api/watchlater-api.md) - 详细 API 文档
- [稍后再看页前端实现](../web/watchlater-page.md) - 前端实现详情
- [稍后再看数据转换](../components/toview-data-transformer.md) - 数据转换详解
- [稍后再看下载集成](../download/watchlater-download.md) - 下载功能集成
- [收藏夹功能](./favorites.md) - 收藏夹功能对比

---

[返回上级](./README.md)