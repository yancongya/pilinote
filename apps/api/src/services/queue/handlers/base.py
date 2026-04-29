from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Callable
from pathlib import Path
import logging
import asyncio

from src.models.task import Task, SubTask, TaskState

logger = logging.getLogger(__name__)


class ProgressCallback:
    """进度回调器"""
    
    def __init__(self, task_id: str, subtask_id: str, callback: Optional[Callable] = None):
        self.task_id = task_id
        self.subtask_id = subtask_id
        self.callback = callback
        self.total = 0
        self.current = 0
    
    async def update(self, current: int, total: int = None, message: str = ""):
        """更新进度"""
        if total is not None:
            self.total = total
        self.current = current
        
        progress = (current / self.total * 100) if self.total > 0 else 0
        
        if self.callback:
            await self.callback({
                "task_id": self.task_id,
                "subtask_id": self.subtask_id,
                "current": current,
                "total": self.total,
                "progress": progress,
                "message": message
            })
        
        logger.debug(f"Progress {self.subtask_id}: {progress:.1f}% ({current}/{self.total}) - {message}")


class BaseHandler(ABC):
    """子任务处理器基类"""

    def __init__(self):
        self.name = self.__class__.__name__

    @abstractmethod
    async def execute(self, task: Task, subtask: SubTask, progress_callback: ProgressCallback) -> bool:
        """
        执行子任务
        
        Args:
            task: 主任务对象
            subtask: 子任务对象
            progress_callback: 进度回调器
            
        Returns:
            bool: 执行是否成功
        """
        pass

    async def prepare(self, task: Task, subtask: SubTask) -> Dict[str, Any]:
        """
        准备子任务执行所需的数据
        
        Returns:
            Dict: 准备好的数据
        """
        return {}

    async def cleanup(self, task: Task, subtask: SubTask, success: bool):
        """
        清理子任务执行后的临时文件等
        
        Args:
            task: 主任务对象
            subtask: 子任务对象
            success: 执行是否成功
        """
        pass

    def _get_temp_path(self, temp_dir: Path, filename: str) -> Path:
        """获取临时文件路径"""
        temp_dir.mkdir(parents=True, exist_ok=True)
        return temp_dir / filename

    def _get_output_path(self, output_dir: Path, filename: str) -> Path:
        """获取输出文件路径"""
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir / filename

    def _move_to_output(self, temp_path: Path, output_path: Path):
        """移动文件到输出目录"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.move(str(temp_path), str(output_path))
        logger.info(f"✓ 文件已移动: {output_path}")

    def _safe_filename(self, filename: str) -> str:
        """生成安全的文件名"""
        import re
        # 移除或替换非法字符
        illegal_chars = '<>:"/\\|?*'
        for char in illegal_chars:
            filename = filename.replace(char, '_')
        
        # 限制长度
        if len(filename) > 200:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:200-len(ext)-1] + '.' + ext if ext else name[:200]
        
        return filename
