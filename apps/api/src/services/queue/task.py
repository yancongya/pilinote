import asyncio
from typing import Dict, List
from pathlib import Path
from datetime import datetime
import logging

from src.models.task import Task, TaskState
from src.schemas.task import SubTask, SubTaskType
from src.services.bilibili import BilibiliService
from src.database import SessionLocal

logger = logging.getLogger(__name__)


class TaskService:
    """任务服务 - 管理单个任务的执行"""

    def __init__(self, task: Task):
        self.task = task

    async def prepare(self):
        """准备任务"""
        logger.info(f"准备任务 {self.task.id}...")

        # 初始化Bilibili服务
        bilibili_service = BilibiliService()
        await bilibili_service.init()

        # 根据媒体类型准备数据
        if self.task.media_type == "video":
            await self._prepare_video(bilibili_service)
        elif self.task.media_type == "bangumi":
            await self._prepare_bangumi()
        elif self.task.media_type == "favorite":
            await self._prepare_favorite()

        logger.info(f"✓ 任务 {self.task.id} 准备完成")

    async def _prepare_video(self, bilibili_service: BilibiliService):
        """准备视频任务"""
        # 获取视频信息
        result = await bilibili_service.get_video_info(self.task.media_id)

        if not result.get('success'):
            raise Exception(result.get('message', '获取视频信息失败'))

        video_info = result['data']

        # 保存元数据
        self.task.meta = video_info

        # 构建准备数据
        self.task.prepare = {
            'subtasks': self._create_subtasks(video_info)
        }

        # 更新状态
        self.task.state = TaskState.PENDING
        self.task.updated_at = int(datetime.now().timestamp())

        # 持久化
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    def _create_subtasks(self, info: dict) -> List[dict]:
        """创建子任务列表"""
        subtasks = []

        # 视频下载
        subtasks.append({
            'type': SubTaskType.VIDEO,
            'bvid': self.task.media_id,
            'filename': f"{info.get('title', 'video')}.mp4"
        })

        # 字幕下载
        subtasks.append({
            'type': SubTaskType.SUBTITLES,
            'bvid': self.task.media_id,
            'filename': f"{info.get('title', 'video')}.zh.srt"
        })

        # 弹幕下载
        subtasks.append({
            'type': SubTaskType.DANMAKU,
            'bvid': self.task.media_id,
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

    async def _prepare_bangumi(self):
        """准备番剧任务"""
        # TODO: 实现番剧准备逻辑
        raise Exception("Bangumi类型暂未实现")

    async def _prepare_favorite(self):
        """准备收藏夹任务"""
        # TODO: 实现收藏夹准备逻辑
        raise Exception("Favorite类型暂未实现")

    async def execute(self, temp_dir: Path, output_dir: Path):
        """执行任务"""
        logger.info(f"执行任务 {self.task.id}...")

        # 遍历所有子任务
        for subtask_data in self.task.prepare.get('subtasks', []):
            await self._execute_subtask(subtask_data, temp_dir, output_dir)

        logger.info(f"✓ 任务 {self.task.id} 执行完成")

    async def _execute_subtask(self, subtask_data: dict, temp_dir: Path, output_dir: Path):
        """执行子任务"""
        from services.queue.handlers import SubTaskHandler

        subtask_type = subtask_data['type']

        # 获取处理器
        handler = SubTaskHandler.get_handler(subtask_type)
        if not handler:
            logger.warning(f"未找到 {subtask_type} 的处理器，跳过")
            return

        # 执行处理器
        await handler.handle(subtask_data, temp_dir, output_dir, self.task.meta)

    def update_progress(self, progress: int):
        """更新进度"""
        self.task.status['progress'] = progress
        self.task.updated_at = int(datetime.now().timestamp())

        # 持久化
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()