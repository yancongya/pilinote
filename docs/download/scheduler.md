# 调度器

## 功能

定时扫描和自动下载，支持批量下载合集、收藏夹、稍后再看等内容。

## 调度器状态

| 状态 | 说明 |
|------|------|
| idle | 空闲 |
| running | 运行中 |
| paused | 暂停 |
| completed | 完成 |
| failed | 失败 |

## 调度器模型

```python
class Scheduler(Base):
    """调度器模型"""
    __tablename__ = "schedulers"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200))  # 调度器标题
    folder = Column(String(500))  # 输出文件夹
    queue_type = Column(Integer, default=0)  # 队列类型: 0=BACKLOG, 1=PENDING, 2=DOING, 3=COMPLETE
    state = Column(Integer, default=0)  # 状态: 0=idle, 1=running, 2=paused, 3=completed, 4=failed
    list = Column(Text)  # 任务ID列表（JSON）
    count = Column(Integer, default=0)  # 任务总数
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
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
POST /api/queue/schedulers/{id}/stop
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
2. 扫描合集内容
   ↓
3. 为每个分集创建任务
   ↓
4. 将任务添加到调度器的任务列表
   ↓
5. 启动调度器
   ↓
6. 按顺序执行任务
   ↓
7. 所有任务完成
   ↓
8. 调度器状态更新为completed
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
8. 调度器状态更新为completed
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
8. 调度器状态更新为completed
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

### 调度器管理器

**文件**: `apps/api/src/services/queue/scheduler_manager.py`

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

### 调度器执行

**文件**: `apps/api/src/services/queue/scheduler_executor.py`

```python
class SchedulerExecutor:
    """调度器执行器"""
    
    async def execute(self, scheduler: Scheduler):
        """执行调度器"""
        try:
            # 获取任务列表
            task_ids = json.loads(scheduler.list)
            
            # 更新状态为running
            scheduler.state = 1  # running
            db.commit()
            
            # 按顺序执行任务
            for task_id in task_ids:
                try:
                    # 获取任务
                    task = db.query(Task).filter(Task.id == task_id).first()
                    
                    if task and task.state == 0:  # BACKLOG
                        # 更新任务状态为DOING
                        task.state = 2  # DOING
                        db.commit()
                        
                        # 执行任务
                        await handler.process(task)
                        
                        # 更新任务状态为COMPLETE
                        task.state = 3  # COMPLETE
                        db.commit()
                except Exception as e:
                    logger.error(f"任务 {task_id} 执行失败: {e}")
                    continue
            
            # 更新状态为completed
            scheduler.state = 3  # completed
            db.commit()
            
        except Exception as e:
            logger.error(f"调度器 {scheduler.id} 执行失败: {e}")
            
            # 更新状态为failed
            scheduler.state = 4  # failed
            db.commit()
```

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
  "type": "scheduler_updated",
  "scheduler_id": "770e8400-e29b-41d4-a716-446655440002",
  "state": 1,
  "message": "调度器正在运行"
}
```

### 调度器完成

```json
{
  "type": "scheduler_completed",
  "scheduler_id": "770e8400-e29b-41d4-a716-446655440002",
  "message": "调度器已完成"
}
```

## 关键文件

- **后端**:
  - `apps/api/src/models/scheduler.py` - 调度器模型
  - `apps/api/src/services/queue/scheduler_manager.py` - 调度器管理器
  - `apps/api/src/services/queue/scheduler_executor.py` - 调度器执行器
  - `apps/api/src/routers/queue.py` - 调度器路由

- **前端**:
  - `apps/web/src/components/SchedulerManager.tsx` - 调度器管理组件
  - `apps/web/src/stores/scheduler.ts` - 调度器状态管理
  - `apps/web/src/services/api.ts` - API服务

---

[返回上级](./README.md)