# 队列系统

## 概述

队列系统负责管理“任务（Task）”的创建、调度与执行，并通过 WebSocket 向前端推送实时状态。

当前实现以 `Task.state`（整数枚举）作为**主状态**，以 `Task.status.stage`（字符串枚举）作为**下载阶段**。两者含义不同，避免混用。

## 任务状态

后端存储/返回的 `state` 为 `TaskState`（`apps/api/src/models/task.py`），取值为整数：

| TaskState | 值 | 说明 | 常见 UI 文案 |
|---|---:|---|---|
| BACKLOG | 0 | 已规划（已创建，但尚未进入执行调度） | 已规划/待办 |
| PENDING | 1 | 待处理（等待调度/资源位） | 排队中 |
| ACTIVE | 2 | 执行中 | 下载中 |
| COMPLETED | 3 | 已完成 | 完成 |
| PAUSED | 4 | 已暂停 | 暂停 |
| FAILED | 5 | 失败 | 失败 |
| CANCELLED | 6 | 已取消 | 取消/跳过 |

注意：
1. 文档中如果出现“跳过”，应理解为**没有进入下载执行**的结果（例如扫描到新视频但未自动加入队列，或任务被用户取消），它不是一个独立的 `TaskState`。
2. 前端可能把整数 `state` 映射成字符串（如 `active/completed`）用于筛选或展示，但以整数枚举为准。

## 下载阶段

`Task.status.stage` 使用 `DownloadStage`（`apps/api/src/models/task.py`），用于表达“正在做哪一步”：

| stage | 说明 |
|---|---|
| preparing | 准备中（获取元数据/链接等） |
| downloading | 下载视频/音频中 |
| moving | 移动/整理文件中 |
| post_processing | 后处理中（封面、字幕、NFO 等） |
| completed | 阶段完成（通常与 `TaskState.COMPLETED` 同步出现） |

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

在现实现里：
1. `QueueType` 表示“任务在哪个队列里”，用于调度/执行排序。
2. `TaskState` 表示“任务当前状态”，用于 UI 展示与控制。
3. 常见对应关系：`QueueType.BACKLOG` ↔ `TaskState.BACKLOG`，`QueueType.DOING` ↔ `TaskState.ACTIVE`，但两者不是强绑定字段，应该分别理解。

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
POST /api/queue/tasks/{task_id}/pause
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

#### 暂停/恢复/取消调度器

```
POST /api/queue/schedulers/{id}/pause
POST /api/queue/schedulers/{id}/resume
POST /api/queue/schedulers/{id}/cancel
```

#### 删除调度器

```
DELETE /api/queue/schedulers/{id}
```

## WebSocket 实时更新

```
ws://localhost:8000/ws/queue
```

### 事件类型

| 事件类型 | 说明 |
|----------|------|
| `taskCreated` | 新任务创建 |
| `taskUpdated` | 任务状态更新（`state`，可能为整数或字符串） |
| `taskProgress` | 任务进度更新（`progress/speed/eta/stage/downloaded/total`） |
| `progress` | 子任务/分片进度（历史兼容字段） |
| `schedulerUpdated` | 调度器状态更新 |
| `schedulerDeleted` | 调度器删除 |
| `queueUpdated` | 队列更新（提示前端做全量刷新） |

### 事件示例

#### taskProgress

```json
{
  "type": "taskProgress",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 45.5,
  "speed": 1024000,
  "eta": 120,
  "stage": "downloading",
  "downloaded": 12345678,
  "total": 34567890
}
```

#### taskUpdated

```json
{
  "type": "taskUpdated",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "2",
  "cancelled": false
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
  const wsUrl = `ws://${window.location.hostname}:8000/ws/queue`
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
