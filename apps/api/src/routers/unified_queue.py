"""
统一队列管理 API 路由

使用新的统一队列管理器提供 API 服务
"""

import asyncio
from fastapi import APIRouter, HTTPException, Request, Body
from typing import List, Optional, Any
from datetime import datetime
import logging
from pydantic import BaseModel

from src.schemas.task import TaskCreate, TaskResponse, TaskState
from src.services.unified_queue_manager import unified_queue_manager
from src.models.task import Task, SubTask
from src.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/unified-queue", tags=["unified-queue"])


class ApiResponse(BaseModel):
    """统一的API响应格式"""
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None
    code: Optional[int] = None


class TaskControlRequest(BaseModel):
    """任务控制请求"""
    action: str  # pause, resume, cancel, retry


# ========== 队列管理 APIs ==========

@router.post("/start", response_model=ApiResponse)
async def start_queue_manager():
    """启动队列管理器"""
    try:
        await unified_queue_manager.start()
        return ApiResponse(
            success=True,
            message="队列管理器启动成功"
        )
    except Exception as e:
        logger.error(f"启动队列管理器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop", response_model=ApiResponse)
async def stop_queue_manager():
    """停止队列管理器"""
    try:
        await unified_queue_manager.stop()
        return ApiResponse(
            success=True,
            message="队列管理器停止成功"
        )
    except Exception as e:
        logger.error(f"停止队列管理器失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=ApiResponse)
async def get_queue_status():
    """获取队列状态"""
    try:
        status = {
            "running": unified_queue_manager._running,
            "max_concurrent": unified_queue_manager.max_concurrent,
            "active_tasks_count": len(unified_queue_manager.active_tasks),
            "active_tasks": list(unified_queue_manager.active_tasks.keys()),
            "queue_sizes": {
                "backlog": unified_queue_manager.memory_queues[0].qsize(),
                "pending": unified_queue_manager.memory_queues[1].qsize(),
                "doing": unified_queue_manager.memory_queues[2].qsize(),
                "complete": unified_queue_manager.memory_queues[3].qsize(),
            }
        }
        
        return ApiResponse(
            success=True,
            data=status
        )
    except Exception as e:
        logger.error(f"获取队列状态失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== 任务管理 APIs ==========

@router.post("/tasks", response_model=ApiResponse)
async def submit_task(task_create: TaskCreate):
    """提交新任务"""
    try:
        logger.info(f"📝 提交任务: {task_create.media_id}")
        
        # 验证必填字段
        if not task_create.media_id or not task_create.media_id.strip():
            raise HTTPException(status_code=400, detail="media_id 不能为空")
        
        if not task_create.media_type:
            raise HTTPException(status_code=400, detail="media_type 不能为空")
        
        # 提交任务
        task = await unified_queue_manager.submit_task(task_create)
        
        return ApiResponse(
            success=True,
            message="任务提交成功",
            data={
                "task_id": task.id,
                "media_id": task.media_id,
                "title": task.title,
                "state": task.state
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"提交任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"提交任务失败: {str(e)}")


@router.get("/tasks", response_model=ApiResponse)
async def get_all_tasks():
    """获取所有任务"""
    try:
        db = SessionLocal()
        try:
            # 获取所有任务
            tasks = db.query(Task).order_by(Task.created_at.desc()).all()
            
            task_list = []
            for task in tasks:
                # 获取子任务
                subtasks = db.query(SubTask).filter(SubTask.task_id == task.id).all()
                
                task_data = {
                    "id": task.id,
                    "media_type": task.media_type,
                    "media_id": task.media_id,
                    "title": task.title,
                    "cover": task.cover,
                    "desc": task.desc,
                    "meta": task.meta,
                    "status": task.status,
                    "state": task.state,
                    "scheduler_id": task.scheduler_id,
                    "created_at": task.created_at,
                    "updated_at": task.updated_at,
                    "subtasks": [
                        {
                            "id": st.id,
                            "type": st.type,
                            "state": st.state,
                            "progress": st.progress,
                            "output_path": st.output_path,
                            "file_size": st.file_size
                        }
                        for st in subtasks
                    ]
                }
                task_list.append(task_data)
            
            return ApiResponse(
                success=True,
                data=task_list
            )
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"获取任务列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}", response_model=ApiResponse)
async def get_task(task_id: str):
    """获取单个任务详情"""
    try:
        db = SessionLocal()
        try:
            task = db.query(Task).filter(Task.id == task_id).first()
            if not task:
                raise HTTPException(status_code=404, detail="任务不存在")
            
            # 获取子任务
            subtasks = db.query(SubTask).filter(SubTask.task_id == task_id).all()
            
            task_data = {
                "id": task.id,
                "media_type": task.media_type,
                "media_id": task.media_id,
                "title": task.title,
                "cover": task.cover,
                "desc": task.desc,
                "meta": task.meta,
                "status": task.status,
                "state": task.state,
                "scheduler_id": task.scheduler_id,
                "created_at": task.created_at,
                "updated_at": task.updated_at,
                "subtasks": [
                    {
                        "id": st.id,
                        "type": st.type,
                        "state": st.state,
                        "progress": st.progress,
                        "params": st.params,
                        "output_path": st.output_path,
                        "file_size": st.file_size,
                        "error_detail": st.error_detail,
                        "created_at": st.created_at,
                        "updated_at": st.updated_at
                    }
                    for st in subtasks
                ]
            }
            
            return ApiResponse(
                success=True,
                data=task_data
            )
            
        finally:
            db.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/control", response_model=ApiResponse)
async def control_task(task_id: str, request: TaskControlRequest):
    """控制任务（暂停/恢复/取消/重试）"""
    try:
        action = request.action.lower()
        
        if action == "pause":
            success = await unified_queue_manager.pause_task(task_id)
            message = "任务暂停成功" if success else "任务暂停失败"
        elif action == "resume":
            success = await unified_queue_manager.resume_task(task_id)
            message = "任务恢复成功" if success else "任务恢复失败"
        elif action == "cancel":
            success = await unified_queue_manager.cancel_task(task_id)
            message = "任务取消成功" if success else "任务取消失败"
        elif action == "retry":
            success = await unified_queue_manager.retry_task(task_id)
            message = "任务重试成功" if success else "任务重试失败"
        else:
            raise HTTPException(status_code=400, detail=f"不支持的操作: {action}")
        
        return ApiResponse(
            success=success,
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"控制任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}", response_model=ApiResponse)
async def delete_task(task_id: str):
    """删除任务"""
    try:
        db = SessionLocal()
        try:
            # 检查任务是否存在
            task = db.query(Task).filter(Task.id == task_id).first()
            if not task:
                raise HTTPException(status_code=404, detail="任务不存在")
            
            # 如果任务正在执行，先取消
            if task_id in unified_queue_manager.active_tasks:
                await unified_queue_manager.cancel_task(task_id)
            
            # 删除子任务
            db.query(SubTask).filter(SubTask.task_id == task_id).delete()
            
            # 删除主任务
            db.delete(task)
            db.commit()
            
            return ApiResponse(
                success=True,
                message="任务删除成功"
            )
            
        finally:
            db.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== 统计信息 APIs ==========

@router.get("/stats", response_model=ApiResponse)
async def get_queue_stats():
    """获取队列统计信息"""
    try:
        db = SessionLocal()
        try:
            # 任务状态统计
            from sqlalchemy import func
            task_stats = db.query(
                Task.state, 
                func.count(Task.id)
            ).group_by(Task.state).all()
            
            # 子任务类型统计
            subtask_stats = db.query(
                SubTask.type,
                func.count(SubTask.id)
            ).group_by(SubTask.type).all()
            
            # 媒体类型统计
            media_stats = db.query(
                Task.media_type,
                func.count(Task.id)
            ).group_by(Task.media_type).all()
            
            stats = {
                "task_states": {str(state): count for state, count in task_stats},
                "subtask_types": {stype: count for stype, count in subtask_stats},
                "media_types": {mtype: count for mtype, count in media_stats},
                "queue_manager": {
                    "running": unified_queue_manager._running,
                    "active_tasks": len(unified_queue_manager.active_tasks),
                    "max_concurrent": unified_queue_manager.max_concurrent
                }
            }
            
            return ApiResponse(
                success=True,
                data=stats
            )
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))