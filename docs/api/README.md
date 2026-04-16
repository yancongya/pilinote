# API 端点

本目录包含后端接口文档。

## 文档索引

### 1. 后端实现
**文件**: [implementation.md](implementation.md)

内容：
- 项目结构
- API 路由
- 核心服务
- 中间件
- 数据库模型

### 2. 接口列表
**文件**: [endpoints.md](endpoints.md)

内容：
- 认证接口
- 视频接口
- 下载接口
- 设置接口

### 3. 收藏夹 API
**文件**: [favorites-api.md](favorites-api.md)

内容：
- 获取收藏夹列表
- 获取收藏夹详情
- 获取订阅的收藏夹

### 4. 稍后再看 API
**文件**: [watchlater-api.md](watchlater-api.md)

内容：
- 获取稍后再看列表
- 添加到稍后再看
- 从稍后再看移除

### 5. 观看历史 API
**文件**: [history-api.md](history-api.md)

内容：
- 获取观看历史列表
- 支持分页、搜索、排序
- 观看进度显示
- 与下载系统集成

### 6. 本地视频库 API
**文件**: [library-api.md](library-api.md)

内容：
- 获取视频库统计信息
- 扫描视频库
- 导入新文件
- 清理丢失文件
- 完整同步
- 获取本地图片
- 文件命名规范（cover.jpg、avatar.jpg/png）
- 时间管理（文件夹创建时间）

### 3. 后端服务组件
**文件**: [components/README.md](../components/README.md)

内容：
- BilibiliService
- CookieManager
- HeadersManager
- VideoCacheService
- DownloadEngine
- MediaProcessor
- DownloadManager
- DownloadService
- ScanService
- SettingsService

---

## 关联文档

- [web/implementation.md](../web/implementation.md) - 前端实现
- [database/models.md](../database/models.md) - 数据模型
- [components/video-cache-service.md](../components/video-cache-service.md) - 视频缓存服务

---

[返回上级](../README.md)