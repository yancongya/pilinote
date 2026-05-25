import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import logging

from src.models.task import Task, TaskState
from src.models.scheduler import Scheduler, SchedulerState
from src.models.queue import Queue, QueueType
from src.schemas.task import TaskCreate, TaskResponse
from src.schemas.scheduler import SchedulerCreate, SchedulerResponse
from src.schemas.queue import QueueResponse
from src.database import SessionLocal
from src.config import settings as app_settings

logger = logging.getLogger(__name__)


class QueueManager:
    """Unified queue manager"""

    _instance: Optional['QueueManager'] = None
    _lock = asyncio.Lock()

    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True

        # In-memory schedulers and tasks
        self.schedulers: Dict[str, Scheduler] = {}
        self.tasks: Dict[str, Task] = {}

        # Four-level queues
        self.queues: Dict[QueueType, asyncio.Queue] = {
            QueueType.BACKLOG: asyncio.Queue(),
            QueueType.PENDING: asyncio.Queue(),
            QueueType.DOING: asyncio.Queue(),
            QueueType.COMPLETE: asyncio.Queue()
        }

        # Runtime flag
        self._running = False
        
        # 全局并发控制服务
        from src.services.concurrency_control import concurrency_control
        self.concurrency_control = concurrency_control

        # 队列调度器任务
        self._scheduler_task: Optional[asyncio.Task] = None

    async def initialize(self):
        """Initialize manager"""
        if self._running:
            return

        logger.info("Initializing queue manager...")

        # 启动全局并发控制服务
        await self.concurrency_control.start()
        logger.info("✓ Concurrency control service started")

        # Load queues from database
        await self._load_queues_from_db()

        # Load schedulers from database
        await self._load_schedulers_from_db()

        # Load tasks from database
        await self._load_tasks_from_db()

        # 启动队列调度器
        self._scheduler_task = asyncio.create_task(self._run_scheduler())
        logger.info("✓ Queue scheduler started")

        self._running = True
        logger.info("Queue manager initialized")

    async def _load_queues_from_db(self):
        """Load queues from database"""
        db = SessionLocal()
        try:
            # Recreate queues
            for queue_type in QueueType:
                self.queues[queue_type] = asyncio.Queue()

            # Load queue data from database
            queues = db.query(Queue).all()
            for queue in queues:
                queue_type = QueueType(queue.queue_type)
                task_ids = queue.value or []
                for task_id in task_ids:
                    await self.queues[queue_type].put(task_id)

            logger.info(f"Loaded {len(queues)} queues from database")
        finally:
            db.close()

    async def _load_schedulers_from_db(self):
        """Load schedulers from database"""
        db = SessionLocal()
        try:
            schedulers = db.query(Scheduler).all()
            for scheduler in schedulers:
                scheduler.list = self._unique_task_ids(scheduler.list)
                scheduler.count = len(scheduler.list)
                self.schedulers[scheduler.id] = scheduler

            logger.info(f"Loaded {len(schedulers)} schedulers from database")
        finally:
            db.close()

    async def _load_tasks_from_db(self):
        """Load tasks from database"""
        db = SessionLocal()
        try:
            tasks = db.query(Task).all()
            for task in tasks:
                self.tasks[task.id] = task

            logger.info(f"Loaded {len(tasks)} tasks from database")
        finally:
            db.close()

        # After loading tasks, ensure all BACKLOG tasks are in backlog queue
        await self._ensure_backlog_consistency()

    async def _ensure_backlog_consistency(self):
        """Ensure all BACKLOG tasks are in backlog queue"""
        # Get all tasks with BACKLOG state
        backlog_task_ids = [
            task_id for task_id, task in self.tasks.items()
            if task.state == TaskState.BACKLOG
        ]

        # Check which are already in queue
        queue_items = list(self.queues[QueueType.BACKLOG]._queue)
        existing_ids = set(queue_items)

        # Add missing tasks to queue
        added_count = 0
        for task_id in backlog_task_ids:
            if task_id not in existing_ids:
                await self.queues[QueueType.BACKLOG].put(task_id)
                added_count += 1

        if added_count > 0:
            logger.info(f"Added {added_count} BACKLOG tasks to queue")
            await self._save_queue_to_db(QueueType.BACKLOG)

    async def submit_backlog(self, task_create: TaskCreate) -> TaskResponse:
        """Submit task to backlog queue"""
        logger.info(f"Submitting task to backlog: {task_create.media_id}")
        print(f"[DEBUG] submit_backlog called with meta: {task_create.meta}")
        logger.info(f"Task meta: {task_create.meta}")

        # 检查是否已经存在同一媒体分集的任务。多 P 视频共享同一个 BVID，
        # 需要继续比较 cid/page，不能只按 media_id 去重。
        db = SessionLocal()
        try:
            existing_task = self._find_existing_task(db, task_create)
            if existing_task:
                logger.info(f"Task for {task_create.media_id} already exists, skipping creation")
                self._merge_task_create_into_existing(existing_task, task_create)
                db.commit()
                db.refresh(existing_task)
                if existing_task.id in self.tasks:
                    self.tasks[existing_task.id].title = existing_task.title
                    self.tasks[existing_task.id].cover = existing_task.cover
                    self.tasks[existing_task.id].desc = existing_task.desc
                    self.tasks[existing_task.id].meta = existing_task.meta
                    self.tasks[existing_task.id].updated_at = existing_task.updated_at
                # 返回已存在的任务
                return TaskResponse(
                    id=existing_task.id,
                    media_type=existing_task.media_type,
                    media_id=existing_task.media_id,
                    title=existing_task.title,
                    cover=existing_task.cover,
                    desc=existing_task.desc,
                    meta=existing_task.meta,
                    prepare=existing_task.prepare,
                    status=existing_task.status,
                    state=TaskState(existing_task.state),
                    scheduler_id=existing_task.scheduler_id,
                    subtasks=[],
                    created_at=existing_task.created_at,
                    updated_at=existing_task.updated_at
                )
        finally:
            db.close()

        # 1. Create task
        task = Task(
            media_type=task_create.media_type,
            media_id=task_create.media_id,
            title=task_create.title or "",
            cover=task_create.cover or "",
            desc=task_create.desc or "",
            meta=task_create.meta or {},  # Use meta from request
            prepare={},
            status={},
            state=TaskState.BACKLOG
        )
        print(f"[DEBUG] Task created with meta: {task.meta}")

        # 2. Persist to database
        db = SessionLocal()
        try:
            db.add(task)
            db.commit()
            db.refresh(task)
        finally:
            db.close()

        # 3. Add to in-memory management
        self.tasks[task.id] = task

        # 4. Add to backlog queue
        await self.queues[QueueType.BACKLOG].put(task.id)

        # 5. Persist queue to database
        await self._save_queue_to_db(QueueType.BACKLOG)

        logger.info(f"Task {task.id} submitted to backlog")

        # 6. Broadcast WebSocket event
        from src.routers.websocket import broadcast_task_created
        task_data = {
            "id": task.id,
            "media_type": task.media_type,
            "media_id": task.media_id,
            "title": task.title,
            "cover": task.cover,
            "state": "backlog"
        }
        broadcast_task_created(task_data)

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
            scheduler_id=task.scheduler_id,
            subtasks=[],
            created_at=task.created_at,
            updated_at=task.updated_at
        )

    def _find_existing_task(self, db, task_create: TaskCreate) -> Optional[Task]:
        """Find an existing task matching the media item identity."""
        candidates = db.query(Task).filter_by(
            media_type=task_create.media_type.value,
            media_id=task_create.media_id
        ).all()

        requested_identity = self._task_page_identity(task_create.meta or {})
        requested_meta = task_create.meta or {}
        requested_is_scheduler_item = bool(
            requested_meta.get("output_subdir")
            or requested_meta.get("collection_title")
            or requested_meta.get("series_title")
        )
        for task in candidates:
            if task.scheduler_id and not requested_is_scheduler_item:
                continue
            existing_identity = self._task_page_identity(task.meta or {})
            if requested_identity is None and existing_identity is None:
                return task
            if requested_identity is not None and requested_identity == existing_identity:
                return task

        return None

    @staticmethod
    def _merge_task_create_into_existing(task: Task, task_create: TaskCreate) -> None:
        """Merge newer request metadata into an existing task reused by identity."""
        incoming_meta = task_create.meta or {}
        if incoming_meta:
            task.meta = {**(task.meta or {}), **incoming_meta}

        if task_create.cover:
            task.cover = task_create.cover
            task.meta = {**(task.meta or {}), "pic": task.meta.get("pic") or task_create.cover}

        if task_create.title:
            task.title = task_create.title

        if task_create.desc:
            task.desc = task_create.desc

        task.updated_at = int(datetime.now().timestamp())

    @staticmethod
    def _task_page_identity(meta: dict) -> Optional[tuple[str, str]]:
        cid = meta.get("cid")
        if cid not in (None, ""):
            return ("cid", str(cid))

        page = meta.get("page")
        if page not in (None, ""):
            return ("page", str(page))

        return None

    @staticmethod
    def _unique_task_ids(task_ids: List[str]) -> List[str]:
        return list(dict.fromkeys(task_id for task_id in task_ids if task_id))

    async def plan_scheduler(self, scheduler_create: SchedulerCreate) -> SchedulerResponse:
        """Create scheduler from backlog"""
        logger.info(f"Creating scheduler: {scheduler_create.title}")

        # 1. Get task IDs
        if scheduler_create.task_ids:
            # Use provided task IDs
            task_ids = scheduler_create.task_ids
        else:
            # Get all tasks from backlog queue
            task_ids = []
            while not self.queues[QueueType.BACKLOG].empty():
                task_id = await self.queues[QueueType.BACKLOG].get()
                task_ids.append(task_id)

        if not task_ids:
            logger.warning("Backlog queue is empty, cannot create scheduler")
            raise ValueError("Backlog queue is empty")

        task_ids = self._unique_task_ids(task_ids)

        # 2. Create scheduler
        scheduler = Scheduler(
            title=scheduler_create.title,
            list=task_ids,
            count=len(task_ids),
            queue_type=QueueType.PENDING,
            state=SchedulerState.PENDING,
            folder=scheduler_create.folder
        )

        # 3. Persist to database
        db = SessionLocal()
        scheduler_id = None
        title = None
        folder = None
        created_at = None
        updated_at = None
        try:
            db.add(scheduler)
            db.commit()
            db.refresh(scheduler)
            
            # Save all values before closing the session
            scheduler_id = scheduler.id
            title = scheduler.title
            folder = scheduler.folder
            created_at = scheduler.created_at
            updated_at = scheduler.updated_at

            # Update tasks with scheduler_id
            for task_id in task_ids:
                task = db.query(Task).filter_by(id=task_id).first()
                if task:
                    task.scheduler_id = scheduler.id
                    task.state = TaskState.PENDING  # Update state to PENDING

            db.commit()
        finally:
            db.close()

        # 4. Update in-memory tasks and broadcast events
        from src.routers.websocket import broadcast_task_updated
        for task_id in task_ids:
            if task_id in self.tasks:
                self.tasks[task_id].scheduler_id = scheduler_id
                self.tasks[task_id].state = TaskState.PENDING
                # Broadcast task update event
                broadcast_task_updated(task_id, str(TaskState.PENDING), cancelled=False)

        # 5. Add to in-memory management - create a new object to avoid Session binding issue
        self.schedulers[scheduler_id] = Scheduler(
            id=scheduler_id,
            title=title,
            list=task_ids,
            count=len(task_ids),
            queue_type=QueueType.PENDING,
            state=SchedulerState.PENDING,
            folder=folder,
            created_at=created_at,
            updated_at=updated_at
        )

        # 6. Add to pending queue
        await self.queues[QueueType.PENDING].put(scheduler_id)

        # 6. Persist queue to database
        await self._save_queue_to_db(QueueType.PENDING)
        await self._save_queue_to_db(QueueType.BACKLOG)

        logger.info(f"Scheduler {scheduler_id} created with {len(task_ids)} tasks")

        return SchedulerResponse(
            id=scheduler_id,
            title=title,
            list=task_ids,
            count=len(task_ids),
            queue_type=QueueType.PENDING,
            state=SchedulerState.PENDING,
            folder=folder,
            created_at=created_at,
            updated_at=updated_at
        )

    async def get_queue(self, queue_type: QueueType) -> List[str]:
        """Get queue content"""
        # Get from memory
        queue = self.queues[queue_type]
        items = list(queue._queue)  # Access internal queue

        return items

    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get task"""
        return self.tasks.get(task_id)

    async def get_scheduler(self, scheduler_id: str) -> Optional[Scheduler]:
        """Get scheduler"""
        return self.schedulers.get(scheduler_id)

    async def remove_task(self, task_id: str):
        """Remove task from all queues and database"""
        logger.info(f"Removing task: {task_id}")

        # 1. Remove from in-memory tasks
        if task_id in self.tasks:
            del self.tasks[task_id]

        # 2. Remove from all queues
        for queue_type in QueueType:
            queue = self.queues[queue_type]
            # Create new queue without the task_id
            new_items = []
            while not queue.empty():
                item = await queue.get()
                if item != task_id:
                    new_items.append(item)
            # Put items back
            for item in new_items:
                await queue.put(item)

        # 3. Remove from database
        db = SessionLocal()
        try:
            # Delete task
            task = db.query(Task).filter_by(id=task_id).first()
            if task:
                db.delete(task)

            # Save all queues to database
            for queue_type in QueueType:
                queue = self.queues[queue_type]
                items = list(queue._queue)
                queue_obj = db.query(Queue).filter_by(queue_type=queue_type).first()
                if queue_obj:
                    queue_obj.value = items
                    queue_obj.updated_at = int(datetime.now().timestamp())

            db.commit()
            logger.info(f"Task {task_id} removed from database and queues")
        finally:
            db.close()

    async def delete_scheduler(self, scheduler_id: str):
        """Delete scheduler and all its tasks"""
        logger.info(f"Deleting scheduler: {scheduler_id}")

        # Get scheduler
        scheduler = self.schedulers.get(scheduler_id)
        if not scheduler:
            logger.warning(f"Scheduler {scheduler_id} not found")
            return

        # 0. Delete local files (before removing from database)
        try:
            from pathlib import Path
            import shutil
            from src.services.settings_service import SettingsService
            
            # 从设置中获取临时路径和下载路径
            db = SessionLocal()
            try:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                temp_path = settings.storage.temp_path or app_settings.default_temp_path
                download_path = settings.storage.download_path or app_settings.default_download_path
            finally:
                db.close()
            
            # 删除调度器文件夹（整个系列的文件夹）
            scheduler_folder = Path(scheduler.folder)
            if scheduler_folder.exists():
                logger.info(f"删除调度器文件夹: {scheduler_folder}")
                shutil.rmtree(scheduler_folder)
            
            # 删除所有任务的临时文件夹
            for task_id in scheduler.list:
                temp_folder = Path(temp_path) / task_id
                if temp_folder.exists():
                    logger.info(f"删除临时文件夹: {temp_folder}")
                    shutil.rmtree(temp_folder)
                    
        except Exception as e:
            logger.error(f"删除本地文件失败: {e}")
            # 继续删除调度器，即使删除文件失败

        # 1. Remove from in-memory schedulers
        del self.schedulers[scheduler_id]

        # 2. Remove scheduler from all queues
        for queue_type in QueueType:
            queue = self.queues[queue_type]
            new_items = []
            while not queue.empty():
                item = await queue.get()
                if item != scheduler_id:
                    new_items.append(item)
            for item in new_items:
                await queue.put(item)

        # 3. Remove all associated tasks from memory and queues
        for task_id in scheduler.list:
            # Remove from in-memory tasks
            if task_id in self.tasks:
                del self.tasks[task_id]

            # Remove from all queues
            for queue_type in QueueType:
                queue = self.queues[queue_type]
                new_items = []
                while not queue.empty():
                    item = await queue.get()
                    if item != task_id:
                        new_items.append(item)
                for item in new_items:
                    await queue.put(item)

        # 4. Remove from database
        db = SessionLocal()
        try:
            # Delete scheduler
            scheduler_obj = db.query(Scheduler).filter_by(id=scheduler_id).first()
            if scheduler_obj:
                db.delete(scheduler_obj)

            # Delete all associated tasks
            for task_id in scheduler.list:
                task = db.query(Task).filter_by(id=task_id).first()
                if task:
                    db.delete(task)

            # Save all queues to database
            for queue_type in QueueType:
                queue = self.queues[queue_type]
                items = list(queue._queue)
                queue_obj = db.query(Queue).filter_by(queue_type=queue_type).first()
                if queue_obj:
                    queue_obj.value = items
                    queue_obj.updated_at = int(datetime.now().timestamp())

            db.commit()
            logger.info(f"Scheduler {scheduler_id} and all its tasks deleted")
        finally:
            db.close()

    async def _save_queue_to_db(self, queue_type: QueueType):
        """Save queue to database"""
        queue = self.queues[queue_type]
        items = list(queue._queue)

        db = SessionLocal()
        try:
            # Update or create queue
            queue_obj = db.query(Queue).filter_by(queue_type=queue_type).first()
            if queue_obj:
                queue_obj.value = items
                queue_obj.updated_at = int(datetime.now().timestamp())
            else:
                # Create new queue record
                queue_obj = Queue(
                    queue_type=queue_type,
                    value=items,
                    updated_at=int(datetime.now().timestamp())
                )
                db.add(queue_obj)
            db.commit()
        finally:
            db.close()

    async def shutdown(self):
        """Shutdown manager"""
        if not self._running:
            return

        logger.info("Shutting down queue manager...")

        # Save all queues to database
        for queue_type in QueueType:
            await self._save_queue_to_db(queue_type)

        # 停止队列调度器
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
            logger.info("✓ Queue scheduler stopped")

        # 停止全局并发控制服务
        await self.concurrency_control.stop()
        logger.info("✓ Concurrency control service stopped")

        self._running = False
        logger.info("Queue manager shutdown")

    async def _run_scheduler(self):
        """运行队列调度器"""
        logger.info("Queue scheduler started")

        while self._running:
            try:
                # 处理BACKLOG队列 -> PENDING队列
                await self._schedule_backlog_tasks()

                # 处理PENDING队列 -> DOING队列
                await self._schedule_pending_tasks()

                # 检查已完成的调度器
                await self._check_completed_schedulers()

                # 每秒调度一次
                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Queue scheduler error: {e}")
                await asyncio.sleep(5)  # 出错后等待5秒再试

        logger.info("Queue scheduler stopped")

    async def _schedule_backlog_tasks(self):
        """将BACKLOG任务调度到PENDING队列"""
        try:
            # 获取BACKLOG队列大小
            backlog_size = self.queues[QueueType.BACKLOG].qsize()

            if backlog_size == 0:
                return

            # 限制每次处理的BACKLOG任务数量，避免阻塞
            max_process = min(backlog_size, 10)

            for _ in range(max_process):
                try:
                    # 从BACKLOG队列获取任务
                    task_id = await asyncio.wait_for(
                        self.queues[QueueType.BACKLOG].get(),
                        timeout=0.1
                    )

                    # 检查任务是否存在
                    if task_id not in self.tasks:
                        logger.warning(f"Task {task_id} not found in memory, skipping")
                        continue

                    task = self.tasks[task_id]

                    # 检查任务状态
                    if task.state != TaskState.BACKLOG:
                        logger.warning(f"Task {task_id} state is {task.state}, not BACKLOG, skipping")
                        continue

                    # 更新任务状态为PENDING
                    task.state = TaskState.PENDING
                    task.updated_at = int(datetime.now().timestamp())

                    # 添加到PENDING队列
                    await self.queues[QueueType.PENDING].put(task_id)

                    # 持久化到数据库
                    db = SessionLocal()
                    try:
                        db.merge(task)
                        db.commit()
                        logger.info(f"Task {task_id[:8]} scheduled: BACKLOG → PENDING")
                    finally:
                        db.close()

                    # 广播状态更新
                    from src.routers.websocket import broadcast_task_updated
                    broadcast_task_updated(task_id, {
                        "state": TaskState.PENDING.value,
                        "status": "pending"
                    })

                except asyncio.TimeoutError:
                    break
                except Exception as e:
                    logger.error(f"Error scheduling backlog task: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error in _schedule_backlog_tasks: {e}")

    async def _schedule_pending_tasks(self):
        """将PENDING任务调度到DOING队列"""
        try:
            # 检查当前活跃任务数量
            doing_size = self.queues[QueueType.DOING].qsize()

            # 最大并发任务数 (可以配置)
            max_concurrent = 3

            if doing_size >= max_concurrent:
                return  # 已达到并发限制

            # 计算可以调度的任务数量
            available_slots = max_concurrent - doing_size

            for _ in range(available_slots):
                try:
                    # 从PENDING队列获取任务
                    task_id = await asyncio.wait_for(
                        self.queues[QueueType.PENDING].get(),
                        timeout=0.1
                    )

                    # 检查任务是否存在
                    if task_id not in self.tasks:
                        logger.warning(f"Task {task_id} not found in memory, skipping")
                        continue

                    task = self.tasks[task_id]

                    # 检查任务状态
                    if task.state != TaskState.PENDING:
                        logger.warning(f"Task {task_id} state is {task.state}, not PENDING, skipping")
                        continue

                    # 更新任务状态为ACTIVE (DOING)
                    task.state = TaskState.ACTIVE
                    task.updated_at = int(datetime.now().timestamp())

                    # 添加到DOING队列
                    await self.queues[QueueType.DOING].put(task_id)

                    # 持久化到数据库
                    db = SessionLocal()
                    try:
                        db.merge(task)
                        db.commit()
                        logger.info(f"Task {task_id[:8]} scheduled: PENDING → DOING")
                    finally:
                        db.close()

                    # 启动任务执行
                    asyncio.create_task(self._execute_task(task_id))

                    # 广播状态更新
                    from src.routers.websocket import broadcast_task_updated
                    broadcast_task_updated(task_id, {
                        "state": TaskState.ACTIVE.value,
                        "status": "downloading"
                    })

                except asyncio.TimeoutError:
                    break
                except Exception as e:
                    logger.error(f"Error scheduling pending task: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error in _schedule_pending_tasks: {e}")

    async def _execute_task(self, task_id: str):
        """执行任务"""
        try:
            task = self.tasks.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found for execution")
                return

            logger.info(f"Executing task {task_id}")

            # 创建TaskService并执行
            from src.services.queue.task import TaskService
            task_service = TaskService(task)
            await task_service.prepare()

            from pathlib import Path
            from src.services.settings_service import SettingsService

            db = SessionLocal()
            try:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                temp_path = settings.storage.temp_path or "temp"
                download_path = settings.storage.download_path or "downloads"
            finally:
                db.close()

            temp_dir = Path(temp_path) / task_id
            output_dir = Path(download_path)
            temp_dir.mkdir(parents=True, exist_ok=True)
            output_dir.mkdir(parents=True, exist_ok=True)

            # 执行任务
            success = await task_service.execute(temp_dir, output_dir)

            if success:
                # 任务成功完成
                await self._complete_task(task_id, "completed")
            else:
                # 任务执行失败
                await self._complete_task(task_id, "failed")

        except Exception as e:
            logger.error(f"Task execution failed {task_id}: {e}")
            await self._complete_task(task_id, "failed", str(e))

    async def _complete_task(self, task_id: str, status: str, error_message: str = None):
        """完成任务处理"""
        try:
            task = self.tasks.get(task_id)
            if not task:
                return

            # 从DOING队列移除
            try:
                # 尝试从DOING队列移除（非阻塞）
                doing_queue = list(self.queues[QueueType.DOING]._queue)
                if task_id in doing_queue:
                    doing_queue.remove(task_id)
                    self.queues[QueueType.DOING]._queue.clear()
                    for item in doing_queue:
                        self.queues[QueueType.DOING]._queue.append(item)
            except:
                pass

            # 更新任务状态
            if status == "completed":
                task.state = TaskState.COMPLETED
            elif status == "failed":
                task.state = TaskState.FAILED
                if error_message:
                    task.error_message = error_message

            task.updated_at = int(datetime.now().timestamp())
            if status == "completed":
                task.completed_at = task.updated_at

            # 添加到COMPLETE队列
            await self.queues[QueueType.COMPLETE].put(task_id)

            # 持久化到数据库
            db = SessionLocal()
            try:
                db.merge(task)
                db.commit()
                logger.info(f"Task {task_id[:8]} {status}")
            finally:
                db.close()

            # 广播状态更新
            from src.routers.websocket import broadcast_task_updated
            broadcast_task_updated(task_id, {
                "state": TaskState(task.state).value,
                "status": status,
                "error_message": error_message
            })

        except Exception as e:
            logger.error(f"Error completing task {task_id}: {e}")

    async def _check_completed_schedulers(self):
        """检查已完成的调度器"""
        try:
            for scheduler_id, scheduler in list(self.schedulers.items()):
                if scheduler.state == 1:  # ACTIVE
                    # 检查调度器是否所有任务都已完成
                    all_completed = True
                    for task_id in scheduler.list:
                        task = self.tasks.get(task_id)
                        if task and task.state not in [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED]:
                            all_completed = False
                            break

                    if all_completed:
                        # 更新调度器状态
                        scheduler.state = 2  # COMPLETED
                        scheduler.updated_at = int(datetime.now().timestamp())

                        # 持久化到数据库
                        db = SessionLocal()
                        try:
                            db.merge(scheduler)
                            db.commit()
                            logger.info(f"Scheduler {scheduler_id[:8]} completed")
                        finally:
                            db.close()

        except Exception as e:
            logger.error(f"Error checking completed schedulers: {e}")


# Global singleton
queue_manager = QueueManager()
