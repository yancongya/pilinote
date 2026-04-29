from typing import Dict, Any
from pathlib import Path
import logging
import asyncio
import xml.etree.ElementTree as ET

from .base import BaseHandler, ProgressCallback
from src.models.task import Task, SubTask

logger = logging.getLogger(__name__)


class DanmakuHandler(BaseHandler):
    """弹幕下载处理器"""

    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        """执行弹幕下载"""
        try:
            logger.info(f"🎭 开始下载弹幕: {task.title}")
            
            await progress_callback.update(0, 100, "准备下载弹幕...")
            
            # 获取必要信息
            media_id = task.media_id
            aid = task.meta.get('aid')
            cid = task.meta.get('cid')
            
            # 如果没有 aid/cid，尝试获取
            if not aid or not cid:
                await progress_callback.update(10, 100, "获取视频信息...")
                aid, cid = await self._get_video_info(media_id)
            
            if not aid or not cid:
                logger.warning(f"弹幕下载缺少 aid/cid，跳过: {media_id}")
                await progress_callback.update(100, 100, "跳过弹幕下载（缺少信息）")
                return True  # 不算失败，只是跳过
            
            await progress_callback.update(20, 100, "获取弹幕数据...")
            
            # 获取弹幕数据
            danmaku_data = await self._get_danmaku_data(aid, cid)
            
            if not danmaku_data:
                logger.info(f"视频 {media_id} 没有弹幕数据")
                await progress_callback.update(100, 100, "无弹幕数据")
                return True
            
            await progress_callback.update(50, 100, f"处理 {len(danmaku_data)} 条弹幕")
            
            # 获取文件路径（使用文件组织器）
            from ..file_organizer import file_organizer
            
            task_data = {
                'media_type': task.media_type,
                'title': task.title,
                'uploader': task.meta.get('owner', {}).get('name', 'Unknown'),
                'meta': task.meta
            }
            
            # 获取弹幕文件路径
            danmaku_xml_path = file_organizer.get_file_path(task_data, 'danmaku', 'xml')
            danmaku_ass_path = file_organizer.get_file_path(task_data, 'danmaku', 'ass')
            
            # 生成多种格式的弹幕文件
            success_count = 0
            
            # 1. 生成 XML 格式（B站原始格式）
            await progress_callback.update(60, 100, "生成 XML 格式弹幕")
            xml_success = await self._save_xml_danmaku(danmaku_data, danmaku_xml_path)
            if xml_success:
                success_count += 1
            
            # 2. 生成 ASS 格式（字幕格式）
            await progress_callback.update(80, 100, "生成 ASS 格式弹幕")
            ass_success = await self._save_ass_danmaku(danmaku_data, danmaku_ass_path, task.meta)
            if ass_success:
                success_count += 1
            
            # 更新子任务输出路径
            subtask.output_path = str(danmaku_xml_path.parent)
            
            await progress_callback.update(100, 100, f"弹幕下载完成 ({success_count}/2 格式)")
            
            logger.info(f"✅ 弹幕下载完成: {success_count}/2 格式")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"❌ 弹幕下载异常: {e}")
            await progress_callback.update(0, 100, f"弹幕下载失败: {str(e)}")
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
                    aid = int(data.get("aid", 0)) if data.get("aid") else None
                    
                    pages = data.get("pages", [])
                    cid = int(pages[0].get("cid", 0)) if pages and pages[0].get("cid") else None
                    
                    return aid, cid
            finally:
                bilibili_service.close()
                
        except Exception as e:
            logger.error(f"获取视频信息失败: {e}")
        
        return None, None

    async def _get_danmaku_data(self, aid: int, cid: int) -> list:
        """获取弹幕数据"""
        try:
            import aiohttp
            import gzip
            
            # B站弹幕API
            danmaku_url = f"https://comment.bilibili.com/{cid}.xml"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(danmaku_url) as response:
                    if response.status == 200:
                        # 检查是否是gzip压缩
                        content_encoding = response.headers.get('Content-Encoding', '')
                        content = await response.read()
                        
                        if content_encoding == 'gzip':
                            content = gzip.decompress(content)
                        
                        # 解析XML
                        xml_text = content.decode('utf-8')
                        root = ET.fromstring(xml_text)
                        
                        danmaku_list = []
                        for d_elem in root.findall('d'):
                            p_attr = d_elem.get('p', '')
                            text = d_elem.text or ''
                            
                            if p_attr and text:
                                # 解析弹幕属性: 时间,模式,字号,颜色,时间戳,池,用户ID,弹幕ID
                                parts = p_attr.split(',')
                                if len(parts) >= 8:
                                    danmaku_list.append({
                                        'time': float(parts[0]),
                                        'mode': int(parts[1]),
                                        'fontsize': int(parts[2]),
                                        'color': int(parts[3]),
                                        'timestamp': int(parts[4]),
                                        'pool': int(parts[5]),
                                        'user_id': parts[6],
                                        'danmaku_id': parts[7],
                                        'text': text
                                    })
                        
                        return danmaku_list
                        
        except Exception as e:
            logger.error(f"获取弹幕数据失败: {e}")
        
        return []

    async def _save_xml_danmaku(self, danmaku_data: list, output_path: Path) -> bool:
        """保存XML格式弹幕"""
        try:
            # 创建XML结构
            root = ET.Element('i')
            
            for danmaku in danmaku_data:
                d_elem = ET.SubElement(root, 'd')
                
                # 重建p属性
                p_attr = f"{danmaku['time']},{danmaku['mode']},{danmaku['fontsize']},{danmaku['color']},{danmaku['timestamp']},{danmaku['pool']},{danmaku['user_id']},{danmaku['danmaku_id']}"
                d_elem.set('p', p_attr)
                d_elem.text = danmaku['text']
            
            # 确保输出目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 格式化XML
            from xml.dom import minidom
            rough_string = ET.tostring(root, encoding='unicode')
            reparsed = minidom.parseString(rough_string)
            pretty_xml = reparsed.toprettyxml(indent="  ", encoding=None)
            
            output_path.write_text(pretty_xml, encoding='utf-8')
            
            logger.info(f"✅ XML弹幕保存成功: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"保存XML弹幕失败: {e}")
            return False

    async def _save_ass_danmaku(self, danmaku_data: list, output_path: Path, video_meta: dict) -> bool:
        """保存ASS格式弹幕"""
        try:
            # ASS文件头
            ass_header = """[Script Info]
Title: Danmaku
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Danmaku,SimHei,25,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
            
            ass_lines = [ass_header]
            
            # 获取视频分辨率（用于弹幕定位）
            video_width = video_meta.get('width', 1920)
            video_height = video_meta.get('height', 1080)
            
            for danmaku in danmaku_data:
                start_time = self._seconds_to_ass_time(danmaku['time'])
                end_time = self._seconds_to_ass_time(danmaku['time'] + 5)  # 弹幕显示5秒
                
                # 根据弹幕模式设置效果
                mode = danmaku['mode']
                text = danmaku['text'].replace('\n', '\\N')
                
                if mode == 1:  # 滚动弹幕
                    effect = f"\\move({video_width + 100}, {video_height // 2}, {-100}, {video_height // 2})"
                elif mode == 4:  # 底部弹幕
                    effect = f"\\pos({video_width // 2}, {video_height - 50})"
                elif mode == 5:  # 顶部弹幕
                    effect = f"\\pos({video_width // 2}, 50)"
                else:  # 默认滚动
                    effect = f"\\move({video_width + 100}, {video_height // 2}, {-100}, {video_height // 2})"
                
                # 颜色转换
                color = danmaku['color']
                ass_color = f"&H00{color:06X}&"
                
                ass_line = f"Dialogue: 0,{start_time},{end_time},Danmaku,,0,0,0,,{{{effect}\\c{ass_color}}}{text}"
                ass_lines.append(ass_line)
            
            # 保存文件
            output_path.parent.mkdir(parents=True, exist_ok=True)
            ass_content = '\n'.join(ass_lines)
            output_path.write_text(ass_content, encoding='utf-8')
            
            logger.info(f"✅ ASS弹幕保存成功: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"保存ASS弹幕失败: {e}")
            return False

    def _seconds_to_ass_time(self, seconds: float) -> str:
        """将秒数转换为ASS时间格式"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        
        return f"{hours:01d}:{minutes:02d}:{secs:05.2f}"
