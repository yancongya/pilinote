import os
import uuid
import asyncio
import logging
import shutil
import xml.etree.ElementTree as ET
import httpx
from datetime import datetime
from typing import Dict, Optional, Callable, Any
from pathlib import Path
import yt_dlp

from src.database import SessionLocal
from src.models.download import Download
from src.services.download_engine import DownloadEngine
from src.utils.error_handler import ErrorHandler, handle_error

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

    def _handle_download_error(
        self,
        download_id: str,
        error: Exception,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        处理下载错误

        Args:
            download_id: 下载任务ID
            error: 异常对象
            context: 上下文信息

        Returns:
            错误详情字典
        """
        # 使用错误处理器分类错误
        error_detail = handle_error(
            error,
            context=context or {'download_id': download_id},
            log_level="error",
            raise_error=False
        )

        # 更新下载状态
        self.update_download_status(
            download_id,
            status="failed",
            error_message=error_detail.message,  # 向后兼容
            error_detail=error_detail.to_dict()  # 新增错误详情
        )

        logger.error(
            f"下载失败 [{download_id}]: {error_detail.message} "
            f"(类型: {error_detail.error_type}, 代码: {error_detail.error_code})"
        )

        return error_detail.to_dict()

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
        codec: Optional[str] = 'avc',
        enable_subtitle: Optional[bool] = True,
        enable_nfo: Optional[bool] = True,
        enable_cover: Optional[bool] = True,
        enable_avatar: Optional[bool] = True
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
                enable_subtitle=int(enable_subtitle) if enable_subtitle is not None else 1,
                enable_nfo=int(enable_nfo) if enable_nfo is not None else 1,
                enable_cover=int(enable_cover) if enable_cover is not None else 1,
                enable_avatar=int(enable_avatar) if enable_avatar is not None else 1,
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
        """更新下载进度并推送到WebSocket"""
        # 更新数据库
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
        error_message: Optional[str] = None,
        error_detail: Optional[dict] = None
    ):
        """更新下载状态并推送到WebSocket"""
        # 更新数据库
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
                elif status == "failed":
                    if error_message:
                        download.error_message = error_message  # 向后兼容
                    if error_detail:
                        download.error_detail = error_detail  # 新增错误详情
                    download.retry_count += 1

                db.commit()
    
    def get_all_downloads(self, status: Optional[str] = None) -> list[Download]:
        """获取所有下载任务"""
        with SessionLocal() as db:
            query = db.query(Download)
            if status:
                # 支持多个状态的过滤，用逗号分隔
                status_list = [s.strip() for s in status.split(',')]
                query = query.filter(Download.status.in_(status_list))
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

        # 重新启动下载需要异步调用
        # 注意：这需要调用者在异步上下文中处理
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
    
    def _generate_nfo_file(self, video_file_path: Path, download: Download, description: str = None, video_stats: dict = None, video_tags: list = None, video_comments: list = None) -> None:
        """
        生成NFO元数据文件
        
        Args:
            video_file_path: 视频文件路径
            download: 下载任务对象
            description: 视频描述（可选）
            video_stats: 视频统计数据（可选）
            video_tags: 视频标签列表（可选）
            video_comments: 视频评论列表（可选）
        """
        try:
            # 从视频文件路径中提取目录和文件名
            output_dir = video_file_path.parent
            video_filename = video_file_path.stem  # 不包含扩展名的文件名
            nfo_filename = f"{video_filename}.nfo"
            
            # 创建XML根元素
            movie = ET.Element("movie")
            
            # 添加BVID字段
            if download.bvid:
                bvid_elem = ET.SubElement(movie, "bvid")
                bvid_elem.text = download.bvid
            
            # 添加基本信息
            title_elem = ET.SubElement(movie, "title")
            title_elem.text = download.title or "Unknown"
            
            # 添加描述（使用传入的描述或BVID占位符）
            plot_elem = ET.SubElement(movie, "plot")
            plot_elem.text = description or f"B站视频ID: {download.bvid}"
            
            # 添加视频标签（如果有）
            if video_tags:
                for tag in video_tags:
                    tag_elem = ET.SubElement(movie, "tag")
                    tag_elem.text = tag
            
            # 添加封面
            if download.thumbnail_url:
                thumb_elem = ET.SubElement(movie, "thumb")
                thumb_elem.text = download.thumbnail_url
            
            # 添加发布日期（使用创建时间）
            if download.created_at:
                premiered_elem = ET.SubElement(movie, "premiered")
                premiered_elem.text = download.created_at.strftime("%Y-%m-%d")
            
            # 添加UP主信息
            if download.uploader:
                studio_elem = ET.SubElement(movie, "studio")
                studio_elem.text = download.uploader
                
                director_elem = ET.SubElement(movie, "director")
                director_elem.text = download.uploader
            
            # 添加时长信息
            if download.duration:
                runtime_elem = ET.SubElement(movie, "runtime")
                runtime_elem.text = str(download.duration)
            
            # 添加B站统计数据（如果有）
            if video_stats:
                # 添加播放数
                if video_stats.get("play"):
                    playcount_elem = ET.SubElement(movie, "playcount")
                    playcount_elem.text = str(video_stats["play"])
                
                # 计算并添加互动评分（基于点赞、投币、收藏）
                rating = self._calculate_bilibili_rating(video_stats)
                if rating > 0:
                    rating_elem = ET.SubElement(movie, "rating")
                    rating_elem.text = f"{rating:.1f}"
                
                # 添加标签（弹幕数、评论数、分享数）
                if video_stats.get("danmaku"):
                    danmaku_tag = ET.SubElement(movie, "tag")
                    danmaku_tag.text = f"弹幕数: {video_stats['danmaku']}"
                
                if video_stats.get("reply"):
                    reply_tag = ET.SubElement(movie, "tag")
                    reply_tag.text = f"评论数: {video_stats['reply']}"
                
                if video_stats.get("share"):
                    share_tag = ET.SubElement(movie, "tag")
                    share_tag.text = f"分享数: {video_stats['share']}"
                
                # 添加B站自定义统计标签（完整数据）
                bilibili_stat = ET.SubElement(movie, "bilibili_stat")
                bilibili_stat.set("xmlns", "bilibili")
                
                for key in ["play", "like", "coin", "favorite", "share", "danmaku", "reply"]:
                    if video_stats.get(key) is not None:
                        stat_elem = ET.SubElement(bilibili_stat, key)
                        stat_elem.text = str(video_stats[key])
            
            # 生成XML字符串
            xml_str = ET.tostring(movie, encoding='unicode', method='xml')
            
            # 添加XML声明
            xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
            full_xml = xml_declaration + xml_str
            
            # 写入NFO文件（使用视频文件名，只是扩展名不同）
            nfo_file = output_dir / nfo_filename
            nfo_file.write_text(full_xml, encoding='utf-8')
            
            logger.info(f"Generated NFO file: {nfo_file}")
            
        except Exception as e:
            logger.error(f"Failed to generate NFO file: {e}")
    
    def _calculate_bilibili_rating(self, stats: dict) -> float:
        """
        计算B站视频互动评分（五分制）
        
        基于B站算法研究和视频质量评估方法，使用以下改进算法：
        
        1. 纯互动率计算（移除播放量本身权重）:
           - 点赞权重: 0.4（正向反馈）
           - 投币权重: 0.4（高价值互动）
           - 收藏权重: 0.3（长期价值）
           - 分享权重: 0.6（最高权重，病毒传播）
           - 弹幕权重: 0.4（深度互动）
           - 评论权重: 0.4（深度互动）
        
        2. 互动率计算:
           互动率 = (点赞×0.4 + 投币×0.4 + 收藏×0.3 + 分享×0.6 + 弹幕×0.4 + 评论×0.4) / 播放量
           
        3. 对数平滑（避免极端值）:
           平滑互动率 = log(1 + 互动率×1000) / log(1001)
           
        4. 贝叶斯平均调整（避免小样本偏差）:
           WR = (v / (v + m)) × R + (m / (v + m)) × C
           其中：
           - WR: 加权评分
           - R: 该视频的基础评分
           - v: 该视频的播放量
           - m: 基准播放量（5000次）
           - C: 全局平均评分（2.0分）
        
        5. 评分范围: 0-5分
        
        Args:
            stats: 视频统计数据
            
        Returns:
            评分 (0-5)
        """
        try:
            play = stats.get("play", 0) or 0
            like = stats.get("like", 0) or 0
            coin = stats.get("coin", 0) or 0
            favorite = stats.get("favorite", 0) or 0
            share = stats.get("share", 0) or 0
            danmaku = stats.get("danmaku", 0) or 0
            reply = stats.get("reply", 0) or 0
            
            # 如果播放量为0，返回0分
            if play == 0:
                return 0.0
            
            # 计算纯互动得分（只计算互动，不包含播放量本身）
            interaction_score = (
                like * 0.4 +        # 点赞
                coin * 0.4 +        # 投币（高价值互动）
                favorite * 0.3 +    # 收藏
                share * 0.6 +       # 分享（最高权重）
                danmaku * 0.4 +     # 弹幕
                reply * 0.4         # 评论
            )
            
            # 计算互动率（互动得分 / 播放量）
            interaction_rate = interaction_score / play
            
            # 对数平滑（避免极端值，让分布更合理）
            # 互动率4% = 0.04 → log(41)/log(1001) ≈ 0.6 → 3.0分
            # 互动率2% = 0.02 → log(21)/log(1001) ≈ 0.5 → 2.5分
            # 互动率1% = 0.01 → log(11)/log(1001) ≈ 0.4 → 2.0分
            import math
            smoothed_rate = math.log(1 + interaction_rate * 1000) / math.log(1001)
            
            # 计算基础评分（平滑后的互动率转换为5分制）
            base_rating = smoothed_rate * 5  # 转换为5分制
            
            # 贝叶斯平均调整（更严格的调整，避免小样本高评分）
            # m = 5000: 基准播放量，表示达到这个播放量时贝叶斯调整影响较小
            # C = 2.0: 全局平均评分，作为先验概率（5分制的中位数）
            m = 5000  # 基准播放量
            C = 2.0   # 全局平均评分
            v = play  # 该视频的播放量
            R = base_rating  # 该视频的基础评分
            
            # 计算贝叶斯加权评分
            # 当播放量很低时，评分会向全局平均回归
            # 当播放量很高时，评分更接近实际互动率
            weighted_rating = (v / (v + m)) * R + (m / (v + m)) * C
            
            # 确保评分在0-5范围内
            final_rating = min(max(weighted_rating, 0), 5)
            
            return round(final_rating, 1)
        except Exception as e:
            logger.warning(f"Failed to calculate rating: {e}")
            return 0.0
    
    async def _download_image(self, url: str, save_path: Path) -> bool:
        """
        下载图像（参考BiliTools get_image实现）
        
        Args:
            url: 图像URL
            save_path: 保存路径
            
        Returns:
            bool: 是否成功
        """
        logger.info(f"Downloading image from: {url}")
        logger.info(f"Saving to: {save_path}")
        
        try:
            # 使用httpx下载图像
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                logger.info(f"Sending HTTP request to {url}...")
                response = await client.get(url)
                logger.info(f"Response status: {response.status_code}")
                response.raise_for_status()
                
                content_length = len(response.content)
                logger.info(f"Downloaded {content_length} bytes")
                
                # 保存图像
                save_path.parent.mkdir(parents=True, exist_ok=True)
                save_path.write_bytes(response.content)
                
                logger.info(f"Successfully downloaded image: {save_path}")
                return True
        except Exception as e:
            logger.error(f"Failed to download image from {url}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    async def _download_thumbnail(self, download: Download, output_dir: Path) -> bool:
        """
        下载封面图（参考BiliTools handleThumbs实现）
        
        Args:
            download: 下载任务对象
            output_dir: 输出目录
            
        Returns:
            bool: 是否成功
        """
        logger.info(f"=== Starting thumbnail download ===")
        logger.info(f"Download ID: {download.id}")
        logger.info(f"Output dir: {output_dir}")
        logger.info(f"Output dir exists: {output_dir.exists()}")
        logger.info(f"Thumbnail URL: {download.thumbnail_url}")
        
        if not download.thumbnail_url:
            logger.warning("No thumbnail URL provided")
            return False
        
        try:
            # 获取视频文件名（不含扩展名）
            video_files = [f for f in output_dir.glob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
            logger.info(f"Video files found in output dir: {len(video_files)}")
            if video_files:
                logger.info(f"Video files: {[str(f) for f in video_files]}")
            
            if not video_files:
                logger.warning("No video file found in output directory")
                return False
            
            logger.info(f"Video filename: {video_filename}")
            
            # 下载封面（统一命名为cover.jpg）
            thumbnail_path = output_dir / "cover.jpg"
            logger.info(f"Thumbnail path: {thumbnail_path}")
            
            # 将http:替换为https:（参考BiliTools）
            url = download.thumbnail_url.replace('http:', 'https:')
            logger.info(f"Final URL: {url}")
            
            # 下载图像
            success = await self._download_image(url, thumbnail_path)
            
            if success:
                logger.info(f"Downloaded thumbnail: {thumbnail_path}")
            
            return success
        except Exception as e:
            logger.error(f"Failed to download thumbnail: {e}")
            return False
    
    async def _download_avatar(self, download: Download, output_dir: Path) -> bool:
        """
        下载UP主头像（参考BiliTools getUserInfo实现）
        
        Args:
            download: 下载任务对象
            output_dir: 输出目录
            
        Returns:
            bool: 是否成功
        """
        logger.info(f"=== Starting avatar download ===")
        logger.info(f"Download ID: {download.id}")
        logger.info(f"Uploader: {download.uploader}")
        logger.info(f"Uploader MID: {download.uploader_mid}")
        logger.info(f"Output dir: {output_dir}")
        
        if not download.uploader_mid or not download.uploader:
            logger.warning("No uploader MID or name provided")
            return False
        
        try:
            # 使用BilibiliService获取UP主信息
            from src.services.bilibili import BilibiliService
            bilibili_service = BilibiliService()
            
            try:
                logger.info(f"Fetching uploader info for MID: {download.uploader_mid}")
                # 获取UP主信息
                uploader_info = await bilibili_service.get_uploader_info(
                    download.uploader_mid,
                    download.sessdata or ""
                )
                
                logger.info(f"Uploader info response: {uploader_info}")
                
                if uploader_info.get("success"):
                    avatar_url = uploader_info.get("data", {}).get("avatar")
                    logger.info(f"Avatar URL: {avatar_url}")
                    
                    if avatar_url:
                        # 下载UP主头像（保存为avatar.jpg）
                        avatar_path = output_dir / "avatar.jpg"
                        
                        # 将http:替换为https:（参考BiliTools）
                        url = avatar_url.replace('http:', 'https:')
                        
                        # 下载图像
                        success = await self._download_image(url, avatar_path)
                        
                        if success:
                            logger.info(f"Downloaded uploader avatar: {avatar_path}")
                        
                        return success
                else:
                    logger.warning(f"Failed to get uploader info: {uploader_info.get('message')}")
                    return False
            finally:
                bilibili_service.close()
        except Exception as e:
            logger.error(f"Failed to download uploader avatar: {e}")
            return False
    
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
        
        video_dir = None
        video_file = None
        
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
            
            # 递归查找最终目录中的视频文件（包括子目录）
            video_files = [f for f in final_dir.rglob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
            logger.info(f"Video files found: {len(video_files)}")
            
            if video_files:
                video_file = video_files[0]
                video_dir = video_file.parent
                logger.info(f"Video file: {video_file}")
                logger.info(f"Video directory: {video_dir}")
                
                # 先更新数据库（在事务外获取视频文件路径）
                with SessionLocal() as db:
                    download = db.query(Download).filter(Download.id == download_id).first()
                    if download:
                        download.file_path = str(video_file)
                        download.file_size = video_file.stat().st_size
                        download.temp_file_path = None
                        db.commit()
                        logger.info(f"Database updated: file_path={download.file_path}")
                
                # 生成NFO文件（如果启用）- 在数据库事务外执行
                try:
                    logger.info(f"=== Checking NFO generation ===")
                    with SessionLocal() as db:
                        download = db.query(Download).filter(Download.id == download_id).first()
                        if download and download.enable_nfo:
                            logger.info(f"Starting NFO generation...")
                            
                            # 获取视频描述和统计数据
                            description = None
                            video_stats = None
                            video_tags = None
                            
                            # 尝试从B站API获取视频详情
                            from src.services.bilibili import BilibiliService
                            bilibili_service = BilibiliService()
                            try:
                                video_info = await bilibili_service.get_video_info(download.bvid, download.sessdata or "")
                                if video_info.get("success"):
                                    video_data = video_info.get("data", {})
                                    description = video_data.get("desc")
                                    video_stats = {
                                        "play": video_data.get("stat", {}).get("view", 0),
                                        "like": video_data.get("stat", {}).get("like", 0),
                                        "coin": video_data.get("stat", {}).get("coin", 0),
                                        "favorite": video_data.get("stat", {}).get("favorite", 0),
                                        "share": video_data.get("stat", {}).get("share", 0),
                                        "danmaku": video_data.get("stat", {}).get("danmaku", 0),
                                        "reply": video_data.get("stat", {}).get("reply", 0)
                                    }
                            except Exception as e:
                                logger.warning(f"Failed to get video info for NFO: {e}")
                            finally:
                                bilibili_service.close()
                            
                            # 生成NFO文件
                            self._generate_nfo_file(
                                video_file_path=video_file,
                                download=download,
                                description=description,
                                video_stats=video_stats,
                                video_tags=video_tags
                            )
                            logger.info(f"NFO file generated successfully")
                except Exception as e:
                    logger.error(f"Failed to generate NFO file: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                
                # 下载封面图（如果启用）- 在数据库事务外执行
                try:
                    logger.info(f"=== Checking thumbnail download ===")
                    with SessionLocal() as db:
                        download = db.query(Download).filter(Download.id == download_id).first()
                        if download:
                            logger.info(f"enable_cover={download.enable_cover}, thumbnail_url={download.thumbnail_url}")
                            logger.info(f"video_dir={video_dir}")
                            
                            if download.enable_cover and download.thumbnail_url:
                                logger.info(f"Starting thumbnail download...")
                                success = await self._download_thumbnail(download, video_dir)
                                logger.info(f"Thumbnail download result: {success}")
                            else:
                                logger.info(f"Thumbnail download disabled: enable_cover={download.enable_cover}")
                except Exception as e:
                    logger.error(f"Failed to download thumbnail: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                
                # 下载UP主头像（如果启用）- 在数据库事务外执行
                try:
                    logger.info(f"=== Checking avatar download ===")
                    with SessionLocal() as db:
                        download = db.query(Download).filter(Download.id == download_id).first()
                        if download:
                            logger.info(f"enable_avatar={download.enable_avatar}, uploader_mid={download.uploader_mid}")
                            logger.info(f"video_dir={video_dir}")
                            
                            if download.enable_avatar and download.uploader_mid:
                                logger.info(f"Starting avatar download...")
                                success = await self._download_avatar(download, video_dir)
                                logger.info(f"Avatar download result: {success}")
                            else:
                                logger.info(f"Avatar download disabled: enable_avatar={download.enable_avatar}")
                except Exception as e:
                    logger.error(f"Failed to download avatar: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                
                # 下载字幕（如果启用）- 在数据库事务外执行
                try:
                    logger.info(f"=== Checking subtitle download ===")
                    with SessionLocal() as db:
                        download = db.query(Download).filter(Download.id == download_id).first()
                        if download:
                            logger.info(f"enable_subtitle={download.enable_subtitle}")
                            logger.info(f"video_dir={video_dir}")

                            if download.enable_subtitle:
                                logger.info(f"Starting subtitle download...")

                                result = await self._download_preferred_subtitles(
                                    download,
                                    video_dir,
                                )
                                logger.info(
                                    f"Subtitle download completed: "
                                    f"{result['downloaded']}/{result['attempted']} "
                                    f"({', '.join(result['languages']) if result['languages'] else 'no-matches'})"
                                )
                            else:
                                logger.info(f"Subtitle download disabled: enable_subtitle={download.enable_subtitle}")
                except Exception as e:
                    logger.error(f"Failed to download subtitle: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")

            else:
                # 即使没识别到视频文件，也尽量把附属文件放到最终目录根目录
                video_dir = final_dir
                logger.warning(f"No video files detected, fallback metadata output dir: {video_dir}")

                with SessionLocal() as db:
                    download = db.query(Download).filter(Download.id == download_id).first()
                    if download:
                        download.temp_file_path = None
                        db.commit()

                try:
                    logger.info(f"=== Checking subtitle download (fallback dir) ===")
                    with SessionLocal() as db:
                        download = db.query(Download).filter(Download.id == download_id).first()
                        if download and download.enable_subtitle:
                            result = await self._download_preferred_subtitles(download, video_dir)
                            logger.info(
                                f"Subtitle download completed: "
                                f"{result['downloaded']}/{result['attempted']} "
                                f"({', '.join(result['languages']) if result['languages'] else 'no-matches'})"
                            )
                except Exception as e:
                    logger.error(f"Failed to download subtitle in fallback dir: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")

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
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
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
            raw_title = (download.title or "").strip()

            def _sanitize_folder_name(value: str, fallback: str) -> str:
                safe_value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', value).strip()
                return safe_value or fallback

            def _derive_series_name(title: str) -> str:
                normalized = title.strip()
                patterns = [
                    r'\s*[-_ ]?P\d+\b.*$',
                    r'\s*【Part\s*\d+】.*$',
                    r'\s*\[Part\s*\d+\].*$',
                    r'\s*第\d+[集话回].*$',
                ]
                for pattern in patterns:
                    normalized = re.sub(pattern, '', normalized, flags=re.IGNORECASE).strip()
                return normalized

            safe_title = _sanitize_folder_name(raw_title, "video")
            series_root_name = _sanitize_folder_name(_derive_series_name(raw_title), safe_title)
            is_series_like = series_root_name != safe_title
            final_dir = Path(storage_settings.download_path) / (
                series_root_name if is_series_like else safe_title
            )

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
            print(f"DEBUG: final_dir={final_dir}")
            print(f"DEBUG: Using download path from settings: {storage_settings.download_path}")
            await self._process_completed_download(
                download_id=download_id,
                temp_dir=temp_download_dir,
                final_dir=final_dir,
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

    async def _get_subtitles(self, download: Download) -> list:
        """
        获取字幕列表（优先复用 Pilipala 同款公开播放器接口）

        Args:
            download: 下载任务对象

        Returns:
            list: 字幕列表，每个字幕包含lan（语言代码）和subtitle_url
        """
        if not download.aid or not download.cid:
            logger.warning("No aid or cid found for subtitle download")
            return []

        try:
            from src.services.bilibili import BilibiliService
            bilibili_service = BilibiliService()

            try:
                logger.info(f"Getting subtitles for aid={download.aid}, cid={download.cid}")
                preferred_languages = {"zh-CN", "en-US"}
                collected: list[dict] = []
                collected_keys: set[tuple[str, str]] = set()
                seen_languages: set[str] = set()

                for attempt in range(3):
                    player_info = await bilibili_service.get_player_info_public(
                        download.aid,
                        download.cid,
                        download.sessdata or ""
                    )

                    if not player_info.get("success"):
                        logger.warning(
                            "Failed to get public player info on attempt %s: %s",
                            attempt + 1,
                            player_info.get("message"),
                        )
                        continue

                    player_data = player_info.get("data", {})
                    subtitle_data = player_data.get("subtitle", {}) or {}
                    subtitles = subtitle_data.get("subtitles") or subtitle_data.get("list") or []
                    attempt_downloadable = 0

                    for subtitle in subtitles:
                        subtitle_url = self._extract_subtitle_url(subtitle)
                        if not subtitle_url:
                            continue

                        language = self._normalize_subtitle_language(subtitle)
                        if language not in preferred_languages:
                            continue

                        attempt_downloadable += 1
                        key = (language, subtitle_url)
                        if key in collected_keys:
                            continue

                        collected_keys.add(key)
                        collected.append(subtitle)
                        seen_languages.add(language)

                    logger.info(
                        "Subtitle fetch attempt %s returned %s subtitles (%s preferred/downloadable)",
                        attempt + 1,
                        len(subtitles),
                        attempt_downloadable,
                    )

                    if preferred_languages.issubset(seen_languages):
                        break

                    if attempt < 2:
                        await asyncio.sleep(0.3)

                logger.info(f"Found {len(collected)} preferred subtitles")
                return collected
            finally:
                bilibili_service.close()
        except Exception as e:
            logger.error(f"Failed to get subtitles: {e}")
            return []

    def _convert_to_srt(self, subtitle_data: dict) -> str:
        """
        将B站字幕JSON格式转换为SRT格式（参考BiliTools实现）

        Args:
            subtitle_data: B站字幕JSON数据

        Returns:
            str: SRT格式字幕
        """
        def get_time(seconds: float) -> str:
            """
            将秒数转换为SRT时间格式

            Args:
                seconds: 秒数

            Returns:
                str: SRT时间格式 (00:00:00,000)
            """
            from datetime import timedelta
            # 转换为时间差
            td = timedelta(seconds=seconds)
            # 获取总秒数
            total_seconds = int(td.total_seconds())
            # 计算时、分、秒、毫秒
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            milliseconds = int((td.total_seconds() - total_seconds) * 1000)
            # 格式化为SRT时间格式
            return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

        # 获取字幕body
        body = subtitle_data.get("body", [])
        if not body:
            return ""

        # 转换为SRT格式
        srt_lines = []
        for index, line in enumerate(body, start=1):
            start_time = get_time(line.get("from", 0))
            end_time = get_time(line.get("to", 0))
            content = line.get("content", "").strip()

            srt_lines.append(f"{index}")
            srt_lines.append(f"{start_time} --> {end_time}")
            srt_lines.append(content)
            srt_lines.append("")  # 空行分隔

        return "\n".join(srt_lines)

    def _classify_subtitle_source(self, subtitle: dict) -> str:
        """归一化字幕来源类型：user / ai / unknown"""
        lan = (subtitle.get("lan") or "").lower()
        lan_doc = (subtitle.get("lan_doc") or "").lower()
        subtitle_url = (self._extract_subtitle_url(subtitle) or "").lower()
        ai_type = subtitle.get("ai_type")
        type_value = subtitle.get("type")
        is_lock = subtitle.get("is_lock")

        if "aisubtitle.hdslb.com" in subtitle_url:
            return "ai"
        if lan.startswith("ai-") or "自动生成" in lan_doc or ai_type is not None or type_value == 1:
            return "ai"
        if is_lock is False:
            return "user"
        if is_lock is True:
            return "user"
        return "unknown"

    def _subtitle_source_priority(self, subtitle: dict) -> int:
        """字幕来源优先级：用户字幕优先，其次 AI，最后 unknown"""
        source = self._classify_subtitle_source(subtitle)
        if source == "user":
            return 0
        if source == "ai":
            return 1
        return 2

    def _extract_subtitle_url(self, subtitle: dict) -> str:
        """提取字幕下载地址，兼容不同字段命名。"""
        for key in ("subtitle_url", "subtitleUrl", "url", "subtitleURL"):
            value = subtitle.get(key)
            if value:
                return value
        return ""

    def _normalize_subtitle_language(self, subtitle: dict) -> str:
        """归一化字幕语言，用于目标语言匹配和文件命名"""
        lan = subtitle.get("lan") or ""
        lan_lower = lan.lower()
        if lan_lower in {"ai-zh", "ai-hans", "ai-zh-cn", "ai-zh-hans"}:
            return "zh-CN"
        if lan_lower in {"ai-en", "ai-en-us", "ai-en-gb"}:
            return "en-US"
        if lan_lower in {"zh", "zh-cn", "zh-hans", "zh-hant", "zh-sg", "zh-tw"}:
            return "zh-CN" if "hant" not in lan_lower and "tw" not in lan_lower else "zh-TW"
        if lan_lower in {"en", "en-us", "en-gb", "en-au"}:
            return "en-US"
        return lan or "unknown"

    def _get_subtitle_candidates(self, subtitles: list, target_languages: list[str]) -> list[dict]:
        """
        选择目标语言的字幕候选，按“用户字幕优先，其次 AI”返回每种语言 1 条。
        """
        normalized_targets = []
        for language in target_languages:
            fake_subtitle = {"lan": language}
            normalized = self._normalize_subtitle_language(fake_subtitle)
            if normalized not in normalized_targets:
                normalized_targets.append(normalized)

        chosen: dict[str, dict] = {}
        for subtitle in subtitles:
            if not self._extract_subtitle_url(subtitle):
                continue

            language = self._normalize_subtitle_language(subtitle)
            if language not in normalized_targets:
                continue

            source = self._classify_subtitle_source(subtitle)
            candidate = {
                "raw": subtitle,
                "language": language,
                "source": source,
            }
            existing = chosen.get(language)
            if existing is None:
                chosen[language] = candidate
                continue

            if self._subtitle_source_priority(subtitle) < self._subtitle_source_priority(existing["raw"]):
                chosen[language] = candidate

        return [chosen[language] for language in normalized_targets if language in chosen]

    def _build_subtitle_filename(
        self,
        output_dir: Path,
        subtitle: dict,
        subtitle_index: int = 0
    ) -> Path:
        """生成字幕文件路径"""
        video_files = [f for f in output_dir.glob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
        base_name = video_files[0].stem if video_files else "subtitle"
        language = subtitle.get("language") or self._normalize_subtitle_language(subtitle.get("raw", {}))
        source = subtitle.get("source") or self._classify_subtitle_source(subtitle.get("raw", {}))
        suffix = f"{language}.{source}"
        if subtitle_index > 0:
            suffix = f"{suffix}.{subtitle_index}"
        return output_dir / f"{base_name}.{suffix}.srt"

    async def _download_subtitle(
        self,
        download: Download,
        output_dir: Path,
        subtitle_lan: str
    ) -> bool:
        """
        下载指定语言的字幕并转换为SRT格式

        Args:
            download: 下载任务对象
            output_dir: 输出目录
            subtitle_lan: 字幕语言代码（如 'zh-CN', 'en-US', 'ai-zh'）

        Returns:
            bool: 是否成功
        """
        logger.info(f"=== Starting subtitle download ===")
        logger.info(f"Download ID: {download.id}")
        logger.info(f"Subtitle language: {subtitle_lan}")
        logger.info(f"Output dir: {output_dir}")

        try:
            # 获取字幕列表
            subtitles = await self._get_subtitles(download)
            if not subtitles:
                logger.warning("No subtitles found")
                return False

            # 查找指定语言的字幕，优先用户上传，其次 AI 字幕
            subtitle_candidates = self._get_subtitle_candidates(subtitles, [subtitle_lan])
            subtitle_info = subtitle_candidates[0]["raw"] if subtitle_candidates else None

            if not subtitle_info:
                logger.warning(f"Subtitle with language '{subtitle_lan}' not found")
                return False

            # 获取字幕URL
            subtitle_url = subtitle_info.get("subtitle_url", "")
            if not subtitle_url:
                logger.warning("No subtitle URL found")
                return False

            # 将http:替换为https:
            if subtitle_url.startswith("//"):
                subtitle_url = "https:" + subtitle_url
            elif subtitle_url.startswith("http:"):
                subtitle_url = subtitle_url.replace("http:", "https:")

            logger.info(f"Downloading subtitle from: {subtitle_url}")

            # 下载字幕JSON
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(subtitle_url)
                response.raise_for_status()

                subtitle_data = response.json()

                # 转换为SRT格式
                srt_content = self._convert_to_srt(subtitle_data)

                if not srt_content:
                    logger.warning("Empty subtitle content after conversion")
                    return False

                subtitle_path = self._build_subtitle_filename(
                    output_dir,
                    {
                        "raw": subtitle_info,
                        "language": self._normalize_subtitle_language(subtitle_info),
                        "source": self._classify_subtitle_source(subtitle_info)
                    }
                )
                logger.info(f"Saving subtitle to: {subtitle_path}")

                # 保存SRT文件
                subtitle_path.write_text(srt_content, encoding='utf-8')

                logger.info(f"Successfully downloaded subtitle: {subtitle_path}")
                return True

        except Exception as e:
            logger.error(f"Failed to download subtitle: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    async def _download_preferred_subtitles(
        self,
        download: Download,
        output_dir: Path
    ) -> dict:
        """只下载中英双语字幕，返回成功/失败统计"""
        subtitles = await self._get_subtitles(download)
        if not subtitles:
            logger.info(f"No subtitles found for this video: aid={download.aid}, cid={download.cid}")
            return {"downloaded": 0, "attempted": 0, "languages": []}

        preferred_languages = ["zh-CN", "en-US"]
        downloadable_subtitles = self._get_subtitle_candidates(subtitles, preferred_languages)
        skipped_subtitles = max(0, len(subtitles) - len(downloadable_subtitles))

        if not downloadable_subtitles:
            logger.info(
                "Subtitles were returned but no preferred zh/en subtitles were exposed: aid=%s, cid=%s, total=%s, skipped=%s",
                download.aid,
                download.cid,
                len(subtitles),
                skipped_subtitles,
            )
            return {
                "downloaded": 0,
                "attempted": len(subtitles),
                "downloadable": 0,
                "skipped_no_url": skipped_subtitles,
                "languages": [],
            }

        if skipped_subtitles:
            logger.info(
                "Skipped %s non-preferred subtitle entries: aid=%s, cid=%s",
                skipped_subtitles,
                download.aid,
                download.cid,
            )

        downloaded = 0
        languages = []
        for index, subtitle in enumerate(downloadable_subtitles):
            language = subtitle["language"]
            source = subtitle["source"]
            languages.append(f"{language}:{source}")
            success = await self._download_subtitle_from_info(
                download,
                output_dir,
                subtitle,
                index
            )
            if success:
                downloaded += 1

        return {
            "downloaded": downloaded,
            "attempted": len(subtitles),
            "downloadable": len(downloadable_subtitles),
            "skipped_no_url": skipped_subtitles,
            "languages": languages,
        }

    async def _download_subtitle_from_info(
        self,
        download: Download,
        output_dir: Path,
        subtitle: dict,
        subtitle_index: int = 0
    ) -> bool:
        """基于已选中的字幕信息下载字幕"""
        output_dir.mkdir(parents=True, exist_ok=True)
        subtitle_info = subtitle.get("raw", subtitle)
        subtitle_lan = subtitle_info.get("lan", "")
        subtitle_url = self._extract_subtitle_url(subtitle_info)
        if not subtitle_lan or not subtitle_url:
            logger.warning("Subtitle info missing lan or url")
            return False

        if subtitle_url.startswith("//"):
            subtitle_url = "https:" + subtitle_url
        elif subtitle_url.startswith("http:"):
            subtitle_url = subtitle_url.replace("http:", "https:")

        logger.info(f"Downloading subtitle from: {subtitle_url}")

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(subtitle_url)
            response.raise_for_status()

            subtitle_data = response.json()
            srt_content = self._convert_to_srt(subtitle_data)
            if not srt_content:
                logger.warning("Empty subtitle content after conversion")
                return False

            subtitle_path = self._build_subtitle_filename(output_dir, subtitle, subtitle_index)
            logger.info(f"Saving subtitle to: {subtitle_path}")
            subtitle_path.write_text(srt_content, encoding='utf-8')
            logger.info(f"Successfully downloaded subtitle: {subtitle_path}")
            return True


# 全局下载服务实例
download_service = DownloadService()
