"""
下载引擎

主下载路径：
- queue_manager -> TaskService -> DownloadEngine

职责边界：
- yt-dlp: 只负责解析媒体流与在必要时兜底下载
- aria2c: 主媒体传输器
- ffmpeg: 合并/转封装

兼容层（DownloadService / DownloadManager）仍可调用本类，但不再是功能权威入口。
"""
import asyncio
import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

import yt_dlp

from src.utils.error_handler import ErrorHandler

logger = logging.getLogger(__name__)


@dataclass
class ResolvedStream:
    url: str
    ext: str
    headers: dict[str, str]
    format_id: str
    kind: str


@dataclass
class MediaResolution:
    title: str
    output_stem: str
    container: str
    requires_merge: bool
    stream_count: int
    selected_quality: str
    selected_codec: str
    referer: str
    video: Optional[ResolvedStream]
    audio: Optional[ResolvedStream]
    cookie_header: Optional[str]


class DownloadEngine:
    """
    下载引擎

    功能：
    - 视频解析（yt-dlp extract_info）
    - aria2c 主下载
    - yt-dlp builtin 回退
    - ffmpeg 合并/转封装
    """

    def _auto_detect_aria2c(self):
        """自动检测 aria2c（优先使用项目内工具）"""
        from pathlib import Path
        import platform
        import shutil

        script_dir = Path(__file__).parent.parent.parent
        system = platform.system().lower()

        if system == "darwin":
            platform_dir = "macos"
        elif system == "linux":
            platform_dir = "linux"
        elif system == "windows":
            platform_dir = "windows"
        else:
            platform_dir = None

        if platform_dir:
            project_aria2c = script_dir / "tools" / platform_dir / "aria2c"
            if project_aria2c.exists() and project_aria2c.is_file():
                self.aria2c_path = str(project_aria2c)
                logger.info("Found aria2c in project: %s", project_aria2c)
                return

        system_path = shutil.which("aria2c")
        if system_path:
            self.aria2c_path = system_path
            logger.info("Found aria2c in system: %s", system_path)
            return

        logger.info("aria2c not found, builtin downloader fallback only")

    def _auto_detect_ffmpeg(self):
        """自动检测 ffmpeg（优先使用项目内工具）"""
        from pathlib import Path
        import platform
        import shutil

        script_dir = Path(__file__).parent.parent.parent
        system = platform.system().lower()

        if system == "darwin":
            platform_dir = "macos"
        elif system == "linux":
            platform_dir = "linux"
        elif system == "windows":
            platform_dir = "windows"
        else:
            platform_dir = None

        if platform_dir:
            project_ffmpeg = script_dir / "tools" / platform_dir / "ffmpeg"
            if project_ffmpeg.exists() and project_ffmpeg.is_file():
                self.ffmpeg_path = str(project_ffmpeg)
                logger.info("Found ffmpeg in project: %s", project_ffmpeg)
                return

        system_path = shutil.which("ffmpeg")
        if system_path:
            self.ffmpeg_path = system_path
            logger.info("Found ffmpeg in system: %s", system_path)
            return

        logger.info("ffmpeg not found, will use default 'ffmpeg'")

    def __init__(self, settings=None):
        self.yt_dlp_path = "yt-dlp"
        self.ffmpeg_path = "ffmpeg"
        self.aria2c_path = "aria2c"
        self.last_run_metadata: dict[str, Any] = {}

        if settings and hasattr(settings, "storage") and settings.storage.sidecar:
            sidecar = settings.storage.sidecar
            if sidecar:
                self.yt_dlp_path = sidecar.get("yt_dlp", self.yt_dlp_path)
                self.ffmpeg_path = sidecar.get("ffmpeg", self.ffmpeg_path)
                self.aria2c_path = sidecar.get("aria2c", self.aria2c_path)
                logger.info(
                    "Using custom tool paths: yt-dlp=%s, ffmpeg=%s, aria2c=%s",
                    self.yt_dlp_path,
                    self.ffmpeg_path,
                    self.aria2c_path,
                )

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
        codec: Optional[str] = "avc",
        download_id: Optional[str] = None,
    ):
        """
        下载视频。

        返回值保持宽松兼容：
        - 旧调用方可忽略返回值
        - 新调用方可读取返回字典中的 downloader 元数据
        """
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)

        self.last_run_metadata = {
            "resolver": "yt-dlp",
            "downloader": "aria2c",
            "fallback_used": False,
            "merge_required": False,
            "stream_count": 0,
            "selected_quality": str(quality),
            "selected_codec": codec or "avc",
            "cid": cid,
            "page": page_num,
        }

        try:
            resolution = await self._resolve_media(
                bvid=bvid,
                quality=quality,
                output_format=output_format,
                output_dir=output_dir,
                sessdata=sessdata,
                cid=cid,
                page_num=page_num,
                audio_bitrate=audio_bitrate,
                codec=codec,
            )
            self.last_run_metadata.update(
                {
                    "merge_required": resolution.requires_merge,
                    "stream_count": resolution.stream_count,
                    "selected_quality": resolution.selected_quality,
                    "selected_codec": resolution.selected_codec,
                    "title": resolution.title,
                }
            )

            if self._check_aria2c_available():
                try:
                    await self._download_with_aria2(
                        resolution=resolution,
                        output_dir=output_dir,
                        output_format=output_format,
                        progress_callback=progress_callback,
                        pause_event=pause_event,
                        download_id=download_id or bvid,
                    )
                    return dict(self.last_run_metadata)
                except Exception as aria_error:
                    error_detail = ErrorHandler.classify_error(
                        aria_error,
                        context={"bvid": bvid, "use_aria2c": True},
                    )
                    logger.warning(
                        "aria2c transfer failed for %s: %s", bvid, error_detail.message
                    )
                    self.last_run_metadata["downloader"] = "yt-dlp-builtin"
                    self.last_run_metadata["fallback_used"] = True
                    await self._download_with_builtin(
                        bvid=bvid,
                        quality=quality,
                        output_format=output_format,
                        output_dir=output_dir,
                        sessdata=sessdata,
                        progress_callback=progress_callback,
                        pause_event=pause_event,
                        page_num=page_num,
                        audio_bitrate=audio_bitrate,
                        codec=codec,
                        download_id=download_id or bvid,
                    )
                    return dict(self.last_run_metadata)

            self.last_run_metadata["downloader"] = "yt-dlp-builtin"
            self.last_run_metadata["fallback_used"] = True
            await self._download_with_builtin(
                bvid=bvid,
                quality=quality,
                output_format=output_format,
                output_dir=output_dir,
                sessdata=sessdata,
                progress_callback=progress_callback,
                pause_event=pause_event,
                page_num=page_num,
                audio_bitrate=audio_bitrate,
                codec=codec,
                download_id=download_id or bvid,
            )
            return dict(self.last_run_metadata)
        except asyncio.CancelledError:
            logger.info("Download cancelled: %s", bvid)
            raise
        except Exception as e:
            logger.error("Download failed: %s, error: %s", bvid, e)
            raise

    async def _resolve_media(
        self,
        bvid: str,
        quality: int,
        output_format: str,
        output_dir: Path,
        sessdata: Optional[str],
        cid: Optional[int],
        page_num: Optional[int],
        audio_bitrate: Optional[int],
        codec: Optional[str],
    ) -> MediaResolution:
        format_str = self._build_format_string(quality, codec or "avc", audio_bitrate)
        target_url = f"https://www.bilibili.com/video/{bvid}"
        if page_num:
            target_url = f"{target_url}?p={page_num}"

        ydl_opts: dict[str, Any] = {
            "format": format_str,
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": bool(page_num),
            "socket_timeout": 30,
            "retries": 3,
            "fragment_retries": 3,
        }

        cookie_file = None
        if sessdata:
            cookie_file = output_dir / "cookies.txt"
            cookie_file.write_text(
                "# Netscape HTTP Cookie File\n"
                "# This is a generated file! Do not edit.\n\n"
                f".bilibili.com\tTRUE\t/\tFALSE\t0\tSESSDATA\t{sessdata}\n",
                encoding="utf-8",
            )
            ydl_opts["cookiefile"] = str(cookie_file)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = await asyncio.to_thread(ydl.extract_info, target_url, False)
        finally:
            if cookie_file and cookie_file.exists():
                try:
                    cookie_file.unlink()
                except OSError:
                    pass

        title = str(info.get("title") or bvid)
        output_stem = self._safe_filename(title)
        referer = str(
            (info.get("http_headers") or {}).get("Referer")
            or target_url
        )

        requested_formats = info.get("requested_formats") or []
        if requested_formats:
            video_stream = self._build_stream(requested_formats[0], "video")
            audio_stream = (
                self._build_stream(requested_formats[1], "audio")
                if len(requested_formats) > 1
                else None
            )
            selected_quality = str(
                requested_formats[0].get("height")
                or requested_formats[0].get("format_note")
                or quality
            )
            selected_codec = str(requested_formats[0].get("vcodec") or codec or "avc")
        else:
            single_stream = self._build_stream(info, "muxed")
            video_stream = single_stream
            audio_stream = None
            selected_quality = str(info.get("height") or info.get("format_note") or quality)
            selected_codec = str(info.get("vcodec") or codec or "avc")

        return MediaResolution(
            title=title,
            output_stem=output_stem,
            container=output_format,
            requires_merge=audio_stream is not None,
            stream_count=2 if audio_stream else 1,
            selected_quality=selected_quality,
            selected_codec=selected_codec,
            referer=referer,
            video=video_stream,
            audio=audio_stream,
            cookie_header=f"SESSDATA={sessdata}" if sessdata else None,
        )

    def _build_stream(self, source: dict[str, Any], kind: str) -> ResolvedStream:
        headers = dict(source.get("http_headers") or {})
        return ResolvedStream(
            url=str(source.get("url") or ""),
            ext=str(source.get("ext") or "mp4"),
            headers=headers,
            format_id=str(source.get("format_id") or ""),
            kind=kind,
        )

    async def _download_with_aria2(
        self,
        resolution: MediaResolution,
        output_dir: Path,
        output_format: str,
        progress_callback: Optional[Callable],
        pause_event: Optional[asyncio.Event],
        download_id: str,
    ) -> None:
        temp_video = output_dir / f"{resolution.output_stem}.video.{resolution.video.ext}"
        await self._download_stream_with_aria2(
            stream=resolution.video,
            destination=temp_video,
            referer=resolution.referer,
            cookie_header=resolution.cookie_header,
            progress_callback=progress_callback,
            progress_id=download_id,
            progress_value=25.0 if resolution.audio else 70.0,
            pause_event=pause_event,
        )

        if resolution.audio:
            temp_audio = output_dir / f"{resolution.output_stem}.audio.{resolution.audio.ext}"
            await self._download_stream_with_aria2(
                stream=resolution.audio,
                destination=temp_audio,
                referer=resolution.referer,
                cookie_header=resolution.cookie_header,
                progress_callback=progress_callback,
                progress_id=download_id,
                progress_value=65.0,
                pause_event=pause_event,
            )
            final_output = output_dir / f"{resolution.output_stem}.{output_format}"
            await self._merge_streams(temp_video, temp_audio, final_output)
            temp_video.unlink(missing_ok=True)
            temp_audio.unlink(missing_ok=True)
        else:
            final_output = output_dir / f"{resolution.output_stem}.{output_format}"
            await self._convert_or_move(temp_video, final_output)

        if progress_callback:
            final_size = final_output.stat().st_size if final_output.exists() else 0
            progress_callback(download_id, 100.0, final_size, final_size, 0.0, 0.0)

    async def _download_stream_with_aria2(
        self,
        stream: ResolvedStream,
        destination: Path,
        referer: str,
        cookie_header: Optional[str],
        progress_callback: Optional[Callable],
        progress_id: str,
        progress_value: float,
        pause_event: Optional[asyncio.Event],
    ) -> None:
        if not stream or not stream.url:
            raise RuntimeError("Resolved stream URL missing")

        destination.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self.aria2c_path,
            "--dir",
            str(destination.parent),
            "--out",
            destination.name,
            "--allow-overwrite=true",
            "--auto-file-renaming=false",
            "--continue=true",
            "--max-tries=5",
            "--retry-wait=5",
            "--timeout=60",
            "--split=4",
            "--max-connection-per-server=4",
            "--min-split-size=1M",
            "--check-certificate=false",
            "--summary-interval=0",
            "--console-log-level=warn",
            "--header",
            f"Referer: {referer}",
        ]

        headers = dict(stream.headers or {})
        headers.pop("Referer", None)
        for key, value in headers.items():
            if value:
                cmd.extend(["--header", f"{key}: {value}"])
        if cookie_header:
            cmd.extend(["--header", f"Cookie: {cookie_header}"])
        cmd.append(stream.url)

        if progress_callback:
            progress_callback(progress_id, progress_value, 0, 0, 0.0, 0.0)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            while True:
                if pause_event and pause_event.is_set():
                    process.kill()
                    raise asyncio.CancelledError("Download paused or cancelled")

                return_code = process.returncode
                if return_code is not None:
                    break
                await asyncio.sleep(0.2)
        finally:
            stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(
                f"aria2c exited with code {process.returncode}: "
                f"{stderr.decode(errors='ignore') or stdout.decode(errors='ignore')}"
            )

        if not destination.exists():
            raise RuntimeError(f"aria2c completed but output missing: {destination}")

    async def _merge_streams(self, video_path: Path, audio_path: Path, output_path: Path):
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(audio_path),
            "-c",
            "copy",
            str(output_path),
        ]
        await self._run_ffmpeg(cmd, "merge")

    async def _convert_or_move(self, source_path: Path, output_path: Path):
        if source_path.suffix.lower() == output_path.suffix.lower():
            source_path.replace(output_path)
            return

        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i",
            str(source_path),
            "-c",
            "copy",
            str(output_path),
        ]
        await self._run_ffmpeg(cmd, "remux")
        source_path.unlink(missing_ok=True)

    async def _run_ffmpeg(self, cmd: list[str], action: str):
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(
                f"ffmpeg {action} failed: "
                f"{stderr.decode(errors='ignore') or stdout.decode(errors='ignore')}"
            )

    async def _download_with_builtin(
        self,
        bvid: str,
        quality: int,
        output_format: str,
        output_dir: Path,
        sessdata: Optional[str],
        progress_callback: Optional[Callable],
        pause_event: Optional[asyncio.Event],
        page_num: Optional[int],
        audio_bitrate: Optional[int],
        codec: Optional[str],
        download_id: str,
    ) -> None:
        format_str = self._build_format_string(quality, codec or "avc", audio_bitrate)
        outtmpl = (
            str(output_dir / "%(title)s-P%(playlist_index)s.%(ext)s")
            if page_num
            else str(output_dir / "%(title)s.%(ext)s")
        )

        ydl_opts = {
            "format": format_str,
            "outtmpl": outtmpl,
            "quiet": False,
            "no_warnings": True,
            "merge_output_format": output_format,
            "progress_hooks": [],
            "socket_timeout": 30,
            "retries": 3,
            "retry_sleep": 5,
            "fragment_retries": 3,
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
        }
        if self.ffmpeg_path != "ffmpeg":
            ydl_opts["ffmpeg_location"] = self.ffmpeg_path
        if page_num:
            ydl_opts["playlist_items"] = str(page_num)

        if progress_callback:
            def progress_hook(d):
                if pause_event and pause_event.is_set():
                    raise asyncio.CancelledError("Download paused or cancelled")

                status = d.get("status")
                if status == "downloading":
                    total_bytes = (
                        d.get("total_bytes", 0)
                        or d.get("total_bytes_estimate", 0)
                        or 0
                    )
                    downloaded_bytes = d.get("downloaded_bytes", 0) or 0
                    progress = (
                        (downloaded_bytes / total_bytes) * 100 if total_bytes > 0 else 0.0
                    )
                    speed = d.get("speed") or 0
                    eta = d.get("eta") or 0
                    progress_callback(
                        download_id,
                        progress,
                        downloaded_bytes,
                        total_bytes,
                        speed / 1024 if speed else 0.0,
                        eta,
                    )
                elif status == "finished":
                    total_bytes = d.get("total_bytes", 0) or 0
                    progress_callback(download_id, 100.0, total_bytes, total_bytes, 0.0, 0.0)

            ydl_opts["progress_hooks"].append(progress_hook)

        cookie_file = None
        if sessdata:
            cookie_file = output_dir / "cookies.txt"
            cookie_file.write_text(
                "# Netscape HTTP Cookie File\n"
                "# This is a generated file! Do not edit.\n\n"
                f".bilibili.com\tTRUE\t/\tFALSE\t0\tSESSDATA\t{sessdata}\n",
                encoding="utf-8",
            )
            ydl_opts["cookiefile"] = str(cookie_file)

        target_url = f"https://www.bilibili.com/video/{bvid}"
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                await asyncio.to_thread(ydl.download, [target_url])
        finally:
            if cookie_file and cookie_file.exists():
                try:
                    cookie_file.unlink()
                except OSError:
                    pass

    async def extract_audio(self, video_path: str, output_path: str):
        cmd = [
            self.ffmpeg_path,
            "-i",
            video_path,
            "-vn",
            "-acodec",
            "libmp3lame",
            "-ab",
            "192k",
            output_path,
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise Exception(f"Audio extraction failed: {stderr.decode() or stdout.decode()}")

    async def convert_format(self, input_path: str, output_path: str, output_format: str):
        cmd = [self.ffmpeg_path, "-i", input_path, "-c", "copy", output_path]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise Exception(f"Format conversion failed: {stderr.decode() or stdout.decode()}")

    def _build_format_string(
        self,
        quality: int,
        codec: str = "avc",
        audio_bitrate: Optional[int] = 192,
    ) -> str:
        quality_map = {
            16: 360,
            32: 480,
            64: 720,
            80: 1080,
            112: 1080,
            116: 2160,
        }
        codec_map = {
            "avc": "avc1",
            "hevc": "hevc",
            "av1": "av01",
            "vp9": "vp09",
        }
        audio_format_map = {
            64: "30216",
            128: "30216",
            132: "30216",
            192: "30280",
            30232: "30232",
            30251: "30280",
            30250: "30280",
        }

        height = quality_map.get(quality, 720)
        video_codec = codec_map.get(codec, "avc1")
        audio_format_id = audio_format_map.get(audio_bitrate, "30280")

        if audio_bitrate and audio_bitrate >= 30232:
            return (
                f"bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+{audio_format_id}/"
                f"bestvideo[height<={height}][vcodec~={video_codec}]+{audio_format_id}/"
                f"bestvideo[ext=mp4][height<={height}]+{audio_format_id}/"
                f"bestvideo[height<={height}]+{audio_format_id}/"
                f"bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+bestaudio[ext=m4a]/"
                f"bestvideo[height<={height}][vcodec~={video_codec}]+bestaudio/"
                f"bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/"
                f"bestvideo[height<={height}]+bestaudio/best[ext=mp4]/best"
            )

        return (
            f"bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+bestaudio[ext=m4a]/"
            f"bestvideo[height<={height}][vcodec~={video_codec}]+bestaudio/"
            f"bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/"
            f"bestvideo[height<={height}]+bestaudio/best[ext=mp4]/best"
        )

    def get_supported_formats(self) -> list:
        return ["mp4", "flv", "mkv", "webm"]

    def get_supported_qualities(self) -> list:
        return [
            {"qn": 16, "desc": "360P 流畅", "height": 360},
            {"qn": 32, "desc": "480P 清晰", "height": 480},
            {"qn": 64, "desc": "720P 高清", "height": 720},
            {"qn": 80, "desc": "1080P 高清", "height": 1080},
            {"qn": 112, "desc": "1080P+ 高码率", "height": 1080},
            {"qn": 116, "desc": "4K 超清", "height": 2160},
        ]

    def _check_aria2c_available(self) -> bool:
        import shutil

        if not self.aria2c_path:
            return False
        return shutil.which(self.aria2c_path) is not None or Path(self.aria2c_path).exists()

    def get_download_stats(self) -> dict:
        return {
            "yt_dlp_path": self.yt_dlp_path,
            "ffmpeg_path": self.ffmpeg_path,
            "aria2c_path": self.aria2c_path,
            "aria2c_available": self._check_aria2c_available(),
            "supported_formats": self.get_supported_formats(),
            "supported_qualities": self.get_supported_qualities(),
        }

    def _safe_filename(self, value: str) -> str:
        safe = re.sub(r'[<>:"/\\\\|?*\x00-\x1f]', "", value).strip()
        return safe or "video"
