"""
备份服务 - 用于将本地文件备份到 FTP
"""
import logging
import os
from pathlib import Path
from typing import Generator, Tuple, List
from datetime import datetime

from src.utils.ftp_adapter import FTPAdapter

logger = logging.getLogger(__name__)


class BackupService:
    """备份服务类"""
    
    def __init__(self, ftp_config: dict):
        """
        初始化备份服务
        
        Args:
            ftp_config: FTP 配置字典
        """
        self.adapter = FTPAdapter(
            host=ftp_config.get('host', ''),
            username=ftp_config.get('username', ''),
            password=ftp_config.get('password', ''),
            use_tls=ftp_config.get('use_tls', False)
        )
        # 移除前导斜杠，使用相对路径
        remote_path = ftp_config.get('remote_path', '/pilinote').lstrip('/')
        self.remote_base_path = remote_path if remote_path else 'pilinote'
    
    def _scan_directory(self, directory: str) -> Generator[Tuple[str, int, str], None, None]:
        """
        扫描目录中的所有文件
        
        Args:
            directory: 目录路径
        
        Yields:
            (文件路径, 文件大小, 相对路径)
        """
        if not os.path.exists(directory):
            logger.warning(f"Directory not found: {directory}")
            return
        
        base_path = Path(directory)
        
        for root, dirs, files in os.walk(directory):
            for file in files:
                file_path = Path(root) / file
                file_size = file_path.stat().st_size
                relative_path = file_path.relative_to(base_path)
                yield str(file_path), file_size, str(relative_path)
    
    def _prepare_remote_path(self, local_path: str, base_dir: str, remote_dir: str) -> str:
        """
        准备远程文件路径（使用相对路径）
        
        Args:
            local_path: 本地文件路径
            base_dir: 基础目录
            remote_dir: 远程目录
        
        Returns:
            远程文件路径（相对路径）
        """
        relative_path = Path(local_path).relative_to(base_dir)
        # 使用相对路径格式
        if self.remote_base_path:
            remote_path = f"{self.remote_base_path}/{remote_dir}/{relative_path}"
        else:
            remote_path = f"{remote_dir}/{relative_path}"
        return remote_path
    
    def backup_download_directory(self, download_path: str) -> Generator[dict, None, None]:
        """
        备份下载目录（直接传输，保持目录结构）
        
        Args:
            download_path: 下载目录路径
        
        Yields:
            备份进度信息
        """
        logger.info(f"Starting backup of download directory: {download_path}")
        
        # 扫描文件
        files = list(self._scan_directory(download_path))
        total_files = len(files)
        total_size = sum(size for _, size, _ in files)
        
        if total_files == 0:
            yield {
                'type': 'error',
                'message': '下载目录为空或不存在'
            }
            return
        
        yield {
            'type': 'progress',
            'total_files': total_files,
            'total_size': total_size,
            'completed_files': 0,
            'completed_size': 0,
            'current_file': '',
            'message': f'准备备份 {total_files} 个文件，总大小 {self._format_size(total_size)}'
        }
        
        # 连接 WebDAV
        if not self.adapter.connect():
            yield {
                'type': 'error',
                'message': '无法连接到 WebDAV 服务器'
            }
            return
        
        # 上传文件
        completed_files = 0
        completed_size = 0
        
        for file_path, file_size, relative_path in files:
            try:
                # 准备远程路径
                remote_path = self._prepare_remote_path(file_path, download_path, 'downloads')
                
                # 直接上传
                success = self.adapter.upload_file(file_path, remote_path)
                
                if success:
                    completed_files += 1
                    completed_size += file_size
                    logger.info(f"Uploaded: {relative_path} ({self._format_size(file_size)})")
                else:
                    logger.error(f"Failed to upload: {relative_path}")
                
                # 发送进度更新
                yield {
                    'type': 'progress',
                    'total_files': total_files,
                    'total_size': total_size,
                    'completed_files': completed_files,
                    'completed_size': completed_size,
                    'current_file': relative_path,
                    'message': f'已上传 {completed_files}/{total_files} 个文件'
                }
                
            except Exception as e:
                logger.error(f"Error uploading {file_path}: {e}")
                yield {
                    'type': 'error',
                    'message': f'上传文件失败: {relative_path} - {str(e)}'
                }
        
        # 完成
        yield {
            'type': 'complete',
            'message': f'备份完成！成功上传 {completed_files}/{total_files} 个文件'
        }
    
    def backup_database(self, database_path: str) -> Generator[dict, None, None]:
        """
        备份数据库文件
        
        Args:
            database_path: 数据库文件路径
        
        Yields:
            备份进度信息
        """
        logger.info(f"Starting backup of database: {database_path}")
        
        if not os.path.exists(database_path):
            yield {
                'type': 'error',
                'message': '数据库文件不存在'
            }
            return
        
        file_size = os.path.getsize(database_path)
        file_name = Path(database_path).name
        
        # 添加时间戳
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{Path(file_name).stem}_{timestamp}{Path(file_name).suffix}"
        remote_dir = f"{self.remote_base_path}/data"
        remote_path = f"{remote_dir}/{backup_name}"
        
        yield {
            'type': 'progress',
            'total_files': 1,
            'total_size': file_size,
            'completed_files': 0,
            'completed_size': 0,
            'current_file': file_name,
            'message': f'准备备份数据库: {file_name} ({self._format_size(file_size)})'
        }
        
        # 连接 WebDAV
        if not self.adapter.connect():
            yield {
                'type': 'error',
                'message': '无法连接到 WebDAV 服务器'
            }
            return
        
        # 确保远程目录存在
        if not self.adapter.mkdir(remote_dir):
            yield {
                'type': 'error',
                'message': f'无法创建远程目录: {remote_dir}'
            }
            return
        
        # 上传文件
        success = self.adapter.upload_file(database_path, remote_path)
        
        if success:
            yield {
                'type': 'complete',
                'message': f'数据库备份完成: {backup_name}'
            }
        else:
            yield {
                'type': 'error',
                'message': '数据库备份失败，请检查 WebDAV 服务器权限'
            }
    
    @staticmethod
    def _format_size(size_bytes: int) -> str:
        """格式化文件大小"""
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        size = float(size_bytes)
        
        while size >= 1024 and i < len(size_names) - 1:
            size /= 1024
            i += 1
        
        return f"{size:.1f} {size_names[i]}"