# 视频库设置

## 概述

视频库设置用于管理本地视频库的状态检查和缓存机制，帮助系统准确判断视频是否已下载，避免重复下载。

## 配置选项

### 缓存设置

| 选项 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| 缓存过期时间 | 视频库缓存的过期时间（秒） | 600 | 60-3600 |
| 智能刷新 | 根据缓存新鲜度决定是否刷新 | 启用 | 启用/禁用 |
| 深度扫描 | 对多P视频进行深度检查 | 禁用 | 启用/禁用 |

### 自动刷新设置

| 选项 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| 下载完成后自动刷新 | 下载任务完成后自动刷新视频库 | 启用 | 启用/禁用 |
| 自动刷新延迟 | 下载完成后刷新的延迟时间（秒） | 5 | 1-60 |

### 性能设置

| 选项 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| 最大并发检查数 | 批量检查时的最大并发数 | 50 | 10-100 |

## 工作原理

### 缓存机制

系统会缓存视频库的状态信息，避免频繁扫描文件系统：

1. **首次访问**：扫描视频库并缓存结果
2. **后续访问**：使用缓存结果
3. **缓存过期**：自动刷新缓存
4. **手动刷新**：用户主动刷新

### 状态判断

判断视频是否已下载的逻辑：

1. **检查视频库缓存**（主要判断）
2. **检查任务队列状态**（补充判断）
3. **严格文件存在**：只有文件实际存在才认为已下载

### 自动刷新

下载任务完成后自动刷新视频库：

1. **监听WebSocket事件**：监听下载完成事件
2. **延迟刷新**：延迟指定时间后刷新缓存
3. **智能判断**：根据缓存新鲜度决定是否刷新

## 使用场景

### 手动添加下载

在视频详情页添加下载时，系统会：

1. **检查视频状态**：使用 `VideoLibraryService.checkBeforeAdd()`
2. **显示确认对话框**：已下载则显示确认对话框
3. **用户确认**：用户确认后可以重新下载

```typescript
const decision = await videoLibraryService.checkBeforeAdd(video);

switch (decision.action) {
  case 'add':
    // 直接添加
    await addToDownloadQueue(video);
    break;
    
  case 'show_confirm':
    // 显示确认对话框
    const confirmed = await videoLibraryService.showReDownloadDialog(video);
    if (confirmed) {
      await addToDownloadQueue(video);
    }
    break;
    
  case 'skip':
    // 静默跳过
    showToast('视频已下载，已在视频库中', 'info');
    break;
}
```

### 批量添加下载

在收藏夹/稍后再看批量添加时，系统会：

1. **批量检查状态**：使用 `checkVideosInLibrary()` 批量检查
2. **自动过滤**：自动过滤已下载的视频
3. **显示统计**：显示跳过的视频数量

```typescript
const bvids = videos.map(v => v.bvid);
const result = await videoLibraryService.checkVideosInLibrary(bvids);

const videosToDownload = videos.filter(v => 
  !result.data.downloaded.includes(v.bvid)
);

console.log(`跳过 ${result.data.downloaded.length} 个已下载视频`);
console.log(`添加 ${videosToDownload.length} 个新视频`);
```

### 自动下载

自动扫描下载时，后端会：

1. **检查视频库**：使用后端视频库服务检查状态
2. **跳过已下载**：跳过已下载的视频
3. **避免重复**：避免重复添加

## 配置建议

### 低配置系统

对于配置较低的系统，建议使用以下设置：

- **缓存过期时间**：300秒（5分钟）
- **最大并发检查数**：20
- **禁用深度扫描**：避免过度消耗资源
- **启用智能刷新**：减少不必要的刷新

### 高配置系统

对于配置较高的系统，可以使用以下设置：

- **缓存过期时间**：1800秒（30分钟）
- **最大并发检查数**：100
- **启用深度扫描**：提高检查准确性
- **启用智能刷新**：平衡性能和准确性

### 网络不稳定环境

对于网络环境不稳定的场景：

- **下载完成后自动刷新**：启用
- **自动刷新延迟**：10秒
- **禁用智能刷新**：强制刷新以确保准确性
- **最大并发检查数**：20（减少并发请求）

## 配置存储

视频库设置存储在设置配置的 `video_library` 部分：

```json
{
  "video_library": {
    "cache_ttl": 600,
    "auto_refresh_delay": 5,
    "max_concurrent_checks": 50,
    "enable_smart_refresh": true,
    "enable_deep_scan": false
  }
}
```

## 相关文件

### 前端文件

- **设置页面**：`apps/web/src/pages/settings/VideoLibrarySettings.tsx`
- **视频库服务**：`apps/web/src/services/videoLibraryService.ts`
- **设置存储**：`apps/web/src/stores/settings.ts`

### 后端文件

- **视频库服务**：`apps/api/src/services/video_library_service.py`
- **API路由**：`apps/api/src/routers/video_library.py`

## 相关文档

- [视频库API](../api/library-api.md)
- [VideoLibrary组件](../components/video-library.md)
- [ReDownloadDialog组件](../components/re-download-dialog.md)
- [视频库状态管理系统设计](../superpowers/specs/2026-04-16-video-library-status-management-design.md)

---

[返回上级](./README.md)