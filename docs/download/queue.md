# 队列系统

## 概述

基于 Aria2c 的任务队列系统，采用四级队列架构进行任务管理。

## 任务状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| downloading | 下载中 |
| completed | 完成 |
| failed | 失败 |
| paused | 暂停 |
| cancelled | 取消 |

## 下载阶段

| 阶段 | 说明 |
|------|------|
| preparing | 准备中 |
| downloading | 下载中 |
| moving | 文件移动中 |
| post_processing | 后处理中 |
| completed | 已完成 |

## 四级队列系统

```python
class QueueType(IntEnum):
    BACKLOG = 0   # 待处理队列
    PENDING = 1   # 等待队列
    DOING = 2     # 执行队列
    COMPLETE = 3  # 完成队列
```

### 任务生命周期

```
BACKLOG → PENDING → DOING → COMPLETED
  ↓         ↓        ↓         ↓
待处理   等待中    执行中    已完成
```

### 并发控制

```python
# 最大并发下载任务数
MAX_CONCURRENT_DOWNLOADS = 3

# 信号量控制并发
semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

async def process_task(task_id: str):
    async with semaphore:
        # 执行下载任务
        await download_service.process(task_id)
```

## API

### 下载队列管理（新系统）

#### 获取任务列表

```
GET /api/queue/tasks
```

#### 创建任务

```
POST /api/queue/tasks
Body: {
    "media_type": "video",
    "media_id": "BV1xx411c7mD",
    "title": "视频标题",
    "meta": {
        "cid": 123456,
        "page": 1
    }
}
```

#### 控制任务

```
POST /api/queue/tasks/{task_id}/start
POST /api/queue/tasks/{task_id}/pause
POST /api/queue/tasks/{task_id}/resume
POST /api/queue/tasks/{task_id}/cancel
POST /api/queue/tasks/{task_id}/retry
```

#### 删除任务

```
DELETE /api/queue/tasks/{task_id}
```

#### 批量操作

```
POST /api/queue/tasks/batch/start
Body: {
    "task_ids": ["id1", "id2", "id3"]
}
```

### 调度器管理

#### 创建调度器

```
POST /api/queue/schedulers
Body: {
    "title": "我的调度器",
    "folder": "/downloads/my_videos",
    "task_ids": ["task1", "task2"]
}
```

#### 启动调度器

```
POST /api/queue/schedulers/{id}/start
```

#### 停止调度器

```
POST /api/queue/schedulers/{id}/stop
```

#### 删除调度器

```
DELETE /api/queue/schedulers/{id}
```

### 下载列表管理

#### 获取下载列表

```
GET /api/downloads?status=downloading
```

#### 批量开始下载

```
POST /api/downloads/batch/start
Body: {
    "download_ids": ["id1", "id2", "id3"]
}
```

#### 删除下载记录

```
DELETE /api/downloads/{download_id}
DELETE /api/downloads/by-bvid/{bvid}
```

## WebSocket 实时更新

```
ws://localhost:8000/ws/downloads
```

### 事件类型

| 事件类型 | 说明 |
|----------|------|
| `download_progress` | 下载进度更新 |
| `download_status` | 下载状态更新 |
| `download_stage` | 下载阶段更新 |
| `download_bytes` | 下载字节数更新 |
| `download_error` | 下载错误 |

### 事件示例

#### 下载进度更新

```json
{
  "type": "download_progress",
  "download_id": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 45.5,
  "speed": 1024000,
  "eta": 120
}
```

#### 下载状态更新

```json
{
  "type": "download_status",
  "download_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "downloading"
}
```

#### 下载错误

```json
{
  "type": "download_error",
  "download_id": "550e8400-e29b-41d4-a716-446655440000",
  "error": "网络连接失败",
  "error_type": "network",
  "error_code": "NETWORK_ERROR"
}
```

## 前端状态管理

### 下载状态Store

**文件**: `apps/web/src/stores/download.ts`

```typescript
interface DownloadState {
  downloads: Map<string, DownloadItem>
  downloadIds: string[]
  syncing: boolean
  lastSyncTime: number | null
  ws: WebSocket | null
  wsConnected: boolean
  
  // 状态更新方法
  updateDownloadStatus: (downloadId: string, status: DownloadStatus) => void
  updateDownloadProgress: (downloadId: string, progress: number, speed?: number, eta?: number) => void
  setDownloadError: (downloadId: string, error: ErrorInfo) => void
  
  // 任务控制方法
  startDownload: (downloadId: string) => Promise<boolean>
  pauseDownload: (downloadId: string) => Promise<boolean>
  resumeDownload: (downloadId: string) => Promise<boolean>
  retryDownload: (downloadId: string) => Promise<boolean>
  
  // 服务器同步
  syncFromServer: () => Promise<void>
}
```

### WebSocket连接管理

```typescript
// 自动连接WebSocket
connectWebSocket: () => {
  const wsUrl = `ws://${window.location.hostname}:8000/ws/downloads`
  const ws = new WebSocket(wsUrl)
  
  ws.onopen = () => {
    console.log('[DownloadStore] WebSocket connected')
  }
  
  ws.onmessage = (event) => {
    handleWebSocketMessage(event)
  }
  
  ws.onclose = () => {
    // 3秒后重连
    setTimeout(() => connectWebSocket(), 3000)
  }
}
```

## 错误处理和重试

### 错误类型

```typescript
export type ErrorType = 'network' | 'authentication' | 'file_system' | 'server' | 'unknown'

export interface ErrorInfo {
  type: ErrorType
  message: string
  code?: string
  details?: string
  timestamp: number
}
```

### 重试机制

```typescript
retryDownload: async (downloadId: string) => {
  // 增加重试次数
  incrementRetryCount(downloadId)
  
  // 检查是否超过最大重试次数
  const download = downloads.get(downloadId)
  if (download && download.statusInfo.retry_count > download.statusInfo.max_retries) {
    console.error(`下载任务 ${downloadId} 已超过最大重试次数`)
    return false
  }
  
  // 清除错误信息并重新开始
  clearDownloadError(downloadId)
  updateDownloadStatus(downloadId, 'pending')
  
  return await startDownload(downloadId)
}
```

## 性能优化

### WebSocket推送

- 替代轮询，减少90%的API请求
- 实时进度更新，用户体验更流畅
- 自动重连机制，保证连接稳定性

### 本地状态缓存

- 使用Zustand的persist中间件
- 支持离线浏览下载列表
- 减少不必要的API请求

### 批量操作

- 支持批量开始、暂停、取消下载
- 减少API调用次数
- 提高操作效率

### 智能重试

- 失败任务自动重试
- 最多3次重试
- 详细的错误信息和分类

## 已知问题和解决方案

### WebSocket连接不稳定

**问题**: 网络波动导致连接断开
**解决**: 自动重连机制，3秒后重试

### 下载进度不准确

**问题**: 某些情况下进度计算错误
**解决**: 使用字节级别计算，避免百分比误差

### 历史记录性能问题

**问题**: 大量历史记录导致渲染卡顿
**解决**: 使用虚拟滚动和分页加载

## 关键文件

- **前端**:
  - `apps/web/src/stores/download.ts` - 下载状态管理
  - `apps/web/src/stores/downloadHistory.ts` - 下载历史记录
  - `apps/web/src/stores/downloadSettings.ts` - 下载设置
  - `apps/web/src/services/api.ts` - API服务

- **后端**:
  - `apps/api/src/routers/queue.py` - 队列路由
  - `apps/api/src/routers/downloads.py` - 下载列表路由
  - `apps/api/src/routers/websocket.py` - WebSocket路由
  - `apps/api/src/services/queue/manager.py` - 队列管理器
  - `apps/api/src/services/queue/handlers/` - 队列处理器

---

[返回上级](./README.md)