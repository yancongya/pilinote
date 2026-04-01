from typing import Dict, Any
from pathlib import Path
import logging

from .base import BaseHandler

logger = logging.getLogger(__name__)

class VideoHandler(BaseHandler):
    """视频处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理视频下载"""
        bvid = params.get('bvid', '')
        filename = params.get('filename', f"{bvid}.mp4")

        logger.info(f"开始处理视频下载: {filename}")

        # 创建临时文件
        temp_path = self._get_temp_path(temp_dir, filename)
        temp_path.parent.mkdir(parents=True, exist_ok=True)

        # 创建占位文件（实际下载需要DownloadEngine）
        temp_path.write_text(f"视频占位文件: {bvid}")

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 视频处理完成: {filename}")


class AudioHandler(BaseHandler):
    """音频处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理音频下载"""
        bvid = params.get('bvid', '')
        filename = params.get('filename', f"{bvid}.m4a")

        logger.info(f"开始处理音频下载: {filename}")

        # 创建临时文件
        temp_path = self._get_temp_path(temp_dir, filename)
        temp_path.parent.mkdir(parents=True, exist_ok=True)

        # 创建占位文件
        temp_path.write_text(f"音频占位文件: {bvid}")

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 音频处理完成: {filename}")


class AudioVideoMergeHandler(BaseHandler):
    """音视频合并处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理音视频合并"""
        bvid = params.get('bvid', '')
        video_filename = params.get('video_filename', f"{bvid}_video.mp4")
        audio_filename = params.get('audio_filename', f"{bvid}_audio.m4a")
        output_filename = params.get('output_filename', f"{bvid}.mp4")

        logger.info(f"开始处理音视频合并: {video_filename} + {audio_filename} -> {output_filename}")

        # 创建临时文件
        video_path = self._get_temp_path(temp_dir, video_filename)
        audio_path = self._get_temp_path(temp_dir, audio_filename)
        output_path = self._get_output_path(output_dir, output_filename)

        video_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # 创建占位文件
        video_path.write_text(f"视频占位文件: {bvid}")
        audio_path.write_text(f"音频占位文件: {bvid}")

        # 创建输出文件
        output_path.write_text(f"音视频合并占位文件: {bvid}")

        logger.info(f"✓ 音视频合并完成: {output_filename}")
