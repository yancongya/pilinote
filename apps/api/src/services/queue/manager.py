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

        # 4. Update in-memory tasks
        for task_id in task_ids:
            if task_id in self.tasks:
                self.tasks[task_id].scheduler_id = scheduler_id
                self.tasks[task_id].state = TaskState.PENDING

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

        self._running = False
        logger.info("Queue manager shutdown")


# Global singleton
queue_manager = QueueManager()