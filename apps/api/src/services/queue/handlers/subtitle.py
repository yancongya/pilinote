from typing import Dict, Any
from pathlib import Path
import logging
import asyncio

from .base import BaseHandler, ProgressCallback
from src.models.task import Task, SubTask

logger = logging.getLogger(__name__)


def _to_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


class SubtitleHandler(BaseHandler):
    """字幕下载处理器"""

    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        """执行字幕下载"""
        try:
            logger.info(f"📝 开始下载字幕: {task.title}")
            
            await progress_callback.update(0, 100, "准备下载字幕...")
            
            # 获取必要信息
            media_id = task.media_id
            aid = task.meta.get('aid')
            cid = task.meta.get('cid')
            
            # 如果没有 aid/cid，尝试获取
            if not aid or not cid:
                await progress_callback.update(10, 100, "获取视频信息...")
                aid, cid = await self._get_video_info(media_id)
            
            if not aid or not cid:
                logger.warning(f"字幕下载缺少 aid/cid，跳过: {media_id}")
                await progress_callback.update(100, 100, "跳过字幕下载（缺少信息）")
                return True  # 不算失败，只是跳过
            
            await progress_callback.update(20, 100, "获取字幕列表...")
            
            # 获取字幕列表
            subtitles = await self._get_subtitle_list(aid, cid)
            
            if not subtitles:
                logger.info(f"视频 {media_id} 没有可用字幕")
                await progress_callback.update(100, 100, "无可用字幕")
                return True
            
            await progress_callback.update(30, 100, f"找到 {len(subtitles)} 个字幕")
            
            # 设置输出目录
            safe_title = self._safe_filename(task.title or media_id)
            output_dir = Path("downloads") / "subtitles" / safe_title
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # 下载字幕
            downloaded_count = 0
            total_subtitles = len(subtitles)
            
            for i, subtitle_info in enumerate(subtitles):
                lang = subtitle_info.get('lan_doc', subtitle_info.get('lan', 'unknown'))
                
                progress = 30 + (i / total_subtitles) * 60  # 30-90%
                await progress_callback.update(
                    int(progress), 
                    100, 
                    f"下载字幕: {lang}"
                )
                
                success = await self._download_single_subtitle(
                    subtitle_info, 
                    output_dir, 
                    safe_title
                )
                
                if success:
                    downloaded_count += 1
            
            # 更新子任务输出路径
            subtask.output_path = str(output_dir)
            
            await progress_callback.update(100, 100, f"字幕下载完成 ({downloaded_count}/{total_subtitles})")
            
            logger.info(f"✅ 字幕下载完成: {downloaded_count}/{total_subtitles}")
            return downloaded_count > 0
            
        except Exception as e:
            logger.error(f"❌ 字幕下载异常: {e}")
            await progress_callback.update(0, 100, f"字幕下载失败: {str(e)}")
            return False

    async def _get_video_info(self, media_id: str) -> tuple[int, int]:
        """获取视频的 aid 和 cid"""
        try:
            from src.services.bilibili import BilibiliService
            
            bilibili_service = BilibiliService()
            try:
                video_info = await bilibili_service.get_video_info(media_id)
                if video_info.get("success"):
                    data = video_info.get("data", {})
                    aid = _to_int(data.get("aid"))
                    
                    pages = data.get("pages", [])
                    cid = _to_int(pages[0].get("cid")) if pages else None
                    
                    return aid, cid
            finally:
                bilibili_service.close()
                
        except Exception as e:
            logger.error(f"获取视频信息失败: {e}")
        
        return None, None

    async def _get_subtitle_list(self, aid: int, cid: int) -> list:
        """获取字幕列表"""
        try:
            from src.services.bilibili import BilibiliService
            
            bilibili_service = BilibiliService()
            try:
                # 获取字幕信息
                subtitle_info = await bilibili_service.get_subtitle_info(aid, cid)
                if subtitle_info.get("success"):
                    data = subtitle_info.get("data", {})
                    subtitles = data.get("subtitle", {}).get("subtitles", [])
                    return subtitles
            finally:
                bilibili_service.close()
                
        except Exception as e:
            logger.error(f"获取字幕列表失败: {e}")
        
        return []

    async def _download_single_subtitle(self, subtitle_info: dict, output_dir: Path, base_filename: str) -> bool:
        """下载单个字幕文件"""
        try:
            import aiohttp
            import json
            
            subtitle_url = subtitle_info.get("subtitle_url")
            if not subtitle_url:
                return False
            
            # 确保URL是完整的
            if subtitle_url.startswith("//"):
                subtitle_url = "https:" + subtitle_url
            elif subtitle_url.startswith("/"):
                subtitle_url = "https://api.bilibili.com" + subtitle_url
            
            lang = subtitle_info.get('lan_doc', subtitle_info.get('lan', 'unknown'))
            
            # 下载字幕内容
            async with aiohttp.ClientSession() as session:
                async with session.get(subtitle_url) as response:
                    if response.status == 200:
                        subtitle_data = await response.json()
                        
                        # 转换为 SRT 格式
                        srt_content = self._convert_to_srt(subtitle_data)
                        
                        # 保存文件
                        filename = f"{base_filename}.{lang}.srt"
                        output_path = output_dir / filename
                        
                        output_path.write_text(srt_content, encoding='utf-8')
                        
                        logger.info(f"✅ 字幕下载成功: {filename}")
                        return True
            
        except Exception as e:
            logger.error(f"下载字幕失败: {e}")
        
        return False

    def _convert_to_srt(self, subtitle_data: dict) -> str:
        """将B站字幕格式转换为SRT格式"""
        try:
            body = subtitle_data.get("body", [])
            srt_lines = []
            
            for i, item in enumerate(body, 1):
                start_time = item.get("from", 0)
                end_time = item.get("to", 0)
                content = item.get("content", "")
                
                # 转换时间格式
                start_srt = self._seconds_to_srt_time(start_time)
                end_srt = self._seconds_to_srt_time(end_time)
                
                # 添加SRT条目
                srt_lines.append(f"{i}")
                srt_lines.append(f"{start_srt} --> {end_srt}")
                srt_lines.append(content)
                srt_lines.append("")  # 空行
            
            return "\n".join(srt_lines)
            
        except Exception as e:
            logger.error(f"字幕格式转换失败: {e}")
            return ""

    def _seconds_to_srt_time(self, seconds: float) -> str:
        """将秒数转换为SRT时间格式"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millisecs = int((seconds % 1) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"
