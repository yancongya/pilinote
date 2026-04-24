"""
下载引擎 - 集成yt-dlp实现视频下载
"""
import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, Callable

import yt_dlp

from src.utils.error_handler import ErrorHandler, handle_error

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
    
    def _auto_detect_aria2c(self):
        """自动检测 aria2c（优先使用项目内工具）"""
        print("=== _auto_detect_aria2c called ===")
        
        # 优先检查项目内工具
        from pathlib import Path
        import platform
        
        script_dir = Path(__file__).parent.parent.parent
        system = platform.system().lower()
        
        if system == 'darwin':
            platform_dir = 'macos'
        elif system == 'linux':
            platform_dir = 'linux'
        elif system == 'windows':
            platform_dir = 'windows'
        else:
            platform_dir = None
        
        if platform_dir:
            project_aria2c = script_dir / 'tools' / platform_dir / 'aria2c'
            if project_aria2c.exists() and project_aria2c.is_file():
                logger.info(f"Found aria2c in project: {project_aria2c}")
                print(f"✓ Found aria2c in project: {project_aria2c}")
                self.aria2c_path = str(project_aria2c)
                return
        
        # 回退到系统工具
        import shutil
        if shutil.which('aria2c'):
            system_path = shutil.which('aria2c')
            logger.info(f"Found aria2c in system: {system_path}")
            print(f"✓ Found aria2c in system: {system_path}")
            self.aria2c_path = system_path
            return
        
        logger.info("aria2c not found, will use yt-dlp built-in downloader")
        print("✗ aria2c not found")
    
    def _auto_detect_ffmpeg(self):
        """自动检测 ffmpeg（优先使用项目内工具）"""
        print("=== _auto_detect_ffmpeg called ===")
        
        # 优先检查项目内工具
        from pathlib import Path
        import platform
        
        script_dir = Path(__file__).parent.parent.parent
        system = platform.system().lower()
        
        if system == 'darwin':
            platform_dir = 'macos'
        elif system == 'linux':
            platform_dir = 'linux'
        elif system == 'windows':
            platform_dir = 'windows'
        else:
            platform_dir = None
        
        if platform_dir:
            project_ffmpeg = script_dir / 'tools' / platform_dir / 'ffmpeg'
            if project_ffmpeg.exists() and project_ffmpeg.is_file():
                logger.info(f"Found ffmpeg in project: {project_ffmpeg}")
                print(f"✓ Found ffmpeg in project: {project_ffmpeg}")
                self.ffmpeg_path = str(project_ffmpeg)
                return
        
        # 回退到系统工具
        import shutil
        if shutil.which('ffmpeg'):
            system_path = shutil.which('ffmpeg')
            logger.info(f"Found ffmpeg in system: {system_path}")
            print(f"✓ Found ffmpeg in system: {system_path}")
            self.ffmpeg_path = system_path
            return
        
        logger.info("ffmpeg not found, will use default 'ffmpeg'")
        print("✗ ffmpeg not found")
    
    def __init__(self, settings=None):
        """
        初始化下载引擎
        
        Args:
            settings: Settings对象，包含自定义工具路径
        """
        # 默认路径
        self.yt_dlp_path = "yt-dlp"
        self.ffmpeg_path = "ffmpeg"
        self.aria2c_path = "aria2c"
        
        # 从设置中读取自定义路径
        if settings and hasattr(settings, 'storage') and settings.storage.sidecar:
            sidecar = settings.storage.sidecar
            if sidecar:
                self.yt_dlp_path = sidecar.get('yt_dlp', self.yt_dlp_path)
                self.ffmpeg_path = sidecar.get('ffmpeg', self.ffmpeg_path)
                self.aria2c_path = sidecar.get('aria2c', self.aria2c_path)
                
                logger.info(f"Using custom tool paths: yt-dlp={self.yt_dlp_path}, ffmpeg={self.ffmpeg_path}, aria2c={self.aria2c_path}")
        
        # 自动检测工具路径（如果用户没有自定义）
        if self.ffmpeg_path == "ffmpeg":
            self._auto_detect_ffmpeg()
        if self.aria2c_path == "aria2c":
            self._auto_detect_aria2c()
    
    async def download_video(
        self,
        bvid: str,
        quality: int,
        output_format: str,
        output_path: str,
        sessdata: Optional[str] = None,
        progress_callback: Optional[Callable] = None,
        pause_event: Optional[asyncio.Event] = None,
        cid: Optional[int] = None,
        page_num: Optional[int] = None,
        audio_bitrate: Optional[int] = 192,
        codec: Optional[str] = 'avc',
        download_id: Optional[str] = None
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
            cid: 视频分P ID
            audio_bitrate: 音频码率 (64/128/132/192/30232/30251/30250)
            codec: 视频编码 (avc/hevc/av1/vp9)
            download_id: 下载任务ID（用于进度回调）
        """
        # 创建输出目录
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 根据质量、编码和音频码率构建格式选择
        format_str = self._build_format_string(quality, codec, audio_bitrate)
        
        # 构建后处理器配置
        postprocessors = []
        
        # 添加视频转换器（仅当需要转换格式时）
        postprocessors.append({
            'key': 'FFmpegVideoConvertor',
            'preferedformat': output_format,
        })
        
        # 构建yt-dlp配置
        if page_num:
            outtmpl = str(output_dir / '%(title)s-P%(playlist_index)s.%(ext)s')
        else:
            outtmpl = str(output_dir / '%(title)s.%(ext)s')

        ydl_opts = {
            'format': format_str,
            'outtmpl': outtmpl,
            'quiet': False,
            'no_warnings': True,
            'merge_output_format': output_format,
            'postprocessors': postprocessors,
            'progress_hooks': [],
            # SSL/TLS相关配置
            'nocheckcertificate': False,  # 默认检查证书
            'prefer_insecure': False,     # 不优先使用不安全连接
            # 网络相关配置
            'socket_timeout': 30,         # 增加超时时间
            'retries': 3,                 # 增加重试次数
            'retry_sleep': 5,            # 重试间隔
            'fragment_retries': 3,       # 分片重试次数
            # HTTP请求头优化
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            },
        }
        
        # 使用自定义的ffmpeg路径
        if self.ffmpeg_path != 'ffmpeg':
            ydl_opts['ffmpeg_location'] = self.ffmpeg_path
            logger.info(f"Using custom FFmpeg path: {self.ffmpeg_path}")
        
        # 添加 Aria2c 配置（如果可用）
        if self._check_aria2c_available():
            ydl_opts['external_downloader'] = self.aria2c_path
            ydl_opts['external_downloader_args'] = [
                '-x', '4',                    # 4个连接（降低被检测风险）
                '-k', '1M',                    # 每个连接分块1MB
                '--max-tries=5',             # 最多重试5次
                '--retry-wait=10',           # 重试等待10秒
                '--timeout=60',              # 60秒超时
                '--max-connection-per-server=4',  # 每服务器最大连接数
                '--split=4',                 # 分成4块下载
                '--min-split-size=1M',       # 最小分片1MB
                '--continue=true',           # 启用断点续传
                '--check-certificate=false', # 跳过证书验证
                '--allow-overwrite=true',    # 允许覆盖
                '--auto-file-renaming=false', # 不自动重命名
                '--summary-interval=0',      # 减少输出
            ]
            logger.info(f"Using Aria2c downloader: {self.aria2c_path}")
            logger.info(f"Aria2c configuration: 4 connections, 1MB chunks (optimized for stability)")
        else:
            logger.info("Using yt-dlp built-in downloader")
        
        logger.info(f"Download parameters: quality={quality}, codec={codec}, audio_bitrate={audio_bitrate}, format={output_format}")
        
        # 如果指定了page_num，只下载特定的分P
        if page_num:
            ydl_opts['playlist_items'] = str(page_num)
            logger.info(f"Downloading specific part: page={page_num}, cid={cid}")
        else:
            logger.info(f"Downloading all parts for bvid={bvid}")
        
        logger.info(f"Download parameters: quality={quality}, codec={codec}, audio_bitrate={audio_bitrate}, format={output_format}")
        
        # 添加进度回调
        if progress_callback:
            def progress_hook(d):
                """进度回调函数"""
                # 检查是否暂停
                if pause_event:
                    if pause_event.is_set():
                        raise asyncio.CancelledError("Download paused or cancelled")
                
                status = d.get('status')
                if status == 'downloading':
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
                    
                    # 添加日志
                    logger.info(f"Progress: {progress:.1f}%, {downloaded_bytes}/{total_bytes} bytes, {download_speed:.1f} KB/s, ETA: {eta}s")
                    
                    # 使用download_id或bvid
                    progress_callback(download_id or bvid, progress, downloaded_bytes, total_bytes, download_speed, eta)
                elif status == 'finished':
                    total_bytes = d.get('total_bytes', 0) or 0
                    logger.info(f"Download finished: {total_bytes} bytes")
                    progress_callback(download_id or bvid, 100.0, total_bytes, total_bytes, 0.0, 0.0)
                elif status == 'error':
                    logger.error(f"Download error: {d.get('error', 'Unknown error')}")
            
            ydl_opts['progress_hooks'].append(progress_hook)
        
        # 添加SESSDATA
        if sessdata:
            cookie_file = output_dir / 'cookies.txt'
            with open(cookie_file, 'w') as f:
                # Netscape cookie 格式
                f.write("# Netscape HTTP Cookie File\n")
                f.write("# This is a generated file! Do not edit.\n\n")
                f.write(f".bilibili.com\tTRUE\t/\tFALSE\t0\tSESSDATA\t{sessdata}\n")
            ydl_opts['cookiefile'] = str(cookie_file)
        
        try:
            # 执行下载
            logger.info(f"Starting download: {bvid}")
            use_aria2c = self._check_aria2c_available()
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # 在单独的线程中运行下载以避免阻塞
                    await asyncio.to_thread(ydl.download, [f'https://www.bilibili.com/video/{bvid}'])
                
                logger.info(f"Download completed: {bvid}")
                
            except Exception as download_error:
                # 使用错误处理器分类错误
                error_detail = ErrorHandler.classify_error(
                    download_error,
                    context={'bvid': bvid, 'use_aria2c': use_aria2c}
                )

                # 检查是否是aria2c错误
                error_str = str(download_error)
                if use_aria2c and ('aria2c' in error_str.lower() or 'exited with code' in error_str):
                    logger.warning(f"⚠️ Aria2c download failed for {bvid}: {error_detail.message}")
                    logger.warning(f"Error type: {error_detail.error_type}, Code: {error_detail.error_code}")
                    logger.warning(f"Possible causes: Network interruption, B站反爬 mechanism, or connection timeout")
                    logger.info(f"🔄 Falling back to yt-dlp built-in downloader (slower but more stable)")

                    # 移除aria2c配置，使用内置下载器重试
                    ydl_opts.pop('external_downloader', None)
                    ydl_opts.pop('external_downloader_args', None)

                    try:
                        logger.info(f"Retrying with built-in downloader: {bvid}")
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            await asyncio.to_thread(ydl.download, [f'https://www.bilibili.com/video/{bvid}'])

                        logger.info(f"✅ Download completed successfully with built-in downloader: {bvid}")
                    except Exception as fallback_error:
                        logger.error(f"❌ Built-in downloader also failed: {fallback_error}")
                        logger.error(f"Both aria2c and built-in downloader failed for {bvid}")
                        # 抛出组合错误信息
                        raise Exception(f"Download failed with both aria2c and built-in downloader. Aria2c error: {error_str}, Built-in error: {fallback_error}")
                else:
                    # 检查是否是SSL错误，如果是则尝试降级重试
                    error_str = str(download_error)
                    if ('ssl' in error_str.lower() or
                        'certificate' in error_str.lower() or
                        'tls' in error_str.lower() or
                        'unexpected_eof' in error_str.lower()):

                        logger.warning(f"⚠️ SSL错误检测到: {error_detail.message}")
                        logger.warning(f"Error type: {error_detail.error_type}, Code: {error_detail.error_code}")
                        logger.info(f"🔄 尝试SSL降级重试...")

                        # 创建SSL降级的配置
                        ssl_fallback_opts = ydl_opts.copy()
                        ssl_fallback_opts.update({
                            'nocheckcertificate': True,  # 跳过证书验证
                            'prefer_insecure': True,     # 允许不安全连接
                        })
                        # 移除可能导致问题的HTTP头
                        ssl_fallback_opts.pop('http_headers', None)

                        try:
                            logger.info(f"Retrying with SSL downgrade: {bvid}")
                            with yt_dlp.YoutubeDL(ssl_fallback_opts) as ydl:
                                await asyncio.to_thread(ydl.download, [f'https://www.bilibili.com/video/{bvid}'])

                            logger.info(f"✅ SSL降级重试成功: {bvid}")
                        except Exception as ssl_fallback_error:
                            logger.error(f"❌ SSL降级也失败: {ssl_fallback_error}")

                            # 最后尝试HTTP降级
                            try:
                                logger.info(f"🔄 最后尝试HTTP降级: {bvid}")
                                http_opts = ssl_fallback_opts.copy()
                                http_opts['forceurl'] = False

                                with yt_dlp.YoutubeDL(http_opts) as ydl:
                                    await asyncio.to_thread(ydl.download, [f'http://www.bilibili.com/video/{bvid}'])

                                logger.info(f"✅ HTTP降级成功: {bvid}")
                            except Exception as http_error:
                                logger.error(f"❌ 所有SSL降级策略都失败: {http_error}")
                                logger.error(f"SSL错误: {error_str}")
                                logger.error(f"SSL降级错误: {ssl_fallback_error}")
                                logger.error(f"HTTP降级错误: {http_error}")
                                raise Exception(f"Download failed after SSL downgrade attempts. Original: {error_str}, SSL fallback: {ssl_fallback_error}, HTTP fallback: {http_error}")
                    else:
                        # 非SSL错误，直接抛出
                        logger.error(f"❌ Download failed (non-aria2c, non-SSL): {error_detail.message}")
                        logger.error(f"Error type: {error_detail.error_type}, Code: {error_detail.error_code}")
                        logger.error(f"Recoverable: {error_detail.recoverable}, Suggestion: {error_detail.suggestion}")
                        raise download_error
            
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
    
    def _build_format_string(self, quality: int, codec: str = 'avc', audio_bitrate: Optional[int] = 192) -> str:
        """
        根据质量、编码和音频码率构建yt-dlp格式字符串
        
        Args:
            quality: 视频质量代码
            codec: 视频编码格式
            audio_bitrate: 音频码率（64/128/132/192/30232/30251/30250）
            
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
        
        # B站编码格式到codec的映射
        codec_map = {
            'avc': 'avc1',    # H.264
            'hevc': 'hevc',   # H.265
            'av1': 'av01',    # AV1
            'vp9': 'vp09',    # VP9
        }
        
        # B站音频码率到格式ID的映射
        # 注意：这些ID是根据实际视频的可用音频流确定的
        audio_format_map = {
            64: '30216',      # 64K - 低质量音频
            128: '30216',     # 128K - 标准质量（使用最低可用）
            132: '30216',     # 132K - 高质量
            192: '30280',     # 192K - 高质量
            30232: '30232',   # 杜比全景声320K
            30251: '30280',   # Hi-Res 无损（使用最高可用）
            30250: '30280',   # 无损FLAC（使用最高可用）
        }
        
        height = quality_map.get(quality, 720)
        video_codec = codec_map.get(codec, 'avc1')
        audio_format_id = audio_format_map.get(audio_bitrate, '30280')
        
        # 构建格式字符串
        # 优先选择指定的视频编码和音频质量
        # 音频质量通过指定格式ID来实现
        if audio_bitrate >= 30232:
            # 高质量音频：使用指定的音频格式ID
            format_str = (f'bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+{audio_format_id}/'
                         f'bestvideo[height<={height}][vcodec~={video_codec}]+{audio_format_id}/'
                         f'bestvideo[ext=mp4][height<={height}]+{audio_format_id}/'
                         f'bestvideo[height<={height}]+{audio_format_id}/'
                         f'bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+bestaudio[ext=m4a]/'
                         f'bestvideo[height<={height}][vcodec~={video_codec}]+bestaudio/'
                         f'bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/'
                         f'bestvideo[height<={height}]+bestaudio/best[ext=mp4]/best')
        else:
            # 普通音频：使用bestaudio
            format_str = (f'bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+bestaudio[ext=m4a]/'
                         f'bestvideo[height<={height}][vcodec~={video_codec}]+bestaudio/'
                         f'bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/'
                         f'bestvideo[height<={height}]+bestaudio/best[ext=mp4]/best')
        
        logger.debug(f"Built format string: {format_str} (quality={quality}, codec={codec}, audio_bitrate={audio_bitrate})")
        
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

    def _check_aria2c_available(self) -> bool:
        """
        检查 Aria2c 是否可用
        
        Returns:
            bool: Aria2c 是否可用
        """
        import shutil
        
        # 如果使用默认路径，不使用
        if self.aria2c_path == 'aria2c':
            return False
        
        # 检查自定义路径是否存在
        return shutil.which(self.aria2c_path) is not None

    def get_download_stats(self) -> dict:
        """
        获取下载引擎统计信息
        
        Returns:
            Dict: 统计信息
        """
        return {
            'yt_dlp_path': self.yt_dlp_path,
            'ffmpeg_path': self.ffmpeg_path,
            'aria2c_path': self.aria2c_path,
            'aria2c_available': self._check_aria2c_available(),
            'supported_formats': self.get_supported_formats(),
            'supported_qualities': self.get_supported_qualities(),
        }
