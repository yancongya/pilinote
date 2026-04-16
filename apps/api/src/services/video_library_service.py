"""
视频库状态管理服务

提供统一的视频库状态检查和刷新功能：
- 批量检查视频是否在视频库中
- 刷新视频库缓存
- 获取视频库状态统计

核心逻辑：
1. 基于文件系统扫描，从nfo文件中提取bvid
2. 建立已下载视频的缓存列表
3. 检查视频是否已下载：直接查询缓存列表

优势：
- 准确反映实际下载的文件（包括非任务方式下载的视频）
- 简单直接的对比逻辑
- 性能好（只需扫描一次文件系统）
- 不依赖任务数据库
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from src.services.local_library_service import LocalLibraryService
from src.models.download import Download


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
        # 获取视频库数据（基于文件系统扫描）
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
        # 扫描文件系统获取视频库数据
        result = self.local_library.scan_library()
        
        # 提取已下载的bvid列表
        downloaded_bvids = []
        for folder in result.folders:
            nfo_data = folder.get('nfo_data')
            if nfo_data and 'bvid' in nfo_data:
                downloaded_bvids.append(nfo_data['bvid'])
        
        return {
            "folders": result.to_dict()['folders'] if hasattr(result, 'to_dict') else result.folders,
            "downloaded_bvids": downloaded_bvids,
            "folder_count": result.folder_count,
            "total_files": result.total_files
        }

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

    def get_local_playback_map(self, bvid: str) -> Dict[str, Any]:
        """
        获取视频的本地可播放文件映射

        Args:
            bvid: 视频 BVID

        Returns:
            {
                "bvid": "BVxxx",
                "has_local_video": True,
                "entries": [
                    {"cid": 123, "path": "...", "exists": True, "title": "..."}
                ]
            }
        """
        library_data = self.local_library.scan_library()
        folder_match = None

        for folder in library_data.folders:
            nfo_data = folder.get('nfo_data') or {}
            if nfo_data.get('bvid') == bvid:
                folder_match = folder
                break

        entries: List[Dict[str, Any]] = []
        seen_paths: Set[str] = set()

        downloads = (
            self.db.query(Download)
            .filter(Download.bvid == bvid, Download.status == "completed")
            .order_by(Download.cid.asc(), Download.created_at.asc())
            .all()
        )

        for download in downloads:
            if not download.file_path or not os.path.exists(download.file_path):
                continue

            if download.file_path in seen_paths:
                continue

            entries.append({
                "cid": download.cid,
                "path": download.file_path,
                "exists": True,
                "title": download.title or os.path.basename(download.file_path)
            })
            seen_paths.add(download.file_path)

        folder_videos = getattr(library_data, 'folder_videos', {})
        if not entries and folder_match:
            folder_data = folder_videos.get(folder_match.get('name', ''), {})
            for video_file in folder_data.get('files', []):
                if not os.path.exists(video_file.path) or video_file.path in seen_paths:
                    continue

                entries.append({
                    "cid": None,
                    "path": video_file.path,
                    "exists": True,
                    "title": video_file.title
                })
                seen_paths.add(video_file.path)

        return {
            "bvid": bvid,
            "has_local_video": len(entries) > 0,
            "entries": entries,
            "folder_path": folder_match.get('path') if folder_match else None
        }

    def get_local_opus_content(self, opus_id: str) -> Dict[str, Any]:
        """
        获取图文的本地归档内容
        """
        normalized_opus_id = opus_id if opus_id.startswith('cv') else f'cv{opus_id}'
        library_data = self.local_library.scan_library()
        folder_match = None

        for folder in library_data.folders:
            nfo_data = folder.get('nfo_data') or {}
            if nfo_data.get('opus_id') == normalized_opus_id:
                folder_match = folder
                break

        if not folder_match:
            raise FileNotFoundError(f"未找到图文本地归档: {normalized_opus_id}")

        markdown_path = folder_match.get('markdown_path')
        if not markdown_path or not os.path.exists(markdown_path):
            raise FileNotFoundError(f"未找到图文 Markdown 文件: {normalized_opus_id}")

        markdown_content = Path(markdown_path).read_text(encoding='utf-8')
        nfo_data = folder_match.get('nfo_data') or {}

        return {
            "opus_id": normalized_opus_id,
            "title": folder_match.get('title') or nfo_data.get('title') or folder_match.get('name'),
            "folder_path": folder_match.get('path'),
            "markdown_path": markdown_path,
            "markdown_content": markdown_content,
            "cover_path": folder_match.get('cover_path'),
            "avatar_path": folder_match.get('avatar_path'),
            "nfo_data": nfo_data,
        }
