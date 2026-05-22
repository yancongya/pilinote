# 观看历史

---
关联文档:
  - ../auth/login-flow.md    # 需要登录验证
  - ../auth/cookies.md      # Cookie 管理
  - ../auth/multi-account.md  # 登录状态验证 isAuthenticated
  - ../api/history-api.md   # 观看历史 API 完整文档
  - ../web/implementation.md # 前端历史型列表实现
  - ../components/video-list-container.md # 列表容器
  - ../download/add-to-download-queue.md # 下载集成

涉及文件:
  - apps/api/src/routers/history.py
  - apps/api/src/services/bilibili.py
  - apps/api/src/services/media_data_transformer.py
  - apps/web/src/pages/components/HistoryContent.tsx
  - apps/web/src/hooks/useVideoList.ts
  - apps/web/src/components/VideoListContainer.tsx
  - apps/web/src/hooks/useVideoDownload.ts

依赖服务:
  - BilibiliService
  - MediaDataTransformer
  - NewQueueStore
---

## 概述

观看历史源用于展示用户在 B 站看过的视频记录，支持分页、搜索、排序、观看时间展示和下载集成。

与收藏夹、稍后再看类似，历史记录页面也复用了统一的历史型列表壳层：

- `MediaListShell` 负责顶部固定区域和内容壳层
- `MediaListTopBar` 负责标题、统计和筛选区
- `VideoListContainer` 负责真正的视频卡片列表与增量错误展示
- `useVideoList` 负责分页缓存、首屏 sessionStorage 复用、请求去重和加载更多控制

## 功能特性

### 已实现功能

1. **观看历史列表展示**
   - 显示视频封面、标题、UP主、观看时间、观看进度
   - 支持无限滚动加载
   - 支持分页加载
   - 支持点击进入视频详情页

2. **搜索和排序**
   - 支持关键词搜索
   - 支持按播放量、发布时间、观看时间排序
   - 支持升序和降序切换

3. **缓存与稳定性**
   - 后端以 `user.mid` 作为稳定缓存键
   - 服务端先获取完整历史列表，再在本地分页、搜索和排序
   - 前端 `useVideoList` 会对分页结果做页面缓存、请求去重和短暂重试
   - 加载更多失败时只显示底部提示，不会清空已加载内容

4. **下载集成**
   - 单视频下载
   - 多P视频下载（自动创建调度器）
   - 下载状态实时显示
   - 下载队列管理

5. **登录验证**
   - 未登录显示登录提示
   - 登录后自动加载数据

## 数据获取

### 获取观看历史列表

```
GET /api/history/list?pn=1&ps=20&keyword=&order=default&sort_direction=desc
```

**后端流程**：
```
1. 前端调用 getHistoryList()
2. 后端 /api/history/list
3. BilibiliService.get_history()
4. MediaDataTransformer.transform_history_list()
5. 服务端完成分页、搜索和排序
6. 返回视频列表（CardListResponse）
```

**前端调用**：
```typescript
// apps/web/src/pages/components/HistoryContent.tsx
const historyCacheKey = `history:${user?.mid || 'anon'}:${keyword.trim() || '__all__'}:${order}:${sortDirection}`

const { videos, loading, loadingMore, loadMoreError, hasMore, loadMoreRef } = useVideoList({
  fetchFn: fetchHistoryVideos,
  pageSize: 20,
  deps: [],
  cacheKey: historyCacheKey,
  formatItem: (video: any) => ({
    id: video.id,
    bvid: video.bvid,
    title: video.title,
    cover: video.cover,
    duration: formatDuration(video.duration),
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
    time: formatTime(video.view_time),
    cid: video.cid,
    aid: video.aid,
    pic: video.cover,
    originalDuration: video.duration,
    owner: video.uploader,
    pubtime: video.pubtime
  })
});
```

## 路由设计

### 路由结构

```
/history  -> 观看历史列表
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

### 下载状态

- `none`：未下载
- `in_list`：在下载队列中
- `downloaded`：已下载完成

---

[返回上级](./README.md)
