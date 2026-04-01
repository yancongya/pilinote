from typing import Dict, Any
from pathlib import Path
import logging

from .base import BaseHandler

logger = logging.getLogger(__name__)

class ThumbHandler(BaseHandler):
    """封面处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理封面下载"""
        bvid = params.get('bvid', '')
        filename = params.get('filename', f"{bvid}.jpg")

        logger.info(f"开始处理封面下载: {filename}")

        # 创建临时文件
        temp_path = self._get_temp_path(temp_dir, filename)
        temp_path.parent.mkdir(parents=True, exist_ok=True)

        # 创建占位图片文件
        temp_path.write_text("封面占位文件", encoding='utf-8')

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 封面处理完成: {filename}")


class UploaderAvatarHandler(BaseHandler):
    """UP主头像处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理UP主头像下载"""
        uploader = meta.get('uploader', 'unknown')
        filename = params.get('filename', f"{uploader}_avatar.jpg")

        logger.info(f"开始处理UP主头像下载: {filename}")

        # 创建临时文件
        temp_path = self._get_temp_path(temp_dir, filename)
        temp_path.parent.mkdir(parents=True, exist_ok=True)

        # 创建占位图片文件
        temp_path.write_bytes(f"UP主头像占位文件: {uploader}".encode())

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ UP主头像处理完成: {filename}")
