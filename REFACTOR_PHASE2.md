# 阶段2：后端服务层重构

## 2.1 统一队列管理器

### 合并 download_manager 和 queue_manager
```python
class UnifiedQueueManager:
    """统一的队列管理器"""
    
    def __init__(self):
        # 四级队列系统
        self.queues = {
            QueueType.BACKLOG: asyncio.Queue(),
            QueueType.PENDING: asyncio.Queue(), 
            QueueType.DOING: asyncio.Queue(),
            QueueType.COMPLETE: asyncio.Queue()
        }
        
        # 并发控制
        self.semaphore = asyncio.Semaphore(3)  # 最大并发数
        self.running_tasks = {}
        
        # 事件系统
        self.event_manager = EventManager()
    
    async def submit_task(self, task_create: TaskCreate) -> Task:
        """提交任务到 backlog 队列"""
        
    async def process_queues(self):
        """处理队列流转：backlog → pending → doing → complete"""
        
    async def execute_task(self, task: Task):
        """执行单个任务（包含所有子任务）"""
```

## 2.2 重构下载引擎

### 简化 DownloadEngine
- 移除复杂的重试逻辑（交给统一错误处理）
- 专注于下载执行
- 改进进度回调机制

### 实现子任务处理器
```python
class VideoHandler:
    """视频下载处理器"""
    async def execute(self, task: Task, subtask: SubTask) -> bool:
        
class SubtitleHandler:
    """字幕下载处理器"""
    async def execute(self, task: Task, subtask: SubTask) -> bool:
        
class DanmakuHandler:
    """弹幕下载处理器"""
    async def execute(self, task: Task, subtask: SubTask) -> bool:
```

## 2.3 统一错误处理系统

### ErrorManager
```python
class ErrorManager:
    """统一错误管理器"""
    
    def classify_error(self, error: Exception) -> ErrorCategory:
        """错误分类"""
        
    def should_retry(self, error: ErrorCategory, retry_count: int) -> bool:
        """判断是否应该重试"""
        
    async def handle_error(self, task: Task, error: Exception):
        """处理错误"""
```

## 2.4 事件系统

### EventManager
```python
class EventManager:
    """事件管理器 - 支持 WebSocket 实时推送"""
    
    async def publish(self, event_type: EventType, data: dict):
        """发布事件到 WebSocket 客户端"""
        
    def subscribe(self, event_type: EventType, callback):
        """订阅事件"""
```

## 2.5 API 路由整合

### 移除旧路由
- 删除 `routers/download.py`
- 保留必要的 API 到 `routers/queue.py`

### 完善 queue.py
- 简化任务执行逻辑
- 添加批量操作支持
- 改进错误响应格式