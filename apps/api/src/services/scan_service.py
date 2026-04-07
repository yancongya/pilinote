"""
Scan service for auto-download scanning functionality
"""
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from src.models.setting import Setting
from src.models.user import User
from src.schemas.auto_download import (
    ScanRecord,
    ScanTriggerResponse,
    ScanVideoInfo,
    ScanResult
)
from src.schemas.task import TaskCreate, MediaType
from src.services.bilibili import BilibiliService


logger = logging.getLogger(__name__)


class ScanService:
    """扫描服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def trigger_scan(
        self,
        source_type: str,
        source_id: str = "all",
        sessdata: str = None,
        user_mid: int = None
    ) -> ScanTriggerResponse:
        """
        触发扫描
        
        Args:
            source_type: 视频源类型 (favorite/watch_later)
            source_id: 视频源 ID
            sessdata: 用户 SESSDATA
            user_mid: 用户 MID
            
        Returns:
            扫描结果
        """
        logger.info(f"Triggering scan: source_type={source_type}, source_id={source_id}, user_mid={user_mid}")
        
        # 获取视频列表和收藏夹信息
        videos, folder_infos = await self._fetch_videos(source_type, source_id, sessdata, user_mid)
        total_videos = len(videos)
        
        # 识别新视频
        new_videos = await self._identify_new_videos(source_type, videos)
        new_count = len(new_videos)
        
        # 计算每个收藏夹的新视频数量
        for folder_info in folder_infos:
            folder_bvids = {v.bvid for v in videos if hasattr(v, 'folder_id') and v.folder_id == folder_info.id}
            folder_new_videos = [v for v in new_videos if v.bvid in folder_bvids]
            folder_info.new_count = len(folder_new_videos)
        
        # 将新视频添加到队列
        added_count = await self.add_videos_to_queue(new_videos, source_type)
        
        # 保存扫描记录
        await self._save_scan_record(
            source_type=source_type,
            source_id=source_id,
            total_videos=total_videos,
            new_videos=new_count,
            added_to_queue=added_count
        )
        
        return ScanTriggerResponse(
            total=total_videos,
            new=new_count,
            added=added_count,
            folder_count=len(folder_infos),
            folders=folder_infos
        )
    
    async def get_scan_records(self, source_type: Optional[str] = None) -> List[ScanRecord]:
        """
        获取扫描记录
        
        Args:
            source_type: 视频源类型过滤
            
        Returns:
            扫描记录列表
        """
        # 从 Setting 表读取扫描记录
        base_key = f"auto_download.scan_records"
        if source_type:
            base_key = f"{base_key}.{source_type}"
        
        settings = self.db.query(Setting).filter(Setting.key.like(f"{base_key}%")).all()
        
        records = []
        for setting in settings:
            try:
                import json
                record_data = json.loads(setting.value)
                record_data['created_at'] = setting.created_at
                records.append(ScanRecord(**record_data))
            except Exception as e:
                logger.error(f"Failed to parse scan record {setting.key}: {e}")
        
        # 按扫描时间倒序排序
        records.sort(key=lambda x: x.last_scan_time, reverse=True)
        
        return records
    
    async def delete_scan_record(self, record_id: str) -> bool:
        """
        删除单个扫描记录
        
        Args:
            record_id: 记录 ID
            
        Returns:
            是否删除成功
        """
        try:
            settings = self.db.query(Setting).filter(
                Setting.key.like(f"auto_download.scan_records.%.{record_id}")
            ).all()
            
            for setting in settings:
                self.db.delete(setting)
            
            self.db.commit()
            logger.info(f"Deleted scan record: {record_id}")
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete scan record {record_id}: {e}")
            return False
    
    async def clear_scan_records(self, source_type: Optional[str] = None, days: Optional[int] = None) -> int:
        """
        清除扫描记录
        
        Args:
            source_type: 视频源类型过滤（None表示清除所有）
            days: 保留最近几天的记录（None表示清除所有）
            
        Returns:
            删除的记录数量
        """
        try:
            query = self.db.query(Setting).filter(
                Setting.key.like("auto_download.scan_records.%")
            )
            
            if source_type:
                query = query.filter(Setting.key.like(f"auto_download.scan_records.{source_type}%"))
            
            if days is not None:
                from datetime import timedelta
                cutoff_time = datetime.utcnow() - timedelta(days=days)
                query = query.filter(Setting.created_at < cutoff_time)
            
            deleted_count = query.count()
            query.delete()
            self.db.commit()
            
            logger.info(f"Cleared {deleted_count} scan records (source_type={source_type}, days={days})")
            return deleted_count
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to clear scan records: {e}")
            return 0
        
        return records
    
    async def _fetch_videos(
        self,
        source_type: str,
        source_id: str,
        sessdata: str,
        user_mid: int = None
    ) -> tuple[List[ScanVideoInfo], List[Dict]]:
        """
        获取视频列表和收藏夹信息
        
        Args:
            source_type: 视频源类型
            source_id: 视频源 ID
            sessdata: 用户 SESSDATA
            user_mid: 用户 MID
            
        Returns:
            (视频列表, 收藏夹信息列表)
        """
        logger.info(f"_fetch_videos called: source_type={source_type}, source_id={source_id}, user_mid={user_mid}")
        
        # 从数据库获取用户的原始sessdata（URL编码格式）
        user = self.db.query(User).filter(User.mid == user_mid).first()
        if not user:
            logger.error(f"未找到MID={user_mid}的用户")
            return [], []
        
        # 使用数据库中的原始sessdata（URL编码格式）
        original_sessdata = user.sessdata
        logger.info(f"使用原始sessdata: {original_sessdata[:50]}...")
        
        # 对sessdata进行URL解码，确保格式正确
        from urllib.parse import unquote
        decoded_sessdata = unquote(original_sessdata)
        logger.info(f"解码后的sessdata: {decoded_sessdata[:50]}...")
        
        # 获取自定义扫描配置
        custom_scan_config = self._get_custom_scan_config()
        logger.info(f"自定义扫描配置: enabled={custom_scan_config['enabled']}")
        
        service = BilibiliService()
        try:
            if source_type == "favorite":
                # 获取收藏夹视频
                logger.info(f"开始获取收藏夹列表, user_mid={user_mid}")
                result = await service.get_folder_list(decoded_sessdata, user_mid, 1, 50)
                logger.info(f"收藏夹列表结果: {result.get('success')}")
                
                if result["success"]:
                    folders = result["data"].get("list", [])
                    logger.info(f"获取到 {len(folders)} 个收藏夹")
                    
                    # 应用自定义扫描配置
                    if custom_scan_config['enabled'] and custom_scan_config['folder_list']:
                        # 创建文件夹名称到配置的映射
                        folder_config_map = {item['folder_name']: item['max_videos'] for item in custom_scan_config['folder_list']}
                        
                        # 只保留配置中的收藏夹，且max_videos大于0的
                        filtered_folders = []
                        for folder in folders:
                            folder_name = folder.get("title", "")
                            if folder_name in folder_config_map:
                                max_videos = folder_config_map[folder_name]
                                if max_videos and max_videos > 0:
                                    folder['max_videos'] = max_videos
                                    filtered_folders.append(folder)
                                else:
                                    logger.info(f"跳过收藏夹 {folder_name} (max_videos={max_videos}，不扫描)")
                        
                        folders = filtered_folders
                        logger.info(f"应用自定义扫描配置后，剩余 {len(folders)} 个收藏夹")
                    elif custom_scan_config['enabled']:
                        # 启用了自定义扫描但folder_list为空，不扫描任何收藏夹
                        logger.info("启用了自定义扫描但收藏夹列表为空，不扫描任何收藏夹")
                        return [], []
                    
                    videos = []
                    folder_infos = []
                    
                    for folder in folders:
                        if source_id == "all" or str(folder.get("id")) == source_id:
                            logger.info(f"正在扫描收藏夹: {folder.get('title')} (ID: {folder.get('id')}, FID: {folder.get('fid')})")
                            
                            # 获取收藏夹详情
                            page_size = 20
                            if custom_scan_config['enabled'] and 'max_videos' in folder:
                                # 使用配置中的max_videos限制
                                max_videos = folder['max_videos']
                                page_size = min(max_videos, 20)
                            
                            detail_result = await service.get_folder_detail(
                                decoded_sessdata,
                                folder.get("id"),
                                1,
                                page_size
                            )
                            logger.info(f"收藏夹详情结果: {detail_result.get('success')}")
                            
                            if detail_result["success"]:
                                # B站 API 返回的是 "medias" 而不是 "media_list"
                                media_list = detail_result["data"].get("medias", [])
                                
                                # 应用视频数量限制
                                if custom_scan_config['enabled'] and 'max_videos' in folder:
                                    max_videos = folder['max_videos']
                                    if max_videos and max_videos < len(media_list):
                                        media_list = media_list[:max_videos]
                                        logger.info(f"应用视频数量限制，保留 {len(media_list)} 个视频")
                                
                                media_count = detail_result["data"].get("info", {}).get("media_count", len(media_list))
                                logger.info(f"收藏夹 {folder.get('title')} 包含 {len(media_list)} 个视频 (总计: {media_count})")
                                
                                # 转换视频信息并添加 folder_id
                                transformed_videos = self._transform_to_scan_videos(media_list, folder.get("id"))
                                videos.extend(transformed_videos)
                                
                                # 收藏夹信息
                                from src.schemas.auto_download import FolderScanInfo
                                folder_info = FolderScanInfo(
                                    id=folder.get("id"),
                                    title=folder.get("title"),
                                    video_count=len(transformed_videos),
                                    new_count=0,  # 后续会计算
                                    media_count=media_count
                                )
                                folder_infos.append(folder_info)
                    
                    logger.info(f"总共收集到 {len(videos)} 个视频，扫描了 {len(folder_infos)} 个收藏夹")
                    return videos, folder_infos
                else:
                    logger.error(f"收藏夹列表获取失败: {result}")
            
            elif source_type == "watch_later":
                # 获取稍后再看视频
                logger.info("开始获取稍后再看列表")
                result = await service.get_watch_later(decoded_sessdata)
                if result["success"]:
                    watch_later_data = result["data"]
                    video_list = watch_later_data.get("list", []) if isinstance(watch_later_data, dict) else []
                    logger.info(f"获取到 {len(video_list)} 个稍后再看视频")
                    
                    # 应用稍后再看数量限制
                    watch_later_max = self._get_watch_later_max()
                    if watch_later_max and watch_later_max < len(video_list):
                        video_list = video_list[:watch_later_max]
                        logger.info(f"应用稍后再看数量限制，保留 {len(video_list)} 个视频")
                    elif watch_later_max == 0:
                        logger.info(f"稍后再看数量限制为0，跳过扫描")
                        return [], []
                    
                    return self._transform_watchlater_to_videos(video_list), []
            
            return [], []
        except Exception as e:
            logger.error(f"_fetch_videos 异常: {e}", exc_info=True)
            raise
        finally:
            service.close()
    
    def _transform_to_scan_videos(self, media_list: List[Dict], folder_id: int = None) -> List[ScanVideoInfo]:
        """转换收藏夹视频为 ScanVideoInfo"""
        videos = []
        for media in media_list:
            video = ScanVideoInfo(
                bvid=media.get("bvid", ""),
                title=media.get("title", ""),
                author=media.get("upper", {}).get("name", ""),
                duration=media.get("duration", 0),
                cover=media.get("cover", ""),
                pubdate=media.get("pubtime", 0),
                is_new=False
            )
            # 添加 folder_id 属性
            if folder_id is not None:
                video.folder_id = folder_id
            videos.append(video)
        return videos
    
    def _transform_watchlater_to_videos(self, data: List[Dict]) -> List[ScanVideoInfo]:
        """转换稍后再看视频为 ScanVideoInfo"""
        videos = []
        for item in data:
            # 确保 item 是字典类型
            if not isinstance(item, dict):
                continue
                
            video = ScanVideoInfo(
                bvid=item.get("bvid", ""),
                title=item.get("title", ""),
                author=item.get("owner", {}).get("name", "") if isinstance(item.get("owner"), dict) else "",
                duration=item.get("duration", 0),
                cover=item.get("pic", ""),
                pubdate=item.get("pubdate", 0),
                is_new=False
            )
            videos.append(video)
        return videos
    
    async def _identify_new_videos(
        self,
        source_type: str,
        videos: List[ScanVideoInfo]
    ) -> List[ScanVideoInfo]:
        """
        识别新视频
        
        Args:
            source_type: 视频源类型
            videos: 视频列表
            
        Returns:
            新视频列表
        """
        # 获取上次扫描记录
        records = await self.get_scan_records(source_type)
        if not records:
            # 第一次扫描，所有视频都是新的
            for video in videos:
                video.is_new = True
            return videos
        
        # 获取最近一次扫描的视频列表
        last_record = records[0]
        last_videos_key = f"auto_download.scan_videos.{last_record.id}"
        last_videos_setting = self.db.query(Setting).filter(Setting.key == last_videos_key).first()
        
        if not last_videos_setting:
            # 没有上次扫描的视频列表，所有视频都是新的
            for video in videos:
                video.is_new = True
            return videos
        
        try:
            import json
            last_bvids = set(json.loads(last_videos_setting.value))
            new_videos = []
            
            for video in videos:
                if video.bvid not in last_bvids:
                    video.is_new = True
                    new_videos.append(video)
            
            return new_videos
        except Exception as e:
            logger.error(f"Failed to parse last videos: {e}")
            return videos
    
    async def _save_scan_record(
        self,
        source_type: str,
        source_id: str,
        total_videos: int,
        new_videos: int,
        added_to_queue: int
    ):
        """
        保存扫描记录
        
        Args:
            source_type: 视频源类型
            source_id: 视频源 ID
            total_videos: 总视频数
            new_videos: 新视频数
            added_to_queue: 添加到队列数
        """
        record_id = str(uuid.uuid4())
        now = datetime.now()
        
        # 保存扫描记录
        record_data = {
            "id": record_id,
            "source_type": source_type,
            "source_id": source_id,
            "last_scan_time": now.isoformat(),
            "total_videos": total_videos,
            "new_videos": new_videos,
            "added_to_queue": added_to_queue,
            "status": "success"
        }
        
        import json
        setting_key = f"auto_download.scan_records.{source_type}.{record_id}"
        setting = self.db.query(Setting).filter(Setting.key == setting_key).first()
        
        if setting:
            setting.value = json.dumps(record_data)
            setting.updated_at = now
        else:
            setting = Setting(
                key=setting_key,
                value=json.dumps(record_data),
                type="json",
                category="auto_download",
                description=f"Scan record for {source_type}/{source_id}",
                default_value=None,
                created_at=now,
                updated_at=now
            )
            self.db.add(setting)
        
        self.db.commit()
    
    def _get_custom_scan_config(self) -> Dict[str, Any]:
        """
        获取自定义扫描配置
        
        Returns:
            自定义扫描配置字典
        """
        try:
            import json
            setting = self.db.query(Setting).filter(Setting.key == "auto_download.custom_scan").first()
            if setting and setting.value:
                return json.loads(setting.value)
        except Exception as e:
            logger.error(f"获取自定义扫描配置失败: {e}")
        
        # 返回默认配置
        return {
            "enabled": False,
            "folder_list": []
        }

    def _get_watch_later_max(self) -> int:
        """
        获取稍后再看数量限制配置
        
        Returns:
            稍后再看数量限制，0表示不限制
        """
        try:
            setting = self.db.query(Setting).filter(Setting.key == "auto_download.watch_later_max").first()
            if setting and setting.value:
                max_value = int(setting.value)
                logger.info(f"稍后再看数量限制配置: {max_value}")
                return max_value
        except Exception as e:
            logger.error(f"获取稍后再看数量限制配置失败: {e}")
        
        # 返回默认配置（不限制）
        logger.info("稍后再看数量限制配置: 0 (不限制)")
        return 0

    def _convert_video_to_task_create(self, video: ScanVideoInfo, source_type: str) -> TaskCreate:
        """
        将扫描到的视频信息转换为任务创建请求
        
        Args:
            video: 扫描到的视频信息
            source_type: 视频源类型
            
        Returns:
            任务创建请求
        """
        # 构建 meta 信息
        meta = {
            "bvid": video.bvid,
            "author": video.author,
            "duration": video.duration,
            "pubdate": video.pubdate,
            "cover": video.cover,
            "source_type": source_type
        }
        
        # 如果是收藏夹，添加 folder_id
        if hasattr(video, 'folder_id') and video.folder_id:
            meta["folder_id"] = video.folder_id
        
        # 确定媒体类型
        if source_type == "favorite":
            media_type = MediaType.FAVORITE
        elif source_type == "watch_later":
            media_type = MediaType.WATCH_LATER
        else:
            media_type = MediaType.VIDEO
        
        return TaskCreate(
            media_type=media_type,
            media_id=video.bvid,
            title=video.title,
            cover=video.cover,
            desc=f"UP主: {video.author}",
            meta=meta
        )
    
    async def add_videos_to_queue(self, videos: List[ScanVideoInfo], source_type: str) -> int:
        """
        将新视频添加到队列
        
        Args:
            videos: 新视频列表
            source_type: 视频源类型
            
        Returns:
            实际添加到队列的视频数量
        """
        if not videos:
            return 0
        
        logger.info(f"准备将 {len(videos)} 个新视频添加到队列")
        
        # 延迟导入避免循环依赖
        from src.services.queue.manager import queue_manager
        
        added_count = 0
        
        for video in videos:
            try:
                # 转换为任务创建请求
                task_create = self._convert_video_to_task_create(video, source_type)
                
                # 提交到队列
                await queue_manager.submit_backlog(task_create)
                added_count += 1
                logger.info(f"✓ 视频已添加到队列: {video.title} (BV: {video.bvid})")
                
            except Exception as e:
                logger.error(f"✗ 添加视频到队列失败: {video.title} - {e}")
                continue
        
        logger.info(f"✓ 成功将 {added_count}/{len(videos)} 个视频添加到队列")
        return added_count