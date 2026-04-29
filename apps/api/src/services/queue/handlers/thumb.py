from typing import Dict, Any
from pathlib import Path
import logging
import asyncio

from .base import BaseHandler, ProgressCallback
from src.models.task import Task, SubTask

logger = logging.getLogger(__name__)


class CoverHandler(BaseHandler):
    """封面下载处理器"""

    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        """执行封面下载"""
        try:
            logger.info(f"🖼️ 开始下载封面: {task.title}")
            
            await progress_callback.update(0, 100, "准备下载封面...")
            
            # 获取封面URL
            cover_url = task.cover or task.meta.get('pic') or task.meta.get('cover')
            
            if not cover_url:
                logger.info(f"视频 {task.media_id} 没有封面URL")
                await progress_callback.update(100, 100, "无封面URL")
                return True  # 没有封面不算失败
            
            await progress_callback.update(20, 100, "下载封面图片...")
            
            # 获取文件路径（使用文件组织器）
            from ..file_organizer import file_organizer
            
            task_data = {
                'media_type': task.media_type,
                'title': task.title,
                'uploader': task.meta.get('owner', {}).get('name', 'Unknown'),
                'meta': task.meta
            }
            
            # 获取封面文件路径
            cover_path = file_organizer.get_file_path(task_data, 'cover', 'jpg')
            
            # 下载封面
            success = await self._download_image(cover_url, cover_path, progress_callback)
            
            if success:
                # 更新子任务输出路径和文件大小
                subtask.output_path = str(cover_path)
                if cover_path.exists():
                    subtask.file_size = cover_path.stat().st_size
                
                await progress_callback.update(100, 100, "封面下载完成")
                logger.info(f"✅ 封面下载成功: {cover_path}")
                return True
            else:
                logger.error(f"❌ 封面下载失败: {cover_url}")
                return False
                
        except Exception as e:
            logger.error(f"❌ 封面下载异常: {e}")
            await progress_callback.update(0, 100, f"封面下载失败: {str(e)}")
            return False

    async def _download_image(self, url: str, output_path: Path, progress_callback: ProgressCallback) -> bool:
        """下载图片文件"""
        try:
            import aiohttp
            
            # 确保URL是完整的
            if url.startswith('//'):
                url = 'https:' + url
            elif url.startswith('/'):
                url = 'https://i0.hdslb.com' + url
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        total_size = int(response.headers.get('Content-Length', 0))
                        downloaded = 0
                        
                        with open(output_path, 'wb') as f:
                            async for chunk in response.content.iter_chunked(8192):
                                f.write(chunk)
                                downloaded += len(chunk)
                                
                                if total_size > 0:
                                    progress = 20 + (downloaded / total_size) * 60  # 20-80%
                                    await progress_callback.update(
                                        int(progress), 
                                        100, 
                                        f"下载中... {downloaded}/{total_size} 字节"
                                    )
                        
                        return True
                    else:
                        logger.error(f"下载图片失败，状态码: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"下载图片异常: {e}")
            return False

    def _get_image_extension(self, url: str) -> str:
        """从URL获取图片扩展名"""
        url_lower = url.lower()
        if '.jpg' in url_lower or '.jpeg' in url_lower:
            return '.jpg'
        elif '.png' in url_lower:
            return '.png'
        elif '.webp' in url_lower:
            return '.webp'
        elif '.gif' in url_lower:
            return '.gif'
        else:
            return '.jpg'  # 默认使用jpg


class AvatarHandler(BaseHandler):
    """UP主头像下载处理器"""

    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        """执行UP主头像下载"""
        try:
            logger.info(f"👤 开始下载UP主头像: {task.title}")
            
            await progress_callback.update(0, 100, "准备下载UP主头像...")
            
            # 获取UP主信息
            uploader_info = task.meta.get('owner') or task.meta.get('uploader_info')
            if not uploader_info:
                # 尝试从其他字段获取
                uploader_name = task.meta.get('uploader')
                if uploader_name:
                    uploader_info = {'name': uploader_name}
            
            if not uploader_info:
                logger.info(f"视频 {task.media_id} 没有UP主信息")
                await progress_callback.update(100, 100, "无UP主信息")
                return True
            
            # 获取头像URL
            avatar_url = uploader_info.get('face') or uploader_info.get('avatar')
            uploader_name = uploader_info.get('name', 'unknown')
            
            if not avatar_url:
                logger.info(f"UP主 {uploader_name} 没有头像URL")
                await progress_callback.update(100, 100, "无头像URL")
                return True
            
            await progress_callback.update(20, 100, f"下载UP主 {uploader_name} 的头像...")
            
            # 获取文件路径（使用文件组织器）
            from ..file_organizer import file_organizer
            
            task_data = {
                'media_type': task.media_type,
                'title': task.title,
                'uploader': uploader_name,
                'meta': task.meta
            }
            
            # 获取头像文件路径
            avatar_path = file_organizer.get_file_path(task_data, 'avatar', 'jpg')
            
            # 下载头像
            success = await self._download_image(avatar_url, avatar_path, progress_callback)
            
            if success:
                # 更新子任务输出路径和文件大小
                subtask.output_path = str(avatar_path)
                if avatar_path.exists():
                    subtask.file_size = avatar_path.stat().st_size
                
                await progress_callback.update(100, 100, "UP主头像下载完成")
                logger.info(f"✅ UP主头像下载成功: {avatar_path}")
                return True
            else:
                logger.error(f"❌ UP主头像下载失败: {avatar_url}")
                return False
                
        except Exception as e:
            logger.error(f"❌ UP主头像下载异常: {e}")
            await progress_callback.update(0, 100, f"头像下载失败: {str(e)}")
            return False

    async def _download_image(self, url: str, output_path: Path, progress_callback: ProgressCallback) -> bool:
        """下载图片文件"""
        try:
            import aiohttp
            
            # 确保URL是完整的
            if url.startswith('//'):
                url = 'https:' + url
            elif url.startswith('/'):
                url = 'https://i0.hdslb.com' + url
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        total_size = int(response.headers.get('Content-Length', 0))
                        downloaded = 0
                        
                        with open(output_path, 'wb') as f:
                            async for chunk in response.content.iter_chunked(8192):
                                f.write(chunk)
                                downloaded += len(chunk)
                                
                                if total_size > 0:
                                    progress = 20 + (downloaded / total_size) * 60  # 20-80%
                                    await progress_callback.update(
                                        int(progress), 
                                        100, 
                                        f"下载中... {downloaded}/{total_size} 字节"
                                    )
                        
                        return True
                    else:
                        logger.error(f"下载头像失败，状态码: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"下载头像异常: {e}")
            return False

    def _get_image_extension(self, url: str) -> str:
        """从URL获取图片扩展名"""
        url_lower = url.lower()
        if '.jpg' in url_lower or '.jpeg' in url_lower:
            return '.jpg'
        elif '.png' in url_lower:
            return '.png'
        elif '.webp' in url_lower:
            return '.webp'
        elif '.gif' in url_lower:
            return '.gif'
        else:
            return '.jpg'  # 默认使用jpg


# 向后兼容的别名
ThumbHandler = CoverHandler
UploaderAvatarHandler = AvatarHandler
