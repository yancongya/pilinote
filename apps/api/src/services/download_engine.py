"""
下载引擎 - 集成yt-dlp实现视频下载
"""
import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, Callable

import yt_dlp

logger = logging.getLogger(__name__)


class DownloadEngine:
    """
    下载引擎 - 使用yt-dlp下载视频
    
    功能：
    - 视频下载
    - 进度回调
    - 格式转换
    - 暂停支持
    """
    
    def __init__(self):
        self.yt_dlp_path = "yt-dlp"
        self.ffmpeg_path = "ffmpeg"
    
    async def download_video(
        self,
        bvid: str,
        quality: int,
        output_format: str,
        output_path: str,
        sessdata: Optional[str] = None,
        progress_callback: Optional[Callable] = None,
        pause_event: Optional[asyncio.Event] = None
    ):
        """
        下载视频
        
        Args:
            bvid: B站视频ID
            quality: 视频质量 (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)
            output_format: 输出格式 (mp4, flv, mkv)
            output_path: 输出路径
            sessdata: 用户SESSDATA
            progress_callback: 进度回调函数
            pause_event: 暂停事件
        """
        # 创建输出目录
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 根据质量构建格式选择
        format_str = self._build_format_string(quality)
        
        # 构建yt-dlp配置
        ydl_opts = {
            'format': format_str,
            'outtmpl': str(output_dir / '%(title)s.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
            'merge_output_format': output_format,
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': output_format,
            }],
            'progress_hooks': [],
        }
        
        # 添加进度回调
        if progress_callback:
            def progress_hook(d):
                """进度回调函数"""
                if d['status'] == 'downloading':
                    total_bytes = d.get('total_bytes', 0) or d.get('total_bytes_estimate', 0) or 0
                    downloaded_bytes = d.get('downloaded_bytes', 0) or 0
                    
                    # 计算进度百分比
                    if total_bytes > 0:
                        progress = (downloaded_bytes / total_bytes) * 100
                    else:
                        progress = 0.0
                    
                    # 获取速度和ETA
                    speed = d.get('speed') or 0
                    download_speed = speed / 1024 if speed else 0.0
                    eta = d.get('eta') or 0
                    
                    progress_callback(d.get('info_dict', {}).get('display_id', ''), progress, downloaded_bytes, total_bytes, download_speed, eta)
                elif d['status'] == 'finished':
                    progress_callback(d.get('info_dict', {}).get('display_id', ''), 100.0, d.get('total_bytes', 0), d.get('total_bytes', 0), 0.0, 0.0)
            
            ydl_opts['progress_hooks'].append(progress_hook)
        
        # 添加SESSDATA
        if sessdata:
            cookie_file = output_dir / 'cookies.txt'
            with open(cookie_file, 'w') as f:
                f.write(f".bilibili.com\tTRUE\t/\tFALSE\t0\tSESSDATA\t{sessdata}\n")
            ydl_opts['cookiefile'] = str(cookie_file)
        
        try:
            # 执行下载
            logger.info(f"Starting download: {bvid}, quality: {quality}, format: {output_format}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 在单独的线程中运行下载以避免阻塞
                await asyncio.to_thread(ydl.download, [f'https://www.bilibili.com/video/{bvid}'])
            
            logger.info(f"Download completed: {bvid}")
            
        except asyncio.CancelledError:
            logger.info(f"Download cancelled: {bvid}")
            raise
        except Exception as e:
            logger.error(f"Download failed: {bvid}, error: {e}")
            raise
    
    async def extract_audio(self, video_path: str, output_path: str):
        """
        提取音频
        
        Args:
            video_path: 视频文件路径
            output_path: 音频输出路径
        """
        import subprocess
        
        cmd = [
            self.ffmpeg_path,
            '-i', video_path,
            '-vn',  # 禁用视频
            '-acodec', 'libmp3lame',  # 使用MP3编码
            '-ab', '192k',  # 音频比特率
            output_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"Audio extraction failed: {stderr.decode()}")
    
    async def convert_format(self, input_path: str, output_path: str, output_format: str):
        """
        转换格式
        
        Args:
            input_path: 输入文件路径
            output_path: 输出文件路径
            output_format: 输出格式
        """
        import subprocess
        
        cmd = [
            self.ffmpeg_path,
            '-i', input_path,
            '-c', 'copy',  # 复制流，不重新编码
            output_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"Format conversion failed: {stderr.decode()}")
    
    def _build_format_string(self, quality: int) -> str:
        """
        根据质量构建yt-dlp格式字符串
        
        Args:
            quality: 视频质量代码
            
        Returns:
            格式字符串
        """
        # B站质量代码到视频高度的映射
        quality_map = {
            16: 360,   # 360P 流畅
            32: 480,   # 480P 清晰
            64: 720,   # 720P 高清
            80: 1080,  # 1080P 高清
            112: 1080, # 1080P+ 高码率
            116: 2160  # 4K 超清
        }
        
        height = quality_map.get(quality, 720)
        
        # 构建格式字符串，优先选择指定高度的MP4格式
        # 格式说明：
        # bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a] - 选择最佳MP4视频（<=720P）+ 最佳音频
        # bestvideo[height<=720]+bestaudio - 选择最佳视频（<=720P）+ 最佳音频
        # best[ext=mp4] - 选择最佳MP4格式
        # best - 选择最佳格式
        
        format_str = f'bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/bestvideo[height<={height}]+bestaudio/best[ext=mp4]/best'
        
        return format_str
    
    def get_supported_formats(self) -> list:
        """
        获取支持的格式列表
        
        Returns:
            格式列表
        """
        return ['mp4', 'flv', 'mkv', 'webm']
    
    def get_supported_qualities(self) -> list:
        """
        获取支持的质量列表
        
        Returns:
            质量列表
        """
        return [
            {'qn': 16, 'desc': '360P 流畅', 'height': 360},
            {'qn': 32, 'desc': '480P 清晰', 'height': 480},
            {'qn': 64, 'desc': '720P 高清', 'height': 720},
            {'qn': 80, 'desc': '1080P 高清', 'height': 1080},
            {'qn': 112, 'desc': '1080P+ 高码率', 'height': 1080},
            {'qn': 116, 'desc': '4K 超清', 'height': 2160},
        ]
