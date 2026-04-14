"""
本地视频库扫描服务
用于扫描下载目录并同步视频文件状态
"""
import os
import re
import logging
import uuid
import xml.etree.ElementTree as ET
import platform
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from sqlalchemy.orm import Session

from src.models.download import Download
from src.models.setting import Setting
from src.services.settings_service import SettingsService

logger = logging.getLogger(__name__)

# 检测操作系统
SYSTEM = platform.system().lower()

def get_folder_creation_time(folder_path: str) -> float:
    """
    获取文件夹创建时间（跨平台兼容）
    
    在不同操作系统上的实现：
    - macOS: 使用 st_birthtime（真正的创建时间）
    - Windows: 使用 st_ctime（创建时间）
    - Linux: 使用 st_mtime（修改时间，Linux没有标准的创建时间）
    
    Args:
        folder_path: 文件夹路径
        
    Returns:
        创建时间戳（Unix时间戳）
    """
    try:
        folder_stat = os.stat(folder_path)
        
        if SYSTEM == 'darwin':
            # macOS: 优先使用 st_birthtime（真正的创建时间）
            if hasattr(folder_stat, 'st_birthtime') and folder_stat.st_birthtime > 0:
                logger.debug(f"macOS: 使用 st_birthtime = {folder_stat.st_birthtime}")
                return folder_stat.st_birthtime
            # 如果 birthtime 不可用，使用 ctime
            if folder_stat.st_ctime > 0:
                logger.debug(f"macOS: 使用 st_ctime = {folder_stat.st_ctime}")
                return folder_stat.st_ctime
        elif SYSTEM == 'windows':
            # Windows: st_ctime 是创建时间
            if folder_stat.st_ctime > 0:
                logger.debug(f"Windows: 使用 st_ctime = {folder_stat.st_ctime}")
                return folder_stat.st_ctime
        else:
            # Linux: 使用修改时间（Linux没有标准的创建时间）
            if folder_stat.st_mtime > 0:
                logger.debug(f"Linux: 使用 st_mtime = {folder_stat.st_mtime}")
                return folder_stat.st_mtime
        
        # 如果所有方法都失败，返回 0
        logger.warning(f"无法获取文件夹 {folder_path} 的创建时间，所有方法都失败")
        return 0
        
    except (OSError, FileNotFoundError) as e:
        logger.warning(f"无法获取文件夹 {folder_path} 的创建时间: {e}")
        return 0


class VideoFile:
    """视频文件信息"""
    def __init__(self, path: str, size: int, modified_time: float, title: str):
        self.path = path  # 完整文件路径
        self.size = size  # 文件大小（字节）
        self.modified_time = modified_time  # 修改时间戳
        self.title = title  # 从文件名提取的标题


class LibraryScanResult:
    """扫描结果"""
    def __init__(self):
        self.total_files = 0  # 扫描到的文件总数
        self.folder_count = 0  # 文件夹数量
        self.all_files: List[VideoFile] = []  # 所有发现的文件
        self.new_files: List[VideoFile] = []  # 新发现的文件
        self.existing_files: List[Tuple[Download, VideoFile]] = []  # 已存在的文件 (数据库记录, 文件信息)
        self.missing_files: List[Download] = []  # 数据库中记录但文件不存在的记录
        self.total_size = 0  # 所有文件总大小
        self.errors: List[str] = []  # 扫描过程中的错误
        self.folders: List[Dict] = []  # 文件夹统计信息

    def to_dict(self) -> dict:
        folders_dict = []
        for folder in self.folders:
            folder_dict = {
                "name": folder["name"],
                "title": folder.get("title", folder["name"]),
                "path": folder["path"],
                "file_count": folder["file_count"],
                "size": folder["size"],
                "metadata_size": folder.get("metadata_size", 0),
                "total_size": folder.get("total_size", folder["size"]),
                "size_mb": folder["size_mb"],
                "size_gb": folder["size_gb"],
                "cover": folder.get("cover"),
                "cover_path": folder.get("cover_path"),
                "avatar": folder.get("avatar"),
                "avatar_path": folder.get("avatar_path"),
                "studio": folder.get("studio"),
                "nfo_data": folder.get("nfo_data"),
                "created_time": folder.get("created_time", 0)
            }
            folders_dict.append(folder_dict)
        
        return {
            "total_files": self.total_files,
            "folder_count": self.folder_count,
            "new_files_count": len(self.new_files),
            "existing_files_count": len(self.existing_files),
            "missing_count": len(self.missing_files),
            "total_size": self.total_size,
            "total_size_mb": round(self.total_size / (1024 * 1024), 2),
            "total_size_gb": round(self.total_size / (1024 * 1024 * 1024), 2),
            "all_files": [
                {
                    "path": f.path,
                    "title": f.title,
                    "size": f.size,
                    "size_mb": round(f.size / (1024 * 1024), 2),
                    "modified_time": f.modified_time,
                    "modified_date": datetime.fromtimestamp(f.modified_time).strftime("%Y-%m-%d %H:%M:%S")
                }
                for f in self.all_files
            ],
            "new_files": [
                {
                    "path": f.path,
                    "title": f.title,
                    "size": f.size,
                    "size_mb": round(f.size / (1024 * 1024), 2),
                    "modified_time": f.modified_time,
                    "modified_date": datetime.fromtimestamp(f.modified_time).strftime("%Y-%m-%d %H:%M:%S")
                }
                for f in self.new_files
            ],
            "missing_files": [
                {
                    "id": d.id,
                    "bvid": d.bvid,
                    "title": d.title,
                    "file_path": d.file_path,
                    "file_size": d.file_size,
                    "status": d.status
                }
                for d in self.missing_files
            ],
            "folders": folders_dict,
            "folder_videos": self._serialize_folder_videos() if hasattr(self, 'folder_videos') else {},
            "errors": self.errors
        }
    
    def _serialize_folder_videos(self) -> dict:
        """序列化按文件夹组织的视频数据"""
        if not hasattr(self, 'folder_videos'):
            return {}
        
        serialized = {}
        for folder_name, folder_data in self.folder_videos.items():
            serialized[folder_name] = {
                "files": [
                    {
                        "path": f.path,
                        "title": f.title,
                        "size": f.size,
                        "size_mb": round(f.size / (1024 * 1024), 2),
                        "modified_time": f.modified_time,
                        "modified_date": datetime.fromtimestamp(f.modified_time).strftime("%Y-%m-%d %H:%M:%S")
                    }
                    for f in folder_data.get('files', [])
                ],
                "total_size": folder_data.get('total_size', 0),
                "metadata_size": folder_data.get('metadata_size', 0)
            }
        
        return serialized


class LocalLibraryService:
    """本地视频库扫描服务"""
    
    # 支持的视频文件扩展名
    VIDEO_EXTENSIONS = {'.mp4', '.flv', '.mkv', '.webm', '.avi', '.mov', '.wmv', '.m4v'}
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_download_directory(self) -> str:
        """获取下载目录路径"""
        try:
            settings_service = SettingsService(self.db)
            settings = settings_service.get_settings()
            download_path = settings.storage.download_path if settings.storage else "./downloads"
            
            # 处理相对路径
            if not os.path.isabs(download_path):
                download_path = os.path.abspath(download_path)
            
            return download_path
        except Exception as e:
            logger.error(f"获取下载目录失败: {e}")
            return "./downloads"
    
    def _parse_nfo_file(self, nfo_path: str) -> Optional[Dict]:
        """解析nfo文件，提取元数据"""
        try:
            tree = ET.parse(nfo_path)
            root = tree.getroot()
            
            metadata = {}
            
            # 提取基本信息
            title_elem = root.find('title')
            if title_elem is not None and title_elem.text:
                metadata['title'] = title_elem.text
            
            plot_elem = root.find('plot')
            if plot_elem is not None and plot_elem.text:
                metadata['plot'] = plot_elem.text
            
            studio_elem = root.find('studio')
            if studio_elem is not None and studio_elem.text:
                metadata['studio'] = studio_elem.text
            
            premiered_elem = root.find('premiered')
            if premiered_elem is not None and premiered_elem.text:
                metadata['premiered'] = premiered_elem.text
            
            thumb_elem = root.find('thumb')
            if thumb_elem is not None and thumb_elem.text:
                metadata['thumb'] = thumb_elem.text
            
            # 提取统计信息
            stats_elem = root.find('statistics')
            if stats_elem is not None:
                stats = {}
                play_elem = stats_elem.find('play')
                if play_elem is not None and play_elem.text:
                    try:
                        stats['play'] = int(play_elem.text)
                    except ValueError:
                        pass
                
                like_elem = stats_elem.find('like')
                if like_elem is not None and like_elem.text:
                    try:
                        stats['like'] = int(like_elem.text)
                    except ValueError:
                        pass
                
                coin_elem = stats_elem.find('coin')
                if coin_elem is not None and coin_elem.text:
                    try:
                        stats['coin'] = int(coin_elem.text)
                    except ValueError:
                        pass
                
                favorite_elem = stats_elem.find('favorite')
                if favorite_elem is not None and favorite_elem.text:
                    try:
                        stats['favorite'] = int(favorite_elem.text)
                    except ValueError:
                        pass
                
                if stats:
                    metadata['statistics'] = stats
            
            return metadata if metadata else None
            
        except Exception as e:
            logger.warning(f"解析nfo文件失败 {nfo_path}: {e}")
            return None
    
    def _find_folder_metadata(self, folder_path: str, folder_name: str) -> Dict:
        """查找文件夹的元数据文件（nfo、封面、头像）"""
        metadata = {
            'title': folder_name,
            'cover': None,
            'avatar': None,
            'nfo_data': None,
            'cover_path': None,
            'avatar_path': None
        }
        
        try:
            if not os.path.exists(folder_path):
                return metadata
            
            # 查找nfo文件
            nfo_path = os.path.join(folder_path, f"{folder_name}.nfo")
            if os.path.exists(nfo_path):
                nfo_data = self._parse_nfo_file(nfo_path)
                if nfo_data:
                    metadata['nfo_data'] = nfo_data
                    if 'title' in nfo_data:
                        metadata['title'] = nfo_data['title']
                    if 'thumb' in nfo_data:
                        metadata['cover'] = nfo_data['thumb']
                    if 'studio' in nfo_data:
                        metadata['studio'] = nfo_data['studio']
            
            # 查找封面图片（统一使用cover.jpg）
            cover_path = os.path.join(folder_path, "cover.jpg")
            if os.path.exists(cover_path):
                metadata['cover_path'] = cover_path
                if not metadata['cover']:  # 如果nfo中没有封面URL，使用本地文件
                    metadata['cover'] = cover_path
                logger.debug(f"Found cover image: {cover_path}")
            else:
                logger.debug(f"No cover image found in {folder_path}")
            
            # 查找头像图片
            avatar_path = os.path.join(folder_path, "avatar.jpg")
            if not os.path.exists(avatar_path):
                avatar_path = os.path.join(folder_path, "avatar.png")
            
            if os.path.exists(avatar_path):
                metadata['avatar_path'] = avatar_path
                metadata['avatar'] = avatar_path
            
        except Exception as e:
            logger.warning(f"查找文件夹元数据失败 {folder_path}: {e}")
        
        return metadata
    
    def _extract_title_from_filename(self, filename: str) -> str:
        """从文件名提取视频标题"""
        # 移除扩展名
        name = os.path.splitext(filename)[0]
        
        # 移除常见的前缀和后缀
        # 移除数字前缀 (如 "01 视频标题" -> "视频标题")
        name = re.sub(r'^\d+[\s\-_]*', '', name)
        
        # 移除画质标识
        name = re.sub(r'[\[\(](1080p|720p|480p|4K|HD|SD)[\]\)]', '', name, flags=re.IGNORECASE)
        
        # 移除多余的分隔符
        name = re.sub(r'[\s\-_]+', ' ', name).strip()
        
        return name
    
    def _is_video_file(self, filename: str) -> bool:
        """判断是否为视频文件"""
        return Path(filename).suffix.lower() in self.VIDEO_EXTENSIONS
    
    def _scan_directory(self, directory: str) -> List[VideoFile]:
        """扫描目录中的所有视频文件"""
        video_files = []
        
        if not os.path.exists(directory):
            logger.warning(f"目录不存在: {directory}")
            return video_files
        
        logger.info(f"开始扫描目录: {directory}")
        
        for root, dirs, files in os.walk(directory):
            for filename in files:
                if self._is_video_file(filename):
                    file_path = os.path.join(root, filename)
                    try:
                        # 获取文件信息
                        file_stat = os.stat(file_path)
                        size = file_stat.st_size
                        modified_time = file_stat.st_mtime
                        
                        # 提取标题
                        title = self._extract_title_from_filename(filename)
                        
                        video_file = VideoFile(file_path, size, modified_time, title)
                        video_files.append(video_file)
                        
                        logger.debug(f"发现视频文件: {filename} ({size} bytes)")
                        
                    except (OSError, FileNotFoundError) as e:
                        error_msg = f"无法读取文件 {file_path}: {e}"
                        logger.warning(error_msg)
                        continue
        
        logger.info(f"扫描完成，发现 {len(video_files)} 个视频文件")
        return video_files
    
    def _match_file_to_download(self, video_file: VideoFile, downloads: List[Download]) -> Optional[Download]:
        """将视频文件匹配到下载记录"""
        for download in downloads:
            # 1. 完全路径匹配
            if download.file_path and download.file_path == video_file.path:
                return download
            
            # 2. 文件名匹配
            if download.file_path:
                download_filename = os.path.basename(download.file_path)
                if download_filename == os.path.basename(video_file.path):
                    return download
            
            # 3. 标题匹配
            if download.title:
                download_title = download.title.lower().strip()
                file_title = video_file.title.lower().strip()
                if download_title == file_title or download_title in file_title or file_title in download_title:
                    return download
            
            # 4. BVID 匹配（从文件名中提取 BVID）
            bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', os.path.basename(video_file.path))
            if bvid_match and download.bvid == bvid_match.group():
                return download
        
        return None
    
    def scan_library(self) -> LibraryScanResult:
        """扫描本地视频库并同步状态"""
        result = LibraryScanResult()
        
        try:
            # 1. 获取下载目录
            download_dir = self._get_download_directory()
            logger.info(f"扫描本地视频库: {download_dir}")
            
            # 2. 扫描目录中的视频文件和文件夹
            folder_videos = {}  # 按文件夹组织的视频文件
            
            if not os.path.exists(download_dir):
                logger.warning(f"下载目录不存在: {download_dir}")
            else:
                # 扫描一级文件夹
                for folder_name in os.listdir(download_dir):
                    folder_path = os.path.join(download_dir, folder_name)
                    
                    if not os.path.isdir(folder_path):
                        continue
                    
                    # 获取文件夹创建时间（跨平台兼容）
                    folder_created_time = get_folder_creation_time(folder_path)
                    
                    # 查找文件夹元数据
                    folder_metadata = self._find_folder_metadata(folder_path, folder_name)
                    
                    folder_file_count = 0
                    folder_size = 0
                    folder_files = []
                    metadata_size = 0  # 元数据文件大小
                    
                    # 扫描文件夹内的文件
                    for root, dirs, files in os.walk(folder_path):
                        for filename in files:
                            file_path = os.path.join(root, filename)
                            
                            # 统计所有文件大小
                            try:
                                file_stat = os.stat(file_path)
                                file_size = file_stat.st_size
                                
                                if self._is_video_file(filename):
                                    # 视频文件
                                    modified_time = file_stat.st_mtime
                                    title = self._extract_title_from_filename(filename)
                                    
                                    video_file = VideoFile(file_path, file_size, modified_time, title)
                                    folder_files.append(video_file)
                                    folder_file_count += 1
                                    folder_size += file_size
                                    
                                    logger.debug(f"发现视频文件: {filename} ({file_size} bytes)")
                                else:
                                    # 非视频文件（如nfo、图片等），计入元数据大小
                                    metadata_size += file_size
                                    
                            except (OSError, FileNotFoundError) as e:
                                error_msg = f"无法读取文件 {file_path}: {e}"
                                logger.warning(error_msg)
                                continue
                    
                    if folder_files:
                        # 如果文件夹创建时间为 0，使用第一个文件的修改时间
                        if folder_created_time == 0 and folder_files:
                            folder_created_time = folder_files[0].modified_time
                        
                        folder_videos[folder_name] = {
                            'files': folder_files,
                            'metadata': folder_metadata,
                            'total_size': folder_size,
                            'metadata_size': metadata_size
                        }
                        result.folder_count += 1
                        
                        # 添加文件夹统计信息（包含元数据）
                        result.folders.append({
                            "name": folder_name,
                            "title": folder_metadata['title'],
                            "path": folder_path,
                            "file_count": folder_file_count,
                            "size": folder_size,
                            "metadata_size": metadata_size,
                            "total_size": folder_size + metadata_size,
                            "size_mb": round(folder_size / (1024 * 1024), 2),
                            "size_gb": round(folder_size / (1024 * 1024 * 1024), 2),
                            "cover": folder_metadata['cover'],
                            "cover_path": folder_metadata['cover_path'],
                            "avatar": folder_metadata['avatar'],
                            "avatar_path": folder_metadata['avatar_path'],
                            "studio": folder_metadata.get('studio'),
                            "nfo_data": folder_metadata.get('nfo_data'),
                            "created_time": folder_created_time
                        })
            
            # 展平所有视频文件
            video_files = []
            for folder_data in folder_videos.values():
                video_files.extend(folder_data['files'])
            
            result.total_files = len(video_files)
            result.total_size = sum(f.size for f in video_files)
            result.all_files = video_files  # 保存所有文件
            result.folder_videos = folder_videos  # 保存按文件夹组织的视频
            
            # 3. 获取数据库中的所有下载记录
            downloads = self.db.query(Download).all()
            logger.info(f"数据库中有 {len(downloads)} 个下载记录")
            
            # 4. 匹配文件和记录
            unmatched_downloads = {d.id: d for d in downloads}
            
            for video_file in video_files:
                matched_download = self._match_file_to_download(video_file, downloads)
                
                if matched_download:
                    # 文件已记录
                    result.existing_files.append((matched_download, video_file))
                    # 从未匹配记录中移除
                    if matched_download.id in unmatched_downloads:
                        del unmatched_downloads[matched_download.id]
                else:
                    # 新文件
                    result.new_files.append(video_file)
            
            # 5. 找出文件丢失的记录
            result.missing_files = list(unmatched_downloads.values())
            
            logger.info(f"扫描结果: 文件夹={result.folder_count}, 文件={result.total_files}, 新文件={len(result.new_files)}, 已存在={len(result.existing_files)}, 文件丢失={len(result.missing_files)}")
            
        except Exception as e:
            error_msg = f"扫描本地视频库失败: {e}"
            logger.error(error_msg, exc_info=True)
            result.errors.append(error_msg)
        
        return result
    
    def import_new_files(self, video_files: List[VideoFile], auto_import: bool = False) -> Tuple[int, List[str]]:
        """
        导入新发现的视频文件到数据库
        
        Args:
            video_files: 要导入的视频文件列表
            auto_import: 是否自动导入（不需要用户确认）
            
        Returns:
            (成功导入数量, 导入的文件路径列表)
        """
        imported_count = 0
        imported_paths = []
        
        for video_file in video_files:
            try:
                # 创建新的下载记录
                download = Download(
                    id=str(uuid.uuid4()),
                    bvid="external",  # 外部导入的文件
                    title=video_file.title,
                    file_path=video_file.path,
                    file_size=video_file.size,
                    total_bytes=video_file.size,
                    downloaded_bytes=video_file.size,
                    progress=100.0,
                    status="completed",  # 标记为已完成
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                
                self.db.add(download)
                imported_paths.append(video_file.path)
                imported_count += 1
                
                logger.info(f"导入视频文件: {video_file.title}")
                
            except Exception as e:
                error_msg = f"导入文件失败 {video_file.path}: {e}"
                logger.error(error_msg)
                continue
        
        # 提交更改
        try:
            self.db.commit()
            logger.info(f"成功导入 {imported_count} 个视频文件")
        except Exception as e:
            self.db.rollback()
            logger.error(f"提交导入结果失败: {e}")
            imported_count = 0
            imported_paths = []
        
        return imported_count, imported_paths
    
    def cleanup_missing_files(self, download_ids: List[str]) -> int:
        """
        清理文件丢失的下载记录
        
        Args:
            download_ids: 要清理的下载记录ID列表
            
        Returns:
            清理的记录数量
        """
        if not download_ids:
            return 0
        
        try:
            # 删除指定的下载记录
            deleted_count = self.db.query(Download).filter(
                Download.id.in_(download_ids)
            ).delete()
            
            self.db.commit()
            logger.info(f"清理了 {deleted_count} 个文件丢失的记录")
            
            return deleted_count
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"清理文件丢失记录失败: {e}")
            return 0
    
    def get_library_statistics(self) -> dict:
        """获取视频库统计信息"""
        try:
            download_dir = self._get_download_directory()
            
            if not os.path.exists(download_dir):
                return {
                    "exists": False,
                    "path": download_dir,
                    "message": "下载目录不存在"
                }
            
            # 统计文件信息
            file_count = 0
            total_size = 0
            video_files_by_type = {}
            
            for root, dirs, files in os.walk(download_dir):
                for filename in files:
                    if self._is_video_file(filename):
                        file_path = os.path.join(root, filename)
                        try:
                            file_stat = os.stat(file_path)
                            file_count += 1
                            total_size += file_stat.st_size
                            
                            # 按类型统计
                            ext = Path(filename).suffix.lower()
                            video_files_by_type[ext] = video_files_by_type.get(ext, 0) + 1
                            
                        except (OSError, FileNotFoundError):
                            continue
            
            # 数据库统计
            total_downloads = self.db.query(Download).count()
            completed_downloads = self.db.query(Download).filter(
                Download.status == "completed"
            ).count()
            
            return {
                "exists": True,
                "path": download_dir,
                "file_count": file_count,
                "total_size": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "total_size_gb": round(total_size / (1024 * 1024 * 1024), 2),
                "video_files_by_type": video_files_by_type,
                "database_stats": {
                    "total_downloads": total_downloads,
                    "completed_downloads": completed_downloads
                }
            }
            
        except Exception as e:
            logger.error(f"获取视频库统计信息失败: {e}")
            return {
                "exists": False,
                "error": str(e)
            }