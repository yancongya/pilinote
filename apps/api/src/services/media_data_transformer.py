"""
统一数据转换层

负责将 B站 API 的原始数据转换为统一的 CardData 格式，
确保 Watch Later 和 Favorites 使用相同的数据结构。
"""
from typing import Dict, List, Any
from src.schemas.card import CardData, CardStats, UploaderInfo


class MediaDataTransformer:
    """媒体数据转换器
    
    统一处理来自不同数据源（Watch Later、Favorites 等）的数据，
    转换为标准的 CardData 格式。
    """

    @staticmethod
    def normalize_stats(raw_stats: Dict[str, Any], backup_stats: Dict[str, Any] = None) -> CardStats:
        """归一化统计数据
        
        Args:
            raw_stats: 主要统计数据源（如 stat 字段）
            backup_stats: 备用统计数据源（如 cnt_info 字段）
            
        Returns:
            CardStats: 统一格式的统计数据
        """
        if backup_stats is None:
            backup_stats = {}
        
        # 统一字段映射，处理不同来源的字段名差异
        return CardStats(
            view=raw_stats.get("view") or backup_stats.get("play") or backup_stats.get("view", 0),
            danmaku=raw_stats.get("danmaku") or backup_stats.get("danmaku", 0),
            comment=raw_stats.get("reply") or backup_stats.get("reply") or backup_stats.get("comment", 0),
            like=raw_stats.get("like") or backup_stats.get("like", 0),
            coin=raw_stats.get("coin") or backup_stats.get("coin", 0),
            favorite=raw_stats.get("favorite") or backup_stats.get("collect") or backup_stats.get("favorite", 0),
            share=raw_stats.get("share") or backup_stats.get("share", 0)
        )

    @staticmethod
    def normalize_uploader(raw_uploader: Dict[str, Any], backup_uploader: Dict[str, Any] = None) -> UploaderInfo:
        """归一化UP主信息
        
        Args:
            raw_uploader: 主要UP主数据源（如 owner 字段）
            backup_uploader: 备用UP主数据源（如 upper 字段）
            
        Returns:
            UploaderInfo: 统一格式的UP主信息
        """
        if backup_uploader is None:
            backup_uploader = {}
        
        # 统一字段映射，处理不同来源的字段名差异
        return UploaderInfo(
            mid=raw_uploader.get("mid") or backup_uploader.get("mid", 0),
            name=raw_uploader.get("name") or backup_uploader.get("name", "未知"),
            face=raw_uploader.get("face") or backup_uploader.get("face", "")
        )

    @staticmethod
    def transform_watchlater_video(raw_video: Dict[str, Any]) -> CardData:
        """转换 Watch Later 视频数据

        Args:
            raw_video: B站 API 返回的视频数据

        Returns:
            CardData: 统一格式的卡片数据
        """
        # 提取统计数据
        stat_data = raw_video.get("stat", {})
        cnt_info = raw_video.get("cnt_info", {})

        # 提取UP主信息
        owner = raw_video.get("owner", {})

        # 归一化统计数据
        stats = MediaDataTransformer.normalize_stats(stat_data, cnt_info)

        # 获取发布时间：优先使用 pubdate，如果没有则使用 pubtime
        pubtime = raw_video.get("pubdate", raw_video.get("pubtime", 0))

        # 归一化UP主信息
        uploader_info = MediaDataTransformer.normalize_uploader(owner)

        return CardData(
            id=raw_video.get("aid", 0),
            bvid=raw_video.get("bvid", ""),
            title=raw_video.get("title", ""),
            cover=raw_video.get("pic", ""),
            duration=raw_video.get("duration", 0),
            pubtime=pubtime,
            uploader=uploader_info,
            author=uploader_info.name,  # 将 uploader.name 映射到 author 字段
            stats=stats,
            progress=raw_video.get("progress", -1),
            add_time=raw_video.get("add_at", 0),
            # 为了前端兼容，将 stats 字段提升到顶层
            view=stats.view,
            danmaku=stats.danmaku,
            comment=stats.comment,
            like=stats.like,
            coin=stats.coin,
            favorite=stats.favorite,
            share=stats.share
        )

    @staticmethod
    def transform_watchlater_list(raw_data: Dict[str, Any]) -> List[CardData]:
        """转换 Watch Later 视频列表
        
        Args:
            raw_data: B站 API 返回的完整数据
            
        Returns:
            List[CardData]: 统一格式的卡片数据列表
        """
        videos = raw_data.get("list", [])
        return [MediaDataTransformer.transform_watchlater_video(video) for video in videos]

    @staticmethod
    def transform_favorite_video(raw_media: Dict[str, Any]) -> CardData:
        """转换 Favorites 视频数据

        Args:
            raw_media: B站 API 返回的视频数据

        Returns:
            CardData: 统一格式的卡片数据
        """
        # 提取统计数据
        cnt_info = raw_media.get("cnt_info", {})

        # 提取UP主信息
        upper = raw_media.get("upper", {})

        # 归一化统计数据
        stats = MediaDataTransformer.normalize_stats({}, cnt_info)

        # 归一化UP主信息
        uploader_info = MediaDataTransformer.normalize_uploader({}, upper)

        return CardData(
            id=raw_media.get("id", 0),
            bvid=raw_media.get("bvid", ""),
            title=raw_media.get("title", ""),
            cover=raw_media.get("cover", ""),
            duration=raw_media.get("duration", 0),
            pubtime=raw_media.get("pubtime", 0),
            add_time=raw_media.get("fav_time", 0),  # 收藏时间
            uploader=uploader_info,
            author=uploader_info.name,  # 将 uploader.name 映射到 author 字段
            stats=stats,
            intro=raw_media.get("intro", ""),
            # 为了前端兼容，将 stats 字段提升到顶层
            view=stats.view,
            danmaku=stats.danmaku,
            comment=stats.comment,
            like=stats.like,
            coin=stats.coin,
            favorite=stats.favorite,
            share=stats.share
        )

    @staticmethod
    def transform_favorite_list(raw_medias: List[Dict[str, Any]]) -> List[CardData]:
        """转换 Favorites 视频列表
        
        Args:
            raw_medias: B站 API 返回的视频数据列表
            
        Returns:
            List[CardData]: 统一格式的卡片数据列表
        """
        return [MediaDataTransformer.transform_favorite_video(media) for media in raw_medias]

    @staticmethod
    def transform_history_video(raw_video: Dict[str, Any]) -> CardData:
        """转换 History 视频数据

        Args:
            raw_video: B站 API 返回的视频数据

        Returns:
            CardData: 统一格式的卡片数据
        """
        # 提取统计数据
        stat_data = raw_video.get("stat", {})

        # 提取UP主信息
        owner = raw_video.get("owner", {})

        # 归一化统计数据
        stats = MediaDataTransformer.normalize_stats(stat_data, {})

        # 获取观看进度（秒数）并转换为百分比
        progress_seconds = raw_video.get("progress", -1)
        duration = raw_video.get("duration", 0)

        # 计算进度百分比
        progress_percent = -1  # -1 表示未开始或未知
        if progress_seconds > 0 and duration > 0:
            progress_percent = int((progress_seconds / duration) * 100)

        # 获取观看时间
        view_at = raw_video.get("view_at", 0)

        # 归一化UP主信息
        uploader_info = MediaDataTransformer.normalize_uploader(owner)

        return CardData(
            id=raw_video.get("aid", 0),
            bvid=raw_video.get("bvid", ""),
            title=raw_video.get("title", ""),
            cover=raw_video.get("pic", ""),
            duration=raw_video.get("duration", 0),
            pubtime=raw_video.get("pubdate", 0),
            uploader=uploader_info,
            author=uploader_info.name,  # 将 uploader.name 映射到 author 字段
            stats=stats,
            progress=progress_percent,
            add_time=view_at,  # 观看时间
            # 为了前端兼容，将 stats 字段提升到顶层
            view=stats.view,
            danmaku=stats.danmaku,
            comment=stats.comment,
            like=stats.like,
            coin=stats.coin,
            favorite=stats.favorite,
            share=stats.share
        )

    @staticmethod
    def transform_history_list(raw_data: dict) -> List[CardData]:
        """转换B站观看历史数据为CardData列表
        
        Args:
            raw_data: B站 API 返回的完整数据（包含data数组）
            
        Returns:
            List[CardData]: 统一格式的卡片数据列表
        """
        # /x/v2/history API 返回的数据中，data 是一个数组
        videos = raw_data if isinstance(raw_data, list) else raw_data.get("data", [])
        return [MediaDataTransformer.transform_history_video(video) for video in videos]


# 单例实例，方便直接使用
transformer = MediaDataTransformer()