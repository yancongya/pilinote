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

        # Semaphore for concurrency control
        self.semaphore = asyncio.Semaphore(3)  # Max concurrent downloads

        # Runtime flag
        self._running = False

    async def initialize(self):
        """Initialize manager"""
        if self._running:
            return

        logger.info("Initializing queue manager...")

        # Load queues from database
        await self._load_queues_from_db()

        # Load schedulers from database
        await self._load_schedulers_from_db()

        # Load tasks from database
        await self._load_tasks_from_db()

        self._running = True
        logger.info("Queue manager initialized")

    async def _load_queues_from_db(self):
        """Load queues from database"""
        db = SessionLocal()
        try:
            queues = db.query(Queue).all()
            for queue in queues:
                queue_type = QueueType(queue.queue_type)
                task_ids = queue.value or []

                # Recreate queue
                self.queues[queue_type] = asyncio.Queue()
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

    async def submit_backlog(self, task_create: TaskCreate) -> TaskResponse:
        """Submit task to backlog queue"""
        logger.info(f"Submitting task to backlog: {task_create.media_id}")

        # 1. Create task
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
            subtasks=[],
            created_at=task.created_at,
            updated_at=task.updated_at
        )

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
        try:
            db.add(scheduler)
            db.commit()
            db.refresh(scheduler)
        finally:
            db.close()

        # 4. Add to in-memory management
        self.schedulers[scheduler.id] = scheduler

        # 5. Add to pending queue
        await self.queues[QueueType.PENDING].put(scheduler.id)

        # 6. Persist queue to database
        await self._save_queue_to_db(QueueType.PENDING)
        await self._save_queue_to_db(QueueType.BACKLOG)

        logger.info(f"Scheduler {scheduler.id} created with {len(task_ids)} tasks")

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

    async def _save_queue_to_db(self, queue_type: QueueType):
        """Save queue to database"""
        queue = self.queues[queue_type]
        items = list(queue._queue)

        db = SessionLocal()
        try:
            # Update queue
            queue_obj = db.query(Queue).filter_by(queue_type=queue_type).first()
            if queue_obj:
                queue_obj.value = items
                queue_obj.updated_at = int(datetime.now().timestamp())
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

        self._running = False
        logger.info("Queue manager shutdown")


# Global singleton
queue_manager = QueueManager()