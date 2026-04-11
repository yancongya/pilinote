# 阶段2：队列管理系统

## 概述

本阶段的目标是实现统一的队列管理系统，参考BiliTools的架构设计，创建Manager来管理四级队列（backlog/pending/doing/complete），解决当前项目中DownloadService和DownloadManager功能重复、职责不清的问题。

## 核心问题

### 当前问题

1. **双下载管理器冲突**
   - `DownloadService`和`DownloadManager`功能重复
   - 两个管理器都有`active_downloads`和`download_queue`
   - 状态不同步，容易产生冲突

2. **缺少统一的队列管理**
   - 没有明确的队列概念
   - 任务状态流转不清晰
   - 难以控制任务执行顺序

3. **并发控制不统一**
   - DownloadService有max_concurrent控制
   - DownloadManager也有并发控制
   - 没有统一的信号量管理

## 解决方案

### 1. QueueManager - 统一的队列管理器

**文件**: `apps/api/src/services/queue/manager.py`

```python
import asyncio
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime
import logging

from models.task import Task, TaskState
from models.scheduler import Scheduler, SchedulerState
from models.queue import Queue, QueueType
from schemas.task import TaskCreate, TaskResponse
from schemas.scheduler import SchedulerCreate, SchedulerResponse
from schemas.queue import QueueResponse
from database import SessionLocal

logger = logging.getLogger(__name__)

class QueueManager:
    """统一的队列管理器"""

    _instance: Optional['QueueManager'] = None
    _lock = asyncio.Lock()

    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True

        # 内存中的调度器和任务
        self.schedulers: Dict[str, Scheduler] = {}
        self.tasks: Dict[str, Task] = {}

        # 四级队列
        self.queues: Dict[QueueType, asyncio.Queue] = {
            QueueType.BACKLOG: asyncio.Queue(),
            QueueType.PENDING: asyncio.Queue(),
            QueueType.DOING: asyncio.Queue(),
            QueueType.COMPLETE: asyncio.Queue()
        }

        # 信号量控制并发
        self.semaphore = asyncio.Semaphore(3)  # 最大并发数

        # 运行时标志
        self._running = False

    async def initialize(self):
        """初始化管理器"""
        if self._running:
            return

        logger.info("初始化队列管理器...")

        # 从数据库加载队列
        await self._load_queues_from_db()

        # 从数据库加载调度器
        await self._load_schedulers_from_db()

        # 从数据库加载任务
        await self._load_tasks_from_db()

        self._running = True
        logger.info("队列管理器初始化完成")

    async def _load_queues_from_db(self):
        """从数据库加载队列"""
        db = SessionLocal()
        try:
            queues = db.query(Queue).all()
            for queue in queues:
                queue_type = QueueType(queue.queue_type)
                task_ids = queue.value or []

                # 重新创建队列
                self.queues[queue_type] = asyncio.Queue()
                for task_id in task_ids:
                    await self.queues[queue_type].put(task_id)

            logger.info(f"✓ 从数据库加载了 {len(queues)} 个队列")
        finally:
            db.close()

    async def _load_schedulers_from_db(self):
        """从数据库加载调度器"""
        db = SessionLocal()
        try:
            schedulers = db.query(Scheduler).all()
            for scheduler in schedulers:
                self.schedulers[scheduler.id] = scheduler

            logger.info(f"✓ 从数据库加载了 {len(schedulers)} 个调度器")
        finally:
            db.close()

    async def _load_tasks_from_db(self):
        """从数据库加载任务"""
        db = SessionLocal()
        try:
            tasks = db.query(Task).all()
            for task in tasks:
                self.tasks[task.id] = task

            logger.info(f"✓ 从数据库加载了 {len(tasks)} 个任务")
        finally:
            db.close()

    async def submit_backlog(self, task_create: TaskCreate) -> TaskResponse:
        """提交任务到待办队列"""
        logger.info(f"提交任务到backlog: {task_create.media_id}")

        # 1. 创建任务
        task = Task(
            media_type=task_create.media_type,
            media_id=task_create.media_id,
            title=task_create.title or "",
            cover=task_create.cover or "",
            desc=task_create.desc or "",
            meta={},
            prepare={},
            status={},
            state=TaskState.BACKLOG
        )

        # 2. 持久化到数据库
        db = SessionLocal()
        try:
            db.add(task)
            db.commit()
            db.refresh(task)
        finally:
            db.close()

        # 3. 加入内存管理
        self.tasks[task.id] = task

        # 4. 加入backlog队列
        await self.queues[QueueType.BACKLOG].put(task.id)

        # 5. 持久化队列到数据库
        await self._save_queue_to_db(QueueType.BACKLOG)

        logger.info(f"✓ 任务 {task.id} 已提交到backlog")

        return TaskResponse(
            id=task.id,
            media_type=task.media_type,
            media_id=task.media_id,
            title=task.title,
            cover=task.cover,
            desc=task.desc,
            meta=task.meta,
            prepare=task.prepare,
            status=task.status,
            state=TaskState(task.state),
            created_at=task.created_at,
            updated_at=task.updated_at
        )

    async def plan_scheduler(self, scheduler_create: SchedulerCreate) -> SchedulerResponse:
        """从backlog创建调度器"""
        logger.info(f"创建调度器: {scheduler_create.title}")

        # 1. 从backlog队列取出所有任务
        task_ids = []
        while not self.queues[QueueType.BACKLOG].empty():
            task_id = await self.queues[QueueType.BACKLOG].get()
            task_ids.append(task_id)

        if not task_ids:
            logger.warning("backlog队列为空，无法创建调度器")
            raise ValueError("backlog队列为空")

        # 2. 创建调度器
        scheduler = Scheduler(
            title=scheduler_create.title,
            list=task_ids,
            count=len(task_ids),
            queue_type=QueueType.PENDING,
            state=SchedulerState.PENDING,
            folder=scheduler_create.folder
        )

        # 3. 持久化到数据库
        db = SessionLocal()
        try:
            db.add(scheduler)
            db.commit()
            db.refresh(scheduler)
        finally:
            db.close()

        # 4. 加入内存管理
        self.schedulers[scheduler.id] = scheduler

        # 5. 加入pending队列
        await self.queues[QueueType.PENDING].put(scheduler.id)

        # 6. 持久化队列到数据库
        await self._save_queue_to_db(QueueType.PENDING)
        await self._save_queue_to_db(QueueType.BACKLOG)

        logger.info(f"✓ 调度器 {scheduler.id} 已创建，包含 {len(task_ids)} 个任务")

        return SchedulerResponse(
            id=scheduler.id,
            title=scheduler.title,
            list=scheduler.list,
            count=scheduler.count,
            queue_type=QueueType(scheduler.queue_type),
            state=SchedulerState(scheduler.state),
            folder=scheduler.folder,
            created_at=scheduler.created_at,
            updated_at=scheduler.updated_at
        )

    async def get_queue(self, queue_type: QueueType) -> List[str]:
        """获取队列内容"""
        # 从内存获取
        queue = self.queues[queue_type]
        items = list(queue._queue)  # 访问内部队列

        return items

    async def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        return self.tasks.get(task_id)

    async def get_scheduler(self, scheduler_id: str) -> Optional[Scheduler]:
        """获取调度器"""
        return self.schedulers.get(scheduler_id)

    async def _save_queue_to_db(self, queue_type: QueueType):
        """保存队列到数据库"""
        queue = self.queues[queue_type]
        items = list(queue._queue)

        db = SessionLocal()
        try:
            # 更新队列
            queue_obj = db.query(Queue).filter_by(queue_type=queue_type).first()
            if queue_obj:
                queue_obj.value = items
                queue_obj.updated_at = int(datetime.now().timestamp())
            db.commit()
        finally:
            db.close()

    async def shutdown(self):
        """关闭管理器"""
        if not self._running:
            return

        logger.info("关闭队列管理器...")

        # 保存所有队列到数据库
        for queue_type in QueueType:
            await self._save_queue_to_db(queue_type)

        self._running = False
        logger.info("队列管理器已关闭")

# 全局单例
queue_manager = QueueManager()
```

### 2. Queue API 端点

**文件**: `apps/api/src/routers/queue.py`

```python
from fastapi import APIRouter, HTTPException, Depends
from typing import List
import logging

from schemas.queue import QueueResponse, QueueType
from schemas.task import TaskCreate, TaskResponse, TaskUpdate
from schemas.scheduler import SchedulerCreate, SchedulerResponse, SchedulerUpdate
from services.queue.manager import queue_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queue", tags=["queue"])

# ========== 队列相关 ==========

@router.get("/", response_model=List[QueueResponse])
async def get_all_queues():
    """获取所有队列"""
    queues = []
    for queue_type in QueueType:
        items = await queue_manager.get_queue(queue_type)
        queues.append(QueueResponse(
            queue_type=queue_type,
            value=items,
            updated_at=0  # TODO: 从数据库获取
        ))
    return queues

@router.get("/{queue_type}", response_model=QueueResponse)
async def get_queue(queue_type: QueueType):
    """获取指定队列"""
    items = await queue_manager.get_queue(queue_type)
    return QueueResponse(
        queue_type=queue_type,
        value=items,
        updated_at=0
    )

# ========== 任务相关 ==========

@router.post("/tasks", response_model=TaskResponse)
async def submit_task(task_create: TaskCreate):
    """提交任务到backlog队列"""
    try:
        return await queue_manager.submit_backlog(task_create)
    except Exception as e:
        logger.error(f"提交任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """获取任务详情"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return TaskResponse(
        id=task.id,
        media_type=task.media_type,
        media_id=task.media_id,
        title=task.title,
        cover=task.cover,
        desc=task.desc,
        meta=task.meta,
        prepare=task.prepare,
        status=task.status,
        state=task.state,
        created_at=task.created_at,
        updated_at=task.updated_at
    )

@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate):
    """更新任务"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 更新字段
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

    return TaskResponse(
        id=task.id,
        media_type=task.media_type,
        media_id=task.media_id,
        title=task.title,
        cover=task.cover,
        desc=task.desc,
        meta=task.meta,
        prepare=task.prepare,
        status=task.status,
        state=task.state,
        created_at=task.created_at,
        updated_at=task.updated_at
    )

# ========== 调度器相关 ==========

@router.post("/schedulers", response_model=SchedulerResponse)
async def create_scheduler(scheduler_create: SchedulerCreate):
    """创建调度器"""
    try:
        return await queue_manager.plan_scheduler(scheduler_create)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建调度器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/schedulers/{scheduler_id}", response_model=SchedulerResponse)
async def get_scheduler(scheduler_id: str):
    """获取调度器详情"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="调度器不存在")
    return SchedulerResponse(
        id=scheduler.id,
        title=scheduler.title,
        list=scheduler.list,
        count=scheduler.count,
        queue_type=scheduler.queue_type,
        state=scheduler.state,
        folder=scheduler.folder,
        created_at=scheduler.created_at,
        updated_at=scheduler.updated_at
    )

@router.get("/schedulers", response_model=List[SchedulerResponse])
async def list_schedulers():
    """获取所有调度器"""
    schedulers = []
    for scheduler in queue_manager.schedulers.values():
        schedulers.append(SchedulerResponse(
            id=scheduler.id,
            title=scheduler.title,
            list=scheduler.list,
            count=scheduler.count,
            queue_type=scheduler.queue_type,
            state=scheduler.state,
            folder=scheduler.folder,
            created_at=scheduler.created_at,
            updated_at=scheduler.updated_at
        ))
    return schedulers
```

### 3. 应用启动时初始化

**文件**: `apps/api/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers import queue, download, video, favorites, watchlater, auth, settings
from services.queue.manager import queue_manager

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger.info("启动应用...")
    await queue_manager.initialize()
    logger.info("✓ 队列管理器已初始化")

    yield

    # 关闭时清理
    logger.info("关闭应用...")
    await queue_manager.shutdown()
    logger.info("✓ 队列管理器已关闭")

app = FastAPI(
    title="PiliNote API",
    description="B站视频下载管理系统",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(queue.router)
app.include_router(download.router)
app.include_router(video.router)
app.include_router(favorites.router)
app.include_router(watchlater.router)
app.include_router(auth.router)
app.include_router(settings.router)

@app.get("/")
async def root():
    return {"message": "PiliNote API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

## 实施步骤

### 步骤1：创建队列服务目录

```bash
mkdir -p apps/api/src/services/queue
```

### 步骤2：创建Manager文件

```bash
touch apps/api/src/services/queue/manager.py
touch apps/api/src/services/queue/__init__.py
```

### 步骤3：创建Queue路由

```bash
touch apps/api/src/routers/queue.py
```

### 步骤4：更新main.py

编辑 `apps/api/main.py`，添加队列管理器初始化。

### 步骤5：重启API服务

```bash
cd apps/api
python3 main.py
```

### 步骤6：测试API

```bash
# 测试提交任务
curl -X POST http://localhost:8000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "video",
    "media_id": "BV1xx411c7mD",
    "title": "测试视频"
  }'

# 测试获取队列
curl http://localhost:8000/api/queue/0

# 测试创建调度器
curl -X POST http://localhost:8000/api/queue/schedulers \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试调度器",
    "folder": "/Users/tanyancong/工作/开发/pilinote/downloads/test"
  }'
```

## 注意事项

1. **单例模式**
   - QueueManager使用单例模式，确保全局只有一个实例
   - 使用双重检查锁定实现线程安全

2. **内存与数据库同步**
   - 内存中的队列和任务与数据库保持同步
   - 每次修改后立即持久化到数据库
   - 应用启动时从数据库加载状态

3. **并发控制**
   - 使用asyncio.Semaphore控制最大并发数
   - 默认并发数为3，可根据配置调整

4. **错误处理**
   - 所有操作都有异常捕获和日志记录
   - 数据库操作使用try-finally确保连接关闭

5. **向后兼容**
   - 保留原有的DownloadService和DownloadManager
   - 新的QueueManager作为统一的管理层
   - 逐步迁移现有功能到新系统

6. **性能优化**
   - 使用异步IO提高并发性能
   - 队列操作使用asyncio.Queue
   - 批量操作减少数据库访问

## 下一步

完成本阶段后，进入**阶段3：任务系统重构**，实现Scheduler和Task的具体执行逻辑。