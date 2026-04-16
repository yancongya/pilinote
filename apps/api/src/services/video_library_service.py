"""
视频库状态管理服务

提供统一的视频库状态检查和刷新功能：
- 批量检查视频是否在视频库中
- 刷新视频库缓存
- 获取视频库状态统计

核心逻辑：
1. 从数据库获取所有已完成的下载任务（state=3）
2. 检查这些任务对应的视频文件是否实际存在于文件系统
3. 缓存基于数据库任务的状态检查结果
"""

from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from src.services.local_library_service import LocalLibraryService
from src.models.task import Task, TaskState
from pathlib import Path
import os


class VideoLibraryService:
    """视频库服务"""

    def __init__(self, db: Session):
        """
        初始化视频库服务

        Args:
            db: 数据库会话
        """
        self.db = db
        self.local_library = LocalLibraryService(db)

    def _get_download_directory(self) -> str:
        """获取下载目录"""
        from src.settings import settings
        return settings.storage.download_path

    def _check_task_video_exists(self, task: Task) -> bool:
        """
        检查任务对应的视频文件是否存在

        Args:
            task: 下载任务

        Returns:
            bool: 视频文件是否存在
        """
        download_dir = self._get_download_directory()
        
        # 获取任务标题作为文件夹名
        folder_name = task.title if task.title else task.media_id
        folder_path = os.path.join(download_dir, folder_name)
        
        # 检查文件夹是否存在
        if not os.path.exists(folder_path):
            return False
        
        # 检查文件夹内是否有视频文件
        if not os.path.isdir(folder_path):
            return False
        
        # 遍历文件夹查找视频文件
        for root, dirs, files in os.walk(folder_path):
            for filename in files:
                if self.local_library._is_video_file(filename):
                    return True
        
        return False

    def check_videos_in_library(self, bvids: List[str]) -> Dict[str, List[str]]:
        """
        批量检查视频是否在视频库中

        Args:
            bvids: 视频BVID列表

        Returns:
            {
                "downloaded": ["BV1xx", "BV1yy"],  # 已下载的视频
                "not_downloaded": ["BV1zz"]      # 未下载的视频
            }
        """
        # 获取所有已完成的任务
        completed_tasks = self.db.query(Task).filter(
            Task.state == TaskState.COMPLETED
        ).all()
        
        # 构建已下载的BVID集合（基于文件存在性检查）
        downloaded_bvids = set()
        for task in completed_tasks:
            if self._check_task_video_exists(task):
                downloaded_bvids.add(task.media_id)
        
        # 分类
        downloaded = [bvid for bvid in bvids if bvid in downloaded_bvids]
        not_downloaded = [bvid for bvid in bvids if bvid not in downloaded_bvids]

        return {
            "downloaded": downloaded,
            "not_downloaded": not_downloaded
        }

    def refresh_library(self) -> Dict[str, Any]:
        """
        刷新视频库

        Returns:
            刷新结果统计
        """
        # 获取所有已完成的任务
        completed_tasks = self.db.query(Task).filter(
            Task.state == TaskState.COMPLETED
        ).all()
        
        # 检查每个任务的视频文件是否存在
        downloaded_tasks = []
        downloaded_bvids = set()
        
        for task in completed_tasks:
            if self._check_task_video_exists(task):
                downloaded_tasks.append(task)
                downloaded_bvids.add(task.media_id)
        
        # 获取本地库数据用于统计
        library_data = self.local_library.scan_library()
        
        return {
            "total_tasks": len(completed_tasks),
            "downloaded_tasks": len(downloaded_tasks),
            "missing_tasks": len(completed_tasks) - len(downloaded_tasks),
            "downloaded_bvids": list(downloaded_bvids),
            "folder_count": library_data.folder_count,
            "total_files": library_data.total_files
        }

    def get_library_status(self) -> Dict[str, Any]:
        """
        获取视频库状态

        Returns:
            视频库状态信息
        """
        # 获取所有已完成的任务
        completed_tasks = self.db.query(Task).filter(
            Task.state == TaskState.COMPLETED
        ).all()
        
        # 检查每个任务的视频文件是否存在
        downloaded_tasks = []
        total_size = 0
        
        for task in completed_tasks:
            if self._check_task_video_exists(task):
                downloaded_tasks.append(task)
        
        # 获取本地库数据用于统计
        library_data = self.local_library.scan_library()
        
        return {
            "total_folders": library_data.folder_count,
            "total_videos": len(downloaded_tasks),
            "total_tasks": len(completed_tasks),
            "total_size_mb": round(library_data.total_size / (1024 * 1024), 2),
            "last_scan_time": 0  # scan_library目前没有返回扫描时间，设为0
        }