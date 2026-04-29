"""
统一队列管理器 - 整合 download_manager 和 queue_manager 的功能

这个管理器将：
1. 管理四级队列系统（backlog → pending → doing → complete）
2. 提供并发控制和任务调度
3. 支持子任务处理
4. 提供实时事件推送
5. 统一错误处理和重试机制
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Callable, Any
from enum import Enum

from src.database import SessionLocal
from src.models.task import Task, SubTask, TaskState, SubTaskType
from src.models.queue import Queue, QueueType
from src.models.scheduler import Scheduler, SchedulerState
from src.schemas.task import TaskCreate
from sqlalchemy import and_

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """事件类型枚举"""
    TASK_CREATED = "task_created"
    TASK_STARTED = "task_started"
    TASK_PROGRESS = "task_progress"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    TASK_CANCELLED = "task_cancelled"
    
    SUBTASK_STARTED = "subtask_started"
    SUBTASK_PROGRESS = "subtask_progress"
    SUBTASK_COMPLETED = "subtask_completed"
    SUBTASK_FAILED = "subtask_failed"
    
    QUEUE_UPDATED = "queue_updated"


class EventManager:
    """事件管理器 - 支持 WebSocket 实时推送"""
    
    def __init__(self):
        self.subscribers: Dict[EventType, List[Callable]] = {}
    
    async def publish(self, event_type: EventType, data: dict):
        """发布事件"""
        callbacks = self.subscribers.get(event_type, [])
        for callback in callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(data)
                else:
                    callback(data)
            except Exception as e:
                logger.error(f"Event callback error: {e}")
    
    def subscribe(self, event_type: EventType, callback: Callable):
        """订阅事件"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
    
    def unsubscribe(self, event_type: EventType, callback: Callable):
        """取消订阅"""
        if event_type in self.subscribers:
            if callback in self.subscribers[event_type]:
                self.subscribers[event_type].remove(callback)


class UnifiedQueueManager:
    """
    统一队列管理器
    
    功能：
    - 四级队列管理（backlog → pending → doing → complete）
    - 并发控制（最大同时执行任务数）
    - 子任务处理和编排
    - 实时事件推送
    - 错误处理和重试
    """
    
    _instance: Optional['UnifiedQueueManager'] = None
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
        
        # 配置
        self.max_concurrent = 3
        self.retry_max_attempts = 3
        
        # 运行时状态
        self._running = False
        self._processor_task: Optional[asyncio.Task] = None
        
        # 内存队列（用于快速访问）
        self.memory_queues: Dict[QueueType, asyncio.Queue] = {
            QueueType.BACKLOG: asyncio.Queue(),
            QueueType.PENDING: asyncio.Queue(),
            QueueType.DOING: asyncio.Queue(),
            QueueType.COMPLETE: asyncio.Queue()
        }
        
        # 活跃任务跟踪
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.paused_tasks: Dict[str, asyncio.Event] = {}
        
        # 事件管理器
        self.event_manager = EventManager()
        
        # 注册 WebSocket 事件回调
        self._register_websocket_callbacks()
        
        # 并发控制
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
        
        # 子任务处理器注册表
        self.subtask_handlers: Dict[SubTaskType, Any] = {}
    
    def _register_websocket_callbacks(self):
        """注册 WebSocket 事件回调"""
        from src.routers.websocket import manager
        
        async def broadcast_event(event_type: EventType, data: dict):
            """广播事件到 WebSocket 客户端"""
            message = {
                "type": event_type.value,
                "data": data
            }
            await manager.broadcast(message)
        
        # 注册所有事件类型的回调
        for event_type in EventType:
            self.event_manager.subscribe(event_type, 
                lambda data, et=event_type: asyncio.create_task(broadcast_event(et, data))
            )
    
    async def start(self):
        """启动队列管理器"""
        if self._running:
            return
        
        logger.info("🚀 启动统一队列管理器...")
        
        # 从数据库加载队列状态
        await self._load_queues_from_db()
        
        # 启动队列处理器
        self._running = True
        self._processor_task = asyncio.create_task(self._process_queues())
        
        logger.info("✅ 统一队列管理器启动成功")
    
    async def stop(self):
        """停止队列管理器"""
        if not self._running:
            return
        
        logger.info("🛑 停止统一队列管理器...")
        
        self._running = False
        
        # 停止队列处理器
        if self._processor_task:
            self._processor_task.cancel()
            try:
                await self._processor_task
            except asyncio.CancelledError:
                pass
        
        # 取消所有活跃任务
        for task_id, task in list(self.active_tasks.items()):
            task.cancel()
        
        # 保存队列状态到数据库
        await self._save_queues_to_db()
        
        logger.info("✅ 统一队列管理器停止完成")
    
    async def submit_task(self, task_create: TaskCreate) -> Task:
        """提交任务到 backlog 队列"""
        db = SessionLocal()
        try:
            # 创建主任务
            task = Task(
                media_type=task_create.media_type,
                media_id=task_create.media_id,
                title=task_create.title or "",
                cover=task_create.cover or "",
                desc=task_create.desc or "",
                meta=task_create.meta or {},
                prepare={},
                status={
                    "progress": 0,
                    "speed": 0,
                    "eta": 0,
                    "stage": "preparing",
                    "downloaded": 0,
                    "total": 0
                },
                state=TaskState.BACKLOG
            )
            
            db.add(task)
            db.flush()  # 获取 task.id
            
            # 创建子任务
            subtasks = await self._create_default_subtasks(task.id, db)
            
            db.commit()
            
            # 添加到内存队列
            await self.memory_queues[QueueType.BACKLOG].put(task.id)
            
            # 发布事件
            await self.event_manager.publish(EventType.TASK_CREATED, {
                "task_id": task.id,
                "task": task.to_dict()
            })
            
            logger.info(f"✅ 任务提交成功: {task.title}")
            return task
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ 任务提交失败: {e}")
            raise
        finally:
            db.close()
    
    async def _create_default_subtasks(self, task_id: str, db) -> List[SubTask]:
        """为任务创建默认子任务"""
        subtasks = []
        
        # 默认子任务类型
        default_subtask_types = [
            SubTaskType.VIDEO,     # 视频下载（必须）
            SubTaskType.SUBTITLE,  # 字幕下载
            SubTaskType.DANMAKU,   # 弹幕下载
            SubTaskType.COVER,     # 封面下载
            SubTaskType.NFO        # NFO元数据
        ]
        
        for subtask_type in default_subtask_types:
            subtask = SubTask(
                task_id=task_id,
                type=subtask_type,
                state=TaskState.BACKLOG,
                params={}
            )
            db.add(subtask)
            subtasks.append(subtask)
        
        return subtasks
    
    async def _process_queues(self):
        """队列处理主循环"""
        logger.info("🔄 开始队列处理循环...")
        
        while self._running:
            try:
                # 1. 处理 backlog → pending 流转
                await self._process_backlog_to_pending()
                
                # 2. 处理 pending → doing 流转
                await self._process_pending_to_doing()
                
                # 3. 清理完成的任务
                await self._cleanup_completed_tasks()
                
                # 短暂休眠避免CPU占用过高
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"队列处理错误: {e}")
                await asyncio.sleep(5)  # 错误时等待更长时间
    
    async def _process_backlog_to_pending(self):
        """处理 backlog → pending 流转"""
        try:
            # 非阻塞获取任务
            task_id = self.memory_queues[QueueType.BACKLOG].get_nowait()
            
            # 更新任务状态
            await self._update_task_state(task_id, TaskState.PENDING)
            
            # 移动到 pending 队列
            await self.memory_queues[QueueType.PENDING].put(task_id)
            
            logger.info(f"📋 任务 {task_id} 移动到 pending 队列")
            
        except asyncio.QueueEmpty:
            pass  # backlog 队列为空，正常情况
    
    async def _process_pending_to_doing(self):
        """处理 pending → doing 流转"""
        # 检查是否有可用的并发槽位
        if len(self.active_tasks) >= self.max_concurrent:
            return
        
        try:
            # 非阻塞获取任务
            task_id = self.memory_queues[QueueType.PENDING].get_nowait()
            
            # 更新任务状态
            await self._update_task_state(task_id, TaskState.ACTIVE)
            
            # 移动到 doing 队列
            await self.memory_queues[QueueType.DOING].put(task_id)
            
            # 启动任务执行
            task_coroutine = self._execute_task(task_id)
            execution_task = asyncio.create_task(task_coroutine)
            self.active_tasks[task_id] = execution_task
            
            logger.info(f"🚀 任务 {task_id} 开始执行")
            
        except asyncio.QueueEmpty:
            pass  # pending 队列为空，正常情况
    
    async def _execute_task(self, task_id: str):
        """执行单个任务（包含所有子任务）"""
        try:
            async with self.semaphore:  # 并发控制
                logger.info(f"🎯 开始执行任务: {task_id}")
                
                # 发布任务开始事件
                await self.event_manager.publish(EventType.TASK_STARTED, {
                    "task_id": task_id
                })
                
                # 获取任务和子任务
                db = SessionLocal()
                try:
                    task = db.query(Task).filter(Task.id == task_id).first()
                    if not task:
                        raise Exception(f"任务 {task_id} 不存在")
                    
                    subtasks = db.query(SubTask).filter(SubTask.task_id == task_id).all()
                    
                    # 执行子任务
                    success = await self._execute_subtasks(task, subtasks)
                    
                    if success:
                        # 任务完成
                        await self._complete_task(task_id, TaskState.COMPLETED)
                    else:
                        # 任务失败
                        await self._complete_task(task_id, TaskState.FAILED)
                
                finally:
                    db.close()
                
        except Exception as e:
            logger.error(f"❌ 任务执行失败 {task_id}: {e}")
            await self._complete_task(task_id, TaskState.FAILED)
        
        finally:
            # 清理活跃任务记录
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
    
    async def _execute_subtasks(self, task: Task, subtasks: List[SubTask]) -> bool:
        """执行任务的所有子任务"""
        from .handlers.registry import handler_registry
        from .handlers.base import ProgressCallback
        
        logger.info(f"📝 执行任务 {task.title} 的 {len(subtasks)} 个子任务")
        
        # 按优先级排序子任务（视频优先）
        sorted_subtasks = sorted(subtasks, key=lambda st: (
            0 if st.type == "video" else 1,  # 视频任务优先
            st.type  # 其他按类型排序
        ))
        
        success_count = 0
        
        for i, subtask in enumerate(sorted_subtasks):
            try:
                logger.info(f"🔧 执行子任务 {i+1}/{len(subtasks)}: {subtask.type}")
                
                # 获取处理器
                from src.models.task import SubTaskType
                subtask_type = SubTaskType(subtask.type)
                handler = handler_registry.get_handler(subtask_type)
                
                if not handler:
                    logger.warning(f"⚠️  未找到处理器: {subtask.type}，跳过")
                    continue
                
                # 更新子任务状态为执行中
                await self._update_subtask_state(subtask.id, TaskState.ACTIVE)
                
                # 发布子任务开始事件
                await self.event_manager.publish(EventType.SUBTASK_STARTED, {
                    "task_id": task.id,
                    "subtask_id": subtask.id,
                    "subtask_type": subtask.type
                })
                
                # 创建进度回调
                async def progress_callback_func(progress_data):
                    await self.event_manager.publish(EventType.SUBTASK_PROGRESS, {
                        "task_id": task.id,
                        "subtask_id": subtask.id,
                        **progress_data
                    })
                
                progress_callback = ProgressCallback(
                    task.id, 
                    subtask.id, 
                    progress_callback_func
                )
                
                # 执行子任务
                success = await handler.execute(task, subtask, progress_callback)
                
                if success:
                    # 子任务成功
                    await self._update_subtask_state(subtask.id, TaskState.COMPLETED)
                    success_count += 1
                    
                    await self.event_manager.publish(EventType.SUBTASK_COMPLETED, {
                        "task_id": task.id,
                        "subtask_id": subtask.id,
                        "subtask_type": subtask.type
                    })
                    
                    logger.info(f"✅ 子任务完成: {subtask.type}")
                else:
                    # 子任务失败
                    await self._update_subtask_state(subtask.id, TaskState.FAILED)
                    
                    await self.event_manager.publish(EventType.SUBTASK_FAILED, {
                        "task_id": task.id,
                        "subtask_id": subtask.id,
                        "subtask_type": subtask.type
                    })
                    
                    logger.error(f"❌ 子任务失败: {subtask.type}")
                    
                    # 如果是视频子任务失败，整个任务失败
                    if subtask.type == "video":
                        logger.error(f"❌ 视频下载失败，任务终止: {task.title}")
                        return False
                
            except Exception as e:
                logger.error(f"❌ 子任务执行异常 {subtask.type}: {e}")
                await self._update_subtask_state(subtask.id, TaskState.FAILED)
                
                # 视频任务异常也导致整个任务失败
                if subtask.type == "video":
                    return False
        
        # 只要视频下载成功，就认为任务成功（其他子任务失败不影响）
        video_subtasks = [st for st in subtasks if st.type == "video"]
        if video_subtasks:
            # 检查视频子任务是否成功
            db = SessionLocal()
            try:
                video_subtask = db.query(SubTask).filter(
                    SubTask.id == video_subtasks[0].id
                ).first()
                return video_subtask.state == TaskState.COMPLETED if video_subtask else False
            finally:
                db.close()
        
        return success_count > 0
    
    async def _update_subtask_state(self, subtask_id: str, new_state: TaskState):
        """更新子任务状态"""
        db = SessionLocal()
        try:
            subtask = db.query(SubTask).filter(SubTask.id == subtask_id).first()
            if subtask:
                subtask.state = new_state
                subtask.updated_at = int(datetime.now().timestamp())
                db.commit()
        finally:
            db.close()
    
    async def _complete_task(self, task_id: str, final_state: TaskState):
        """完成任务处理"""
        # 更新任务状态
        await self._update_task_state(task_id, final_state)
        
        # 移动到 complete 队列
        await self.memory_queues[QueueType.COMPLETE].put(task_id)
        
        # 发布完成事件
        event_type = EventType.TASK_COMPLETED if final_state == TaskState.COMPLETED else EventType.TASK_FAILED
        await self.event_manager.publish(event_type, {
            "task_id": task_id,
            "final_state": final_state.name
        })
        
        logger.info(f"✅ 任务完成: {task_id} -> {final_state.name}")
    
    async def _update_task_state(self, task_id: str, new_state: TaskState):
        """更新任务状态"""
        db = SessionLocal()
        try:
            task = db.query(Task).filter(Task.id == task_id).first()
            if task:
                task.state = new_state
                task.updated_at = int(datetime.now().timestamp())
                db.commit()
        finally:
            db.close()
    
    async def _cleanup_completed_tasks(self):
        """清理完成队列中的旧任务"""
        # TODO: 实现完成任务的清理逻辑
        pass
    
    async def _load_queues_from_db(self):
        """从数据库加载队列状态"""
        db = SessionLocal()
        try:
            # 加载各个队列的任务
            for queue_type in QueueType:
                queue_record = db.query(Queue).filter(Queue.queue_type == queue_type).first()
                if queue_record and queue_record.value:
                    for task_id in queue_record.value:
                        await self.memory_queues[queue_type].put(task_id)
            
            logger.info("✅ 队列状态从数据库加载完成")
        finally:
            db.close()
    
    async def _save_queues_to_db(self):
        """保存队列状态到数据库"""
        db = SessionLocal()
        try:
            for queue_type in QueueType:
                # 收集队列中的所有任务ID
                task_ids = []
                while not self.memory_queues[queue_type].empty():
                    try:
                        task_id = self.memory_queues[queue_type].get_nowait()
                        task_ids.append(task_id)
                    except asyncio.QueueEmpty:
                        break
                
                # 更新数据库记录
                queue_record = db.query(Queue).filter(Queue.queue_type == queue_type).first()
                if queue_record:
                    queue_record.value = task_ids
                    queue_record.updated_at = int(datetime.now().timestamp())
                else:
                    queue_record = Queue(
                        queue_type=queue_type,
                        value=task_ids,
                        updated_at=int(datetime.now().timestamp())
                    )
                    db.add(queue_record)
            
            db.commit()
            logger.info("✅ 队列状态保存到数据库完成")
        finally:
            db.close()
    
    # 任务控制方法
    async def pause_task(self, task_id: str) -> bool:
        """暂停任务"""
        # TODO: 实现任务暂停逻辑
        logger.info(f"⏸️  暂停任务: {task_id}")
        return True
    
    async def resume_task(self, task_id: str) -> bool:
        """恢复任务"""
        # TODO: 实现任务恢复逻辑
        logger.info(f"▶️  恢复任务: {task_id}")
        return True
    
    async def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        # TODO: 实现任务取消逻辑
        logger.info(f"❌ 取消任务: {task_id}")
        return True
    
    async def retry_task(self, task_id: str) -> bool:
        """重试任务"""
        # TODO: 实现任务重试逻辑
        logger.info(f"🔄 重试任务: {task_id}")
        return True


# 全局实例
unified_queue_manager = UnifiedQueueManager()