import os
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Optional, Callable
from pathlib import Path
import yt_dlp

from src.database import SessionLocal
from src.models.download import Download


class DownloadService:
    """下载服务类 - 管理下载任务"""
    
    def __init__(self):
        # 存储活跃的下载任务
        self.active_downloads: Dict[str, asyncio.Task] = {}
        # 下载目录
        self.download_dir = Path("downloads")
        self.download_dir.mkdir(exist_ok=True)
        # 最大并发下载数
        self.max_concurrent = 3
        # 下载队列
        self.download_queue = []
    
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
        sessdata: Optional[str] = None
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
    
    async def _download_video(self, download_id: str):
        """执行视频下载"""
        download = self.get_download(download_id)
        if not download:
            return
        
        # 创建视频专属目录
        video_dir = self.download_dir / download_id
        video_dir.mkdir(exist_ok=True)
        
        # 构建yt-dlp配置
        def progress_hook(d: Dict):
            """进度回调函数"""
            if d['status'] == 'downloading':
                total_bytes = d.get('total_bytes', 0) or 0
                downloaded_bytes = d.get('downloaded_bytes', 0) or 0
                
                # 计算进度百分比
                if total_bytes > 0:
                    progress = (downloaded_bytes / total_bytes) * 100
                else:
                    progress = 0.0
                
                # 获取速度和ETA，处理None值
                speed = d.get('speed') or 0
                download_speed = speed / 1024 if speed else 0.0
                eta = d.get('eta') or 0
                
                self.update_download_progress(
                    download_id,
                    progress,
                    downloaded_bytes,
                    total_bytes,
                    download_speed,
                    eta
                )
            elif d['status'] == 'finished':
                self.update_download_progress(download_id, 100.0)
        
        # 使用更灵活的格式选择，兼容B站视频格式
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',  # 最适合B站的格式选择
            'outtmpl': str(video_dir / '%(title)s.%(ext)s'),
            'progress_hooks': [progress_hook],
            'quiet': False,
            'no_warnings': False,
            'merge_output_format': 'mp4',  # 输出为MP4
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
            }],
        }
        
        # 添加SESSDATA
        if download.sessdata:
            # 创建临时cookie文件
            cookie_file = video_dir / 'cookies.txt'
            with open(cookie_file, 'w') as f:
                f.write(f".bilibili.com\tTRUE\t/\tFALSE\t0\tSESSDATA\t{download.sessdata}\n")
            ydl_opts['cookiefile'] = str(cookie_file)
        
        try:
            # 执行下载
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([f'https://www.bilibili.com/video/{download.bvid}'])
            
            # 获取下载的文件路径
            # 只选择视频文件，排除cookie文件
            video_files = [f for f in video_dir.glob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
            if video_files:
                download.file_path = str(video_files[0])
                download.file_size = video_files[0].stat().st_size
            
            self.update_download_status(download_id, "completed")
            
        except Exception as e:
            self.update_download_status(download_id, "failed", str(e))
            raise


# 全局下载服务实例
download_service = DownloadService()