"""
视频库状态管理服务

提供统一的视频库状态检查和刷新功能：
- 批量检查视频是否在视频库中
- 刷新视频库缓存
- 获取视频库状态统计
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from src.services.local_library_service import LocalLibraryService


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
        # 获取视频库数据
        library_data = self.local_library.scan_library()
        downloaded_bvids = set()

        # 遍历所有文件夹，从nfo数据中提取bvid
        for folder in library_data.folders:
            nfo_data = folder.get('nfo_data')
            if nfo_data and 'bvid' in nfo_data:
                downloaded_bvids.add(nfo_data['bvid'])

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
        result = self.local_library.scan_library()
        return result.to_dict()

    def get_library_status(self) -> Dict[str, Any]:
        """
        获取视频库状态

        Returns:
            视频库状态信息
        """
        library_data = self.local_library.scan_library()

        total_folders = len(library_data.folders)
        total_videos = sum(
            folder.get('file_count', 0)
            for folder in library_data.folders
        )
        total_size = sum(
            folder.get('size', 0)
            for folder in library_data.folders
        )

        return {
            "total_folders": total_folders,
            "total_videos": total_videos,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "last_scan_time": 0  # scan_library目前没有返回扫描时间，设为0
        }