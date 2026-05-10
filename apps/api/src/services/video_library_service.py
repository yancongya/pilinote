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

import logging
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Set, Optional, Tuple
from sqlalchemy.orm import Session
from src.services.local_library_service import LocalLibraryService
from src.models.ai_note import AiNote
from src.models.download import Download

logger = logging.getLogger(__name__)


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
        self.video_extensions = {".mp4", ".mkv", ".avi", ".mov", ".flv", ".wmv", ".webm", ".m4v"}
        self.sidecar_extensions = {
            ".nfo",
            ".srt",
            ".ass",
            ".vtt",
            ".mp3",
            ".wav",
            ".m4a",
            ".aac",
            ".flac",
            ".ogg",
            ".opus",
            ".md",
            ".xml",
            ".json",
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".bak",
        }

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
            nfo_data = folder.get("nfo_data")
            if nfo_data and "bvid" in nfo_data:
                downloaded_bvids.add(nfo_data["bvid"])

        # 分类
        downloaded = [bvid for bvid in bvids if bvid in downloaded_bvids]
        not_downloaded = [bvid for bvid in bvids if bvid not in downloaded_bvids]

        return {"downloaded": downloaded, "not_downloaded": not_downloaded}

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
            nfo_data = folder.get("nfo_data")
            if nfo_data and "bvid" in nfo_data:
                downloaded_bvids.append(nfo_data["bvid"])

        return {
            "folders": result.to_dict()["folders"]
            if hasattr(result, "to_dict")
            else result.folders,
            "downloaded_bvids": downloaded_bvids,
            "folder_count": result.folder_count,
            "total_files": result.total_files,
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
            folder.get("file_count", 0) for folder in library_data.folders
        )
        total_size = sum(folder.get("size", 0) for folder in library_data.folders)

        return {
            "total_folders": total_folders,
            "total_videos": total_videos,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "last_scan_time": 0,  # scan_library目前没有返回扫描时间，设为0
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
        try:
            library_data = self.local_library.scan_library()
        except Exception as e:
            logger.error(f"扫描视频库失败: {e}")
            library_data = None

        folder_match = None
        if library_data and hasattr(library_data, "folders"):
            for folder in library_data.folders:
                nfo_data = folder.get("nfo_data") or {}
                if nfo_data.get("bvid") == bvid:
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

            entries.append(
                {
                    "cid": download.cid,
                    "path": download.file_path,
                    "exists": True,
                    "title": download.title or os.path.basename(download.file_path),
                }
            )
            seen_paths.add(download.file_path)

        folder_videos = (
            getattr(library_data, "folder_videos", {}) if library_data else {}
        )
        if not entries and folder_match:
            folder_data = folder_videos.get(folder_match.get("name", ""), {})
            for video_file in folder_data.get("files", []):
                if not os.path.exists(video_file.path) or video_file.path in seen_paths:
                    continue

                entries.append(
                    {
                        "cid": None,
                        "path": video_file.path,
                        "exists": True,
                        "title": video_file.title,
                    }
                )
                seen_paths.add(video_file.path)

        entries = sorted(entries, key=self._playback_entry_sort_key)

        return {
            "bvid": bvid,
            "has_local_video": len(entries) > 0,
            "entries": entries,
            "folder_path": folder_match.get("path") if folder_match else None,
            "series_layout": self.detect_series_layout(folder_match.get("path")) if folder_match else None,
        }

    def _playback_entry_sort_key(self, entry: Dict[str, Any]) -> Tuple[int, str]:
        text = f"{entry.get('title') or ''} {entry.get('path') or ''}"
        match = re.search(r"(?:^|[\\/\\s_-])P?0*(\d{1,3})(?=\\s|[.、．_-]|$)", text, flags=re.IGNORECASE)
        if match:
            try:
                return int(match.group(1)), str(entry.get("path") or "")
            except ValueError:
                pass
        return 9999, str(entry.get("path") or "")

    def detect_series_layout(self, folder_path: Optional[str]) -> Dict[str, Any]:
        """Detect whether a series folder is flat, per-part folders, mixed, or unknown."""
        folder = self._resolve_download_child(folder_path)
        direct_videos = self._direct_series_videos(folder)
        part_dirs = self._series_part_dirs(folder)

        if direct_videos and part_dirs:
            mode = "mixed"
        elif part_dirs:
            mode = "folder"
        elif direct_videos:
            mode = "flat"
        else:
            mode = "unknown"

        return {
            "mode": mode,
            "folder_path": str(folder),
            "direct_videos": len(direct_videos),
            "part_dirs": len(part_dirs),
        }

    def plan_series_layout(
        self,
        folder_path: str,
        target_mode: str,
    ) -> Dict[str, Any]:
        """Build a move plan for switching a series folder layout."""
        folder = self._resolve_download_child(folder_path)
        if target_mode not in {"flat", "folder"}:
            raise ValueError("target_mode must be flat or folder")

        current = self.detect_series_layout(str(folder))
        moves = self._build_flat_to_folder_moves(folder) if target_mode == "folder" else self._build_folder_to_flat_moves(folder)
        conflicts = [move for move in moves if Path(move["to"]).exists()]

        return {
            "folder_path": str(folder),
            "current_mode": current["mode"],
            "target_mode": target_mode,
            "move_count": len(moves),
            "moves": moves,
            "conflicts": conflicts,
            "can_apply": len(moves) > 0 and len(conflicts) == 0,
        }

    def apply_series_layout(
        self,
        folder_path: str,
        target_mode: str,
    ) -> Dict[str, Any]:
        """Move files to the requested series layout and update download records."""
        plan = self.plan_series_layout(folder_path, target_mode)
        if plan["conflicts"]:
            return {
                **plan,
                "success": False,
                "message": "目标路径已存在，未执行移动",
            }

        moved: List[Dict[str, str]] = []
        try:
            for move in plan["moves"]:
                src = Path(move["from"])
                dst = Path(move["to"])
                if not src.exists():
                    continue
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dst))
                moved.append({"from": str(src), "to": str(dst)})
                self._update_download_file_path(str(src), str(dst))
                self._update_ai_note_paths(str(src), str(dst))

            self._remove_empty_part_dirs(Path(plan["folder_path"]))
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("系列目录整理失败")
            raise

        after = self.detect_series_layout(plan["folder_path"])
        return {
            **plan,
            "success": True,
            "message": f"已切换为 {'根目录平铺' if target_mode == 'flat' else '分P子目录'} 模式",
            "moved": moved,
            "applied_mode": after["mode"],
        }

    def _resolve_download_child(self, folder_path: Optional[str]) -> Path:
        if not folder_path:
            raise ValueError("folder_path is required")

        root = Path(self.local_library._get_download_directory()).resolve()
        folder = Path(folder_path).expanduser().resolve()
        if folder != root and root not in folder.parents:
            raise ValueError("folder_path must be inside download directory")
        if not folder.exists() or not folder.is_dir():
            raise FileNotFoundError(f"series folder not found: {folder_path}")
        return folder

    def _part_key(self, value: str) -> Optional[str]:
        match = re.match(r"^(P\d{1,3})\b", value, flags=re.IGNORECASE)
        return match.group(1).upper() if match else None

    def _is_video_file(self, path: Path) -> bool:
        return path.is_file() and path.suffix.lower() in self.video_extensions

    def _direct_series_videos(self, folder: Path) -> List[Path]:
        return sorted(
            [path for path in folder.iterdir() if self._is_video_file(path) and self._part_key(path.stem)],
            key=lambda path: self._part_sort_key(path.stem),
        )

    def _series_part_dirs(self, folder: Path) -> List[Path]:
        return sorted(
            [
                path for path in folder.iterdir()
                if path.is_dir()
                and self._part_key(path.name)
                and any(self._is_video_file(child) for child in path.iterdir())
            ],
            key=lambda path: self._part_sort_key(path.name),
        )

    def _part_sort_key(self, value: str) -> Tuple[int, str]:
        key = self._part_key(value)
        if key:
            try:
                return int(key[1:]), value
            except ValueError:
                pass
        return 9999, value

    def _sidecars_for_stem(self, folder: Path, stem: str) -> List[Path]:
        files: List[Path] = []
        for path in folder.iterdir():
            if not path.is_file():
                continue
            suffix = path.suffix.lower()
            if suffix not in self.video_extensions and suffix not in self.sidecar_extensions:
                continue
            if path.stem == stem or path.name.startswith(f"{stem}."):
                files.append(path)
        return sorted(files, key=lambda path: (path.suffix.lower() not in self.video_extensions, path.name))

    def _build_flat_to_folder_moves(self, folder: Path) -> List[Dict[str, str]]:
        moves: List[Dict[str, str]] = []
        seen: Set[Path] = set()
        for video in self._direct_series_videos(folder):
            target_dir = folder / video.stem
            for source in self._sidecars_for_stem(folder, video.stem):
                if source in seen:
                    continue
                moves.append({"from": str(source), "to": str(target_dir / source.name)})
                seen.add(source)
        return moves

    def _target_name_for_flat(self, part_dir: Path, source: Path) -> str:
        suffix = source.suffix
        lower_name = source.name.lower()
        if self._is_video_file(source):
            return f"{part_dir.name}{suffix}"
        if lower_name in {"cover.jpg", "cover.png", "poster.jpg", "poster.png", "cover.webp", "poster.webp"}:
            return f"{part_dir.name}{suffix}"
        if lower_name in {"avatar.jpg", "avatar.png"}:
            return source.name
        if self._part_key(source.stem):
            return source.name
        return f"{part_dir.name}{suffix}"

    def _build_folder_to_flat_moves(self, folder: Path) -> List[Dict[str, str]]:
        moves: List[Dict[str, str]] = []
        for part_dir in self._series_part_dirs(folder):
            for source in sorted(part_dir.iterdir(), key=lambda path: path.name):
                if not source.is_file():
                    continue
                suffix = source.suffix.lower()
                if suffix not in self.video_extensions and suffix not in self.sidecar_extensions:
                    continue
                target_name = self._target_name_for_flat(part_dir, source)
                moves.append({"from": str(source), "to": str(folder / target_name)})
        return moves

    def _remove_empty_part_dirs(self, folder: Path):
        part_dirs = [
            path for path in folder.iterdir()
            if path.is_dir() and self._part_key(path.name)
        ]
        for part_dir in part_dirs:
            try:
                if part_dir.exists() and not any(part_dir.iterdir()):
                    part_dir.rmdir()
            except OSError:
                continue

    def _update_download_file_path(self, old_path: str, new_path: str):
        self.db.query(Download).filter(Download.file_path == old_path).update(
            {Download.file_path: new_path},
            synchronize_session=False,
        )

    def _update_ai_note_paths(self, old_path: str, new_path: str):
        notes = (
            self.db.query(AiNote)
            .filter(AiNote.video_id == old_path)
            .all()
        )
        for note in notes:
            note.video_id = new_path
            note.updated_at = datetime.utcnow()

        meta_notes = self.db.query(AiNote).filter(AiNote.meta.isnot(None)).all()
        for note in meta_notes:
            updated_meta, changed = self._replace_path_in_meta(note.meta, old_path, new_path)
            if changed:
                note.meta = updated_meta
                note.updated_at = datetime.utcnow()

    def _replace_path_in_meta(self, value: Any, old_path: str, new_path: str) -> Tuple[Any, bool]:
        if isinstance(value, str):
            return (new_path, True) if value == old_path else (value, False)

        if isinstance(value, list):
            changed = False
            result = []
            for item in value:
                replaced, item_changed = self._replace_path_in_meta(item, old_path, new_path)
                result.append(replaced)
                changed = changed or item_changed
            return result, changed

        if isinstance(value, dict):
            changed = False
            result: Dict[str, Any] = {}
            for key, item in value.items():
                replaced, item_changed = self._replace_path_in_meta(item, old_path, new_path)
                result[key] = replaced
                changed = changed or item_changed
            return result, changed

        return value, False

    def get_local_opus_content(self, opus_id: str) -> Dict[str, Any]:
        """
        获取图文的本地归档内容
        """
        normalized_opus_id = opus_id if opus_id.startswith("cv") else f"cv{opus_id}"
        library_data = self.local_library.scan_library()
        folder_match = None

        for folder in library_data.folders:
            nfo_data = folder.get("nfo_data") or {}
            if nfo_data.get("opus_id") == normalized_opus_id:
                folder_match = folder
                break

        if not folder_match:
            raise FileNotFoundError(f"未找到图文本地归档: {normalized_opus_id}")

        markdown_path = folder_match.get("markdown_path")
        if not markdown_path or not os.path.exists(markdown_path):
            raise FileNotFoundError(f"未找到图文 Markdown 文件: {normalized_opus_id}")

        markdown_content = Path(markdown_path).read_text(encoding="utf-8")
        nfo_data = folder_match.get("nfo_data") or {}

        return {
            "opus_id": normalized_opus_id,
            "title": folder_match.get("title")
            or nfo_data.get("title")
            or folder_match.get("name"),
            "folder_path": folder_match.get("path"),
            "markdown_path": markdown_path,
            "markdown_content": markdown_content,
            "cover_path": folder_match.get("cover_path"),
            "avatar_path": folder_match.get("avatar_path"),
            "nfo_data": nfo_data,
        }
