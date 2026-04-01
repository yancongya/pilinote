# Copyright (c) 2025 PiliNote

import httpx
import re
import json
from typing import Dict, Any, Optional, List
import asyncio
import re
import json
from datetime import datetime

from src.config import settings
from src.schemas.media import (
    MediaType, MediaInfo, MediaNfo, MediaItem,
    MediaStats, MediaUpper, MediaThumbnail, MediaSection
)
from src.schemas.login import SessdataLoginRequest


def _format_timestamp(timestamp: Optional[int]) -> Optional[str]:
    """格式化时间戳为日期字符串"""
    if not timestamp:
        return None
    try:
        dt = datetime.fromtimestamp(timestamp)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


class MediaDataProcessor:
    """统一媒体数据处理器 - 对标BiliTools的getMediaInfo功能"""
    
    def __init__(self):
        self.api_base = settings.bilibili_api_base
        # 添加B站常用的cookie参数
        self.default_cookies = {
            "buvid3": "B4F1A8F7-6F1B-4B1E-8C9A-123456789012",
            "buvid4": "B4F1A8F7-6F1B-4B1E-8C9A-123456789012-1700000000",
            "_uuid": "B4F1A8F7-6F1B-4B1E-8C9A-123456789012"
        }
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/video",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "Origin": "https://www.bilibili.com",
            "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"'
        }
        self.client = httpx.Client(timeout=30.0, headers=self.headers)
    
    def close(self):
        """关闭客户端"""
        self.client.close()
    
    async def get_media_info(
        self, 
        media_id: str, 
        media_type: MediaType,
        sessdata: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        获取媒体信息 - 统一的媒体数据获取接口
        
        Args:
            media_id: 媒体ID (BV号, AV号, ep_id, ss_id等)
            media_type: 媒体类型
            sessdata: 用户SESSDATA (可选)
            options: 额外选项 (如target, pn, offset等)
        
        Returns:
            统一格式的媒体信息字典
        """
        try:
            if media_type == MediaType.VIDEO:
                return await self._process_video(media_id, sessdata)
            elif media_type == MediaType.BANGUMI:
                return await self._process_bangumi(media_id, sessdata)
            elif media_type == MediaType.LESSON:
                return await self._process_lesson(media_id, sessdata)
            elif media_type == MediaType.FAVORITE:
                return await self._process_favorite(media_id, sessdata, options)
            elif media_type == MediaType.WATCH_LATER:
                return await self._process_watchlater(sessdata, options)
            elif media_type == MediaType.MUSIC:
                return await self._process_music(media_id, sessdata)
            elif media_type == MediaType.MUSIC_LIST:
                return await self._process_music_list(media_id, sessdata)
            elif media_type == MediaType.OPUS:
                return await self._process_opus(media_id, sessdata)
            elif media_type == MediaType.USER_VIDEO:
                return await self._process_user_video(media_id, sessdata, options)
            elif media_type == MediaType.USER_OPUS:
                return await self._process_user_opus(media_id, sessdata, options)
            elif media_type == MediaType.USER_AUDIO:
                return await self._process_user_audio(media_id, sessdata, options)
            else:
                return {
                    "success": False,
                    "message": f"不支持的媒体类型: {media_type}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"获取媒体信息失败: {str(e)}"
            }
    
    async def _process_video(self, bvid: str, sessdata: Optional[str]) -> Dict[str, Any]:
        """处理视频类型"""
        # 添加SESSDATA到请求头
        headers = self.headers.copy()
        
        # 构建cookie字符串
        cookies = []
        for key, value in self.default_cookies.items():
            cookies.append(f"{key}={value}")
        
        if sessdata:
            cookies.append(f"SESSDATA={sessdata}")
        
        if cookies:
            headers["Cookie"] = "; ".join(cookies)
        
        # 设置动态Referer，包含具体的视频URL
        headers["Referer"] = f"https://www.bilibili.com/video/{bvid}"
        
        try:
            # 使用HTML解析方法替代API调用
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    f"https://www.bilibili.com/video/{bvid}",
                    headers=headers
                )
                response.raise_for_status()
                html = response.text
                
                # 从HTML中提取__INITIAL_STATE__数据
                patterns = [
                    r'__INITIAL_STATE__\s*=\s*({.*?});',
                    r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                    r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>'
                ]
                
                data = None
                for pattern in patterns:
                    match = re.search(pattern, html)
                    if match:
                        try:
                            data = json.loads(match.group(1))
                            break
                        except json.JSONDecodeError:
                            continue
                
                if not data or 'videoData' not in data:
                    return {
                        "success": False,
                        "message": "无法从页面中提取视频信息"
                    }
                
                video_data = data['videoData']
            
            # 构建统计信息
            stat = MediaStats(
                play=video_data.get("stat", {}).get("view", 0),
                danmaku=video_data.get("stat", {}).get("danmaku", 0),
                reply=video_data.get("stat", {}).get("reply", 0),
                like=video_data.get("stat", {}).get("like", 0),
                coin=video_data.get("stat", {}).get("coin", 0),
                favorite=video_data.get("stat", {}).get("favorite", 0),
                share=video_data.get("stat", {}).get("share", 0)
            )
            
            # 构建上传者信息
            owner = video_data.get("owner", {})
            upper = MediaUpper(
                name=owner.get("name", ""),
                mid=owner.get("mid", 0),
                avatar=owner.get("face", "")
            )
            
            # 构建媒体元数据
            nfo = MediaNfo(
                showtitle=video_data.get("title", ""),
                intro=video_data.get("desc", ""),
                url=f"https://www.bilibili.com/video/{bvid}",
                stat=stat,
                thumbs=[MediaThumbnail(id="cover", url=video_data.get("pic", ""))],
                premiered=_format_timestamp(video_data.get("pubdate", 0)),
                upper=upper
            )
            
            # 构建媒体项目列表
            items = []
            pages = video_data.get("pages", [])
            for i, page in enumerate(pages):
                item = MediaItem(
                    title=page.get("part", f"P{i+1}"),
                    cover=video_data.get("pic", ""),
                    desc=video_data.get("desc", ""),
                    duration=page.get("duration", 0),
                    pubtime=video_data.get("pubdate", 0),
                    is_target=(i == 0),
                    type=MediaType.VIDEO,
                    url=f"https://www.bilibili.com/video/{bvid}",
                    aid=video_data.get("aid", 0),
                    bvid=bvid,
                    cid=page.get("cid", 0),
                    index=i
                )
                items.append(item)
            
            return {
                "success": True,
                "data": MediaInfo(
                    type=MediaType.VIDEO,
                    id=bvid,
                    pn=len(pages) > 1,
                    nfo=nfo,
                    list=items
                )
            }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"获取视频信息失败: {str(e)}"
            }
    
    async def _process_bangumi(self, id_str: str, sessdata: Optional[str]) -> Dict[str, Any]:
        """处理番剧类型"""
        # 处理ep_id或ss_id
        id_type = id_str[:2].lower()
        id_num = id_str[2:]
        
        headers = self.headers.copy()
        if sessdata:
            headers["Cookie"] = f"SESSDATA={sessdata}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if id_type == "ep":
                # 获取ep_id对应的season_id
                ep_response = await client.get(
                    f"{self.api_base}/pgc/view/web/season",
                    params={"ep_id": id_num},
                    headers=headers
                )
                ep_data = ep_response.json()
                if ep_data.get("code") != 0:
                    return {"success": False, "message": "获取番剧信息失败"}
                
                season_id = ep_data["data"]["season_id"]
            else:
                season_id = id_num
            
            # 获取番剧详情
            response = await client.get(
                f"{self.api_base}/pgc/view/web/season",
                params={"season_id": season_id},
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") != 0:
                return {
                    "success": False,
                    "message": data.get("message", "获取番剧信息失败")
                }
            
            bangumi_data = data["result"]
            episodes = bangumi_data.get("episodes", [])
            
            if not episodes:
                return {
                    "success": False,
                    "message": "番剧暂无分集内容或需要购买"
                }
            
            # 构建统计信息
            stat = MediaStats(
                play=bangumi_data.get("stat", {}).get("views", 0),
                danmaku=bangumi_data.get("stat", {}).get("danmakus", 0),
                reply=bangumi_data.get("stat", {}).get("reply", 0),
                like=bangumi_data.get("stat", {}).get("likes", 0),
                coin=bangumi_data.get("stat", {}).get("coins", 0),
                favorite=bangumi_data.get("stat", {}).get("favorite", 0),
                share=bangumi_data.get("stat", {}).get("share", 0)
            )
            
            # 构建媒体元数据
            nfo = MediaNfo(
                showtitle=bangumi_data.get("title", ""),
                intro=bangumi_data.get("subtitle", "") or bangumi_data.get("evaluate", ""),
                url=f"https://www.bilibili.com/bangumi/play/ss{season_id}",
                stat=stat,
                thumbs=[MediaThumbnail(id="cover", url=bangumi_data.get("cover", ""))],
                premiered=_format_timestamp(bangumi_data.get("pubtime", 0))
            )
            
            # 构建媒体项目列表
            items = []
            for i, ep in enumerate(episodes):
                item = MediaItem(
                    title=ep.get("long_title", f"第{i+1}集"),
                    cover=ep.get("cover", ""),
                    desc=ep.get("long_title", ""),
                    duration=ep.get("duration", 0) // 1000,  # 毫秒转秒
                    pubtime=ep.get("pub_time", 0),
                    is_target=(i == 0),
                    type=MediaType.BANGUMI,
                    url=ep.get("share_url", ""),
                    aid=ep.get("aid", 0),
                    bvid=ep.get("bvid", ""),
                    cid=ep.get("cid", 0),
                    epid=ep.get("id", 0),
                    ssid=season_id,
                    index=i
                )
                items.append(item)
            
            return {
                "success": True,
                "data": MediaInfo(
                    type=MediaType.BANGUMI,
                    id=f"ss{season_id}",
                    pn=True,
                    nfo=nfo,
                    list=items
                )
            }
    
    async def _process_lesson(self, id_str: str, sessdata: Optional[str]) -> Dict[str, Any]:
        """处理课程类型"""
        id_type = id_str[:2].lower()
        id_num = id_str[2:]
        
        headers = self.headers.copy()
        if sessdata:
            headers["Cookie"] = f"SESSDATA={sessdata}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            from src.services.bilibili import BilibiliService
            bilibili_service = BilibiliService()
            
            try:
                # 获取课程详情
                season_id = int(id_num)
                course_detail_result = bilibili_service.get_classroom_detail(season_id, sessdata or "")
                
                if not course_detail_result["success"]:
                    return {
                        "success": False,
                        "message": course_detail_result.get("message", "获取课程信息失败")
                    }
                
                course_detail = course_detail_result["data"]
                
                # 获取课程分集列表
                course_episodes_result = bilibili_service.get_classroom_episodes(season_id, sessdata or "", 1, 100)
                
                if not course_episodes_result["success"]:
                    return {
                        "success": False,
                        "message": course_episodes_result.get("message", "获取课程分集失败")
                    }
                
                course_data = course_episodes_result["data"]
                episodes = course_data.get("items", [])
                
                if not episodes:
                    return {
                        "success": False,
                        "message": "课程暂无分集内容或需要购买"
                    }
                
                # 构建统计信息
                stat = MediaStats(
                    play=0,  # 课程可能不提供播放量
                    danmaku=0,
                    reply=0,
                    like=0,
                    coin=0,
                    favorite=0,
                    share=0
                )
                
                # 构建媒体元数据
                nfo = MediaNfo(
                    showtitle=course_detail.get("title", ""),
                    intro=course_detail.get("subtitle", "") or course_detail.get("description", ""),
                    url=f"https://www.bilibili.com/cheese/play/ss{season_id}",
                    stat=stat,
                    thumbs=[MediaThumbnail(id="cover", url=course_detail.get("cover", ""))],
                    premiered=_format_timestamp(course_detail.get("pubtime", 0) or int(course_detail.get("release_date", 0)))
                )
                
                # 构建媒体项目列表
                items = []
                for i, ep in enumerate(episodes):
                    item = MediaItem(
                        title=ep.get("title", f"第{i+1}集"),
                        cover=ep.get("cover", ""),
                        desc=ep.get("title", ""),
                        duration=ep.get("duration", 0),
                        pubtime=ep.get("pub_time", 0),
                        is_target=(i == 0),
                        type=MediaType.LESSON,
                        url=f"https://www.bilibili.com/cheese/play/ss{season_id}",
                        aid=ep.get("aid", 0),
                        bvid=ep.get("bvid", ""),
                        cid=ep.get("cid", 0),
                        ssid=season_id,
                        index=i
                    )
                    items.append(item)
                
                return {
                    "success": True,
                    "data": MediaInfo(
                        type=MediaType.LESSON,
                        id=f"ss{season_id}",
                        pn=True,
                        nfo=nfo,
                        list=items
                    )
                }
            finally:
                bilibili_service.close()
    
    async def _process_favorite(
        self, 
        media_id: str, 
        sessdata: Optional[str],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理收藏夹类型"""
        # media_id是用户mid，options.target是收藏夹ID
        target = options.get("target") if options else None
        
        headers = self.headers.copy()
        if sessdata:
            headers["Cookie"] = f"SESSDATA={sessdata}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 如果没有指定收藏夹ID，先获取收藏夹列表
            if not target:
                list_response = await client.get(
                    f"{self.api_base}/x/v3/fav/folder/created/list",
                    params={"up_mid": media_id},
                    headers=headers
                )
                list_data = list_response.json()
                
                if list_data.get("code") != 0:
                    return {
                        "success": False,
                        "message": "获取收藏夹列表失败"
                    }
                
                folders = list_data.get("data", {}).get("list", [])
                if folders:
                    target = folders[0]["id"]
                else:
                    return {
                        "success": False,
                        "message": "没有收藏夹"
                    }
            
            # 获取收藏夹详情
            response = await client.get(
                f"{self.api_base}/x/v3/fav/resource/list",
                params={
                    "media_id": target,
                    "pn": options.get("pn", 1) if options else 1,
                    "ps": options.get("ps", 36) if options else 36,
                    "platform": "web"
                },
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") != 0:
                return {
                    "success": False,
                    "message": data.get("message", "获取收藏夹内容失败")
                }
            
            medias = data["data"]["medias"]
            info = data["data"]["info"]
            
            # 构建统计信息
            cnt_info = info.get("cnt_info", {})
            stat = MediaStats(
                play=cnt_info.get("play", 0),
                danmaku=cnt_info.get("danmaku", 0),
                reply=cnt_info.get("reply", 0),
                like=cnt_info.get("thumb_up", 0),
                coin=cnt_info.get("coin", 0),
                favorite=cnt_info.get("collect", 0),
                share=cnt_info.get("share", 0)
            )
            
            # 构建媒体元数据
            nfo = MediaNfo(
                showtitle=info.get("title", ""),
                intro=info.get("intro", ""),
                url=f"https://space.bilibili.com/{media_id}/favlist?fid={target}",
                stat=stat,
                thumbs=[MediaThumbnail(id="cover", url=info.get("cover", ""))],
                premiered=_format_timestamp(info.get("ctime", 0))
            )
            
            # 构建媒体项目列表
            items = []
            for i, media in enumerate(medias):
                # 从cnt_info获取该视频的统计信息（收藏夹API提供的基本统计）
                cnt_info = media.get("cnt_info", {})
                
                # 提取上传者信息
                upper_data = media.get("upper", {})
                item_upper = None
                if upper_data:
                    item_upper = MediaUpper(
                        name=upper_data.get("name", "未知"),
                        mid=upper_data.get("mid", 0),
                        avatar=upper_data.get("face", "")
                    )
                
                # 获取视频BV号
                bvid = media.get("bvid", "")
                
                # 使用HTML解析方法获取完整统计信息
                item_stat = None
                if bvid:
                    # 构建完整的headers，与视频详情页保持一致
                    video_headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": f"https://www.bilibili.com/video/{bvid}",
                        "Accept": "application/json, text/plain, */*",
                        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                        "Accept-Encoding": "gzip, deflate, br",
                        "Connection": "keep-alive",
                        "Sec-Fetch-Dest": "empty",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Site": "same-site",
                        "Origin": "https://www.bilibili.com"
                    }
                    
                    # 添加cookie
                    cookies = []
                    for key, value in self.default_cookies.items():
                        cookies.append(f"{key}={value}")
                    if sessdata:
                        cookies.append(f"SESSDATA={sessdata}")
                    if cookies:
                        video_headers["Cookie"] = "; ".join(cookies)
                    
                    try:
                        # 使用HTML解析方法获取视频详情
                        html_response = await client.get(
                            f"https://www.bilibili.com/video/{bvid}",
                            headers=video_headers,
                            follow_redirects=True
                        )
                        html_response.raise_for_status()
                        html = html_response.text
                        
                        # 从HTML中提取__INITIAL_STATE__数据
                        patterns = [
                            r'__INITIAL_STATE__\s*=\s*({.*?});',
                            r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                            r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>'
                        ]
                        
                        video_data = None
                        for pattern in patterns:
                            match = re.search(pattern, html)
                            if match:
                                try:
                                    state_data = json.loads(match.group(1))
                                    if 'videoData' in state_data:
                                        video_data = state_data['videoData']
                                        break
                                except json.JSONDecodeError:
                                    continue
                        
                        if video_data:
                            vd = video_data
                            print(f"[DEBUG] 收藏页HTML解析成功 - BV: {bvid}")
                            print(f"[DEBUG] videoData.stat内容: {vd.get('stat', {})}")
                            item_stat = MediaStats(
                                play=vd.get("stat", {}).get("view", 0),
                                danmaku=vd.get("stat", {}).get("danmaku", 0),
                                reply=vd.get("stat", {}).get("reply", 0),
                                like=vd.get("stat", {}).get("like", 0),
                                coin=vd.get("stat", {}).get("coin", 0),
                                favorite=vd.get("stat", {}).get("favorite", 0),
                                share=vd.get("stat", {}).get("share", 0)
                            )
                        else:
                            print(f"[DEBUG] 收藏页HTML解析失败 - BV: {bvid}, 未找到videoData")
                    except Exception as e:
                        print(f"[DEBUG] 收藏页HTML解析异常 - BV: {bvid}, 错误: {str(e)}")
                
                # 如果HTML解析失败，使用收藏夹API提供的基本统计
                if not item_stat:
                    item_stat = MediaStats(
                        play=cnt_info.get("play", 0),
                        danmaku=cnt_info.get("danmaku", 0),
                        reply=cnt_info.get("reply", 0),
                        like=cnt_info.get("like", 0),
                        coin=cnt_info.get("coin", 0),
                        favorite=cnt_info.get("collect", 0),
                        share=cnt_info.get("share", 0)
                    )
                
                item = MediaItem(
                    title=media.get("title", ""),
                    cover=media.get("cover", ""),
                    desc=media.get("intro", ""),
                    duration=media.get("duration", 0),
                    pubtime=media.get("pubtime", 0),
                    is_target=(i == 0),
                    type=MediaType.VIDEO,  # 收藏夹主要是视频
                    url=f"https://www.bilibili.com/video/{media.get('bvid', '')}",
                    aid=media.get("id", 0),
                    bvid=media.get("bvid", ""),
                    fid=target,
                    index=i,
                    stat=item_stat,
                    upper=item_upper
                )
                items.append(item)
            
            return {
                "success": True,
                "data": MediaInfo(
                    type=MediaType.FAVORITE,
                    id=media_id,
                    pn=True,
                    nfo=nfo,
                    list=items
                )
            }
    
    async def _process_watchlater(
        self, 
        sessdata: Optional[str],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理稍后再看类型"""
        headers = self.headers.copy()
        if sessdata:
            headers["Cookie"] = f"SESSDATA={sessdata}"
        
        # 获取分页参数
        page = options.get("pn", 1) if options else 1
        page_size = options.get("ps", 20) if options else 20
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base}/x/v2/history/toview/web",
                params={"ps": 1000},  # 先获取全部列表
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") != 0:
                return {
                    "success": False,
                    "message": data.get("message", "获取稍后再看列表失败")
                }
            
            list_data = data["data"]["list"]
            
            # 手动实现分页
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_data = list_data[start_idx:end_idx]
            
            # 为每个视频单独获取完整统计信息
            items = []
            for i, video in enumerate(paginated_data):
                # 计算全局索引
                global_index = start_idx + i
                # 使用HTML解析方法获取视频详情
                bvid = video.get("bvid", "")
                
                # 构建完整的headers，与视频详情页保持一致
                video_headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": f"https://www.bilibili.com/video/{bvid}",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-site",
                    "Origin": "https://www.bilibili.com"
                }
                
                # 添加cookie
                cookies = []
                for key, value in self.default_cookies.items():
                    cookies.append(f"{key}={value}")
                if sessdata:
                    cookies.append(f"SESSDATA={sessdata}")
                if cookies:
                    video_headers["Cookie"] = "; ".join(cookies)
                
                # 提取上传者信息
                owner_data = video.get("owner", {})
                item_upper = None
                if owner_data:
                    item_upper = MediaUpper(
                        name=owner_data.get("name", "未知"),
                        mid=owner_data.get("mid", 0),
                        avatar=owner_data.get("face", "")
                    )
                
                try:
                    # 使用HTML解析方法获取视频详情
                    html_response = await client.get(
                        f"https://www.bilibili.com/video/{bvid}",
                        headers=video_headers,
                        follow_redirects=True
                    )
                    html_response.raise_for_status()
                    html = html_response.text
                    
                    # 从HTML中提取__INITIAL_STATE__数据
                    patterns = [
                        r'__INITIAL_STATE__\s*=\s*({.*?});',
                        r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                        r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>'
                    ]
                    
                    video_data = None
                    for pattern in patterns:
                        match = re.search(pattern, html)
                        if match:
                            try:
                                state_data = json.loads(match.group(1))
                                if 'videoData' in state_data:
                                    video_data = state_data['videoData']
                                    break
                            except json.JSONDecodeError:
                                continue
                    
                    if video_data:
                        vd = video_data
                        print(f"[DEBUG] 稍后再看HTML解析成功 - BV: {bvid}")
                        print(f"[DEBUG] videoData.stat内容: {vd.get('stat', {})}")
                        stat = MediaStats(
                            play=vd.get("stat", {}).get("view", 0),
                            danmaku=vd.get("stat", {}).get("danmaku", 0),
                            reply=vd.get("stat", {}).get("reply", 0),
                            like=vd.get("stat", {}).get("like", 0),
                            coin=vd.get("stat", {}).get("coin", 0),
                            favorite=vd.get("stat", {}).get("favorite", 0),
                            share=vd.get("stat", {}).get("share", 0)
                        )
                    else:
                        print(f"[DEBUG] 稍后再看HTML解析失败 - BV: {bvid}, 未找到videoData")
                        # 如果HTML解析失败，使用稍后再看API提供的数据
                        stat = MediaStats(
                            play=video.get("stat", {}).get("view", 0),
                            danmaku=video.get("stat", {}).get("danmaku", 0),
                            reply=video.get("cnt_info", {}).get("reply", 0) or video.get("stat", {}).get("reply", 0),
                            like=0,
                            coin=0,
                            favorite=0,
                            share=0
                        )
                except Exception as e:
                    print(f"[DEBUG] 稍后再看HTML解析异常 - BV: {bvid}, 错误: {str(e)}")
                    # 如果发生错误，使用稍后再看API提供的数据
                    stat = MediaStats(
                        play=video.get("stat", {}).get("view", 0),
                        danmaku=video.get("stat", {}).get("danmaku", 0),
                        reply=video.get("cnt_info", {}).get("reply", 0) or video.get("stat", {}).get("reply", 0),
                        like=0,
                        coin=0,
                        favorite=0,
                        share=0
                    )
                
                item = MediaItem(
                    title=video.get("title", ""),
                    cover=video.get("pic", ""),
                    desc=video.get("desc", ""),
                    duration=video.get("duration", 0),
                    pubtime=video.get("pubdate", 0),
                    is_target=(global_index == 0),
                    type=MediaType.VIDEO,
                    url=f"https://www.bilibili.com/video/{video.get('bvid', '')}",
                    aid=video.get("aid", 0),
                    bvid=video.get("bvid", ""),
                    index=global_index,
                    stat=stat,
                    upper=item_upper,
                    progress=video.get("progress", -1)
                )
                items.append(item)
            
            # 构建媒体元数据
            nfo = MediaNfo(
                showtitle="稍后再看",
                intro="稍后再看列表",
                url="https://www.bilibili.com/watchlater",
                stat=MediaStats(),  # 总体统计信息
                thumbs=[],
                premiered=None
            )
            
            return {
                "success": True,
                "data": MediaInfo(
                    type=MediaType.WATCH_LATER,
                    id="watchlater",
                    pn=True,
                    nfo=nfo,
                    list=items
                ),
                "total": len(list_data)  # 添加总数量
            }
    
    async def _process_music(self, music_id: str, sessdata: Optional[str]) -> Dict[str, Any]:
        """处理音乐类型"""
        # 音乐类型实现待补充
        return {
            "success": False,
            "message": "音乐类型暂未实现"
        }
    
    async def _process_music_list(self, list_id: str, sessdata: Optional[str]) -> Dict[str, Any]:
        """处理歌单类型"""
        # 歌单类型实现待补充
        return {
            "success": False,
            "message": "歌单类型暂未实现"
        }
    
    async def _process_opus(self, opus_id: str, sessdata: Optional[str]) -> Dict[str, Any]:
        """处理图文类型"""
        # 图文类型实现待补充
        return {
            "success": False,
            "message": "图文类型暂未实现"
        }
    
    async def _process_user_video(
        self, 
        user_id: str, 
        sessdata: Optional[str],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理用户视频类型"""
        # 用户视频类型实现待补充
        return {
            "success": False,
            "message": "用户视频类型暂未实现"
        }
    
    async def _process_user_opus(
        self, 
        user_id: str, 
        sessdata: Optional[str],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理用户图文类型"""
        # 用户图文类型实现待补充
        return {
            "success": False,
            "message": "用户图文类型暂未实现"
        }
    
    async def _process_user_audio(
        self, 
        user_id: str, 
        sessdata: Optional[str],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理用户音频类型"""
        # 用户音频类型实现待补充
        return {
            "success": False,
            "message": "用户音频类型暂未实现"
        }
    
    def get_public_images(self, data: Dict[str, Any], prefix: str = "") -> List[MediaThumbnail]:
        """
        从数据中提取图片URL
        
        Args:
            data: 原始数据字典
            prefix: 图片ID前缀
        
        Returns:
            缩略图列表
        """
        images = []
        for key, url in data.items():
            if isinstance(url, str) and (url.endswith('.jpg') or url.endswith('.png') or url.endswith('.gif')):
                image_id = f"{prefix}_{key}" if prefix else key
                images.append(MediaThumbnail(id=image_id, url=url))
        return images


# 创建全局实例
media_processor = MediaDataProcessor()