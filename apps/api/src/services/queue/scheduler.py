import asyncio
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime
import logging

from src.models.task import Task, TaskState
from src.models.scheduler import Scheduler, SchedulerState
from src.models.queue import QueueType
from src.schemas.task import SubTaskType
from src.services.queue.manager import queue_manager
from src.services.bilibili import BilibiliService
from src.database import SessionLocal

logger = logging.getLogger(__name__)


class SchedulerService:
    """调度器服务 - 管理批量任务执行"""

    def __init__(self, scheduler: Scheduler):
        self.scheduler = scheduler
        self.tasks: Dict[str, Task] = {}
        self.semaphore = asyncio.Semaphore(3)  # 并发控制
        self.cancel_event = asyncio.Event()
        self._initialized = False

    async def initialize(self):
        """初始化调度器"""
        if self._initialized:
            return

        logger.info(f"初始化调度器 {self.scheduler.id}...")

        # 加载任务
        for task_id in self.scheduler.list:
            task = await queue_manager.get_task(task_id)
            if task:
                self.tasks[task_id] = task

        self._initialized = True
        logger.info(f"✓ 调度器 {self.scheduler.id} 已加载 {len(self.tasks)} 个任务")

    async def prepare(self):
        """准备所有任务"""
        logger.info(f"准备调度器 {self.scheduler.id} 的任务...")

        # 初始化Bilibili服务
        bilibili_service = BilibiliService()
        await bilibili_service.init()

        for task_id, task in self.tasks.items():
            try:
                await self._prepare_task(task, bilibili_service)
                logger.info(f"✓ 任务 {task_id} 准备完成")
            except Exception as e:
                logger.error(f"✗ 任务 {task_id} 准备失败: {e}")
                task.state = TaskState.FAILED
                task.status['error'] = str(e)
                task.updated_at = int(datetime.now().timestamp())

                # 持久化
                db = SessionLocal()
                try:
                    db.commit()
                finally:
                    db.close()

    async def _prepare_task(self, task: Task, bilibili_service: BilibiliService):
        """准备单个任务"""
        logger.info(f"准备任务 {task.id} (media_type={task.media_type}, media_id={task.media_id})...")

        # 根据媒体类型获取信息
        if task.media_type == "video":
            # 获取视频信息
            result = await bilibili_service.get_video_info(task.media_id)

            if not result.get('success'):
                raise Exception(result.get('message', '获取视频信息失败'))

            video_info = result['data']

            # 构建准备数据
            task.prepare = {
                'subtasks': self._create_subtasks(task, video_info)
            }

            # 保存元数据 - 保留原有的分P信息
            logger.info(f"[DEBUG] 准备任务 {task.id}，原始meta keys: {list(task.meta.keys()) if task.meta else 'None'}")
            if task.meta and isinstance(task.meta, dict):
                # 保存原有的分P信息
                cid = task.meta.get('cid')
                page = task.meta.get('page')
                part_title = task.meta.get('part_title')
                logger.info(f"[DEBUG] 检测到分P信息: cid={cid}, page={page}, part_title={part_title}")

                # 用 video_info 更新 meta，但保留分P信息
                task.meta = {**video_info}

                # 恢复分P信息
                if cid:
                    task.meta['cid'] = cid
                if page:
                    task.meta['page'] = page
                if part_title:
                    task.meta['part_title'] = part_title

                logger.info(f"[DEBUG] 合并后meta keys: {list(task.meta.keys())}")
            else:
                task.meta = video_info
                logger.info(f"[DEBUG] meta为空或不是dict，直接使用video_info")

        elif task.media_type == "bangumi":
            # 番剧处理
            raise Exception("Bangumi类型暂未实现")

        elif task.media_type == "favorite":
            # 收藏夹处理
            raise Exception("Favorite类型暂未实现")

        else:
            raise Exception(f"不支持的媒体类型: {task.media_type}")

        # 更新任务状态
        task.state = TaskState.PENDING
        task.updated_at = int(datetime.now().timestamp())

        # 持久化
        db = SessionLocal()
        try:
            db.merge(task)  # 合并对象到 session
            db.commit()
        finally:
            db.close()

    def _create_subtasks(self, task: Task, info: dict) -> List[dict]:
        """根据配置创建子任务"""
        subtasks = []

        # 视频下载
        subtasks.append({
            'type': SubTaskType.VIDEO,
            'bvid': task.media_id,
            'filename': f"{info.get('title', 'video')}.mp4"
        })

        # 字幕下载
        subtasks.append({
            'type': SubTaskType.SUBTITLES,
            'bvid': task.media_id,
            'filename': f"{info.get('title', 'video')}.zh.srt"
        })

        # 弹幕下载
        subtasks.append({
            'type': SubTaskType.DANMAKU,
            'bvid': task.media_id,
            'filename': f"{info.get('title', 'video')}.xml"
        })

        # 封面下载
        if info.get('pic'):
            subtasks.append({
                'type': SubTaskType.THUMB,
                'url': info['pic'],
                'filename': f"{info.get('title', 'video')}.jpg"
            })

        # NFO文件
        subtasks.append({
            'type': SubTaskType.SINGLE_NFO,
            'meta': info,
            'filename': f"{info.get('title', 'video')}.nfo"
        })

        return subtasks

    async def dispatch(self):
        """分发任务执行"""
        logger.info(f"[调度器] 开始执行调度器 {self.scheduler.id}, 包含 {len(self.scheduler.list)} 个任务")
        if not self._initialized:
            await self.initialize()

        logger.info(f"开始执行调度器 {self.scheduler.id}...")

        self.scheduler.state = SchedulerState.ACTIVE
        self.scheduler.updated_at = int(datetime.now().timestamp())

        # 持久化状态
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

        # 创建任务集合
        tasks = []
        for task_id in self.scheduler.list:
            task = self.tasks.get(task_id)
            if task and task.state == TaskState.PENDING:
                tasks.append(self._run_task(task))

        # 并发执行任务
        try:
            await asyncio.gather(*tasks, return_exceptions=True)
        except asyncio.CancelledError:
            logger.info(f"调度器 {self.scheduler.id} 已取消")
            self.scheduler.state = SchedulerState.CANCELLED
        except Exception as e:
            logger.error(f"调度器 {self.scheduler.id} 执行失败: {e}")
            self.scheduler.state = SchedulerState.FAILED
        else:
            # 检查是否所有任务都完成
            all_completed = all(
                task.state == TaskState.COMPLETED
                for task in self.tasks.values()
            )

            if all_completed:
                self.scheduler.state = SchedulerState.COMPLETED
                logger.info(f"✓ 调度器 {self.scheduler.id} 已完成")
            else:
                self.scheduler.state = SchedulerState.FAILED
                logger.warning(f"调度器 {self.scheduler.id} 部分任务失败")

        # 更新状态
        self.scheduler.updated_at = int(datetime.now().timestamp())
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    async def _run_task(self, task: Task):
        """执行单个任务"""
        logger.info(f"开始执行任务 {task.id}...")

        # 获取信号量
        async with self.semaphore:
            # 检查是否取消
            if self.cancel_event.is_set():
                task.state = TaskState.CANCELLED
                return

            # 从设置中获取临时路径
            from src.services.settings_service import SettingsService
            db = SessionLocal()
            try:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                temp_base_path = settings.storage.temp_path
            finally:
                db.close()

            # 创建临时目录
            temp_dir = Path(temp_base_path) / task.id
            temp_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"使用临时路径: {temp_dir}")

            # 创建输出目录（为每个分P创建子目录）
            base_output_dir = Path(self.scheduler.folder)
            base_output_dir.mkdir(parents=True, exist_ok=True)

            # 如果任务有分P标题，创建子目录
            part_title = task.meta.get('part_title') if task.meta else None
            if part_title:
                output_dir = base_output_dir / part_title
            else:
                output_dir = base_output_dir

            output_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"输出目录: {output_dir}")

            try:
                # 使用 TaskService 执行任务
                from src.services.queue.task import TaskService
                task_service = TaskService(task)
                
                # 在后台任务中执行，以便可以检查取消状态
                task_future = asyncio.create_task(task_service.execute(temp_dir, output_dir))
                
                # 等待任务完成或取消
                done, pending = await asyncio.wait(
                    [task_future, asyncio.create_task(self.cancel_event.wait())],
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                # 检查是否被取消
                if self.cancel_event.is_set():
                    # 取消任务
                    if not task_future.done():
                        task_future.cancel()
                        try:
                            await task_future
                        except asyncio.CancelledError:
                            pass
                    task.state = TaskState.CANCELLED
                    logger.info(f"任务 {task.id} 已取消")
                else:
                    # 任务正常完成
                    if task_future.exception() is not None:
                        raise task_future.exception()
                    logger.info(f"✓ 任务 {task.id} 已完成")

            except asyncio.CancelledError:
                logger.info(f"任务 {task.id} 被取消")
                task.state = TaskState.CANCELLED
            except Exception as e:
                logger.error(f"✗ 任务 {task.id} 执行失败: {e}")
                task.state = TaskState.FAILED
                task.status['error'] = str(e)

                # 清理临时目录
                if temp_dir.exists():
                    import shutil
                    shutil.rmtree(temp_dir)

            # 更新任务状态到数据库
            task.updated_at = int(datetime.now().timestamp())
            db = SessionLocal()
            try:
                db.merge(task)  # 合并对象到session
                db.commit()
            finally:
                db.close()

    async def _execute_subtask(self, task: Task, subtask_data: dict, temp_dir: Path, output_dir: Path):
        """执行子任务"""
        from src.services.queue.handlers import SubTaskHandler

        subtask_type = subtask_data['type']

        # 获取处理器
        handler = SubTaskHandler.get_handler(subtask_type)
        if not handler:
            logger.warning(f"未找到 {subtask_type} 的处理器，跳过")
            return

        # 执行处理器
        await handler.handle(subtask_data, temp_dir, output_dir, task.meta)

    async def pause(self):
        """暂停调度器"""
        logger.info(f"暂停调度器 {self.scheduler.id}...")
        self.scheduler.state = SchedulerState.PAUSED
        self.scheduler.updated_at = int(datetime.now().timestamp())

        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    async def resume(self):
        """恢复调度器"""
        logger.info(f"恢复调度器 {self.scheduler.id}...")
        self.cancel_event.clear()
        await self.dispatch()

    async def cancel(self):
        """取消调度器"""
        logger.info(f"取消调度器 {self.scheduler.id}...")
        self.cancel_event.set()
        self.scheduler.state = SchedulerState.CANCELLED
        self.scheduler.updated_at = int(datetime.now().timestamp())

        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()