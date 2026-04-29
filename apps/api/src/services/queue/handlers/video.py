from typing import Dict, Any
from pathlib import Path
import logging
import asyncio

from .base import BaseHandler, ProgressCallback
from src.models.task import Task, SubTask
from src.services.download_engine import DownloadEngine

logger = logging.getLogger(__name__)


class VideoHandler(BaseHandler):
    """视频下载处理器"""

    def __init__(self):
        super().__init__()
        self.download_engine = DownloadEngine()

    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        """执行视频下载"""
        try:
            logger.info(f"🎬 开始下载视频: {task.title}")
            
            # 更新进度：准备阶段
            await progress_callback.update(0, 100, "准备下载...")
            
            # 获取视频信息
            media_id = task.media_id
            quality = subtask.params.get('quality', 80)
            
            # 生成输出文件名
            safe_title = self._safe_filename(task.title or media_id)
            filename = f"{safe_title}.mp4"
            
            # 设置输出路径
            from pathlib import Path
            output_dir = Path("downloads") / "videos"
            output_path = self._get_output_path(output_dir, filename)
            
            # 更新子任务输出路径
            subtask.output_path = str(output_path)
            
            # 更新进度：开始下载
            await progress_callback.update(10, 100, "开始下载视频...")
            
            # 创建进度回调函数
            async def download_progress_callback(downloaded: int, total: int, speed: float):
                # 将下载进度映射到 10-90%
                if total > 0:
                    download_progress = (downloaded / total) * 80  # 80% 用于下载
                    overall_progress = 10 + download_progress
                    await progress_callback.update(
                        int(overall_progress), 
                        100, 
                        f"下载中... {speed/1024/1024:.1f}MB/s"
                    )
            
            # 执行下载
            success = await self.download_engine.download_video(
                media_id=media_id,
                output_path=str(output_path),
                quality=quality,
                progress_callback=download_progress_callback
            )
            
            if success:
                # 更新进度：完成
                await progress_callback.update(100, 100, "视频下载完成")
                
                # 更新子任务文件大小
                if output_path.exists():
                    subtask.file_size = output_path.stat().st_size
                
                logger.info(f"✅ 视频下载成功: {filename}")
                return True
            else:
                logger.error(f"❌ 视频下载失败: {filename}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 视频下载异常: {e}")
            await progress_callback.update(0, 100, f"下载失败: {str(e)}")
            return False

    async def prepare(self, task: Task, subtask: SubTask) -> Dict[str, Any]:
        """准备视频下载数据"""
        return {
            "media_id": task.media_id,
            "title": task.title,
            "quality": subtask.params.get('quality', 80),
            "codec": subtask.params.get('codec', 'avc'),
            "audio_bitrate": subtask.params.get('audio_bitrate', 192)
        }


class AudioHandler(BaseHandler):
    """音频下载处理器"""

    def __init__(self):
        super().__init__()
        self.download_engine = DownloadEngine()

    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        """执行音频下载"""
        try:
            logger.info(f"🎵 开始下载音频: {task.title}")
            
            await progress_callback.update(0, 100, "准备下载音频...")
            
            # 获取音频信息
            media_id = task.media_id
            bitrate = subtask.params.get('audio_bitrate', 192)
            
            # 生成输出文件名
            safe_title = self._safe_filename(task.title or media_id)
            filename = f"{safe_title}.m4a"
            
            # 设置输出路径
            output_dir = Path("downloads") / "audio"
            output_path = self._get_output_path(output_dir, filename)
            subtask.output_path = str(output_path)
            
            await progress_callback.update(10, 100, "开始下载音频...")
            
            # 创建进度回调
            async def download_progress_callback(downloaded: int, total: int, speed: float):
                if total > 0:
                    download_progress = (downloaded / total) * 80
                    overall_progress = 10 + download_progress
                    await progress_callback.update(
                        int(overall_progress), 
                        100, 
                        f"下载音频... {speed/1024/1024:.1f}MB/s"
                    )
            
            # 执行音频下载
            success = await self.download_engine.download_audio(
                media_id=media_id,
                output_path=str(output_path),
                bitrate=bitrate,
                progress_callback=download_progress_callback
            )
            
            if success:
                await progress_callback.update(100, 100, "音频下载完成")
                
                if output_path.exists():
                    subtask.file_size = output_path.stat().st_size
                
                logger.info(f"✅ 音频下载成功: {filename}")
                return True
            else:
                logger.error(f"❌ 音频下载失败: {filename}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 音频下载异常: {e}")
            await progress_callback.update(0, 100, f"下载失败: {str(e)}")
            return False
