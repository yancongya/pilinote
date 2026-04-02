import asyncio
from fastapi import APIRouter, HTTPException
from typing import List, Optional, Any
from datetime import datetime
import logging
from pydantic import BaseModel

from src.schemas.queue import QueueResponse, QueueType
from src.schemas.task import TaskCreate, TaskResponse, TaskUpdate, TaskState
from src.schemas.scheduler import SchedulerCreate, SchedulerResponse, SchedulerUpdate
from src.services.queue.manager import queue_manager
from src.services.queue.scheduler import SchedulerService
from src.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queue", tags=["queue"])


class ApiResponse(BaseModel):
    """统一的API响应格式"""
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None
    code: Optional[int] = None


# ========== Task APIs ==========

@router.get("/tasks", response_model=ApiResponse)
async def get_all_tasks():
    """Get all tasks"""
    try:
        tasks = []
        for task in queue_manager.tasks.values():
            tasks.append(TaskResponse(
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
                subtasks=[],
                created_at=task.created_at,
                updated_at=task.updated_at
            ))
        return ApiResponse(
            success=True,
            data=tasks
        )
    except Exception as e:
        logger.error(f"Failed to get tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        logger.error(f"Failed to submit task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}", response_model=ApiResponse)
async def get_task(task_id: str):
    """Get task details"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return ApiResponse(
        success=True,
        data=TaskResponse(
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
            subtasks=[],
            created_at=task.created_at,
            updated_at=task.updated_at
        )
    )


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

    return ApiResponse(
        success=True,
        message="任务更新成功",
        data=TaskResponse(
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
            subtasks=[],
            created_at=task.created_at,
            updated_at=task.updated_at
        )
    )

    # Persist to database
    db = SessionLocal()
    try:
        db.commit()
    finally:
        db.close()

    # Broadcast WebSocket event
    from src.routers.websocket import broadcast_task_updated
    cancelled = task.state == 6  # CANCELLED state
    broadcast_task_updated(task_id, str(task.state), cancelled)

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


# ========== Scheduler APIs ==========

@router.post("/schedulers", response_model=ApiResponse)
async def create_scheduler(scheduler_create: SchedulerCreate):
    """Create scheduler"""
    try:
        scheduler = await queue_manager.plan_scheduler(scheduler_create)
        return ApiResponse(
            success=True,
            message="调度器创建成功",
            data=scheduler
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create scheduler: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}", response_model=ApiResponse)
async def delete_task(task_id: str):
    """Delete task from queue"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Remove from all queues
    await queue_manager.remove_task(task_id)

    # Broadcast WebSocket event
    from src.routers.websocket import broadcast_task_updated
    broadcast_task_updated(task_id, 'cancelled', cancelled=True)

    return ApiResponse(
        success=True,
        message="任务删除成功"
    )


@router.get("/schedulers", response_model=ApiResponse)
async def list_schedulers():
    """Get all schedulers"""
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
    return ApiResponse(
        success=True,
        data=schedulers
    )


@router.get("/schedulers/{scheduler_id}", response_model=ApiResponse)
async def get_scheduler(scheduler_id: str):
    """Get scheduler details"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")
    return ApiResponse(
        success=True,
        data=SchedulerResponse(
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
    )


# ========== Scheduler Execution APIs ==========

@router.post("/schedulers/{scheduler_id}/start")
async def start_scheduler(scheduler_id: str):
    """Start scheduler execution"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")

    # Create scheduler service
    scheduler_service = SchedulerService(scheduler)

    # Initialize
    await scheduler_service.initialize()

    # Prepare tasks
    await scheduler_service.prepare()

    # Dispatch tasks (run in background)
    asyncio.create_task(scheduler_service.dispatch())

    return ApiResponse(
        success=True,
        message="调度器启动成功"
    )


@router.post("/schedulers/{scheduler_id}/pause", response_model=ApiResponse)
async def pause_scheduler(scheduler_id: str):
    """Pause scheduler"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")

    scheduler_service = SchedulerService(scheduler)
    await scheduler_service.pause()

    return ApiResponse(
        success=True,
        message="调度器暂停成功"
    )


@router.post("/schedulers/{scheduler_id}/resume", response_model=ApiResponse)
async def resume_scheduler(scheduler_id: str):
    """Resume scheduler"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")

    scheduler_service = SchedulerService(scheduler)
    await scheduler_service.resume()

    return ApiResponse(
        success=True,
        message="调度器恢复成功"
    )


@router.post("/schedulers/{scheduler_id}/cancel", response_model=ApiResponse)
async def cancel_scheduler(scheduler_id: str):
    """Cancel scheduler"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")

    scheduler_service = SchedulerService(scheduler)
    await scheduler_service.cancel()

    return ApiResponse(
        success=True,
        message="调度器取消成功"
    )


# ========== Queue APIs ==========

@router.get("/", response_model=List[QueueResponse])
async def get_all_queues():
    """Get all queues"""
    queues = []
    for queue_type in QueueType:
        items = await queue_manager.get_queue(queue_type)
        queues.append(QueueResponse(
            queue_type=queue_type,
            value=items,
            updated_at=0  # TODO: Get from database
        ))
    return queues


@router.get("/{queue_type}", response_model=QueueResponse)
async def get_queue(queue_type: QueueType):
    """Get specific queue"""
    items = await queue_manager.get_queue(queue_type)
    return QueueResponse(
        queue_type=queue_type,
        value=items,
        updated_at=0
    )