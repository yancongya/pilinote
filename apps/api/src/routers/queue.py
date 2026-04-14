import asyncio
from fastapi import APIRouter, HTTPException, Request, Body
from typing import List, Optional, Any
from datetime import datetime
import logging
from pydantic import BaseModel

from src.schemas.queue import QueueResponse, QueueType
from src.schemas.task import TaskCreate, TaskResponse, TaskUpdate, TaskState
from src.schemas.scheduler import SchedulerCreate, SchedulerResponse, SchedulerUpdate
from src.services.queue.manager import queue_manager
from src.services.queue.scheduler import SchedulerService
from src.models.task import Task
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
                scheduler_id=task.scheduler_id,
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
    print(f"[DEBUG] submit_task called with: {task_create}")
    print(f"[DEBUG] task_create.meta: {task_create.meta}")
    logger.info(f"submit_task called with meta: {task_create.meta}")

    try:
        # 验证必填字段
        if not task_create.media_id or not task_create.media_id.strip():
            raise HTTPException(
                status_code=400,
                detail="media_id 不能为空"
            )

        # 验证media_type
        if task_create.media_type not in ["video", "bangumi", "music", "music_list", "lesson", "watch_later", "favorite", "opus", "opus_list", "user_video", "user_opus", "user_audio"]:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的 media_type: {task_create.media_type}"
            )

        # 验证meta字段（如果提供）
        if task_create.meta is not None and not isinstance(task_create.meta, dict):
            raise HTTPException(
                status_code=400,
                detail="meta 必须是字典类型"
            )

        task = await queue_manager.submit_backlog(task_create)
        return ApiResponse(
            success=True,
            message="任务提交成功",
            data=task
        )
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"参数验证失败: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to submit task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"任务提交失败: {str(e)}")


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
            scheduler_id=task.scheduler_id,
            subtasks=[],
            created_at=task.created_at,
            updated_at=task.updated_at
        )
    )


@router.get("/tasks/{task_id}/file-size", response_model=ApiResponse)
async def get_task_file_size(task_id: str):
    """获取任务的实时文件大小信息（总大小｜视频大小｜元数据大小）"""
    from pathlib import Path
    from src.services.settings_service import SettingsService

    try:
        logger.info(f"获取任务文件大小: task_id={task_id}")

        # 获取任务
        task = await queue_manager.get_task(task_id)
        if not task:
            logger.warning(f"任务不存在: task_id={task_id}")
            raise HTTPException(status_code=404, detail="Task not found")

        logger.info(f"任务信息: title={task.title}, scheduler_id={task.scheduler_id}")

        # 获取设置
        db = SessionLocal()
        try:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            download_path = Path(settings.storage.download_path)
            logger.info(f"下载路径: {download_path}")
        finally:
            db.close()

        # 构建任务输出目录
        if task.scheduler_id:
            # 合集任务：{download_path}/{scheduler_title}/{video_title}
            try:
                scheduler = await queue_manager.get_scheduler(task.scheduler_id)
                if scheduler:
                    output_dir = download_path / scheduler.title / task.title
                    logger.info(f"合集任务输出目录: {output_dir}")
                else:
                    output_dir = download_path / task.title
                    logger.info(f"调度器不存在，使用默认路径: {output_dir}")
            except Exception as e:
                logger.warning(f"获取调度器失败: {e}，使用默认路径")
                output_dir = download_path / task.title
        else:
            # 单个任务：{download_path}/{video_title}
            output_dir = download_path / task.title
            logger.info(f"单个任务输出目录: {output_dir}")

        # 统计文件大小
        video_size = 0
        metadata_size = 0
        total_size = 0

        if output_dir.exists():
            logger.info(f"目录存在，开始统计文件")
            for file_path in output_dir.rglob('*'):
                if file_path.is_file():
                    file_size = file_path.stat().st_size
                    # 判断是否为视频文件
                    if file_path.suffix in ['.mp4', '.mkv', '.flv', '.webm']:
                        video_size += file_size
                    else:
                        # 元数据文件（封面、头像、字幕、NFO 等）
                        metadata_size += file_size
            total_size = video_size + metadata_size
            logger.info(f"文件统计完成: video_size={video_size}, metadata_size={metadata_size}, total_size={total_size}")
        else:
            logger.warning(f"目录不存在: {output_dir}")

        # 更新数据库中的 meta 信息（缓存）
        db = SessionLocal()
        try:
            db_task = db.query(Task).filter(Task.id == task_id).first()
            if db_task:
                db_task.meta['videoSize'] = video_size
                db_task.meta['metadataSize'] = metadata_size
                db_task.meta['totalSize'] = total_size
                db.commit()
                logger.info(f"数据库已更新")
            else:
                logger.warning(f"数据库中找不到任务: task_id={task_id}")
        finally:
            db.close()

        # 返回文件大小信息
        return ApiResponse(
            success=True,
            data={
                'videoSize': video_size,
                'metadataSize': metadata_size,
                'totalSize': total_size
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task file size: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tasks/{task_id}", response_model=ApiResponse)
async def update_task(task_id: str, task_update: TaskUpdate):
    """Update task"""
    print(f"=== update_task called: task_id={task_id}, task_update={task_update} ===")
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

    print(f"=== 任务状态更新: id={task_id}, old_state={old_state}, new_state={task.state} ===")
    logger.info(f"任务状态更新: id={task_id}, old_state={old_state}, new_state={task.state}")

    # 广播 WebSocket 事件
    from src.routers.websocket import broadcast_task_updated
    cancelled = task.state == 6  # CANCELLED state
    print(f"=== 广播任务更新: task_id={task_id}, state={task.state}, cancelled={cancelled} ===")
    broadcast_task_updated(task_id, str(task.state), cancelled)

    # 当任务状态变为 active 时，直接执行任务（不使用调度器）
    if old_state != 2 and task.state == 2:  # 2 = ACTIVE
        print(f"=== 任务状态变为 active，开始执行: task_id={task_id} ===")
        logger.info(f"✓✓✓ 任务 {task_id} 状态变为 active，开始执行...")
        logger.info(f"✓✓✓ 任务信息: id={task_id}, title={task.title}, state={task.state}")
        asyncio.create_task(_execute_single_task(task_id))
    else:
        print(f"=== 任务状态未满足执行条件: old_state={old_state}, new_state={task.state} ===")
        logger.info(f"任务状态未满足执行条件: old_state={old_state}, new_state={task.state}")

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
            state=TaskState(task.state),
            subtasks=[],
            created_at=task.created_at,
            updated_at=task.updated_at
        )
    )


async def _execute_single_task(task_id: str):
    """执行单个任务（不使用调度器）"""
    print(f"=== _execute_single_task called: task_id={task_id} ===")
    from pathlib import Path
    from src.services.queue.task import TaskService

    logger.info(f"开始执行单个任务 {task_id}...")
    print(f"=== 开始执行单个任务 {task_id}... ===")

    # 从 queue_manager 获取任务对象
    task = await queue_manager.get_task(task_id)
    if not task:
        logger.error(f"任务 {task_id} 不存在")
        return
    
    logger.info(f"任务信息: id={task.id}, title={task.title}, state={task.state}")
    
    temp_dir = None
    try:
        print(f"=== 开始准备任务 ===")
        # 使用 TaskService 准备并执行任务
        task_service = TaskService(task)

        # 准备任务（获取视频信息，创建子任务）
        logger.info(f"准备任务 {task_id}...")
        print(f"=== 调用 task_service.prepare() ===")
        await task_service.prepare()
        print(f"=== task_service.prepare() 完成 ===")

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
        print(f"=== 临时目录已创建: {temp_dir} ===")
        
        # 创建输出目录
        output_dir = Path(download_path)
        output_dir.mkdir(parents=True, exist_ok=True)

        print(f"=== 输出目录已创建: {output_dir} ===")

        # 执行任务
        logger.info(f"开始下载任务 {task_id}...")
        print(f"=== 调用 task_service.execute() ===")
        await task_service.execute(temp_dir, output_dir)
        print(f"=== task_service.execute() 完成 ===")

        logger.info(f"✓ 任务 {task_id} 已完成")
        
    except asyncio.CancelledError:
        logger.info(f"任务 {task_id} 被取消")
        
        # 从 queue_manager 重新获取任务对象
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
        
        # 从 queue_manager 重新获取任务对象
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

    # 从 queue_manager 重新获取任务对象以返回最新状态
    task = await queue_manager.get_task(task_id)
    if not task:
        return None
    
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
        # 验证必填字段
        if not scheduler_create.title or not scheduler_create.title.strip():
            raise HTTPException(
                status_code=400,
                detail="title 不能为空"
            )

        if not scheduler_create.folder or not scheduler_create.folder.strip():
            raise HTTPException(
                status_code=400,
                detail="folder 不能为空"
            )

        # 验证task_ids（如果提供）
        if scheduler_create.task_ids is not None:
            if len(scheduler_create.task_ids) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="task_ids 不能为空列表"
                )

            # 验证每个任务ID是否存在
            valid_task_ids = []
            invalid_task_ids = []
            for task_id in scheduler_create.task_ids:
                task = await queue_manager.get_task(task_id)
                if task:
                    valid_task_ids.append(task_id)
                else:
                    invalid_task_ids.append(task_id)

            if invalid_task_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"以下任务ID不存在: {', '.join(invalid_task_ids)}"
                )

        scheduler = await queue_manager.plan_scheduler(scheduler_create)
        return ApiResponse(
            success=True,
            message="调度器创建成功",
            data=scheduler
        )
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"参数验证失败: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create scheduler: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"调度器创建失败: {str(e)}")


@router.delete("/tasks/batch", response_model=ApiResponse)
async def batch_delete_tasks(task_ids: List[str] = Body(...)):
    """批量删除任务"""
    if not task_ids:
        return ApiResponse(
            success=True,
            message="没有选择要删除的任务"
        )
    
    deleted_count = 0
    failed_count = 0
    errors = []
    
    for task_id in task_ids:
        try:
            # 复用单个任务的删除逻辑
            task = await queue_manager.get_task(task_id)
            if not task:
                failed_count += 1
                errors.append(f"任务 {task_id} 不存在")
                continue
            
            # 删除本地文件
            try:
                from pathlib import Path
                import shutil
                from src.services.settings_service import SettingsService
                
                # 从设置中获取临时路径和下载路径
                db = SessionLocal()
                try:
                    settings_service = SettingsService(db)
                    settings = settings_service.get_settings()
                    temp_path = settings.storage.temp_path or "/Users/tanyancong/工作/开发/pilinote/apps/api/temp"
                    download_path = settings.storage.download_path or "/Users/tanyancong/工作/开发/pilinote/apps/api/downloads"
                finally:
                    db.close()
                
                # 删除临时文件夹
                temp_folder = Path(temp_path) / task_id
                if temp_folder.exists():
                    logger.info(f"删除临时文件夹: {temp_folder}")
                    shutil.rmtree(temp_folder)
                
                # 如果任务不属于调度器，删除视频文件夹
                if not task.scheduler_id:
                    video_title = task.title.replace('/', '_').replace('\\', '_').replace(':', '_')
                    video_folder = Path(download_path) / video_title
                    
                    if video_folder.exists():
                        logger.info(f"删除视频文件夹: {video_folder}")
                        shutil.rmtree(video_folder)
                else:
                    # 如果任务属于调度器，删除该任务的分P子文件夹
                    # 查找调度器
                    scheduler = await queue_manager.get_scheduler(task.scheduler_id)
                    if scheduler and scheduler.folder:
                        # 获取任务的分P标题
                        part_title = task.meta.get('part_title') if task.meta else None
                        if part_title:
                            # 删除分P子文件夹
                            part_folder = Path(scheduler.folder) / part_title
                            if part_folder.exists():
                                logger.info(f"删除分P子文件夹: {part_folder}")
                                shutil.rmtree(part_folder)
                
            except Exception as e:
                logger.error(f"删除本地文件失败: {e}")
                # 继续删除任务，即使删除文件失败

            # Remove from all queues
            await queue_manager.remove_task(task_id)

            # Broadcast WebSocket event
            from src.routers.websocket import broadcast_task_updated
            broadcast_task_updated(task_id, 'cancelled', cancelled=True)

            deleted_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(f"删除任务 {task_id} 失败: {str(e)}")
    
    return ApiResponse(
        success=failed_count == 0,
        message=f"批量删除完成：成功 {deleted_count} 个，失败 {failed_count} 个",
        data={
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "errors": errors
        }
    )


@router.delete("/tasks/all", response_model=ApiResponse)
async def delete_all_tasks():
    """删除所有任务"""
    try:
        # 获取所有任务ID
        all_task_ids = list(queue_manager.tasks.keys())
        
        if not all_task_ids:
            return ApiResponse(
                success=True,
                message="没有任务可删除"
            )
        
        # 调用批量删除
        result = await batch_delete_tasks(all_task_ids)
        
        return ApiResponse(
            success=result.success,
            message=f"删除所有任务完成：{result.message}",
            data=result.data
        )
    except Exception as e:
        logger.error(f"删除所有任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}", response_model=ApiResponse)
async def delete_task(task_id: str):
    """Delete task from queue and local files"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # 删除本地文件
    try:
        from pathlib import Path
        import shutil
        from src.services.settings_service import SettingsService
        
        # 从设置中获取临时路径和下载路径
        db = SessionLocal()
        try:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            temp_path = settings.storage.temp_path or "/Users/tanyancong/工作/开发/pilinote/apps/api/temp"
            download_path = settings.storage.download_path or "/Users/tanyancong/工作/开发/pilinote/apps/api/downloads"
        finally:
            db.close()
        
        # 删除临时文件夹
        temp_folder = Path(temp_path) / task_id
        if temp_folder.exists():
            logger.info(f"删除临时文件夹: {temp_folder}")
            shutil.rmtree(temp_folder)
        
        # 如果任务不属于调度器，删除视频文件夹
        if not task.scheduler_id:
            video_title = task.title.replace('/', '_').replace('\\', '_').replace(':', '_')
            video_folder = Path(download_path) / video_title
            
            if video_folder.exists():
                logger.info(f"删除视频文件夹: {video_folder}")
                shutil.rmtree(video_folder)
        else:
            # 如果任务属于调度器，删除该任务的分P子文件夹
            # 查找调度器
            scheduler = await queue_manager.get_scheduler(task.scheduler_id)
            if scheduler and scheduler.folder:
                # 获取任务的分P标题
                part_title = task.meta.get('part_title') if task.meta else None
                if part_title:
                    # 删除分P子文件夹
                    part_folder = Path(scheduler.folder) / part_title
                    if part_folder.exists():
                        logger.info(f"删除分P子文件夹: {part_folder}")
                        shutil.rmtree(part_folder)
            
    except Exception as e:
        logger.error(f"删除本地文件失败: {e}")
        # 继续删除任务，即使删除文件失败

    # Remove from all queues
    await queue_manager.remove_task(task_id)

    # Broadcast WebSocket event
    from src.routers.websocket import broadcast_task_updated
    broadcast_task_updated(task_id, 'cancelled', cancelled=True)

    return ApiResponse(
        success=True,
        message="任务和本地文件删除成功"
    )


@router.post("/tasks/{task_id}/pause", response_model=ApiResponse)
async def pause_task(task_id: str):
    """Pause task"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.state != TaskState.ACTIVE:
        raise HTTPException(status_code=400, detail="只有正在执行的任务才能暂停")

    task.state = TaskState.PAUSED
    task.updated_at = int(datetime.now().timestamp())

    # 持久化到数据库
    db = SessionLocal()
    try:
        db.commit()
    finally:
        db.close()

    # 广播 WebSocket 事件
    from src.routers.websocket import broadcast_task_updated
    broadcast_task_updated(task_id, str(task.state), cancelled=False)

    return ApiResponse(
        success=True,
        message="任务暂停成功"
    )


@router.post("/tasks/{task_id}/cancel", response_model=ApiResponse)
async def cancel_task(task_id: str):
    """Cancel task"""
    task = await queue_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.state not in [TaskState.ACTIVE, TaskState.PAUSED, TaskState.PENDING]:
        raise HTTPException(status_code=400, detail="只有待处理、正在执行或已暂停的任务才能取消")

    task.state = TaskState.CANCELLED
    task.updated_at = int(datetime.now().timestamp())

    # 持久化到数据库
    db = SessionLocal()
    try:
        db.commit()
    finally:
        db.close()

    # 广播 WebSocket 事件
    from src.routers.websocket import broadcast_task_updated
    broadcast_task_updated(task_id, 'cancelled', cancelled=True)

    return ApiResponse(
        success=True,
        message="任务取消成功"
    )


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
    from src.models.queue import QueueType
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


@router.delete("/schedulers/{scheduler_id}", response_model=ApiResponse)
async def delete_scheduler(scheduler_id: str):
    """Delete scheduler and all its tasks"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="Scheduler not found")

    # Get task IDs before deletion
    task_ids = scheduler.list if scheduler else []

    # Delete scheduler and all associated tasks
    await queue_manager.delete_scheduler(scheduler_id)

    # Broadcast WebSocket event for scheduler deletion
    from src.routers.websocket import broadcast_scheduler_deleted, broadcast_task_updated
    broadcast_scheduler_deleted(scheduler_id)

    # Broadcast WebSocket event for each deleted task
    for task_id in task_ids:
        broadcast_task_updated(task_id, 'cancelled', cancelled=True)

    return ApiResponse(
        success=True,
        message="调度器删除成功"
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