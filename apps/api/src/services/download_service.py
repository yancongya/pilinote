import os
import uuid
import asyncio
import logging
import shutil
from datetime import datetime
from typing import Dict, Optional, Callable
from pathlib import Path
import yt_dlp

from src.database import SessionLocal
from src.models.download import Download
from src.services.download_engine import DownloadEngine

logger = logging.getLogger(__name__)


class DownloadService:
    """下载服务类 - 管理下载任务"""
    
    def __init__(self):
        # 存储活跃的下载任务
        self.active_downloads: Dict[str, asyncio.Task] = {}
        
        # 从设置中读取路径配置
        try:
            from src.services.settings_service import SettingsService
            from src.database import SessionLocal
            
            with SessionLocal() as db:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                self.download_dir = Path(settings.storage.download_path)
                self.temp_dir = Path(settings.storage.temp_path)
        except Exception as e:
            logger.warning(f"Failed to load settings, using default paths: {e}")
            self.download_dir = Path("downloads")
            self.temp_dir = Path("temp")
        
        # 创建目录
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        # 最大并发下载数
        self.max_concurrent = 3
        # 下载队列
        self.download_queue = []
        # 下载引擎实例（从设置中初始化）
        self.download_engine = self._create_download_engine()
    
    def _create_download_engine(self):
        """创建下载引擎实例，从设置中读取工具路径"""
        try:
            from src.services.settings_service import SettingsService
            from src.database import SessionLocal
            
            with SessionLocal() as db:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                return DownloadEngine(settings)
        except Exception as e:
            logger.warning(f"Failed to load settings, using default tool paths: {e}")
            return DownloadEngine()
    
    def update_engine_settings(self):
        """更新下载引擎的设置（当设置改变时调用）"""
        self.download_engine = self._create_download_engine()
        logger.info("Download engine settings updated")
    
    def _create_temp_download_dir(self, download_id: str) -> Path:
        """创建临时下载目录"""
        temp_download_dir = self.temp_dir / download_id
        temp_download_dir.mkdir(parents=True, exist_ok=True)
        return temp_download_dir
    
    def create_download_task(
        self,
        bvid: str,
        title: str,
        cid: Optional[int] = None,
        aid: Optional[int] = None,
        quality: int = 64,
        output_format: str = "mp4",
        thumbnail_url: Optional[str] = None,
        duration: Optional[int] = None,
        uploader: Optional[str] = None,
        uploader_mid: Optional[int] = None,
        sessdata: Optional[str] = None,
        audio_bitrate: Optional[int] = 192,
        codec: Optional[str] = 'avc'
    ) -> str:
        """创建下载任务"""
        download_id = str(uuid.uuid4())
        
        # 创建下载记录（不预先获取大小，在下载时动态获取）
        with SessionLocal() as db:
            download = Download(
                id=download_id,
                bvid=bvid,
                title=title,
                cid=cid,
                aid=aid,
                quality=quality,
                output_format=output_format,
                audio_bitrate=audio_bitrate,
                codec=codec,
                thumbnail_url=thumbnail_url,
                duration=duration,
                uploader=uploader,
                uploader_mid=uploader_mid,
                sessdata=sessdata,
                total_bytes=0,  # 初始为0，下载时更新
                status="pending"
            )
            db.add(download)
            db.commit()
        
        return download_id
    
    def get_download(self, download_id: str) -> Optional[Download]:
        """获取下载任务"""
        with SessionLocal() as db:
            return db.query(Download).filter(Download.id == download_id).first()
    
    def update_download_progress(
        self,
        download_id: str,
        progress: float,
        downloaded_bytes: int = 0,
        total_bytes: int = 0,
        download_speed: float = 0.0,
        eta: float = 0.0
    ):
        """更新下载进度"""
        with SessionLocal() as db:
            download = db.query(Download).filter(Download.id == download_id).first()
            if download:
                download.progress = progress
                download.downloaded_bytes = downloaded_bytes
                download.total_bytes = total_bytes
                download.download_speed = download_speed
                download.eta = eta
                download.updated_at = datetime.utcnow()
                db.commit()
    
    def update_download_status(
        self,
        download_id: str,
        status: str,
        error_message: Optional[str] = None
    ):
        """更新下载状态"""
        with SessionLocal() as db:
            download = db.query(Download).filter(Download.id == download_id).first()
            if download:
                download.status = status
                download.updated_at = datetime.utcnow()
                
                if status == "downloading" and not download.started_at:
                    download.started_at = datetime.utcnow()
                elif status == "completed":
                    download.completed_at = datetime.utcnow()
                    download.progress = 100.0
                elif status == "failed" and error_message:
                    download.error_message = error_message
                    download.retry_count += 1
                
                db.commit()
    
    def get_all_downloads(self, status: Optional[str] = None) -> list[Download]:
        """获取所有下载任务"""
        with SessionLocal() as db:
            query = db.query(Download)
            if status:
                query = query.filter(Download.status == status)
            return query.order_by(Download.created_at.desc()).all()

    def get_downloads_by_bvid(self, bvid: str, status: Optional[str] = None) -> list[Download]:
        """根据bvid获取下载任务"""
        with SessionLocal() as db:
            query = db.query(Download).filter(Download.bvid == bvid)
            if status:
                query = query.filter(Download.status == status)
            return query.order_by(Download.created_at.desc()).all()
    
    def cancel_download(self, download_id: str) -> bool:
        """取消下载任务"""
        download = self.get_download(download_id)
        if not download:
            return False
        
        # 如果任务正在运行，停止它
        if download_id in self.active_downloads:
            task = self.active_downloads[download_id]
            task.cancel()
            del self.active_downloads[download_id]
        
        # 更新状态
        self.update_download_status(download_id, "cancelled")
        return True
    
    def clear_all_downloads(self) -> int:
        """清空所有下载任务"""
        with SessionLocal() as db:
            count = db.query(Download).count()
            db.query(Download).delete()
            db.commit()
            return count
    
    def retry_download(self, download_id: str) -> bool:
        """重试失败的下载任务"""
        download = self.get_download(download_id)
        if not download or download.status != "failed":
            return False
        
        # 重置状态并重新排队
        download.status = "pending"
        download.error_message = None
        download.progress = 0.0
        download.downloaded_bytes = 0
        
        with SessionLocal() as db:
            db.add(download)
            db.commit()
        
        # 重新启动下载
        asyncio.create_task(self._process_download(download.id))
        return True
    
    async def _process_download(self, download_id: str):
        """处理下载任务"""
        download = self.get_download(download_id)
        if not download:
            return
        
        # 检查并发限制
        active_count = len([d for d in self.active_downloads.values() if not d.done()])
        if active_count >= self.max_concurrent:
            # 加入队列
            self.download_queue.append(download_id)
            self.update_download_status(download_id, "queued")
            return
        
        # 开始下载
        try:
            self.update_download_status(download_id, "downloading")
            
            # 创建下载任务
            task = asyncio.create_task(self._download_video(download_id))
            self.active_downloads[download_id] = task
            
            # 等待下载完成
            await task
            
        except asyncio.CancelledError:
            self.update_download_status(download_id, "cancelled")
        except Exception as e:
            self.update_download_status(download_id, "failed", str(e))
        finally:
            # 从活跃任务中移除
            if download_id in self.active_downloads:
                del self.active_downloads[download_id]
            
            # 处理队列中的下一个任务
            if self.download_queue:
                next_id = self.download_queue.pop(0)
                asyncio.create_task(self._process_download(next_id))
    
    async def _process_completed_download(
        self,
        download_id: str,
        temp_dir: Path,
        final_dir: Path,
        storage_settings
    ):
        """
        处理已完成的下载 - 移动文件并清理
        
        Args:
            download_id: 下载任务ID
            temp_dir: 临时目录
            final_dir: 最终目录
            storage_settings: 存储设置
        """
        import shutil
        logger.info(f"Processing completed download: {download_id}")
        logger.info(f"Temp dir: {temp_dir}")
        logger.info(f"Final dir: {final_dir}")
        try:
            # 确保最终目录存在
            final_dir.mkdir(parents=True, exist_ok=True)
            
            # 移动临时目录中的所有内容到最终目录
            for item in temp_dir.iterdir():
                dest = final_dir / item.name
                
                # 处理文件名冲突
                if dest.exists():
                    # 如果目标文件已存在，添加时间戳后缀
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    if dest.is_file():
                        stem = dest.stem
                        suffix = dest.suffix
                        dest = final_dir / f"{stem}_{timestamp}{suffix}"
                    else:
                        dest = final_dir / f"{item.name}_{timestamp}"
                
                # 移动文件或目录
                shutil.move(str(item), str(dest))
                logger.info(f"Moved {item.name} to {dest}")
            
            # 更新数据库中的文件路径
            with SessionLocal() as db:
                download = db.query(Download).filter(Download.id == download_id).first()
                print(f"DEBUG: Looking for download with id={download_id}")
                print(f"DEBUG: Found download: {download is not None}")
                if download:
                    print(f"DEBUG: Final dir: {final_dir}")
                    print(f"DEBUG: Final dir exists: {final_dir.exists()}")
                    # 递归查找最终目录中的视频文件（包括子目录）
                    video_files = [f for f in final_dir.rglob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
                    print(f"DEBUG: Video files found: {len(video_files)}")
                    if video_files:
                        print(f"DEBUG: First video file: {video_files[0]}")
                        # 更新文件路径为最终路径
                        download.file_path = str(video_files[0])
                        download.file_size = video_files[0].stat().st_size
                        print(f"DEBUG: Updated file_path to: {download.file_path}")
                    download.temp_file_path = None  # 清除临时路径
                    db.commit()
                    print(f"DEBUG: Database commit completed")
            
            # 根据设置清理临时目录
            if storage_settings and storage_settings.auto_cleanup:
                await self._cleanup_temp_dir(temp_dir)
                logger.info(f"Auto-cleaned temp directory: {temp_dir}")
            else:
                # 保留临时目录，但重命名为 .temp 后缀
                backup_dir = temp_dir.parent / (temp_dir.name + '.temp')
                if backup_dir.exists():
                    shutil.rmtree(str(backup_dir))
                shutil.move(str(temp_dir), str(backup_dir))
                logger.info(f"Kept temp directory at: {backup_dir}")
                
        except Exception as e:
            logger.error(f"Failed to process completed download: {e}")
            raise
    
    async def _handle_failed_or_cancelled_download(
        self,
        download_id: str,
        temp_dir: Path,
        storage_settings,
        status: str
    ):
        """
        处理失败或取消的下载
        
        Args:
            download_id: 下载任务ID
            temp_dir: 临时目录
            storage_settings: 存储设置
            status: 任务状态（"failed" 或 "cancelled"）
        """
        import shutil
        try:
            # 根据设置决定是否保留临时文件
            if storage_settings and storage_settings.keep_failed:
                # 保留临时文件，重命名以便识别
                suffix = '.failed' if status == 'failed' else '.cancelled'
                backup_dir = temp_dir.parent / (temp_dir.name + suffix)
                
                if backup_dir.exists():
                    shutil.rmtree(str(backup_dir))
                
                shutil.move(str(temp_dir), str(backup_dir))
                logger.info(f"Kept {status} download files at: {backup_dir}")
                
                # 更新数据库中的文件路径
                with SessionLocal() as db:
                    download = db.query(Download).filter(Download.id == download_id).first()
                    if download:
                        # 查找backup_dir中的视频文件
                        video_files = [f for f in backup_dir.glob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
                        if video_files:
                            # 更新文件路径为保留路径
                            download.file_path = str(video_files[0])
                            download.file_size = video_files[0].stat().st_size
                        download.temp_file_path = None  # 清除临时路径
                        db.commit()
            else:
                # 清理临时文件
                await self._cleanup_temp_dir(temp_dir)
                logger.info(f"Cleaned up {status} download files")
                
        except Exception as e:
            logger.error(f"Failed to handle {status} download: {e}")
    
    async def _cleanup_temp_dir(self, temp_dir: Path):
        """
        清理临时目录
        
        Args:
            temp_dir: 要清理的临时目录
        """
        import shutil
        try:
            if temp_dir.exists():
                shutil.rmtree(str(temp_dir))
                logger.info(f"Cleaned up temp directory: {temp_dir}")
        except Exception as e:
            logger.error(f"Failed to clean up temp directory {temp_dir}: {e}")
    
    async def _download_video(self, download_id: str):
        """执行视频下载"""
        download = self.get_download(download_id)
        if not download:
            return
        
        # 获取当前设置
        try:
            from src.services.settings_service import SettingsService
            from src.database import SessionLocal
            
            with SessionLocal() as db:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                storage_settings = settings.storage
        except Exception as e:
            logger.warning(f"Failed to load settings: {e}")
            # 使用默认设置
            from src.schemas.settings import StorageSettings
            storage_settings = StorageSettings()
        
        # 创建临时下载目录
        temp_download_dir = self._create_temp_download_dir(download_id)
        
        try:
            # 确定输出目录名称
            import re
            if download.aid:
                # 系列视频：使用合集名称作为目录名
                series_name = re.sub(r'【Part \d+】', '', download.title).strip()
                safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', series_name).strip()
                if not safe_title:
                    safe_title = f"series_{download.aid}"
            else:
                # 单个视频：使用完整标题
                safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', download.title).strip()
                if not safe_title:
                    safe_title = "video"
            
            # 创建视频专属目录（在临时目录中）
            video_dir = temp_download_dir / safe_title
            video_dir.mkdir(exist_ok=True)
            
            # 使用下载引擎下载视频到临时目录
            await self.download_engine.download_video(
                bvid=download.bvid,
                quality=download.quality,
                output_format=download.output_format,
                output_path=str(video_dir),  # 下载到临时目录
                sessdata=download.sessdata,
                progress_callback=lambda bvid, progress, downloaded_bytes, total_bytes, download_speed, eta: 
                    self.update_download_progress(
                        download_id,
                        progress,
                        downloaded_bytes,
                        total_bytes,
                        download_speed,
                        eta
                    ),
                cid=download.cid,
                audio_bitrate=download.audio_bitrate,
                codec=download.codec
            )
            
            # 获取下载的文件路径
            video_files = [f for f in video_dir.glob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
            if video_files:
                # 此时文件还在临时目录，暂时保存临时路径
                download.temp_file_path = str(video_files[0])
                download.file_size = video_files[0].stat().st_size
                
                # 保存到数据库
                with SessionLocal() as db:
                    db_download = db.query(Download).filter(Download.id == download_id).first()
                    if db_download:
                        db_download.temp_file_path = download.temp_file_path
                        db_download.file_size = download.file_size
                        db.commit()
            
            # 处理已完成的下载（移动文件到最终目录）
            print(f"DEBUG: About to call _process_completed_download with download_id={download_id}")
            print(f"DEBUG: temp_download_dir={temp_download_dir}")
            print(f"DEBUG: final_dir={self.download_dir}")
            print(f"DEBUG: Using download path from settings: {storage_settings.download_path}")
            await self._process_completed_download(
                download_id=download_id,
                temp_dir=temp_download_dir,
                final_dir=Path(storage_settings.download_path),
                storage_settings=storage_settings
            )
            print(f"DEBUG: _process_completed_download completed")
            
            self.update_download_status(download_id, "completed")
            
        except asyncio.CancelledError:
            # 下载被取消
            await self._handle_failed_or_cancelled_download(
                download_id=download_id,
                temp_dir=temp_download_dir,
                storage_settings=storage_settings,
                status="cancelled"
            )
            self.update_download_status(download_id, "cancelled")
            
        except Exception as e:
            # 下载失败
            await self._handle_failed_or_cancelled_download(
                download_id=download_id,
                temp_dir=temp_download_dir,
                storage_settings=storage_settings,
                status="failed"
            )
            self.update_download_status(download_id, "failed", str(e))
            raise


# 全局下载服务实例
download_service = DownloadService()