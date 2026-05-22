# 调度器

## 功能

定时扫描和自动下载，支持批量下载合集、收藏夹、稍后再看等内容。

## 调度器状态

后端存储/返回的 `state` 为 `SchedulerState`（`apps/api/src/models/scheduler.py`），取值为整数：

| SchedulerState | 值 | 说明 | 常见 UI 文案 |
|---|---:|---|---|
| PENDING | 0 | 待处理 | 空闲/待启动 |
| ACTIVE | 1 | 活跃 | 运行中 |
| COMPLETED | 2 | 已完成 | 完成 |
| PAUSED | 3 | 已暂停 | 暂停 |
| FAILED | 4 | 失败 | 失败 |
| CANCELLED | 5 | 已取消 | 取消 |

## 调度器模型

```python
class SchedulerState(int, enum.Enum):
    PENDING = 0
    ACTIVE = 1
    COMPLETED = 2
    PAUSED = 3
    FAILED = 4
    CANCELLED = 5

class QueueType(int, enum.Enum):
    BACKLOG = 0
    PENDING = 1
    DOING = 2
    COMPLETE = 3

class Scheduler(Base):
    __tablename__ = "schedulers"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)
    list = Column(JSON, nullable=False, default=lambda: [])  # 任务ID列表
    count = Column(Integer, nullable=False, default=0)
    queue_type = Column(Integer, nullable=False, default=QueueType.PENDING)
    state = Column(Integer, nullable=False, default=SchedulerState.PENDING, index=True)
    folder = Column(String(500), nullable=False)
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
```

## API

### 创建调度器

```
POST /api/queue/schedulers
Body: {
    "title": "我的调度器",
    "folder": "/downloads/my_videos",
    "task_ids": ["task1", "task2"]
}
```

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 调度器标题（用于合集下载时的文件夹名称） |
| `folder` | string | 是 | 输出文件夹路径（绝对路径或相对路径） |
| `task_ids` | array | 否 | 任务ID列表（可选，如果不提供则从backlog队列获取） |

**响应示例**：

```json
{
  "success": true,
  "message": "调度器创建成功",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "title": "我的调度器",
    "list": ["550e8400-e29b-41d4-a716-446655440000"],
    "count": 1,
    "queue_type": 0,
    "state": 0,
    "folder": "/downloads/my_videos",
    "created_at": 1234567890,
    "updated_at": 1234567890
  }
}
```

### 启动调度器

```
POST /api/queue/schedulers/{id}/start
```

### 暂停调度器

```
POST /api/queue/schedulers/{id}/pause
```

### 停止调度器

```
POST /api/queue/schedulers/{id}/resume
```

### 取消调度器

```
POST /api/queue/schedulers/{id}/cancel
```

### 删除调度器

```
DELETE /api/queue/schedulers/{id}
```

## 调度器执行流程

### 合集下载流程

```
1. 创建调度器
   ↓
2. 启动调度器（initialize → prepare → dispatch）
   ↓
3. dispatch 按顺序/策略推进任务执行，并更新 scheduler/task 状态
   ↓
4. 所有任务完成 → 调度器状态更新为 COMPLETED（2）
```

### 收藏夹下载流程

```
1. 创建调度器（标题=收藏夹名称，文件夹=收藏夹ID）
   ↓
2. 扫描收藏夹内容
   ↓
3. 为每个视频创建任务
   ↓
4. 将任务添加到调度器的任务列表
   ↓
5. 启动调度器
   ↓
6. 按顺序执行任务
   ↓
7. 所有任务完成
   ↓
4. 调度器状态更新为 COMPLETED（2）
```

### 稍后再看下载流程

```
1. 创建调度器（标题=稍后再看，文件夹=watchlater）
   ↓
2. 扫描稍后再看列表
   ↓
3. 为每个视频创建任务
   ↓
4. 将任务添加到调度器的任务列表
   ↓
5. 启动调度器
   ↓
6. 按顺序执行任务
   ↓
7. 所有任务完成
   ↓
4. 调度器状态更新为 COMPLETED（2）
```

## 使用场景

### 1. 番剧合集下载

```typescript
// 前端调用
const schedulerData = {
  title: "番剧名称",
  folder: "/downloads/番剧名称",
  task_ids: episodeTaskIds  // 每一集的任务ID
}

const response = await apiService.createScheduler(schedulerData)
if (response.success) {
  // 启动调度器
  await apiService.startScheduler(response.data.id)
}
```

### 2. 收藏夹批量下载

```typescript
// 前端调用
const schedulerData = {
  title: "我的收藏夹",
  folder: "/downloads/我的收藏夹",
  task_ids: videoTaskIds  // 每个视频的任务ID
}

const response = await apiService.createScheduler(schedulerData)
if (response.success) {
  // 启动调度器
  await apiService.startScheduler(response.data.id)
}
```

### 3. 稍后再看批量下载

```typescript
// 前端调用
const schedulerData = {
  title: "稍后再看",
  folder: "/downloads/稍后再看",
  task_ids: watchlaterTaskIds  // 每个视频的任务ID
}

const response = await apiService.createScheduler(schedulerData)
if (response.success) {
  // 启动调度器
  await apiService.startScheduler(response.data.id)
}
```

## 实现细节

### 调度器服务

**文件**: `apps/api/src/services/queue/scheduler.py`

```python
class SchedulerManager:
    """调度器管理器"""
    
    async def create_scheduler(self, title: str, folder: str, task_ids: List[str] = None) -> Scheduler:
        """创建调度器"""
        scheduler = Scheduler(
            title=title,
            folder=folder,
            queue_type=0,  # BACKLOG
            state=0,  # idle
            list=json.dumps(task_ids or []),
            count=len(task_ids) if task_ids else 0
        )
        
        db.add(scheduler)
        db.commit()
        db.refresh(scheduler)
        
        return scheduler
    
    async def start_scheduler(self, scheduler_id: str):
        """启动调度器"""
        scheduler = db.query(Scheduler).filter(Scheduler.id == scheduler_id).first()
        
        if not scheduler:
            raise HTTPException(status_code=404, detail="调度器不存在")
        
        # 更新状态为running
        scheduler.state = 1  # running
        db.commit()
        
        # 获取任务列表
        task_ids = json.loads(scheduler.list)
        
        # 按顺序执行任务
        for task_id in task_ids:
            await queue_manager.process_task(task_id)
        
        # 更新状态为completed
        scheduler.state = 3  # completed
        db.commit()
```

（历史文档中出现的 `scheduler_manager.py` / `scheduler_executor.py` 已不再是当前主路径；以 `scheduler.py` 与 `routers/queue.py` 中的调用顺序为准。）

## 前端集成

### 调度器组件

**文件**: `apps/web/src/components/SchedulerManager.tsx`

```typescript
interface SchedulerManagerProps {
  mediaType: string
  mediaId: string
  title: string
}

export function SchedulerManager({ mediaType, mediaId, title }: SchedulerManagerProps) {
  const [scheduler, setScheduler] = useState<Scheduler | null>(null)
  const [loading, setLoading] = useState(false)
  
  const createAndStartScheduler = async () => {
    setLoading(true)
    
    try {
      // 创建任务
      const taskIds = await createTasksForMedia(mediaType, mediaId)
      
      // 创建调度器
      const response = await apiService.createScheduler({
        title: title,
        folder: `/downloads/${title}`,
        task_ids: taskIds
      })
      
      if (response.success) {
        setScheduler(response.data)
        
        // 启动调度器
        await apiService.startScheduler(response.data.id)
      }
    } catch (error) {
      console.error('创建调度器失败:', error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      <button onClick={createAndStartScheduler} disabled={loading}>
        {loading ? '创建中...' : '创建调度器'}
      </button>
      
      {scheduler && (
        <div>
          <p>调度器ID: {scheduler.id}</p>
          <p>状态: {scheduler.state}</p>
          <p>进度: {scheduler.count} 个任务</p>
        </div>
      )}
    </div>
  )
}
```

## WebSocket事件

### 调度器状态更新

```json
{
  "type": "schedulerUpdated",
  "scheduler": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "state": 1
  }
}
```

### 调度器删除

```json
{
  "type": "schedulerDeleted",
  "id": "770e8400-e29b-41d4-a716-446655440002"
}
```

## 关键文件

- **后端**:
  - `apps/api/src/models/scheduler.py` - 调度器模型
  - `apps/api/src/services/queue/scheduler.py` - 调度器服务（initialize/prepare/dispatch/pause/resume/cancel）
  - `apps/api/src/routers/queue.py` - 调度器路由

- **前端**:
  - `apps/web/src/components/SchedulerManager.tsx` - 调度器管理组件
  - `apps/web/src/stores/scheduler.ts` - 调度器状态管理
  - `apps/web/src/services/api.ts` - API服务

---

[返回上级](./README.md)
