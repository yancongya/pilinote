"""
下载管理器 - 管理下载任务队列、并发控制和任务状态
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional, List, Callable
from enum import Enum

from src.database import SessionLocal
from src.models.download import Download

logger = logging.getLogger(__name__)


class DownloadStatus(Enum):
    """下载状态枚举"""
    PENDING = "pending"
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    PAUSED = "paused"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DownloadManager:
    """
    下载管理器 - 统一管理所有下载任务
    
    功能：
    - 任务队列管理
    - 并发控制（最多3个任务）
    - 任务状态管理
    - 暂停/继续/取消操作
    - 进度追踪
    """
    
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self.active_downloads: Dict[str, asyncio.Task] = {}
        self.paused_downloads: Dict[str, asyncio.Event] = {}
        self.download_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._processor_task: Optional[asyncio.Task] = None
        
        # 进度回调函数
        self.progress_callbacks: List[Callable] = []
    
    def add_progress_callback(self, callback: Callable):
        """添加进度回调函数"""
        self.progress_callbacks.append(callback)
    
    def remove_progress_callback(self, callback: Callable):
        """移除进度回调函数"""
        if callback in self.progress_callbacks:
            self.progress_callbacks.remove(callback)
    
    async def start(self):
        """启动下载管理器"""
        if not self._running:
            self._running = True
            self._processor_task = asyncio.create_task(self._process_queue())
            logger.info("DownloadManager started")
    
    async def stop(self):
        """停止下载管理器"""
        if self._running:
            self._running = False
            if self._processor_task:
                self._processor_task.cancel()
                try:
                    await self._processor_task
                except asyncio.CancelledError:
                    pass
            
            # 取消所有活跃下载
            for task_id, task in list(self.active_downloads.items()):
                task.cancel()
            
            logger.info("DownloadManager stopped")
    
    async def add_task(self, download_id: str) -> bool:
        """
        添加下载任务到队列
        
        Args:
            download_id: 下载任务ID
            
        Returns:
            是否成功添加
        """
        download = self._get_download(download_id)
        if not download:
            logger.error(f"Download {download_id} not found")
            return False
        
        if download.status in [DownloadStatus.DOWNLOADING.value, DownloadStatus.PROCESSING.value]:
            logger.warning(f"Download {download_id} is already active")
            return False
        
        # 更新状态为queued
        self._update_status(download_id, DownloadStatus.QUEUED.value)
        await self.download_queue.put(download_id)
        
        logger.info(f"Download {download_id} added to queue")
        return True
    
    async def start_task(self, download_id: str) -> bool:
        """
        开始下载任务
        
        Args:
            download_id: 下载任务ID
            
        Returns:
            是否成功开始
        """
        download = self._get_download(download_id)
        if not download:
            logger.error(f"Download {download_id} not found")
            return False
        
        if download.status == DownloadStatus.PAUSED.value:
            # 恢复暂停的任务
            return await self.resume_task(download_id)
        elif download.status == DownloadStatus.QUEUED.value:
            # 任务已在队列中，等待处理
            return True
        elif download.status == DownloadStatus.PENDING.value:
            # 添加到队列
            return await self.add_task(download_id)
        elif download.status == DownloadStatus.CANCELLED.value or download.status == DownloadStatus.FAILED.value:
            # 重置任务状态并重新开始
            self._update_status(download_id, DownloadStatus.PENDING.value)
            return await self.add_task(download_id)
        else:
            logger.warning(f"Cannot start download {download_id} with status {download.status}")
            return False
    
    async def pause_task(self, download_id: str) -> bool:
        """
        暂停下载任务
        
        Args:
            download_id: 下载任务ID
            
        Returns:
            是否成功暂停
        """
        download = self._get_download(download_id)
        if not download or download.status != DownloadStatus.DOWNLOADING.value:
            return False
        
        # 创建暂停事件
        if download_id not in self.paused_downloads:
            self.paused_downloads[download_id] = asyncio.Event()
        
        # 设置暂停标志
        self.paused_downloads[download_id].clear()
        
        # 更新状态
        self._update_status(download_id, DownloadStatus.PAUSED.value)
        
        logger.info(f"Download {download_id} paused")
        return True
    
    async def resume_task(self, download_id: str) -> bool:
        """
        继续下载任务
        
        Args:
            download_id: 下载任务ID
            
        Returns:
            是否成功继续
        """
        download = self._get_download(download_id)
        if not download or download.status != DownloadStatus.PAUSED.value:
            return False
        
        # 清除暂停标志
        if download_id in self.paused_downloads:
            self.paused_downloads[download_id].set()
            del self.paused_downloads[download_id]
        
        # 更新状态
        self._update_status(download_id, DownloadStatus.DOWNLOADING.value)
        
        logger.info(f"Download {download_id} resumed")
        return True
    
    async def cancel_task(self, download_id: str) -> bool:
        """
        取消下载任务
        
        Args:
            download_id: 下载任务ID
            
        Returns:
            是否成功取消
        """
        download = self._get_download(download_id)
        if not download:
            return False
        
        # 如果任务正在运行，停止它
        if download_id in self.active_downloads:
            task = self.active_downloads[download_id]
            task.cancel()
            del self.active_downloads[download_id]
        
        # 清除暂停状态
        if download_id in self.paused_downloads:
            del self.paused_downloads[download_id]
        
        # 更新状态
        self._update_status(download_id, DownloadStatus.CANCELLED.value)
        
        logger.info(f"Download {download_id} cancelled")
        return True
    
    async def get_task_status(self, download_id: str) -> Optional[Dict]:
        """
        获取任务状态
        
        Args:
            download_id: 下载任务ID
            
        Returns:
            任务状态字典
        """
        download = self._get_download(download_id)
        if not download:
            return None
        
        return {
            "id": download.id,
            "bvid": download.bvid,
            "title": download.title,
            "status": download.status,
            "progress": download.progress,
            "downloaded_bytes": download.downloaded_bytes,
            "total_bytes": download.total_bytes,
            "download_speed": download.download_speed,
            "eta": download.eta,
            "file_path": download.file_path,
            "error_message": download.error_message,
            "created_at": download.created_at.isoformat() if download.created_at else None,
            "started_at": download.started_at.isoformat() if download.started_at else None,
            "completed_at": download.completed_at.isoformat() if download.completed_at else None,
        }
    
    async def get_all_tasks(self, status: Optional[str] = None) -> List[Dict]:
        """
        获取所有任务
        
        Args:
            status: 可选，筛选特定状态的任务
            
        Returns:
            任务列表
        """
        with SessionLocal() as db:
            query = db.query(Download)
            if status:
                query = query.filter(Download.status == status)
            downloads = query.order_by(Download.created_at.desc()).all()
            
            return [
                {
                    "id": d.id,
                    "bvid": d.bvid,
                    "title": d.title,
                    "status": d.status,
                    "progress": d.progress,
                    "downloaded_bytes": d.downloaded_bytes,
                    "total_bytes": d.total_bytes,
                    "download_speed": d.download_speed,
                    "eta": d.eta,
                    "thumbnail_url": d.thumbnail_url,
                    "duration": d.duration,
                    "uploader": d.uploader,
                    "file_path": d.file_path,
                    "error_message": d.error_message,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                    "started_at": d.started_at.isoformat() if d.started_at else None,
                    "completed_at": d.completed_at.isoformat() if d.completed_at else None,
                }
                for d in downloads
            ]
    
    def _get_download(self, download_id: str) -> Optional[Download]:
        """获取下载任务"""
        with SessionLocal() as db:
            return db.query(Download).filter(Download.id == download_id).first()
    
    def _update_status(self, download_id: str, status: str, error_message: Optional[str] = None):
        """更新下载状态"""
        with SessionLocal() as db:
            download = db.query(Download).filter(Download.id == download_id).first()
            if download:
                download.status = status
                download.updated_at = datetime.utcnow()
                
                if status == DownloadStatus.DOWNLOADING.value and not download.started_at:
                    download.started_at = datetime.utcnow()
                elif status == DownloadStatus.COMPLETED.value:
                    download.completed_at = datetime.utcnow()
                    download.progress = 100.0
                elif status == DownloadStatus.FAILED.value and error_message:
                    download.error_message = error_message
                    download.retry_count += 1
                
                db.commit()
    
    def _update_progress(
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
        
        # 调用进度回调
        for callback in self.progress_callbacks:
            try:
                callback(download_id, progress, downloaded_bytes, total_bytes, download_speed, eta)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
    
    async def _process_queue(self):
        """处理下载队列"""
        while self._running:
            try:
                # 等待下一个任务
                download_id = await asyncio.wait_for(
                    self.download_queue.get(),
                    timeout=1.0
                )
                
                # 检查并发限制
                active_count = len([t for t in self.active_downloads.values() if not t.done()])
                if active_count >= self.max_concurrent:
                    # 重新放回队列
                    await self.download_queue.put(download_id)
                    await asyncio.sleep(1.0)
                    continue
                
                # 检查任务是否被取消
                download = self._get_download(download_id)
                if not download or download.status == DownloadStatus.CANCELLED.value:
                    continue
                
                # 创建下载任务
                task = asyncio.create_task(self._execute_download(download_id))
                self.active_downloads[download_id] = task
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing queue: {e}")
    
    async def _execute_download(self, download_id: str):
        """执行下载任务"""
        download = self._get_download(download_id)
        if not download:
            logger.error(f"Download {download_id} not found")
            return
        
        try:
            logger.info(f"Starting download execution for {download_id}, bvid: {download.bvid}, title: {download.title}")
            self._update_status(download_id, DownloadStatus.DOWNLOADING.value)
            
            # 导入下载引擎
            from src.services.download_engine import DownloadEngine
            engine = DownloadEngine()
            
            # 使用视频标题创建子文件夹名称
            safe_title = "".join(c for c in download.title if c.isalnum() or c in (' ', '-', '_')).strip()
            if not safe_title:
                safe_title = "video"
            
            # 构建输出路径：UUID/标题
            output_path = f"downloads/{download_id}/{safe_title}"
            
            # 执行下载
            logger.info(f"Calling download_engine.download_video for {download.bvid}, output_path: {output_path}")
            await engine.download_video(
                bvid=download.bvid,
                quality=download.quality,
                output_format=download.output_format,
                output_path=output_path,
                sessdata=download.sessdata,
                progress_callback=lambda d, p, db, tb, ds, eta: self._update_progress(
                    download_id, p, db, tb, ds, eta
                ),
                pause_event=self.paused_downloads.get(download_id),
                cid=download.cid
            )
            logger.info(f"Download video completed for {download.bvid}")
            
            # 更新文件路径
            logger.info(f"Processing files for {download_id}")
            self._update_status(download_id, DownloadStatus.PROCESSING.value)
            
            # 获取下载的文件
            import os
            video_files = []
            for root, dirs, files in os.walk(f"downloads/{download_id}"):
                for file in files:
                    if file.endswith(('.mp4', '.flv', '.mkv', '.webm')):
                        full_path = os.path.join(root, file)
                        file_size = os.path.getsize(full_path)
                        video_files.append((full_path, file_size))
                        logger.info(f"Found video file: {full_path}, size: {file_size} bytes")
            
            if video_files:
                # 计算总大小
                total_size = sum(size for path, size in video_files)
                main_file = video_files[0][0]
                
                with SessionLocal() as db:
                    download = db.query(Download).filter(Download.id == download_id).first()
                    if download:
                        download.file_path = main_file
                        download.file_size = total_size
                        download.total_bytes = total_size
                        download.downloaded_bytes = total_size
                        download.progress = 100.0
                        db.commit()
                        logger.info(f"Updated file path for {download_id}: {main_file}, total size: {total_size}")
            else:
                logger.warning(f"No video files found for {download_id}")
            
            self._update_status(download_id, DownloadStatus.COMPLETED.value)
            logger.info(f"Download {download_id} completed successfully")
            
        except asyncio.CancelledError:
            self._update_status(download_id, DownloadStatus.CANCELLED.value)
            logger.info(f"Download {download_id} cancelled")
        except Exception as e:
            self._update_status(download_id, DownloadStatus.FAILED.value, str(e))
            logger.error(f"Download {download_id} failed: {e}", exc_info=True)
        finally:
            # 从活跃任务中移除
            if download_id in self.active_downloads:
                del self.active_downloads[download_id]
            
            # 清除暂停状态
            if download_id in self.paused_downloads:
                del self.paused_downloads[download_id]


# 全局下载管理器实例
download_manager = DownloadManager()