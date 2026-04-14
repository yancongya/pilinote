# 组件文档

本目录记录前后端共用的组件和服务文档。

## 文档索引

### 前端组件

| 组件 | 说明 | 文档 |
|------|------|------|
| HomeContent | 首页内容（链接解析/预览卡片） | [home-content.md](home-content.md) |
| VideoDetailPage | 视频/图文详情页 | [video-detail-page.md](video-detail-page.md) |
| VideoListContainer | 视频列表容器 | [video-list-container.md](video-list-container.md) |
| VideoListControls | 视频列表搜索和排序控件 | [video-list-controls.md](video-list-controls.md) |
| HistoryList | 历史记录列表 | [history-list.md](history-list.md) |
| BatchActionsBar | 批量操作栏 | [batch-actions-bar.md](batch-actions-bar.md) |
| Modal | 通用弹窗 | [modal.md](modal.md) |
| Toast | 提示消息 | [toast.md](toast.md) |
| AlertModal | 警告弹窗 | [alert-modal.md](alert-modal.md) |
| ConfirmModal | 确认弹窗 | [confirm-modal.md](confirm-modal.md) |

### 后端服务

| 服务 | 说明 | 文档 |
|------|------|------|
| BilibiliService | Bilibili API 服务 | [bilibili-service.md](bilibili-service.md) |
| CookieManager | Cookie 管理 | [cookie-manager.md](cookie-manager.md) |
| HeadersManager | 请求头管理 | [headers-manager.md](headers-manager.md) |
| VideoCacheService | 视频缓存服务 | [video-cache-service.md](video-cache-service.md) |
| DownloadEngine | 下载引擎 | [download-engine.md](download-engine.md) |
| MediaProcessor | 媒体处理 | [media-processor.md](media-processor.md) |
| MediaDataTransformer | 数据转换 | [media-data-transformer.md](media-data-transformer.md) |
| DownloadManager | 下载管理 | [download-manager.md](download-manager.md) |
| DownloadService | 下载服务 | [download-service.md](download-service.md) |
| ScanService | 扫描服务 | [scan-service.md](scan-service.md) |
| SettingsService | 设置服务 | [settings-service.md](settings-service.md) |

---

## 组件分类

### 基础设施

- CookieManager
- HeadersManager
- SettingsService
- VideoCacheService

### 媒体处理

- BilibiliService
- MediaProcessor
- MediaDataTransformer

### 下载系统

- DownloadEngine
- DownloadManager
- DownloadService

### 自动化

- ScanService
- SchedulerService (未创建文档)

### UI 组件

- 通用组件（Modal, Toast 等）
- 业务组件（VideoListContainer, BatchActionsBar）

---

[返回上级](../README.md)