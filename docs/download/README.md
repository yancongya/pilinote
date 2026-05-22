# 下载系统

本目录包含下载系统的完整文档。

## 文档索引

### 1. 系统整合优化
**文件**: [system-refactor.md](system-refactor.md)

内容：
- 下载系统整合优化概述
- 优化目标和主要改进
- 技术架构和API变更
- 数据模型变更
- 前端状态管理
- 性能优化
- 迁移指南
- 已知问题和解决方案
- 未来规划

### 2. 队列系统
**文件**: [queue.md](queue.md)

内容：
- 任务创建与管理
- 状态流转
- WebSocket 实时更新
- 四级队列系统
- 并发控制
- 错误处理和重试

### 3. 任务系统
**文件**: [tasks.md](tasks.md)

内容：
- 任务定义
- 执行流程
- 任务处理器
- NFO生成器
- 错误处理
- 并发控制
- WebSocket事件推送

### 4. 调度器
**文件**: [scheduler.md](scheduler.md)

内容：
- 定时任务配置
- 自动下载触发
- 调度器模型
- 调度器执行流程
- 使用场景
- 前端集成

### 5. 文件处理器
**文件**: [handlers.md](handlers.md)

内容：
- 视频处理器
- 字幕处理器
- 弹幕处理器
- 封面处理器

### 6. 评论数据提取
**文件**: [comment-extraction.md](comment-extraction.md)

内容：
- B站评论API集成
- 置顶评论和热门评论提取
- NFO文件评论数据存储
- 前端评论显示功能

### 7. 添加到下载队列
**文件**: [add-to-download-queue.md](add-to-download-queue.md)

内容：
- URL解析和验证
- 媒体类型识别
- 队列添加流程

### 8. 自动化功能
**文件**: [automation-features.md](automation-features.md)

内容：
- 自动下载配置
- 定时任务管理
- 批量处理

### 9. 收藏夹下载
**文件**: [favorites-download.md](favorites-download.md)

内容：
- 收藏夹扫描
- 批量下载
- 数据同步

### 10. 稍后再看下载
**文件**: [watchlater-download.md](watchlater-download.md)

内容：
- 稍后再看列表获取
- 自动下载功能

### 11. 媒体类型支持
**文件**: [media-type-support.md](media-type-support.md)

内容：
- 支持的媒体类型
- 类型转换
- 扩展接口

## 下载系统架构

### 核心组件

1. **队列管理器** (`apps/api/src/services/queue/manager.py`)
   - 四级队列系统（BACKLOG → PENDING → DOING → COMPLETE）
   - 并发控制（默认最大3个并发下载）
   - 任务调度和管理

2. **任务处理器** (`apps/api/src/services/queue/handlers/`)
   - 视频处理器 (`video.py`)
   - 图文处理器 (`opus.py`)
   - NFO生成器 (`nfo.py`)

3. **下载记录** (`apps/api/src/models/download.py`)
   - 下载状态管理
   - 进度跟踪
   - 错误处理

4. **前端状态管理** (`apps/web/src/stores/`)
   - `download.ts` - 下载状态管理
   - `downloadHistory.ts` - 下载历史记录
   - `downloadSettings.ts` - 下载设置

### 数据流

```
用户操作 → API请求 → 队列管理器 → 任务处理器 → 下载引擎
                                              ↓
                                         WebSocket推送
                                              ↓
                                          前端状态更新
                                              ↓
                                              UI更新
```

## 重要说明

### 旧系统废弃

以下API已废弃，请使用新的下载系统：

| 废弃API | 替代API |
|---------|---------|
| `POST /api/download/parse` | `POST /api/queue/tasks` 或 `GET /api/media/{media_type}/{media_id}` |
| `GET /api/queue` | `GET /api/queue/tasks` 或 `GET /api/downloads` |
| `POST /api/queue/add` | `POST /api/queue/tasks` |

### WebSocket连接

**端点**: `ws://localhost:8000/ws/queue`

**事件类型**：
- `download_progress` - 下载进度更新
- `download_status` - 下载状态更新
- `download_stage` - 下载阶段更新
- `download_bytes` - 下载字节数更新
- `download_error` - 下载错误

### 性能优化

- **WebSocket推送**：替代轮询，减少90%的API请求
- **本地状态缓存**：使用Zustand的persist中间件，支持离线浏览
- **批量操作**：支持批量开始、暂停、取消下载
- **智能重试**：失败任务自动重试，最多3次

## 相关文档

- [API端点](../api/endpoints.md) - 完整的API端点文档
- [后端架构](../architecture/backend-architecture.md) - 后端架构详细说明
- [系统架构](../architecture/system.md) - 系统整体架构

---

[返回上级](../README.md)
