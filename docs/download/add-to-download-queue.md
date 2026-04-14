# "添加到下载列表"功能链文档

## 1. 功能概述

"添加到下载列表"是 PiliNote 项目的核心功能之一，允许用户将感兴趣的视频内容从收藏夹、稍后再看等页面添加到下载队列中，实现自动化的视频下载管理。

### 核心价值
- **便捷管理**：用户可以快速将多个视频添加到下载列表，无需手动逐个下载
- **智能调度**：系统自动管理下载队列，支持并发下载和资源优化
- **类型支持**：支持单视频、多P系列视频、图文等多种媒体类型
- **状态同步**：通过 WebSocket 实时同步下载状态，用户体验流畅
- **自动化**：支持定时扫描和手动扫描，自动发现新内容

### 主要使用场景
1. **收藏夹下载**：用户浏览收藏夹时，选择喜欢的视频批量下载
2. **稍后再看下载**：将稍后再看列表中的视频快速添加到下载队列
3. **多P视频管理**：自动识别系列视频，创建调度器统一管理分P下载
4. **定时扫描**：设置自动扫描规则，定期检查收藏夹并自动下载新内容
5. **手动扫描**：在下载页手动触发扫描，批量添加符合条件的视频

## 2. 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (React + TypeScript)                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │FavoritesContent│  │WatchLaterContent│ │DownloadPage        │  │
│  │收藏页组件    │  │稍后再看页组件  │ │下载页组件          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              useVideoDownload Hook                        │  │
│  │  - toggleDownload() 下载切换逻辑                          │  │
│  │  - 多P视频检测与调度器创建                                │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              apiService (API 服务层)                      │  │
│  │  - submitTask() 提交任务                                  │  │
│  │  - createScheduler() 创建调度器                           │  │
│  │  - getVideoDetail() 获取视频详情                          │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              newQueueStore (Zustand 状态管理)             │  │
│  │  - tasks 任务列表                                        │  │
│  │  - schedulers 调度器列表                                  │  │
│  │  - WebSocket 实时通信                                    │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                     后端层 (FastAPI + Python)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Router Layer (API 路由)                      │  │
│  │  /api/queue/tasks - 任务管理 API                          │  │
│  │  /api/queue/schedulers - 调度器管理 API                    │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Service Layer (业务逻辑)                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │QueueManager  │  │SchedulerSvc  │  │TaskService   │    │  │
│  │  │队列管理器    │  │调度器服务    │  │任务服务      │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Queue System (队列系统)                       │  │
│  │  ┌────────┐  ┌────────┐  ┌───────┐  ┌──────────┐         │  │
│  │  │backlog │  │pending │  │doing  │  │complete  │         │  │
│  │  │待办队列│  │待处理  │  │执行中 │  │完成队列  │         │  │
│  │  └────────┘  └────────┘  └───────┘  └──────────┘         │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Data Layer (数据持久化)                       │  │
│  │  - SQLite 数据库                                         │  │
│  │  - Task 任务表                                           │  │
│  │  - Scheduler 调度器表                                    │  │
│  │  - Queue 队列表                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流图

```
用户点击下载按钮
       │
       ▼
前端验证（防止重复点击）
       │
       ▼
检查当前下载状态
       │
       ├─ 已在队列中 → 取消下载
       │      │
       │      ▼
       │  调用 DELETE /api/queue/tasks/{id}
       │      │
       │      ▼
       │  更新任务状态为 cancelled
       │      │
       │      ▼
       │  WebSocket 广播状态更新
       │
       ├─ 已下载完成 → 提示无法操作
       │
       └─ 未下载 → 添加到队列
              │
              ▼
         获取视频详情
              │
              ├─ 单P视频
              │      │
              │      ▼
              │  创建单个任务
              │      │
              │      ▼
              │  POST /api/queue/tasks
              │
              └─ 多P视频
                     │
                     ▼
                为每个分P创建任务
                     │
                     ▼
                创建调度器
                     │
                     ▼
                POST /api/queue/schedulers
                     │
                     ▼
                关联任务到调度器
                     │
                     ▼
                任务提交到 backlog 队列
```

## 3. 用户交互流程

### 3.1 收藏页下载流程

**入口**：收藏页 (`/favorites`)

**操作步骤**：
1. 用户登录后进入收藏页，系统自动加载收藏夹列表
2. 用户选择一个收藏夹，查看其中的视频列表
3. 用户点击视频卡片上的下载按钮
4. 系统检查该视频的下载状态：
   - 如果已在队列中：显示"取消下载"按钮
   - 如果已下载完成：显示"已下载"状态，不可操作
   - 如果未下载：显示"添加到下载"按钮
5. 用户点击下载按钮：
   - 单P视频：直接添加到下载队列
   - 多P视频：创建调度器，将所有分P添加到队列
6. 系统显示操作结果（成功/失败提示）
7. 下载按钮状态自动更新

**关键代码**：
```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/FavoritesContent.tsx

const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
  const result = await baseToggleDownload(video, e)
  if (result.success) {
    setAlertModal({
      show: true,
      title: '操作成功',
      message: result.message,
      type: 'success'
    })
  } else {
    setAlertModal({
      show: true,
      title: '操作失败',
      message: result.message,
      type: 'error'
    })
  }
}, [baseToggleDownload, navigate])
```

### 3.2 稍后再看页下载流程

**入口**：稍后再看页 (`/watchlater`)

**操作步骤**：
1. 用户登录后进入稍后再看页，系统自动加载稍后再看列表
2. 用户浏览视频列表，每个视频卡片显示下载按钮
3. 用户点击下载按钮，流程与收藏页相同
4. 支持批量操作：使用 VideoListControls 进行搜索和排序

**关键代码**：
```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/WatchLaterContent.tsx

const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
  const tasks = newQueueStore.tasks
  const newSystemTasks = Object.values(tasks)
  
  const hasActiveTask = newSystemTasks.some(task =>
    task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
  )
  
  if (hasActiveTask) return 'in_list'
  
  const hasCompletedTask = newSystemTasks.some(task =>
    task.media_id === bvid && task.state === 'completed'
  )
  
  if (hasCompletedTask) return 'downloaded'
  
  return 'none'
}
```

### 3.3 下载页操作流程

**入口**：下载页 (`/downloads`)

**操作步骤**：
1. 用户进入下载页，查看当前下载任务
2. 用户可以执行以下操作：
   - 开始任务：将任务状态改为 `active`，立即开始下载
   - 暂停任务：将任务状态改为 `paused`
   - 取消任务：将任务状态改为 `cancelled`
   - 删除任务：删除任务及本地文件
   - 批量操作：选择多个任务进行批量删除或批量开始
3. 用户可以查看实时下载进度、速度、剩余时间等信息
4. 任务完成后自动移动到"视频库"标签页

## 4. 技术实现

### 4.1 前端组件和状态管理

#### 4.1.1 核心组件

**FavoritesContent.tsx** (`/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/FavoritesContent.tsx`)
- 功能：收藏页主组件，展示收藏夹和视频列表
- 状态管理：
  - `selectedFolder`：当前选中的收藏夹
  - `folders`：收藏夹列表
  - `videos`：视频列表
  - `loading`：加载状态
  - `alertModal`：提示弹窗状态
- 关键功能：
  - 收藏夹选择和返回
  - 视频列表展示和分页加载
  - 下载按钮状态管理和操作
  - 搜索和排序功能

**WatchLaterContent.tsx** (`/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/WatchLaterContent.tsx`)
- 功能：稍后再看页主组件，展示稍后再看视频列表
- 状态管理：与 FavoritesContent 类似
- 关键功能：
  - 稍后再看列表展示
  - 视频观看进度显示
  - 下载操作和状态管理

#### 4.1.2 自定义 Hooks

**useVideoDownload Hook** (`/Users/tanyancong/工作/开发/pilinote/apps/web/src/hooks/useVideoDownload.ts`)
- 功能：处理单个视频的下载切换逻辑
- 核心方法：
  - `toggleDownload(video, event)`：切换视频下载状态

**关键实现逻辑**：
```typescript
const toggleDownload = useCallback(async (video: VideoInfo, e: React.MouseEvent) => {
  e.stopPropagation()
  
  // 防止重复点击
  const button = e.currentTarget as HTMLButtonElement
  if (button.disabled) return {success: false, message: '操作进行中'}
  button.disabled = true

  try {
    const sessdata = localStorage.getItem('sessdata')
    const currentTasks = newQueueStore.tasks
    const existingTask = Object.values(currentTasks).find(t => t.media_id === video.bvid)
    
    // 检查是否已在新系统中
    const isInNewQueue = existingTask && !['completed', 'cancelled'].includes(existingTask.state)
    const isDownloaded = existingTask && existingTask.state === 'completed'

    if (isInNewQueue) {
      // 从下载列表移除
      const allTasks = Object.values(currentTasks).filter(t => 
        t.media_id === video.bvid && 
        !['completed', 'cancelled'].includes(t.state)
      )
      
      for (const task of allTasks) {
        await newQueueStore.controlTask(task.id, 'cancelled')
      }
      await newQueueStore.fetchTasks()
      
      const message = allTasks.length > 1 
        ? `已从下载列表移除 ${allTasks.length} 个视频` 
        : '已从下载列表移除'
      return {success: true, message}
    } else if (isDownloaded) {
      return {success: false, message: '视频已下载完成，请到视频库查看'}
    } else {
      // 添加到下载系统
      const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)

      if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
        const pages = videoDetailResponse.data.pages
        
        if (pages.length > 1) {
          // 多P视频：创建调度器统一管理
          const taskIds: string[] = []
          
          // 为每个分P创建任务
          for (const page of pages) {
            const taskData = {
              title: page.part || `${video.title} - P${page.page}`,
              media_type: 'video',
              media_id: video.bvid,
              cover: video.pic || video.cover || '',
              desc: `CID: ${page.cid}`,
              meta: {
                cid: page.cid,
                page: page.page,
                part_title: page.part
              }
            }

            const response = await apiService.submitTask(taskData)
            if (response.success && response.data) {
              taskIds.push(response.data.id)
            }
          }

          // 创建调度器
          const folderName = `系列-${video.title.replace(/[\/\\:*?"<>|]/g, '_')}`
          const { useSettingsStore } = await import('../stores/settings')
          const settingsStore = useSettingsStore.getState()
          
          if (!settingsStore.settings) {
            await settingsStore.fetchSettings()
          }
          
          const downloadPath = settingsStore.settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads'
          const folderPath = `${downloadPath}/${folderName}`

          const schedulerResponse = await apiService.createScheduler({
            title: video.title,
            task_ids: taskIds,
            folder: folderPath
          })

          await newQueueStore.fetchTasks()
          return {success: true, message: `已添加 ${taskIds.length} 个视频到下载列表`}
        } else {
          // 单P视频
          const taskData = {
            title: video.title,
            media_type: 'video',
            media_id: video.bvid,
            cover: video.pic || video.cover || '',
            desc: `CID: ${videoDetailData.cid || pages[0]?.cid}`,
            meta: {
              cid: videoDetailData.cid || pages[0]?.cid
            }
          }

          const response = await apiService.submitTask(taskData)
          if (response.success) {
            await newQueueStore.fetchTasks()
            return {success: true, message: '已添加到下载队列'}
          }
        }
      }
    }
  } finally {
    button.disabled = false
  }
}, [newQueueStore])
```

#### 4.1.3 状态管理

**newQueueStore** (`/Users/tanyancong/工作/开发/pilinote/apps/web/src/stores/newQueue.ts`)
- 基于 Zustand + persist 中间件
- 核心状态：
  - `tasks`：任务字典（`Record<string, Task>`）
  - `schedulers`：调度器字典（`Record<string, Scheduler>`）
  - `activeTab`：当前活动标签页（'downloads' | 'library' | 'scan'）
  - `filterStatus`：任务状态过滤器
  - `ws`：WebSocket 连接
  - `connected`：WebSocket 连接状态

**核心方法**：
```typescript
// 获取任务列表
fetchTasks: async () => {
  const response = await fetch(getApiUrl('/api/queue/tasks'))
  if (response.ok) {
    const result = await response.json()
    const taskList = result.data || []
    const tasks: Record<string, Task> = {}
    taskList.forEach((task: any) => {
      tasks[task.id] = task
    })
    set({ tasks })
  }
}

// 提交任务
submitTask: async (task) => {
  const response = await fetch(getApiUrl('/api/queue/tasks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  if (!response.ok) throw new Error('Submit failed')
  await get().fetchTasks()
}

// 控制任务
controlTask: async (taskId, action) => {
  if (action === 'cancelled') {
    const response = await fetch(getApiUrl(`/api/queue/tasks/${taskId}`), {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Delete failed')
  } else {
    const stateMap: Record<string, number> = {
      'backlog': 0, 'pending': 1, 'active': 2,
      'completed': 3, 'paused': 4, 'failed': 5, 'cancelled': 6
    }
    const response = await fetch(getApiUrl(`/api/queue/tasks/${taskId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: stateMap[action] }),
    })
    if (!response.ok) throw new Error('Control failed')
  }
  await get().fetchTasks()
}
```

### 4.2 API 端点和数据模型

#### 4.2.1 任务管理 API

**提交任务**
```
POST /api/queue/tasks
Content-Type: application/json

Request Body:
{
  "title": "视频标题",
  "media_type": "video",
  "media_id": "BV1xx411c7mD",
  "cover": "https://...",
  "desc": "CID: 123456",
  "meta": {
    "cid": 123456,
    "page": 1,
    "part_title": "第一集"
  }
}

Response:
{
  "success": true,
  "message": "任务提交成功",
  "data": {
    "id": "task-uuid",
    "title": "视频标题",
    "state": "backlog",
    ...
  }
}
```

**更新任务状态**
```
PUT /api/queue/tasks/{task_id}
Content-Type: application/json

Request Body:
{
  "state": 2  // 0=backlog, 1=pending, 2=active, 3=completed, 4=paused, 5=failed, 6=cancelled
}

Response:
{
  "success": true,
  "message": "任务更新成功",
  "data": {...}
}
```

**删除任务**
```
DELETE /api/queue/tasks/{task_id}

Response:
{
  "success": true,
  "message": "任务和本地文件删除成功"
}
```

**获取所有任务**
```
GET /api/queue/tasks

Response:
{
  "success": true,
  "data": [
    {
      "id": "task-uuid",
      "title": "视频标题",
      "media_type": "video",
      "media_id": "BV1xx411c7mD",
      "state": "active",
      "status": {
        "progress": 45.5,
        "speed": 1024000,
        "eta": 120,
        "stage": "downloading"
      },
      ...
    }
  ]
}
```

#### 4.2.2 调度器管理 API

**创建调度器**
```
POST /api/queue/schedulers
Content-Type: application/json

Request Body:
{
  "title": "系列视频标题",
  "task_ids": ["task-uuid-1", "task-uuid-2", "task-uuid-3"],
  "folder": "/path/to/download/folder"
}

Response:
{
  "success": true,
  "message": "调度器创建成功",
  "data": {
    "id": "scheduler-uuid",
    "title": "系列视频标题",
    "list": ["task-uuid-1", "task-uuid-2", "task-uuid-3"],
    "count": 3,
    "state": "idle",
    "folder": "/path/to/download/folder"
  }
}
```

**启动调度器**
```
POST /api/queue/schedulers/{scheduler_id}/start

Response:
{
  "success": true,
  "message": "调度器启动成功"
}
```

**获取所有调度器**
```
GET /api/queue/schedulers

Response:
{
  "success": true,
  "data": [
    {
      "id": "scheduler-uuid",
      "title": "系列视频标题",
      "list": ["task-uuid-1", "task-uuid-2"],
      "count": 2,
      "state": "running",
      "folder": "/path/to/download/folder"
    }
  ]
}
```

#### 4.2.3 数据模型

**Task 模型** (`/Users/tanyancong/工作/开发/pilinote/apps/api/src/models/task.py`)
```python
class Task(Base):
    __tablename__ = 'tasks'
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    cover = Column(String)
    desc = Column(String)
    duration = Column(Integer, default=0)
    pubtime = Column(Integer, default=0)
    media_type = Column(String, nullable=False)
    url = Column(String)
    media_id = Column(String, nullable=False)
    scheduler_id = Column(String, ForeignKey('schedulers.id'))
    state = Column(Integer, default=0)  # TaskState enum
    status = Column(JSON, default=lambda: {})
    meta = Column(JSON, default=lambda: {})
    prepare = Column(JSON, default=lambda: {})
    created_at = Column(Integer, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, default=lambda: int(datetime.now().timestamp()))
```

**TaskState 枚举**
```python
class TaskState(int, enum.Enum):
    BACKLOG = 0      # 待办
    PENDING = 1      # 待处理
    ACTIVE = 2       # 执行中
    COMPLETED = 3    # 已完成
    PAUSED = 4       # 已暂停
    FAILED = 5       # 失败
    CANCELLED = 6    # 已取消
```

**Scheduler 模型**
```python
class Scheduler(Base):
    __tablename__ = 'schedulers'
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    ts = Column(Integer, default=0)
    list = Column(JSON, default=lambda: [])  # 任务ID列表
    count = Column(Integer, default=0)
    queue_type = Column(String, default='fifo')
    state = Column(Integer, default=0)  # SchedulerState enum
    folder = Column(String)
    created_at = Column(Integer, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, default=lambda: int(datetime.now().timestamp()))
```

### 4.3 服务层逻辑

#### 4.3.1 QueueManager

**文件位置**：`/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/manager.py`

**核心功能**：
- 管理多队列系统（backlog、pending、doing、complete）
- 任务提交和调度
- 队列持久化和恢复

**关键方法**：
```python
class QueueManager:
    def __init__(self):
        self.queues = {
            QueueType.BACKLOG: asyncio.Queue(),
            QueueType.PENDING: asyncio.Queue(),
            QueueType.DOING: asyncio.Queue(),
            QueueType.COMPLETE: asyncio.Queue()
        }
        self.tasks: Dict[str, Task] = {}
        self.schedulers: Dict[str, Scheduler] = {}
    
    async def submit_backlog(self, task_create: TaskCreate) -> Task:
        """提交任务到 backlog 队列"""
        # 创建任务对象
        task = Task(
            id=str(uuid.uuid4()),
            title=task_create.title,
            media_type=task_create.media_type,
            media_id=task_create.media_id,
            cover=task_create.cover,
            desc=task_create.desc,
            meta=task_create.meta or {},
            state=TaskState.BACKLOG,
            status={'stage': 'pending', 'progress': 0, 'total': 0, 'speed': 0, 'eta': 0}
        )
        
        # 保存到数据库
        db = SessionLocal()
        try:
            db.add(task)
            db.commit()
            db.refresh(task)
        finally:
            db.close()
        
        # 添加到内存队列
        self.tasks[task.id] = task
        await self.queues[QueueType.BACKLOG].put(task.id)
        
        # 持久化队列
        await self._save_queue_to_db(QueueType.BACKLOG)
        
        # 广播 WebSocket 事件
        from src.routers.websocket import broadcast_task_created
        broadcast_task_created(task)
        
        return task
    
    async def plan_scheduler(self, scheduler_create: SchedulerCreate) -> Scheduler:
        """创建调度器"""
        # 验证任务ID
        valid_task_ids = []
        for task_id in scheduler_create.task_ids:
            if task_id in self.tasks:
                valid_task_ids.append(task_id)
        
        if not valid_task_ids:
            raise ValueError("没有有效的任务ID")
        
        # 创建调度器
        scheduler = Scheduler(
            id=str(uuid.uuid4()),
            title=scheduler_create.title,
            list=valid_task_ids,
            count=len(valid_task_ids),
            queue_type=scheduler_create.queue_type or 'fifo',
            state=SchedulerState.IDLE,
            folder=scheduler_create.folder
        )
        
        # 保存到数据库
        db = SessionLocal()
        try:
            db.add(scheduler)
            db.commit()
            db.refresh(scheduler)
            
            # 更新任务的 scheduler_id
            for task_id in valid_task_ids:
                task = db.query(Task).filter(Task.id == task_id).first()
                if task:
                    task.scheduler_id = scheduler.id
            
            db.commit()
        finally:
            db.close()
        
        # 更新内存
        self.schedulers[scheduler.id] = scheduler
        for task_id in valid_task_ids:
            if task_id in self.tasks:
                self.tasks[task_id].scheduler_id = scheduler.id
        
        # 广播 WebSocket 事件
        from src.routers.websocket import broadcast_scheduler_created
        broadcast_scheduler_created(scheduler)
        
        return scheduler
```

#### 4.3.2 TaskService

**文件位置**：`/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/task.py`

**核心功能**：
- 任务准备（获取视频信息、创建子任务）
- 任务执行（下载视频、转换格式、移动文件）
- 任务状态管理

**关键方法**：
```python
class TaskService:
    def __init__(self, task: Task):
        self.task = task
        self.subtasks: List[SubTask] = []
    
    async def prepare(self):
        """准备任务：获取视频信息，创建子任务"""
        # 根据媒体类型获取详细信息
        if self.task.media_type == 'video':
            await self._prepare_video()
        elif self.task.media_type == 'article':
            await self._prepare_article()
        
        # 更新任务状态
        self.task.state = TaskState.PENDING
        self.task.prepare['subtasks'] = [st.id for st in self.subtasks]
        
        # 持久化
        db = SessionLocal()
        try:
            db.merge(self.task)
            db.commit()
        finally:
            db.close()
    
    async def execute(self, temp_dir: Path, output_dir: Path):
        """执行任务：下载并处理"""
        # 更新状态为执行中
        self.task.state = TaskState.ACTIVE
        self.task.status['stage'] = 'downloading'
        
        # 执行子任务
        for subtask in self.subtasks:
            await self._execute_subtask(subtask, temp_dir, output_dir)
        
        # 移动文件到最终位置
        await self._move_files(temp_dir, output_dir)
        
        # 更新状态为完成
        self.task.state = TaskState.COMPLETED
        self.task.status['stage'] = 'completed'
        self.task.status['progress'] = 100
```

#### 4.3.3 SchedulerService

**文件位置**：`/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/scheduler.py`

**核心功能**：
- 调度器初始化
- 任务准备和分发
- 调度器状态控制

**关键方法**：
```python
class SchedulerService:
    def __init__(self, scheduler: Scheduler):
        self.scheduler = scheduler
        self.queue_manager = queue_manager
    
    async def initialize(self):
        """初始化调度器"""
        self.scheduler.state = SchedulerState.RUNNING
        
        # 持久化
        db = SessionLocal()
        try:
            db.merge(self.scheduler)
            db.commit()
        finally:
            db.close()
        
        # 广播 WebSocket 事件
        from src.routers.websocket import broadcast_scheduler_updated
        broadcast_scheduler_updated(self.scheduler)
    
    async def prepare(self):
        """准备所有任务"""
        for task_id in self.scheduler.list:
            task = await self.queue_manager.get_task(task_id)
            if task:
                task_service = TaskService(task)
                await task_service.prepare()
    
    async def dispatch(self):
        """分发任务到执行队列"""
        for task_id in self.scheduler.list:
            task = await self.queue_manager.get_task(task_id)
            if task and task.state == TaskState.PENDING:
                # 移动到执行队列
                await self.queue_manager.move_task(task_id, QueueType.PENDING, QueueType.DOING)
                
                # 执行任务
                asyncio.create_task(self._execute_task(task_id))
    
    async def _execute_task(self, task_id: str):
        """执行单个任务"""
        task = await self.queue_manager.get_task(task_id)
        if not task:
            return
        
        task_service = TaskService(task)
        
        # 获取路径
        from src.services.settings_service import SettingsService
        db = SessionLocal()
        try:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            temp_path = settings.storage.temp_path
            download_path = settings.storage.download_path
        finally:
            db.close()
        
        # 创建目录
        temp_dir = Path(temp_path) / task_id
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        output_dir = Path(self.scheduler.folder) / task.title
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 执行
        try:
            await task_service.execute(temp_dir, output_dir)
        except Exception as e:
            logger.error(f"任务执行失败: {e}")
            task.state = TaskState.FAILED
            task.status['error'] = str(e)
```

### 4.4 队列管理机制

#### 4.4.1 多队列架构

```
┌─────────────────────────────────────────────────────────┐
│                   Queue System                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   BACKLOG   │───▶│   PENDING   │───▶│    DOING    │ │
│  │   (待办)    │    │   (待处理)  │    │   (执行中)  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│        │                   │                   │        │
│        │                   │                   │        │
│        ▼                   ▼                   ▼        │
│  用户提交任务        调度器准备        任务执行中        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              COMPLETE                             │  │
│  │              (完成队列)                           │  │
│  └──────────────────────────────────────────────────┘  │
│                          ▲                             │
│                          │                             │
│                    任务完成                            │
└─────────────────────────────────────────────────────────┘
```

#### 4.4.2 队列状态流转

```
任务创建
    │
    ▼
BACKLOG (待办)
    │
    │ 调度器准备
    ▼
PENDING (待处理)
    │
    │ 开始执行
    ▼
ACTIVE (执行中)
    │
    ├─▶ COMPLETED (完成)
    │
    ├─▶ PAUSED (暂停) ──▶ ACTIVE (恢复)
    │
    ├─▶ FAILED (失败) ──▶ BACKLOG (重试)
    │
    └─▶ CANCELLED (取消)
```

#### 4.4.3 队列持久化

队列数据同时存储在内存和数据库中：

**内存存储**：
- 使用 `asyncio.Queue` 实现异步队列
- 快速访问和操作

**数据库存储**：
```python
class Queue(Base):
    __tablename__ = 'queues'
    
    queue_type = Column(Integer, primary_key=True)  # QueueType enum
    value = Column(JSON, default=lambda: [])  # 任务ID列表
    updated_at = Column(Integer, default=lambda: int(datetime.now().timestamp()))
```

**同步机制**：
- 每次队列操作后自动持久化到数据库
- 系统启动时从数据库恢复队列状态
- WebSocket 实时同步前端状态

## 5. 媒体类型处理

### 5.1 单个视频处理

**流程**：
1. 用户点击下载按钮
2. 调用 `getVideoDetail` API 获取视频详情
3. 检查 `pages` 数组长度
4. 如果 `pages.length === 1`，创建单个任务
5. 提交任务到 backlog 队列

**关键代码**：
```typescript
// 单P视频处理
if (pages.length === 1) {
  const taskData = {
    title: video.title,
    media_type: 'video',
    media_id: video.bvid,
    cover: video.pic || video.cover || '',
    desc: `CID: ${videoDetailData.cid || pages[0]?.cid}`,
    meta: {
      cid: videoDetailData.cid || pages[0]?.cid
    }
  }

  const response = await apiService.submitTask(taskData)
  if (response.success) {
    await newQueueStore.fetchTasks()
    return {success: true, message: '已添加到下载队列'}
  }
}
```

**文件结构**：
```
downloads/
└── 视频标题/
    ├── video.mp4
    ├── cover.jpg
    ├── avatar.jpg
    ├── danmaku.xml
    └── video.nfo
```

### 5.2 系列视频（多P）处理

**流程**：
1. 用户点击下载按钮
2. 调用 `getVideoDetail` API 获取视频详情
3. 检查 `pages` 数组长度
4. 如果 `pages.length > 1`，按以下步骤处理：
   - 为每个分P创建独立任务
   - 收集所有任务ID
   - 创建调度器关联所有任务
   - 设置统一的输出文件夹
5. 提交所有任务到 backlog 队列

**关键代码**：
```typescript
// 多P视频处理
if (pages.length > 1) {
  const taskIds: string[] = []
  
  // 步骤1：为每个分P创建任务
  for (const page of pages) {
    const taskData = {
      title: page.part || `${video.title} - P${page.page}`,
      media_type: 'video',
      media_id: video.bvid,
      cover: video.pic || video.cover || '',
      desc: `CID: ${page.cid}`,
      meta: {
        cid: page.cid,
        page: page.page,
        part_title: page.part
      }
    }

    const response = await apiService.submitTask(taskData)
    if (response.success && response.data) {
      taskIds.push(response.data.id)
    }
  }

  // 步骤2：创建调度器
  const folderName = `系列-${video.title.replace(/[\/\\:*?"<>|]/g, '_')}`
  const downloadPath = settingsStore.settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads'
  const folderPath = `${downloadPath}/${folderName}`

  const schedulerResponse = await apiService.createScheduler({
    title: video.title,
    task_ids: taskIds,
    folder: folderPath
  })

  await newQueueStore.fetchTasks()
  return {success: true, message: `已添加 ${taskIds.length} 个视频到下载列表`}
}
```

**文件结构**：
```
downloads/
└── 系列-视频标题/
    ├── P1-第一集/
    │   ├── video.mp4
    │   ├── cover.jpg
    │   └── ...
    ├── P2-第二集/
    │   ├── video.mp4
    │   ├── cover.jpg
    │   └── ...
    └── P3-第三集/
        ├── video.mp4
        ├── cover.jpg
        └── ...
```

### 5.3 图文处理

**流程**：
1. 识别媒体类型为 `article`
2. 获取图文内容（图片、文本）
3. 创建任务时设置 `media_type: 'article'`
4. TaskService 根据类型选择不同的处理逻辑

**关键代码**：
```python
# TaskService.prepare()
async def _prepare_article(self):
    """准备图文任务"""
    # 获取图文内容
    content = await self._fetch_article_content()
    
    # 创建子任务：下载图片
    for idx, image_url in enumerate(content['images']):
        subtask = SubTask(
            id=f"image-{idx}",
            type="download_image"
        )
        self.subtasks.append(subtask)
    
    # 创建子任务：保存文本
    text_subtask = SubTask(
        id="text",
        type="save_text"
    )
    self.subtasks.append(text_subtask)
```

**文件结构**：
```
downloads/
└── 图文标题/
    ├── images/
    │   ├── 1.jpg
    │   ├── 2.jpg
    │   └── ...
    ├── content.md
    └── cover.jpg
```

### 5.4 媒体类型对比

| 媒体类型 | media_type | 处理方式 | 文件结构 | 调度器 |
|---------|-----------|---------|---------|--------|
| 单个视频 | video | 直接下载视频流 | 单层文件夹 | 不需要 |
| 系列视频 | video | 分P下载，统一管理 | 多层文件夹 | 需要 |
| 图文 | article | 下载图片+保存文本 | 单层文件夹+images子目录 | 不需要 |

## 6. 自动化功能

### 6.1 定时扫描

**功能**：根据用户配置的规则，定期扫描收藏夹并自动下载新内容。

**实现机制**：
1. 用户在设置页面配置扫描规则：
   - 扫描间隔（小时）
   - 目标收藏夹
   - 下载条件（播放量、点赞数等）
2. 后端 `SchedulerService` 创建定时任务
3. 定时触发 `ScanService` 执行扫描
4. 扫描结果通过 WebSocket 通知用户

**关键代码**：
```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/services/scheduler_service.py

class SchedulerService:
    async def setup_auto_scan(self, settings: dict):
        """设置自动扫描"""
        scan_interval = settings.get('scan_interval', 24)  # 默认24小时
        
        # 创建定时任务
        self.scan_scheduler = await self.create_periodic_task(
            interval=scan_interval * 3600,  # 转换为秒
            callback=self._execute_auto_scan
        )
    
    async def _execute_auto_scan(self):
        """执行自动扫描"""
        from src.services.scan_service import ScanService
        
        scan_service = ScanService()
        results = await scan_service.scan_all()
        
        # 通知用户
        for result in results:
            if result['new_videos']:
                # 发送通知
                await self._notify_user(result)
```

### 6.2 手动扫描

**功能**：用户在下载页手动触发扫描，批量添加符合条件的视频。

**入口**：下载页 → 扫描标签页

**操作流程**：
1. 用户进入下载页，切换到"扫描"标签
2. 点击"开始扫描"按钮
3. 系统扫描收藏夹和稍后再看
4. 显示扫描结果（新视频数量）
5. 用户选择是否添加到下载列表

**关键代码**：
```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/ScanResultContent.tsx

const handleScan = async () => {
  setScanning(true)
  setError('')
  
  try {
    const response = await apiService.scanFolders()
    if (response.success) {
      setScanResults(response.data)
      setTotalNewVideos(response.data.reduce((sum, r) => sum + r.newVideos, 0))
    } else {
      setError(response.message || '扫描失败')
    }
  } catch (error) {
    setError('扫描失败')
  } finally {
    setScanning(false)
  }
}

const handleAddToQueue = async () => {
  setAdding(true)
  
  try {
    for (const result of scanResults) {
      for (const video of result.newVideosList) {
        await apiService.submitTask({
          title: video.title,
          media_type: 'video',
          media_id: video.bvid,
          cover: video.cover,
          desc: `CID: ${video.cid}`,
          meta: { cid: video.cid }
        })
      }
    }
    
    // 刷新任务列表
    await newQueueStore.fetchTasks()
    
    setAlertModal({
      show: true,
      title: '添加成功',
      message: `已添加 ${totalNewVideos} 个视频到下载列表`,
      type: 'success'
    })
  } catch (error) {
    setError('添加失败')
  } finally {
    setAdding(false)
  }
}
```

### 6.3 扫描服务

**文件位置**：`/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/scan_service.py`

**核心功能**：
```python
class ScanService:
    async def scan_all(self) -> List[ScanResult]:
        """扫描所有收藏夹和稍后再看"""
        results = []
        
        # 扫描收藏夹
        folders = await self._get_folders()
        for folder in folders:
            result = await self._scan_folder(folder)
            results.append(result)
        
        # 扫描稍后再看
        watchlater_result = await self._scan_watchlater()
        results.append(watchlater_result)
        
        return results
    
    async def _scan_folder(self, folder: dict) -> ScanResult:
        """扫描单个收藏夹"""
        # 获取收藏夹中的所有视频
        videos = await self._get_folder_videos(folder['id'])
        
        # 过滤新视频（未下载且不在队列中）
        new_videos = []
        for video in videos:
            if await self._is_new_video(video):
                new_videos.append(video)
        
        return ScanResult(
            folder_id=folder['id'],
            folder_name=folder['title'],
            total_videos=len(videos),
            new_videos=len(new_videos),
            new_videos_list=new_videos
        )
    
    async def _is_new_video(self, video: dict) -> bool:
        """检查是否为新视频"""
        # 检查数据库中是否存在已完成的任务
        db = SessionLocal()
        try:
            existing_task = db.query(Task).filter(
                Task.media_id == video['bvid'],
                Task.state == TaskState.COMPLETED
            ).first()
            
            if existing_task:
                return False
            
            # 检查队列中是否存在未完成的任务
            for task in queue_manager.tasks.values():
                if task.media_id == video['bvid'] and task.state != TaskState.COMPLETED:
                    return False
            
            return True
        finally:
            db.close()
```

## 7. 配置和设置

### 7.1 下载路径配置

**配置项**：
- `storage.download_path`：视频下载根路径
- `storage.temp_path`：临时文件路径

**设置界面**：设置页面 → 存储设置

**配置代码**：
```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/stores/settings.ts

interface StorageSettings {
  download_path: string
  temp_path: string
}

interface Settings {
  storage: StorageSettings
  // ... 其他配置
}

// 获取设置
const fetchSettings = async () => {
  const response = await apiService.getSettings()
  if (response.success) {
    setSettings(response.data)
  }
}

// 更新设置
const updateSettings = async (newSettings: Partial<Settings>) => {
  const response = await apiService.updateSettings(newSettings)
  if (response.success) {
    setSettings(response.data)
  }
}
```

### 7.2 自动下载配置

**配置项**：
- `auto_download.enabled`：是否启用自动下载
- `auto_download.scan_interval`：扫描间隔（小时）
- `auto_download.target_folders`：目标收藏夹列表
- `auto_download.conditions`：下载条件

**条件配置**：
```typescript
interface DownloadCondition {
  field: 'view' | 'like' | 'coin' | 'favorite'  // 统计字段
  operator: 'gt' | 'lt' | 'gte' | 'lte'  // 比较操作符
  value: number  // 阈值
}

interface AutoDownloadSettings {
  enabled: boolean
  scan_interval: number  // 小时
  target_folders: number[]  // 收藏夹ID列表
  conditions: DownloadCondition[]
}
```

**使用示例**：
```typescript
// 配置：自动下载播放量大于10000的视频
const autoDownloadSettings = {
  enabled: true,
  scan_interval: 24,
  target_folders: [123, 456, 789],
  conditions: [
    {
      field: 'view',
      operator: 'gt',
      value: 10000
    }
  ]
}
```

### 7.3 并发下载配置

**配置项**：
- `concurrent_downloads.max_tasks`：最大并发任务数
- `concurrent_downloads.max_speed`：最大下载速度（字节/秒）

**配置代码**：
```typescript
interface ConcurrentDownloadSettings {
  max_tasks: number  // 默认3
  max_speed: number  // 默认0（无限制）
}
```

**实现机制**：
```python
# QueueManager 中控制并发
class QueueManager:
    def __init__(self):
        self.max_concurrent_tasks = 3
        self.active_tasks: Set[str] = set()
    
    async def can_start_task(self) -> bool:
        """检查是否可以启动新任务"""
        return len(self.active_tasks) < self.max_concurrent_tasks
    
    async def start_task(self, task_id: str):
        """启动任务"""
        if await self.can_start_task():
            self.active_tasks.add(task_id)
            # 执行任务
            await self._execute_task(task_id)
            self.active_tasks.remove(task_id)
```

## 8. 关键代码片段

### 8.1 前端：视频下载状态检查

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/FavoritesContent.tsx

const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
  const tasks = newQueueStore.tasks
  const newSystemTasks = Object.values(tasks)
  
  // 检查是否在队列中（未完成的任务）
  const hasActiveTask = newSystemTasks.some(task =>
    task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
  )
  
  if (hasActiveTask) {
    return 'in_list'
  }
  
  // 检查是否已下载完成（已完成的任务）
  const hasCompletedTask = newSystemTasks.some(task =>
    task.media_id === bvid && task.state === 'completed'
  )
  
  if (hasCompletedTask) {
    return 'downloaded'
  }
  
  return 'none'
}
```

### 8.2 前端：多P视频检测和调度器创建

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/hooks/useVideoDownload.ts

if (pages.length > 1) {
  // 多P视频：按照BiliTools方案，创建调度器统一管理
  
  // 步骤1：为每个分P创建任务并提交到backlog
  const taskIds: string[] = []
  let addedCount = 0

  for (const page of pages) {
    try {
      const taskData = {
        title: page.part || `${video.title} - P${page.page}`,
        media_type: 'video',
        media_id: video.bvid,
        cover: video.pic || video.cover || '',
        desc: `CID: ${page.cid}`,
        meta: {
          cid: page.cid,
          page: page.page,
          part_title: page.part
        }
      }

      const response = await apiService.submitTask(taskData)
      if (response.success && response.data) {
        taskIds.push(response.data.id)
        addedCount++
      }
    } catch (error) {
      console.error(`添加分集任务失败: ${page.part}`, error)
    }
  }

  if (addedCount === 0) {
    throw new Error('所有分集添加失败')
  }

  // 步骤2：创建调度器，使用收集到的任务ID
  const folderName = `系列-${video.title.replace(/[\/\\:*?"<>|]/g, '_')}`
  
  // 获取用户配置的下载路径
  const { useSettingsStore } = await import('../stores/settings')
  const settingsStore = useSettingsStore.getState()
  
  if (!settingsStore.settings) {
    await settingsStore.fetchSettings()
  }
  
  const downloadPath = settingsStore.settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads'
  const folderPath = `${downloadPath}/${folderName}`

  const schedulerResponse = await apiService.createScheduler({
    title: video.title,
    task_ids: taskIds,
    folder: folderPath
  })

  if (!schedulerResponse.success || !schedulerResponse.data) {
    throw new Error(schedulerResponse.message || '创建调度器失败')
  }

  await newQueueStore.fetchTasks()
  return {success: true, message: `已添加 ${addedCount} 个视频到下载列表`}
}
```

### 8.3 后端：任务提交

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/queue.py

@router.post("/tasks", response_model=ApiResponse)
async def submit_task(task_create: TaskCreate):
    """Submit task to backlog queue"""
    print(f"[DEBUG] submit_task called with: {task_create}")
    logger.info(f"submit_task called with meta: {task_create.meta}")
    try:
        task = await queue_manager.submit_backlog(task_create)
        return ApiResponse(
            success=True,
            message="任务提交成功",
            data=task
        )
    except Exception as e:
        logger.error(f"Failed to submit task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### 8.4 后端：任务状态更新和执行

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/queue.py

@router.put("/tasks/{task_id}", response_model=ApiResponse)
async def update_task(task_id: str, task_update: TaskUpdate):
    """Update task"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Update fields
    old_state = task.state
    if task_update.state is not None:
        task.state = task_update.state
    if task_update.status is not None:
        task.status = task_update.status
    if task_update.meta is not None:
        task.meta = task_update.meta
    if task_update.prepare is not None:
        task.prepare = task_update.prepare

    task.updated_at = int(datetime.now().timestamp())

    # 持久化到数据库
    db = SessionLocal()
    try:
        db.commit()
    finally:
        db.close()

    logger.info(f"任务状态更新: id={task_id}, old_state={old_state}, new_state={task.state}")

    # 广播 WebSocket 事件
    from src.routers.websocket import broadcast_task_updated
    cancelled = task.state == 6  # CANCELLED state
    broadcast_task_updated(task_id, str(task.state), cancelled)

    # 当任务状态变为 active 时，直接执行任务（不使用调度器）
    if old_state != 2 and task.state == 2:  # 2 = ACTIVE
        logger.info(f"✓✓✓ 任务 {task_id} 状态变为 active，开始执行...")
        asyncio.create_task(_execute_single_task(task_id))

    return ApiResponse(
        success=True,
        message="任务更新成功",
        data=TaskResponse(...)
    )
```

### 8.5 后端：单个任务执行

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/queue.py

async def _execute_single_task(task_id: str):
    """执行单个任务（不使用调度器）"""
    from pathlib import Path
    from src.services.queue.task import TaskService

    logger.info(f"开始执行单个任务 {task_id}...")

    # 从 queue_manager 获取任务对象
    task = await queue_manager.get_task(task_id)
    if not task:
        logger.error(f"任务 {task_id} 不存在")
        return
    
    temp_dir = None
    try:
        # 使用 TaskService 准备并执行任务
        task_service = TaskService(task)

        # 准备任务（获取视频信息，创建子任务）
        logger.info(f"准备任务 {task_id}...")
        await task_service.prepare()

        # 从设置中获取临时路径和下载路径
        from src.services.settings_service import SettingsService
        db = SessionLocal()
        try:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            temp_path = settings.storage.temp_path or "/Users/tanyancong/工作/开发/pilinote/apps/api/temp"
            download_path = settings.storage.download_path or "/Users/tanyancong/工作/开发/pilinote/apps/api/downloads"
        finally:
            db.close()
        
        # 创建临时目录
        temp_dir = Path(temp_path) / task_id
        temp_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"临时目录: {temp_dir}")
        
        # 创建输出目录
        output_dir = Path(download_path)
        output_dir.mkdir(parents=True, exist_ok=True)

        # 执行任务
        logger.info(f"开始下载任务 {task_id}...")
        await task_service.execute(temp_dir, output_dir)

        logger.info(f"✓ 任务 {task_id} 已完成")
        
    except asyncio.CancelledError:
        logger.info(f"任务 {task_id} 被取消")
        
        # 更新任务状态
        task = await queue_manager.get_task(task_id)
        if task:
            task.state = TaskState.CANCELLED
            task.updated_at = int(datetime.now().timestamp())
            
            db = SessionLocal()
            try:
                db.merge(task)
                db.commit()
            finally:
                db.close()
            
    except Exception as e:
        logger.error(f"✗ 任务 {task_id} 执行失败: {e}", exc_info=True)
        
        # 更新任务状态
        task = await queue_manager.get_task(task_id)
        if task:
            task.state = TaskState.FAILED
            task.status['error'] = str(e)
            task.updated_at = int(datetime.now().timestamp())
            
            # 清理临时目录
            if temp_dir and temp_dir.exists():
                import shutil
                shutil.rmtree(temp_dir)
            
            db = SessionLocal()
            try:
                db.merge(task)
                db.commit()
            finally:
                db.close()
```

### 8.6 WebSocket 实时通信

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/websocket.py

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """广播消息给所有连接的客户端"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"广播消息失败: {e}")

manager = ConnectionManager()

# 广播任务创建事件
async def broadcast_task_created(task: Task):
    await manager.broadcast({
        'type': 'taskCreated',
        'task': task.to_dict()
    })

# 广播任务更新事件
async def broadcast_task_updated(task_id: str, state: str, cancelled: bool = False):
    await manager.broadcast({
        'type': 'taskUpdated',
        'id': task_id,
        'state': state,
        'cancelled': cancelled
    })

# 广播任务进度事件
async def broadcast_task_progress(task_id: str, progress: float, speed: int, eta: int, stage: str):
    await manager.broadcast({
        'type': 'taskProgress',
        'id': task_id,
        'progress': progress,
        'speed': speed,
        'eta': eta,
        'stage': stage
    })
```

```typescript
// 前端 WebSocket 处理
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/stores/newQueue.ts

connectWebSocket: () => {
  const { ws } = get()
  if (ws && ws.readyState === WebSocket.OPEN) return

  const wsUrl = `ws://${window.location.hostname}:8000/ws/queue`
  const newWs = new WebSocket(wsUrl)

  newWs.onopen = () => {
    set({ connected: true })
  }

  newWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      get().handleEvent(data)
    } catch (e) {
      console.error('[NewQueue] Failed to parse message:', e)
    }
  }

  newWs.onclose = () => {
    set({ connected: false, ws: null })
    setTimeout(() => get().connectWebSocket(), 3000)
  }

  newWs.onerror = (error) => {
    console.error('[NewQueue] WebSocket error:', error)
  }

  set({ ws: newWs })
},

handleEvent: (event) => {
  const { type, ...data } = event

  switch (type) {
    case 'taskCreated':
      set((state) => {
        const tasks = { ...state.tasks }
        if (data.task) {
          tasks[data.task.id] = data.task
        }
        return { tasks }
      })
      break

    case 'taskUpdated':
      set((state) => {
        const tasks = { ...state.tasks }
        if (data.cancelled && data.id) {
          delete tasks[data.id]
        } else if (data.id) {
          if (tasks[data.id]) {
            tasks[data.id] = { ...tasks[data.id], state: data.state }
          }
        }
        return { tasks }
      })
      break

    case 'taskProgress':
      set((state) => {
        const task = state.tasks[data.id]
        if (task) {
          return {
            tasks: {
              ...state.tasks,
              [data.id]: {
                ...task,
                status: {
                  ...task.status,
                  progress: data.progress,
                  speed: data.speed,
                  eta: data.eta,
                  stage: data.stage
                }
              }
            }
          }
        }
        return state
      })
      break
  }
}
```

## 9. 性能优化

### 9.1 前端优化

#### 9.1.1 防重复点击

```typescript
// 防止重复点击下载按钮
const button = e.currentTarget as HTMLButtonElement
if (button.disabled) return {success: false, message: '操作进行中'}
button.disabled = true

try {
  // 执行下载逻辑
  const result = await baseToggleDownload(video, e)
  return result
} finally {
  button.disabled = false
}
```

#### 9.1.2 useCallback 缓存函数

```typescript
// 使用 useCallback 缓存 fetchFn，避免每次渲染创建新函数引用
const fetchFavoriteVideos = useCallback(async (page: number, pageSize: number) => {
  if (!selectedFolder || !user?.mid) {
    return { success: true, data: { list: [], total: 0 } }
  }
  return apiService.getFolderDetail(selectedFolder.id, page, pageSize, keyword, order, sortDirection)
}, [selectedFolder?.id, user?.mid, keyword, order, sortDirection])

// 使用 useVideoList Hook 管理视频列表
const { videos, loading, hasMore, loadMoreRef, fetchVideos } = useVideoList({
  fetchFn: fetchFavoriteVideos,
  pageSize: 10,
  deps: [],  // 不需要deps，因为fetchFn已经用useCallback处理了依赖
  formatItem: (video: any) => ({ ... })
})
```

#### 9.1.3 虚拟滚动

对于大量视频列表，使用虚拟滚动优化渲染性能：

```typescript
// 使用 react-window 或 react-virtualized
import { FixedSizeList as List } from 'react-window'

const VideoList = ({ videos }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <VideoCard video={videos[index]} />
    </div>
  )

  return (
    <List
      height={600}
      itemCount={videos.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  )
}
```

#### 9.1.4 状态缓存

```typescript
// 使用 Zustand persist 中间件缓存状态
export const useNewQueueStore = create<NewQueueState>()(
  persist(
    (set, get) => ({
      tasks: {},
      schedulers: {},
      // ...
    }),
    {
      name: 'new-queue-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        schedulers: state.schedulers,
      }),
    }
  )
)
```

### 9.2 后端优化

#### 9.2.1 异步任务执行

```python
# 使用 asyncio.create_task 异步执行任务
if old_state != 2 and task.state == 2:  # 2 = ACTIVE
    logger.info(f"✓✓✓ 任务 {task_id} 状态变为 active，开始执行...")
    asyncio.create_task(_execute_single_task(task_id))
```

#### 9.2.2 并发下载控制

```python
# 控制并发下载数量
class QueueManager:
    def __init__(self):
        self.max_concurrent_tasks = 3
        self.active_tasks: Set[str] = set()
        self.semaphore = asyncio.Semaphore(self.max_concurrent_tasks)
    
    async def execute_task(self, task_id: str):
        """执行任务（带并发控制）"""
        async with self.semaphore:
            self.active_tasks.add(task_id)
            try:
                await self._execute_task(task_id)
            finally:
                self.active_tasks.remove(task_id)
```

#### 9.2.3 数据库连接池

```python
# 使用 SQLAlchemy 连接池
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(
    'sqlite:///pilinote.db',
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(bind=engine)
```

#### 9.2.4 批量操作

```python
# 批量删除任务
@router.delete("/tasks/batch", response_model=ApiResponse)
async def batch_delete_tasks(task_ids: List[str] = Body(...)):
    """批量删除任务"""
    deleted_count = 0
    failed_count = 0
    
    for task_id in task_ids:
        try:
            await queue_manager.remove_task(task_id)
            deleted_count += 1
        except Exception as e:
            failed_count += 1
    
    return ApiResponse(
        success=failed_count == 0,
        message=f"批量删除完成：成功 {deleted_count} 个，失败 {failed_count} 个"
    )
```

#### 9.2.5 缓存机制

```python
# 视频详情缓存
from functools import lru_cache

class BilibiliService:
    @lru_cache(maxsize=1000)
    async def get_video_detail(self, bvid: str, sessdata: str) -> dict:
        """获取视频详情（带缓存）"""
        # 实现逻辑
        pass
```

### 9.3 网络优化

#### 9.3.1 WebSocket 心跳

```typescript
// 前端 WebSocket 心跳
const connectWebSocket = () => {
  const ws = new WebSocket(wsUrl)
  
  ws.onopen = () => {
    set({ connected: true })
    // 启动心跳
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)  // 30秒
  }
  
  ws.onclose = () => {
    clearInterval(heartbeatInterval)
    // 重连
    setTimeout(() => connectWebSocket(), 3000)
  }
}
```

#### 9.3.2 请求去重

```typescript
// 请求去重
const pendingRequests = new Map<string, Promise<any>>()

const fetchWithDedup = async (key: string, fetcher: () => Promise<any>) => {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }
  
  const promise = fetcher().finally(() => {
    pendingRequests.delete(key)
  })
  
  pendingRequests.set(key, promise)
  return promise
}

// 使用
const fetchTasks = async () => {
  return fetchWithDedup('fetchTasks', async () => {
    const response = await fetch(getApiUrl('/api/queue/tasks'))
    return response.json()
  })
}
```

## 10. 错误处理

### 10.1 前端错误处理

#### 10.1.1 API 请求错误

```typescript
// /Users/tanyancong/工作/开发/pilinote/apps/web/src/services/api.ts

class ApiService {
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json()

      // 如果HTTP状态码不是2xx，检查是否有detail字段
      if (!response.ok) {
        if (data.detail) {
          if (typeof data.detail === 'string') {
            return {
              success: false,
              message: data.detail
            }
          }
          if (typeof data.detail === 'object') {
            return {
              success: false,
              message: data.detail.message || '请求失败',
              code: data.detail.code
            }
          }
        }
        return {
          success: false,
          message: data.message || '请求失败',
          code: data.code
        }
      }

      return data
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '网络请求失败',
      }
    }
  }
}
```

#### 10.1.2 下载操作错误

```typescript
// useVideoDownload Hook 中的错误处理
const toggleDownload = useCallback(async (video: VideoInfo, e: React.MouseEvent) => {
  e.stopPropagation()
  
  const button = e.currentTarget as HTMLButtonElement
  if (button.disabled) return {success: false, message: '操作进行中'}
  button.disabled = true

  try {
    const sessdata = localStorage.getItem('sessdata')
    const currentTasks = newQueueStore.tasks
    const existingTask = Object.values(currentTasks).find(t => t.media_id === video.bvid)
    
    if (existingTask && !['completed', 'cancelled'].includes(existingTask.state)) {
      // 从下载列表移除
      try {
        for (const task of allTasks) {
          await newQueueStore.controlTask(task.id, 'cancelled')
        }
        await newQueueStore.fetchTasks()
        return {success: true, message: '已从下载列表移除'}
      } catch (error) {
        console.error('从下载列表移除失败:', error)
        return {success: false, message: '从下载列表移除失败'}
      }
    } else {
      // 添加到下载系统
      try {
        const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)
        // ... 处理逻辑
      } catch (error) {
        console.error('获取视频详情失败，降级为直接添加:', error)
        
        // 降级处理
        const taskData = {
          title: video.title,
          media_type: 'video',
          media_id: video.bvid,
          cover: video.pic || video.cover || '',
          desc: video.cid || video.aid ? `CID: ${video.cid || video.aid}` : '',
          meta: video.cid ? { cid: video.cid } : undefined
        }

        try {
          const response = await apiService.submitTask(taskData)
          if (response.success) {
            await newQueueStore.fetchTasks()
            return {success: true, message: '已添加到下载队列'}
          } else {
            return {success: false, message: '添加到下载队列失败: ' + (response.message || '未知错误')}
          }
        } catch (error) {
          console.error('添加任务失败:', error)
          return {success: false, message: '添加到下载队列失败'}
        }
      }
    }
  } finally {
    button.disabled = false
  }
}, [newQueueStore])
```

#### 10.1.3 WebSocket 错误

```typescript
// WebSocket 错误处理
newWs.onerror = (error) => {
  console.error('[NewQueue] WebSocket error:', error)
  set({ connected: false, ws: null })
  // 自动重连
  setTimeout(() => get().connectWebSocket(), 3000)
}

newWs.onclose = () => {
  set({ connected: false, ws: null })
  // 自动重连
  setTimeout(() => get().connectWebSocket(), 3000)
}
```

### 10.2 后端错误处理

#### 10.2.1 API 路由错误

```python
# /Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/queue.py

@router.post("/tasks", response_model=ApiResponse)
async def submit_task(task_create: TaskCreate):
    """Submit task to backlog queue"""
    try:
        task = await queue_manager.submit_backlog(task_create)
        return ApiResponse(
            success=True,
            message="任务提交成功",
            data=task
        )
    except ValueError as e:
        # 参数验证错误
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # 其他错误
        logger.error(f"Failed to submit task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

#### 10.2.2 任务执行错误

```python
async def _execute_single_task(task_id: str):
    """执行单个任务（不使用调度器）"""
    task = await queue_manager.get_task(task_id)
    if not task:
        logger.error(f"任务 {task_id} 不存在")
        return
    
    temp_dir = None
    try:
        task_service = TaskService(task)
        await task_service.prepare()
        
        # 创建临时目录
        temp_dir = Path(temp_path) / task_id
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # 执行任务
        await task_service.execute(temp_dir, output_dir)
        logger.info(f"✓ 任务 {task_id} 已完成")
        
    except asyncio.CancelledError:
        # 任务被取消
        logger.info(f"任务 {task_id} 被取消")
        task = await queue_manager.get_task(task_id)
        if task:
            task.state = TaskState.CANCELLED
            task.updated_at = int(datetime.now().timestamp())
            
            db = SessionLocal()
            try:
                db.merge(task)
                db.commit()
            finally:
                db.close()
            
    except Exception as e:
        # 任务执行失败
        logger.error(f"✗ 任务 {task_id} 执行失败: {e}", exc_info=True)
        
        task = await queue_manager.get_task(task_id)
        if task:
            task.state = TaskState.FAILED
            task.status['error'] = str(e)
            task.updated_at = int(datetime.now().timestamp())
            
            # 清理临时目录
            if temp_dir and temp_dir.exists():
                import shutil
                shutil.rmtree(temp_dir)
            
            db = SessionLocal()
            try:
                db.merge(task)
                db.commit()
            finally:
                db.close()
```

#### 10.2.3 数据库错误

```python
# 数据库操作错误处理
db = SessionLocal()
try:
    # 执行数据库操作
    db.add(task)
    db.commit()
    db.refresh(task)
except Exception as e:
    db.rollback()
    logger.error(f"数据库操作失败: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="数据库操作失败")
finally:
    db.close()
```

#### 10.2.4 WebSocket 广播错误

```python
# WebSocket 广播错误处理
async def broadcast(message: dict):
    """广播消息给所有连接的客户端"""
    for connection in self.active_connections[:]:  # 使用副本避免迭代时修改
        try:
            await connection.send_json(message)
        except Exception as e:
            logger.error(f"广播消息失败: {e}")
            # 移除失败的连接
            self.disconnect(connection)
```

### 10.3 错误恢复机制

#### 10.3.1 任务重试

```typescript
// 前端：任务重试
const retryTask = async (taskId: string) => {
  try {
    const response = await apiService.retryTask(taskId)
    if (response.success) {
      await newQueueStore.fetchTasks()
      return {success: true, message: '任务已重新添加到队列'}
    } else {
      return {success: false, message: response.message || '重试失败'}
    }
  } catch (error) {
    return {success: false, message: '重试失败'}
  }
}
```

```python
# 后端：任务重试
@router.post("/tasks/{task_id}/retry", response_model=ApiResponse)
async def retry_task(task_id: str):
    """Retry failed or cancelled task"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # 只有失败或取消的任务才能重试
    if task.state not in [TaskState.FAILED, TaskState.CANCELLED, TaskState.PAUSED, TaskState.COMPLETED]:
        raise HTTPException(status_code=400, detail="只有失败、取消、暂停或已完成的任务才能重试")

    # 重置任务状态
    task.state = TaskState.BACKLOG
    task.status = {
        'stage': 'pending',
        'progress': 0,
        'total': 0,
        'speed': 0,
        'eta': 0
    }
    task.started_at = None
    task.completed_at = None
    task.updated_at = int(datetime.now().timestamp())

    # 持久化到数据库
    db = SessionLocal()
    try:
        db.merge(task)
        db.commit()
        logger.info(f"✓ 任务 {task_id} 状态已重置为 BACKLOG")
    finally:
        db.close()

    # 重新添加到队列
    await queue_manager.queues[QueueType.BACKLOG].put(task_id)
    await queue_manager._save_queue_to_db(QueueType.BACKLOG)
    logger.info(f"✓ 任务 {task_id} 已重新添加到队列")

    # 广播 WebSocket 事件
    from src.routers.websocket import broadcast_task_updated
    broadcast_task_updated(task_id, str(task.state), cancelled=False)

    return ApiResponse(
        success=True,
        message="任务重试成功，已添加到队列"
    )
```

#### 10.3.2 自动重连

```typescript
// WebSocket 自动重连
const connectWebSocket = () => {
  const { ws } = get()
  if (ws && ws.readyState === WebSocket.OPEN) return

  const wsUrl = `ws://${window.location.hostname}:8000/ws/queue`
  const newWs = new WebSocket(wsUrl)

  newWs.onopen = () => {
    set({ connected: true })
    console.log('[NewQueue] WebSocket connected')
  }

  newWs.onclose = () => {
    set({ connected: false, ws: null })
    console.log('[NewQueue] WebSocket disconnected, reconnecting in 3s...')
    // 3秒后重连
    setTimeout(() => get().connectWebSocket(), 3000)
  }

  newWs.onerror = (error) => {
    console.error('[NewQueue] WebSocket error:', error)
    set({ connected: false, ws: null })
  }

  set({ ws: newWs })
}
```

#### 10.3.3 数据一致性检查

```typescript
// 清理重复的已完成任务
cleanupDuplicateCompletedTasks: async () => {
  const tasks = get().tasks
  const taskList = Object.values(tasks)
  
  // 找出所有已完成的任务
  const completedTasks = taskList.filter(t => t.state === 'completed')
  
  // 按media_id分组
  const groupedByMediaId: Record<string, typeof completedTasks> = {}
  completedTasks.forEach(task => {
    const mediaId = task.media_id
    if (!groupedByMediaId[mediaId]) {
      groupedByMediaId[mediaId] = []
    }
    groupedByMediaId[mediaId].push(task)
  })
  
  // 找出重复的任务（同一个media_id有多个completed任务）
  const duplicateTasks: string[] = []
  Object.values(groupedByMediaId).forEach(tasks => {
    if (tasks.length > 1) {
      // 保留最新的一个，删除其他的
      const sortedTasks = tasks.sort((a, b) => b.updated_at - a.updated_at)
      sortedTasks.slice(1).forEach(task => {
        duplicateTasks.push(task.id)
      })
    }
  })
  
  // 删除重复的任务
  if (duplicateTasks.length > 0) {
    await Promise.all(duplicateTasks.map(taskId => get().deleteTask(taskId)))
  }
}
```

## 总结

"添加到下载列表"功能是 PiliNote 项目的核心功能之一，实现了从用户交互到后台下载的完整流程。该功能具有以下特点：

1. **完整的架构设计**：前后端分离，多层架构，职责清晰
2. **灵活的媒体类型支持**：支持单视频、多P系列视频、图文等多种类型
3. **智能的任务调度**：多队列系统，支持并发下载和资源优化
4. **实时的状态同步**：基于 WebSocket 的实时通信，用户体验流畅
5. **强大的自动化能力**：支持定时扫描和手动扫描，自动发现新内容
6. **完善的错误处理**：多层级错误处理和恢复机制，保证系统稳定性
7. **良好的性能优化**：前端防抖、缓存、虚拟滚动，后端异步执行、并发控制、批量操作

通过本文档的详细说明，开发者可以快速理解该功能的实现原理，便于后续的功能扩展和维护优化。

## 附录

### A. 关键文件清单

**前端文件**：
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/FavoritesContent.tsx` - 收藏页组件
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/WatchLaterContent.tsx` - 稍后再看页组件
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/hooks/useVideoDownload.ts` - 视频下载 Hook
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/stores/newQueue.ts` - 队列状态管理
- `/Users/tanyancong/工作/开发/pilinote/apps/web/src/services/api.ts` - API 服务层

**后端文件**：
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/queue.py` - 队列 API 路由
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/models/queue.py` - 队列数据模型
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/models/task.py` - 任务数据模型
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/manager.py` - 队列管理器
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/scheduler.py` - 调度器服务
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/queue/task.py` - 任务服务
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/services/scan_service.py` - 扫描服务
- `/Users/tanyancong/工作/开发/pilinote/apps/api/src/routers/websocket.py` - WebSocket 路由

### B. API 端点汇总

**任务管理**：
- `POST /api/queue/tasks` - 提交任务
- `GET /api/queue/tasks` - 获取所有任务
- `GET /api/queue/tasks/{task_id}` - 获取任务详情
- `PUT /api/queue/tasks/{task_id}` - 更新任务状态
- `DELETE /api/queue/tasks/{task_id}` - 删除任务
- `DELETE /api/queue/tasks/batch` - 批量删除任务
- `DELETE /api/queue/tasks/all` - 删除所有任务
- `POST /api/queue/tasks/{task_id}/pause` - 暂停任务
- `POST /api/queue/tasks/{task_id}/cancel` - 取消任务
- `POST /api/queue/tasks/{task_id}/retry` - 重试任务
- `GET /api/queue/tasks/{task_id}/file-size` - 获取任务文件大小

**调度器管理**：
- `POST /api/queue/schedulers` - 创建调度器
- `GET /api/queue/schedulers` - 获取所有调度器
- `GET /api/queue/schedulers/{scheduler_id}` - 获取调度器详情
- `POST /api/queue/schedulers/{scheduler_id}/start` - 启动调度器
- `POST /api/queue/schedulers/{scheduler_id}/pause` - 暂停调度器
- `POST /api/queue/schedulers/{scheduler_id}/resume` - 恢复调度器
- `POST /api/queue/schedulers/{scheduler_id}/cancel` - 取消调度器
- `DELETE /api/queue/schedulers/{scheduler_id}` - 删除调度器

**WebSocket**：
- `WS /ws/queue` - 队列状态实时更新

### C. 数据库表结构

**tasks 表**：
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    cover TEXT,
    desc TEXT,
    duration INTEGER DEFAULT 0,
    pubtime INTEGER DEFAULT 0,
    media_type TEXT NOT NULL,
    url TEXT,
    media_id TEXT NOT NULL,
    scheduler_id TEXT,
    state INTEGER DEFAULT 0,
    status JSON,
    meta JSON,
    prepare JSON,
    created_at INTEGER,
    updated_at INTEGER,
    started_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (scheduler_id) REFERENCES schedulers(id)
);
```

**schedulers 表**：
```sql
CREATE TABLE schedulers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    ts INTEGER DEFAULT 0,
    list JSON,
    count INTEGER DEFAULT 0,
    queue_type TEXT DEFAULT 'fifo',
    state INTEGER DEFAULT 0,
    folder TEXT,
    created_at INTEGER,
    updated_at INTEGER
);
```

**queues 表**：
```sql
CREATE TABLE queues (
    queue_type INTEGER PRIMARY KEY,
    value JSON,
    updated_at INTEGER
);
```

### D. 状态枚举值

**TaskState（任务状态）**：
- `0 (BACKLOG)` - 待办
- `1 (PENDING)` - 待处理
- `2 (ACTIVE)` - 执行中
- `3 (COMPLETED)` - 已完成
- `4 (PAUSED)` - 已暂停
- `5 (FAILED)` - 失败
- `6 (CANCELLED)` - 已取消

**SchedulerState（调度器状态）**：
- `0 (IDLE)` - 空闲
- `1 (RUNNING)` - 运行中
- `2 (COMPLETED)` - 已完成
- `3 (PAUSED)` - 已暂停
- `4 (FAILED)` - 失败
- `5 (CANCELLED)` - 已取消

**DownloadStage（下载阶段）**：
- `preparing` - 准备中
- `downloading` - 下载中
- `moving` - 移动中
- `post_processing` - 后处理中
- `completed` - 已完成

**QueueType（队列类型）**：
- `0 (BACKLOG)` - 待办队列
- `1 (PENDING)` - 待处理队列
- `2 (DOING)` - 执行中队列
- `3 (COMPLETE)` - 完成队列

---

**文档版本**：1.0  
**最后更新**：2026年4月14日  
**维护者**：PiliNote 开发团队