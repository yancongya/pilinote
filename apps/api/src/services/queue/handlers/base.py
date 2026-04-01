from abc import ABC, abstractmethod
from typing import Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class BaseHandler(ABC):
    """子任务处理器基类"""

    def __init__(self):
        self.name = self.__class__.__name__

    @abstractmethod
    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理子任务"""
        pass

    def _get_temp_path(self, temp_dir: Path, filename: str) -> Path:
        """获取临时文件路径"""
        return temp_dir / filename

    def _get_output_path(self, output_dir: Path, filename: str) -> Path:
        """获取输出文件路径"""
        return output_dir / filename

    def _move_to_output(self, temp_path: Path, output_path: Path):
        """移动文件到输出目录"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.move(str(temp_path), str(output_path))
        logger.info(f"✓ 文件已移动: {output_path}")
