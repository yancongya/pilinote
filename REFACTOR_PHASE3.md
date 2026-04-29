# 阶段3：前端状态管理重构

## 3.1 统一状态管理

### 选择 queue.ts 作为主状态管理
- 保留 `stores/queue.ts` 的完整功能
- 移除 `stores/download.ts` 和 `stores/newQueue.ts`
- 迁移必要的功能到 `queue.ts`

### 重构 queue.ts 结构
```typescript
interface UnifiedQueueStore {
  // 任务管理
  tasks: Map<string, Task>
  schedulers: Map<string, Scheduler>
  
  // 队列状态
  queues: {
    backlog: string[]
    pending: string[]
    doing: string[]
    complete: string[]
  }
  
  // 运行时状态
  isRunning: boolean
  maxConcurrent: number
  
  // WebSocket 连接
  wsConnection: WebSocket | null
  connectionStatus: 'connected' | 'disconnected' | 'connecting'
  
  // 操作方法
  submitTask: (taskData: TaskCreate) => Promise<void>
  controlTask: (taskId: string, action: 'pause' | 'resume' | 'cancel') => Promise<void>
  retryTask: (taskId: string) => Promise<void>
  
  // WebSocket 方法
  connectWebSocket: () => void
  disconnectWebSocket: () => void
  handleWebSocketMessage: (message: any) => void
}
```

## 3.2 WebSocket 集成

### 实时进度更新
```typescript
// WebSocket 消息处理
const handleWebSocketMessage = (message: any) => {
  switch (message.type) {
    case 'task_progress':
      updateTaskProgress(message.data)
      break
    case 'task_completed':
      moveTaskToComplete(message.data.task_id)
      break
    case 'task_failed':
      handleTaskError(message.data)
      break
  }
}
```

### 连接管理
- 自动重连机制
- 连接状态监控
- 错误处理

## 3.3 组件更新

### 更新下载相关组件
- `NewDownload/` 组件适配新的状态管理
- 统一进度显示组件
- 批量操作组件

### 移除旧组件
- 清理与 `download.ts` 相关的组件
- 移除重复的下载列表组件

## 3.4 API 服务整合

### 更新 api.ts
```typescript
// 统一的任务 API
export const taskApi = {
  submit: (taskData: TaskCreate) => post('/api/queue/tasks', taskData),
  list: () => get('/api/queue/tasks'),
  control: (taskId: string, action: string) => post(`/api/queue/tasks/${taskId}/${action}`),
  retry: (taskId: string) => post(`/api/queue/tasks/${taskId}/retry`),
  delete: (taskId: string) => delete(`/api/queue/tasks/${taskId}`)
}

// 调度器 API
export const schedulerApi = {
  create: (data: SchedulerCreate) => post('/api/queue/schedulers', data),
  list: () => get('/api/queue/schedulers'),
  control: (id: string, action: string) => post(`/api/queue/schedulers/${id}/${action}`)
}
```