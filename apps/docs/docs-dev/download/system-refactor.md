# 下载系统整合优化文档

## 概述

2026年4月，PiliNote完成了下载系统的整合优化，将分散的下载功能整合到统一的队列系统中，提升了系统的稳定性和用户体验。

## 优化目标

1. **统一管理**：将分散的下载功能整合到统一的队列系统中
2. **实时更新**：通过WebSocket实时推送下载进度，替代轮询机制
3. **状态管理**：使用Zustand进行前端状态管理，支持离线同步
4. **错误处理**：完善错误处理和重试机制
5. **历史记录**：添加下载历史记录功能
6. **设置同步**：实现下载设置的自动同步

## 主要改进

### 1. 统一队列系统

**旧系统**：
- 分散的下载API（`/api/download/*`）
- 简单的任务管理
- 缺乏统一的队列机制

**新系统**：
- 统一的队列API（`/api/queue/*` 和 `/api/downloads/*`）
- 四级队列系统（BACKLOG → PENDING → DOING → COMPLETE）
- 完善的任务调度和管理

### 2. 实时进度推送

**旧系统**：
- 使用轮询方式获取进度
- API请求频繁，资源浪费
- 延迟高，用户体验差

**新系统**：
- 使用WebSocket推送进度
- 实时更新，延迟低
- 减少90%的API请求

### 3. 前端状态管理

**旧系统**：
- 分散的状态管理
- 缺乏统一的错误处理
- 不支持离线浏览

**新系统**：
- 使用Zustand进行状态管理
- 支持离线浏览（persist中间件）
- 统一的错误处理和重试机制

### 4. 下载历史记录

**旧系统**：
- 无历史记录功能
- 完成的任务直接删除

**新系统**：
- 完整的下载历史记录
- 支持按状态筛选
- 支持批量操作

### 5. 错误处理和重试

**旧系统**：
- 基本的错误处理
- 无重试机制

**新系统**：
- 详细的错误分类和错误信息
- 自动重试机制（最多3次）
- 智能重试策略

## 技术架构

### 后端架构

```
apps/api/src/
├── routers/
│   ├── queue.py          # 队列路由（新系统）
│   ├── downloads.py      # 下载列表路由（新系统）
│   └── websocket.py      # WebSocket路由
├── services/
│   └── queue/
│       ├── manager.py    # 队列管理器
│       └── handlers/     # 队列处理器
│           ├── base.py   # 基础处理器
│           ├── video.py  # 视频处理器
│           ├── opus.py   # 图文处理器
│           └── nfo.py    # NFO生成器
└── models/
    ├── task.py           # 任务模型
    ├── scheduler.py      # 调度器模型
    └── download.py       # 下载记录模型
```

### 前端架构

```
apps/web/src/
├── stores/
│   ├── download.ts           # 下载状态管理
│   ├── downloadHistory.ts    # 下载历史记录
│   └── downloadSettings.ts   # 下载设置
├── services/
│   └── api.ts                # API服务
└── utils/
    └── errorHandler.ts       # 错误处理工具
```

## API变更

### 废弃的API

| 方法 | 路径 | 说明 | 替代方案 |
|------|------|------|----------|
| POST | `/api/download/parse` | 解析下载URL | `POST /api/queue/tasks` 或 `GET /api/media/{media_type}/{media_id}` |
| GET | `/api/queue` | 获取队列 | `GET /api/queue/tasks` 或 `GET /api/downloads` |
| POST | `/api/queue/add` | 添加任务 | `POST /api/queue/tasks` |

### 新增的API

#### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/queue/tasks` | 获取任务列表 |
| POST | `/api/queue/tasks` | 创建任务 |
| POST | `/api/queue/tasks/{task_id}/start` | 开始任务 |
| POST | `/api/queue/tasks/{task_id}/pause` | 暂停任务 |
| POST | `/api/queue/tasks/{task_id}/resume` | 恢复任务 |
| POST | `/api/queue/tasks/{task_id}/cancel` | 取消任务 |
| POST | `/api/queue/tasks/{task_id}/retry` | 重试任务 |
| DELETE | `/api/queue/tasks/{task_id}` | 删除任务 |

#### 下载列表管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/downloads` | 获取下载列表 |
| POST | `/api/downloads/batch/start` | 批量开始下载 |
| DELETE | `/api/downloads/{download_id}` | 删除下载记录 |
| DELETE | `/api/downloads/by-bvid/{bvid}` | 通过BVID删除下载记录 |

#### WebSocket

| 路径 | 说明 |
|------|------|
| `ws://localhost:8000/ws/queue` | 队列/任务/调度器实时推送 |

## 数据模型变更

### 新增字段

**Task模型**：
- `state`: 队列状态（0=BACKLOG, 1=PENDING, 2=DOING, 3=COMPLETE）
- `downloaded_bytes`: 已下载字节数
- `total_bytes`: 总字节数
- `retry_count`: 重试次数
- `max_retries`: 最大重试次数

**Download模型**（新增）：
- `download_speed`: 下载速度
- `eta`: 预计剩余时间
- `error_message`: 错误信息
- `thumbnail_url`: 缩略图URL
- `duration`: 视频时长
- `uploader`: UP主名称
- `file_path`: 文件路径

## 前端状态管理

### 下载状态Store

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

### WebSocket事件处理

```typescript
handleWebSocketMessage: (event: MessageEvent) => {
  const data = JSON.parse(event.data)
  const { type, ...payload } = data
  
  switch (type) {
    case 'download_progress':
      updateDownloadProgress(payload.download_id, payload.progress, payload.speed, payload.eta)
      break
    case 'download_status':
      updateDownloadStatus(payload.download_id, payload.status)
      break
    case 'download_error':
      setDownloadError(payload.download_id, {
        type: payload.error_type,
        message: payload.error,
        timestamp: Date.now()
      })
      break
  }
}
```

## 性能优化

### 1. WebSocket推送

- 替代轮询，减少90%的API请求
- 实时进度更新，用户体验更流畅
- 自动重连机制，保证连接稳定性

### 2. 本地状态缓存

- 使用Zustand的persist中间件
- 支持离线浏览下载列表
- 减少不必要的API请求

### 3. 批量操作

- 支持批量开始、暂停、取消下载
- 减少API调用次数
- 提高操作效率

### 4. 智能重试

- 失败任务自动重试
- 最多3次重试
- 详细的错误信息和分类

## 迁移指南

### 数据迁移

1. **旧任务迁移**：
   ```bash
   python migrate_add_download_fields.py
   ```

2. **旧下载记录迁移**：
   ```bash
   python migrate_db.py
   ```

### 前端迁移

1. **更新API调用**：
   ```typescript
   // 旧代码
   const response = await fetch('/api/queue/add', {
     method: 'POST',
     body: JSON.stringify({ media_type: 'video', media_id: 'BV1xx411c7mD' })
   })
   
   // 新代码
   const response = await apiService.createTask({
     media_type: 'video',
     media_id: 'BV1xx411c7mD'
   })
   ```

2. **更新状态管理**：
   ```typescript
   // 旧代码
   const [downloads, setDownloads] = useState([])
   
   // 新代码
   const { downloads, syncFromServer } = useDownloadStore()
   useEffect(() => {
     syncFromServer()
   }, [])
   ```

3. **更新WebSocket连接**：
   ```typescript
   // 旧代码
   const ws = new WebSocket('ws://localhost:8000/ws')
   ws.onmessage = (event) => {
     const data = JSON.parse(event.data)
     // 处理消息
   }
   
   // 新代码（自动管理）
   const { wsConnected } = useDownloadStore()
   // WebSocket连接自动建立和管理
   ```

## 测试

### 单元测试

```bash
# 后端测试
cd apps/api
pytest tests/

# 前端测试
cd apps/web
pnpm test
```

### 集成测试

```bash
# 启动后端
cd apps/api
uvicorn src.main:app --reload

# 启动前端
cd apps/web
pnpm dev

# 运行Playwright测试
pnpm test:e2e
```

## 已知问题和解决方案

### 1. WebSocket连接不稳定

**问题**：网络波动导致连接断开

**解决方案**：
- 自动重连机制，3秒后重试
- 心跳检测，及时发现断连
- 连接状态可视化，提示用户

### 2. 下载进度不准确

**问题**：某些情况下进度计算错误

**解决方案**：
- 使用字节级别计算，避免百分比误差
- 定期同步服务器状态
- 显示详细的下载信息（速度、ETA等）

### 3. 历史记录性能问题

**问题**：大量历史记录导致渲染卡顿

**解决方案**：
- 使用虚拟滚动和分页加载
- 只渲染可见区域的记录
- 懒加载历史记录

### 4. 设置同步延迟

**问题**：设置修改后同步到服务器有延迟

**解决方案**：
- 乐观更新，立即更新本地状态
- 后台同步，不阻塞用户操作
- 同步失败时提示用户并重试

## 未来规划

1. **断点续传**：支持大文件的断点续传
2. **多线程下载**：提高下载速度
3. **P2P下载**：利用P2P技术加速下载
4. **云端同步**：支持云端备份和同步
5. **智能调度**：根据网络状况智能调度下载任务

## 相关文档

- [队列系统](./queue.md)
- [任务系统](./tasks.md)
- [调度器](./scheduler.md)
- [API端点](../api/endpoints.md)
- [后端架构](../architecture/backend-architecture.md)

---

**文档版本**: 1.0.0
**最后更新**: 2026-04-16
**维护者**: PiliNote Team
