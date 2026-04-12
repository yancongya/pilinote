# Copyright (c) 2025 PiliNote

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import httpx
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

from src.schemas.download import (
    ParseLinkRequest,
    ParseLinkResponse,
    ParsedVideoId,
    VideoInfo,
    VideoQuality,
    VideoFormat,
    DownloadOptionsResponse,
    VideoPages,
    CreateDownloadTaskRequest,
    DownloadTaskResponse,
    DownloadOption
)
from src.utils.bilibili_utils import link_parser, id_converter, MediaType
from src.services.download_service import download_service
from src.services.download_manager import download_manager

router = APIRouter(prefix="/api/download", tags=["下载"])

# 在应用启动时启动下载管理器
@router.on_event("startup")
async def startup_event():
    await download_manager.start()

@router.on_event("shutdown")
async def shutdown_event():
    await download_manager.stop()


# 支持的画质选项
QUALITY_OPTIONS = [
    {"qn": 16, "desc": "360P 流畅"},
    {"qn": 32, "desc": "480P 清晰"},
    {"qn": 64, "desc": "720P 高清"},
    {"qn": 80, "desc": "1080P 高清"},
    {"qn": 112, "desc": "1080P+ 高码率"},
    {"qn": 116, "desc": "4K 超清"},
]

# 支持的格式选项
FORMAT_OPTIONS = [
    {"format": "mp4", "desc": "MP4格式"},
    {"format": "flv", "desc": "FLV格式"},
    {"format": "mkv", "desc": "MKV格式"},
]


# 下载任务相关模型
class StartDownloadRequest(BaseModel):
    bvid: str
    title: str
    cid: Optional[int] = None
    aid: Optional[int] = None
    quality: int = 64
    output_format: str = "mp4"
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    uploader: Optional[str] = None
    uploader_mid: Optional[int] = None
    sessdata: Optional[str] = None
    audio_bitrate: Optional[int] = 192
    codec: Optional[str] = 'avc'
    # 字幕相关参数
    enable_subtitle: Optional[bool] = True  # 启用字幕下载
    enable_nfo: Optional[bool] = True  # 启用NFO文件生成
    enable_cover: Optional[bool] = True  # 启用封面下载
    enable_avatar: Optional[bool] = True  # 启用UP主头像下载


class StartDownloadResponse(BaseModel):
    success: bool
    download_id: Optional[str] = None
    message: Optional[str] = None


class DownloadListResponse(BaseModel):
    success: bool
    downloads: List[Dict[str, Any]]
    total: int


class DownloadDetailResponse(BaseModel):
    success: bool
    download: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


@router.post("/parse", response_model=ParseLinkResponse)
async def parse_link(request: ParseLinkRequest):
    r"""
    解析下载链接，提取资源ID和基本信息
    
    支持的格式:
    - 视频: av\d+, BV\w{10}
    - 番剧: ep\d+, ss\d+, md\d+
    - 音乐: au\d+
    - 歌单: am\d+
    - 课程: cheese.play/ss\d+
    - 稍后再看: /watchlater
    - 收藏夹: space.bilibili.com/{mid}/favlist?fid={fid}
    - 图文: cv\d+
    - 图文合集: rl\d+
    - 用户视频: space.bilibili.com/{mid}/video
    - 用户图文: space.bilibili.com/{mid}/opus
    - 用户音频: space.bilibili.com/{mid}/audio
    - 短链接: b23.tv
    """
    try:
        # 使用新的 parse_id 方法解析链接
        parsed = link_parser.parse_id(request.url)
        
        # 设置请求头
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com"
        }
        if request.sessdata:
            headers["Cookie"] = f"SESSDATA={request.sessdata}"
        
        # 根据媒体类型处理不同的资源
        media_type = parsed["type"]
        api_url = link_parser.get_video_info_url(str(parsed["id"]), media_type)
        
        # 特殊处理：课程
        if media_type == MediaType.LESSON:
            from src.services.bilibili import BilibiliService
            bilibili_service = BilibiliService()
            
            try:
                season_id = int(parsed["id"])
                course_detail_result = bilibili_service.get_classroom_detail(season_id, request.sessdata or "")
                
                if not course_detail_result["success"]:
                    return ParseLinkResponse(
                        success=False,
                        message=course_detail_result.get("message", "获取课程信息失败")
                    )
                
                course_detail = course_detail_result["data"]
                course_episodes_result = bilibili_service.get_classroom_episodes(season_id, request.sessdata or "", 1, 100)
                
                if not course_episodes_result["success"]:
                    return ParseLinkResponse(
                        success=False,
                        message=course_episodes_result.get("message", "获取课程分集失败")
                    )
                
                course_data = course_episodes_result["data"]
                episodes = course_data.get("items", [])
                
                if not episodes:
                    return ParseLinkResponse(
                        success=False,
                        message="课程暂无分集内容或需要购买"
                    )
                
                up_info = course_detail.get("up_info", {})
                stat = course_detail.get("stat", {})
                
                return ParseLinkResponse(
                    success=True,
                    data={
                        "parsed_id": ParsedVideoId(
                            id=parsed["id"],
                            type=parsed["type"].value,
                            original=parsed["original"]
                        ),
                        "video": VideoInfo(
                            bvid=episodes[0].get("bvid", ""),
                            aid=episodes[0].get("aid", 0),
                            title=course_detail.get("title", ""),
                            desc=course_detail.get("subtitle", "") or course_detail.get("description", ""),
                            pic=course_detail.get("cover", ""),
                            duration=sum(ep.get("duration", 0) for ep in episodes),
                            pubdate=course_detail.get("pubtime", 0) or int(course_detail.get("release_date", 0)),
                            cid=episodes[0].get("cid", 0),
                            owner={
                                "mid": up_info.get("mid", 0),
                                "name": up_info.get("uname", ""),
                                "face": up_info.get("avatar", "")
                            },
                            stat={
                                "view": stat.get("play", 0),
                                "danmaku": 0
                            }
                        ),
                        "download_options": {
                            "multi_part": True,
                            "pages": [
                                VideoPages(
                                    page=ep.get("index", 0),
                                    cid=ep.get("cid", 0),
                                    part=ep.get("title", f"第{ep.get('index', 0)}集"),
                                    duration=ep.get("duration", 0)
                                )
                                for ep in episodes
                            ]
                        },
                        "course_info": {
                            "season_id": season_id,
                            "total_episodes": len(episodes),
                            "episodes": episodes
                        }
                    }
                )
            finally:
                bilibili_service.close()
        
        # 特殊处理：番剧
        elif media_type == MediaType.BANGUMI:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                if data.get("code") != 0:
                    return ParseLinkResponse(
                        success=False,
                        message=data.get("message", "获取番剧信息失败")
                    )
                
                # 番剧API返回的数据在 result 字段下
                bangumi_data = data.get("result", {})
                episodes = bangumi_data.get("episodes", [])
                
                if not episodes:
                    return ParseLinkResponse(
                        success=False,
                        message="番剧暂无分集内容或需要购买"
                    )
                
                return ParseLinkResponse(
                    success=True,
                    data={
                        "parsed_id": ParsedVideoId(
                            id=parsed["id"],
                            type=parsed["type"].value,
                            original=parsed["original"]
                        ),
                        "video": VideoInfo(
                            bvid=episodes[0].get("bvid", ""),
                            aid=episodes[0].get("aid", 0),
                            title=bangumi_data.get("title", ""),
                            desc=bangumi_data.get("subtitle", "") or bangumi_data.get("evaluate", ""),
                            pic=bangumi_data.get("cover", ""),
                            duration=sum(ep.get("duration", 0) for ep in episodes),
                            pubdate=bangumi_data.get("pubtime", 0),
                            cid=episodes[0].get("cid", 0),
                            owner={
                                "mid": bangumi_data.get("up_info", {}).get("mid", 0),
                                "name": bangumi_data.get("up_info", {}).get("uname", ""),
                                "face": bangumi_data.get("up_info", {}).get("avatar", "")
                            },
                            stat={
                                "view": bangumi_data.get("stat", {}).get("views", 0),
                                "danmaku": bangumi_data.get("stat", {}).get("danmakus", 0),
                                "reply": bangumi_data.get("stat", {}).get("reply", 0),
                                "favorite": bangumi_data.get("stat", {}).get("favorite", 0),
                                "coin": bangumi_data.get("stat", {}).get("coin", 0),
                                "share": bangumi_data.get("stat", {}).get("share", 0),
                                "like": bangumi_data.get("stat", {}).get("likes", 0)
                            }
                        ),
                        "download_options": {
                            "multi_part": True,
                            "pages": [
                                VideoPages(
                                    page=ep.get("ep_id", 0),
                                    cid=ep.get("cid", 0),
                                    part=ep.get("long_title", f"P{ep.get('ep_id', 0)}"),
                                    duration=ep.get("duration", 0) // 1000  # 番剧duration是毫秒
                                )
                                for ep in episodes
                            ]
                        },
                        "bangumi_info": {
                            "season_id": parsed["id"],
                            "total_episodes": len(episodes),
                            "episodes": episodes
                        }
                    }
                )
        
        # 特殊处理：稍后再看
        elif media_type == MediaType.WATCH_LATER:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                if data.get("code") != 0:
                    return ParseLinkResponse(
                        success=False,
                        message=data.get("message", "获取稍后再看失败")
                    )
                
                watchlater_data = data.get("data", [])
                if not watchlater_data:
                    return ParseLinkResponse(
                        success=True,
                        data={
                            "parsed_id": ParsedVideoId(
                                id=parsed["id"],
                                type=parsed["type"].value,
                                original=parsed["original"]
                            ),
                            "video": VideoInfo(
                                bvid="",
                                aid=0,
                                title="稍后再看",
                                desc="暂无内容",
                                pic="",
                                duration=0,
                                pubdate=0,
                                cid=0,
                                owner={},
                                stat={}
                            ),
                            "download_options": {
                                "multi_part": False,
                                "pages": []
                            },
                            "watchlater_info": {
                                "total": len(watchlater_data),
                                "items": watchlater_data
                            }
                        }
                    )
                
                # 返回第一个视频的信息
                first_item = watchlater_data[0]
                first_bvid = first_item.get("bvid", "")
                
                # 获取第一个视频的详情
                first_video_url = f"https://api.bilibili.com/x/web-interface/view?bvid={first_bvid}"
                # 添加动态Referer以绕过B站反爬虫机制
                parse_headers = headers.copy()
                parse_headers["Referer"] = f"https://www.bilibili.com/video/{first_bvid}"
                first_video_response = await client.get(first_video_url, headers=parse_headers)
                first_video_data = first_video_response.json()
                
                if first_video_data.get("code") == 0:
                    video_data = first_video_data.get("data", {})
                    return ParseLinkResponse(
                        success=True,
                        data={
                            "parsed_id": ParsedVideoId(
                                id=parsed["id"],
                                type=parsed["type"].value,
                                original=parsed["original"]
                            ),
                            "video": VideoInfo(
                                bvid=video_data.get("bvid", ""),
                                aid=video_data.get("aid", 0),
                                title=video_data.get("title", ""),
                                desc=video_data.get("desc", ""),
                                pic=video_data.get("pic", ""),
                                duration=video_data.get("duration", 0),
                                pubdate=video_data.get("pubtime", 0),
                                cid=video_data.get("cid", 0),
                                owner=video_data.get("owner", {}),
                                stat=video_data.get("stat", {})
                            ),
                            "download_options": {
                                "multi_part": True,
                                "pages": [
                                    VideoPages(
                                        page=page.get("page", 0),
                                        cid=page.get("cid", 0),
                                        part=page.get("part", ""),
                                        duration=page.get("duration", 0)
                                    )
                                    for page in video_data.get("pages", [])
                                ]
                            },
                            "watchlater_info": {
                                "total": len(watchlater_data),
                                "items": watchlater_data
                            }
                        }
                    )
        
        # 特殊处理：收藏夹
        elif media_type == MediaType.FAVORITE:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                if data.get("code") != 0:
                    return ParseLinkResponse(
                        success=False,
                        message=data.get("message", "获取收藏夹失败")
                    )
                
                fav_data = data.get("data", {})
                medias = fav_data.get("medias", [])
                
                if not medias:
                    return ParseLinkResponse(
                        success=False,
                        message="收藏夹为空"
                    )
                
                # 返回第一个视频的信息
                first_media = medias[0]
                first_bvid = first_media.get("bvid", "")
                
                # 获取第一个视频的详情
                first_video_url = f"https://api.bilibili.com/x/web-interface/view?bvid={first_bvid}"
                # 添加动态Referer以绕过B站反爬虫机制
                parse_headers = headers.copy()
                parse_headers["Referer"] = f"https://www.bilibili.com/video/{first_bvid}"
                first_video_response = await client.get(first_video_url, headers=parse_headers)
                first_video_data = first_video_response.json()
                
                if first_video_data.get("code") == 0:
                    video_data = first_video_data.get("data", {})
                    return ParseLinkResponse(
                        success=True,
                        data={
                            "parsed_id": ParsedVideoId(
                                id=parsed["id"],
                                type=parsed["type"].value,
                                original=parsed["original"]
                            ),
                            "video": VideoInfo(
                                bvid=video_data.get("bvid", ""),
                                aid=video_data.get("aid", 0),
                                title=video_data.get("title", ""),
                                desc=video_data.get("desc", ""),
                                pic=video_data.get("pic", ""),
                                duration=video_data.get("duration", 0),
                                pubdate=video_data.get("pubtime", 0),
                                cid=video_data.get("cid", 0),
                                owner=video_data.get("owner", {}),
                                stat=video_data.get("stat", {})
                            ),
                            "download_options": {
                                "multi_part": True,
                                "pages": [
                                    VideoPages(
                                        page=page.get("page", 0),
                                        cid=page.get("cid", 0),
                                        part=page.get("part", ""),
                                        duration=page.get("duration", 0)
                                    )
                                    for page in video_data.get("pages", [])
                                ]
                            },
                            "favorite_info": {
                                "mid": parsed["id"],
                                "fid": parsed["target"],
                                "total": len(medias),
                                "items": medias
                            }
                        }
                    )
        
        # 特殊处理：音乐
        elif media_type in [MediaType.MUSIC, MediaType.MUSIC_LIST]:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                if data.get("code") != 0:
                    return ParseLinkResponse(
                        success=False,
                        message=data.get("message", "获取音乐信息失败")
                    )
                
                music_data = data.get("data", {})
                return ParseLinkResponse(
                    success=True,
                    data={
                        "parsed_id": ParsedVideoId(
                            id=parsed["id"],
                            type=parsed["type"].value,
                            original=parsed["original"]
                        ),
                        "video": VideoInfo(
                            bvid="",
                            aid=0,
                            title=music_data.get("title", ""),
                            desc=music_data.get("intro", ""),
                            pic=music_data.get("cover", ""),
                            duration=music_data.get("duration", 0),
                            pubdate=music_data.get("pub_time", 0),
                            cid=0,
                            owner={
                                "mid": music_data.get("author", {}).get("mid", 0),
                                "name": music_data.get("author", {}).get("name", ""),
                                "face": music_data.get("author", {}).get("face", "")
                            },
                            stat={
                                "view": music_data.get("stat", {}).get("play", 0),
                                "danmaku": 0
                            }
                        ),
                        "download_options": {
                            "multi_part": False,
                            "pages": []
                        },
                        "music_info": music_data
                    }
                )
        
        # 特殊处理：图文
        elif media_type in [MediaType.OPUS, MediaType.OPUS_LIST]:
            from src.services.bilibili import BilibiliService
            bilibili_service = BilibiliService()
            try:
                opus_id = parsed["id"].replace("cv", "").replace("CV", "")
                opus_result = await bilibili_service.get_opus_details(opus_id, request.sessdata)
                
                if not opus_result["success"]:
                    return ParseLinkResponse(
                        success=False,
                        message=opus_result.get("message", "获取图文信息失败")
                    )
                
                opus_data = opus_result.get("data", {})
                raw_data = opus_data.get("raw_data", {})
                basic = raw_data.get("detail", {}).get("basic", {})
                author = opus_data.get("author", {})
                raw_stat = opus_data.get("stat", {})
                
                # 提取作者头像URL
                author_avatar = ""
                avatar_data = author.get("avatar", {})
                fallback_layers = avatar_data.get("fallback_layers", {})
                layers = fallback_layers.get("layers", [])
                for layer in layers:
                    resource = layer.get("resource", {})
                    res_image = resource.get("res_image", {})
                    remote = res_image.get("image_src", {}).get("remote", {})
                    if remote.get("url"):
                        author_avatar = remote.get("url")
                        break
                
                # 提取stat计数
                like_count = raw_stat.get("like", {}).get("count", 0)
                reply_count = raw_stat.get("comment", {}).get("count", 0)
                forward_count = raw_stat.get("forward", {}).get("count", 0)
                favorite_count = raw_stat.get("favorite", {}).get("count", 0)
                coin_count = raw_stat.get("coin", {}).get("count", 0)
                
                # 从 author module 获取发布时间
                pubdate = author.get("pub_ts", 0) or basic.get("pub_time", 0) or basic.get("publish_time", 0)
                
                first_image = opus_data.get("image_urls", [""])[0] if opus_data.get("image_urls") else ""
                
                return ParseLinkResponse(
                    success=True,
                    data={
                        "parsed_id": ParsedVideoId(
                            id=parsed["id"],
                            type=parsed["type"].value,
                            original=parsed["original"]
                        ),
                        "video": VideoInfo(
                            bvid="",
                            aid=opus_data.get("id", 0),
                            title=opus_data.get("title", ""),
                            desc="",
                            pic=first_image,
                            duration=0,
                            pubdate=pubdate,
                            cid=0,
                            owner={
                                "mid": basic.get("author", {}).get("mid", 0) or author.get("mid", 0),
                                "name": basic.get("author", {}).get("name", "") or author.get("name", ""),
                                "face": author_avatar
                            },
                            stat={
                                "like": like_count,
                                "reply": reply_count,
                                "share": forward_count,
                                "favorite": favorite_count,
                                "coin": coin_count
                            }
                        ),
                        "download_options": {
                            "multi_part": False,
                            "pages": []
                        },
                        "opus_info": {
                            "title": opus_data.get("title", ""),
                            "author": author.get("name", ""),
                            "author_avatar": author_avatar,
                            "mid": basic.get("author", {}).get("mid", 0) or author.get("mid", 0),
                            "stat": raw_stat,
                            "paragraphs": opus_data.get("paragraphs", []),
                            "image_urls": opus_data.get("image_urls", []),
                            "raw_data": raw_data
                        }
                    }
                )
            finally:
                bilibili_service.close()
        
        # 特殊处理：用户内容（视频/图文/音频）
        elif media_type in [MediaType.USER_VIDEO, MediaType.USER_OPUS, MediaType.USER_AUDIO]:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                if data.get("code") != 0:
                    return ParseLinkResponse(
                        success=False,
                        message=data.get("message", "获取用户信息失败")
                    )
                
                archives = data.get("data", {}).get("list", {}).get("vlist", [])
                if not archives:
                    return ParseLinkResponse(
                        success=False,
                        message="用户暂无发布内容"
                    )
                
                # 返回第一个内容的信息
                first_archive = archives[0]
                first_bvid = first_archive.get("bvid", "")
                
                # 获取第一个视频的详情
                first_video_url = f"https://api.bilibili.com/x/web-interface/view?bvid={first_bvid}"
                # 添加动态Referer以绕过B站反爬虫机制
                parse_headers = headers.copy()
                parse_headers["Referer"] = f"https://www.bilibili.com/video/{first_bvid}"
                first_video_response = await client.get(first_video_url, headers=parse_headers)
                first_video_data = first_video_response.json()
                
                if first_video_data.get("code") == 0:
                    video_data = first_video_data.get("data", {})
                    return ParseLinkResponse(
                        success=True,
                        data={
                            "parsed_id": ParsedVideoId(
                                id=parsed["id"],
                                type=parsed["type"].value,
                                original=parsed["original"]
                            ),
                            "video": VideoInfo(
                                bvid=video_data.get("bvid", ""),
                                aid=video_data.get("aid", 0),
                                title=video_data.get("title", ""),
                                desc=video_data.get("desc", ""),
                                pic=video_data.get("pic", ""),
                                duration=video_data.get("duration", 0),
                                pubdate=video_data.get("pubtime", 0),
                                cid=video_data.get("cid", 0),
                                owner=video_data.get("owner", {}),
                                stat=video_data.get("stat", {})
                            ),
                            "download_options": {
                                "multi_part": True,
                                "pages": [
                                    VideoPages(
                                        page=page.get("page", 0),
                                        cid=page.get("cid", 0),
                                        part=page.get("part", ""),
                                        duration=page.get("duration", 0)
                                    )
                                    for page in video_data.get("pages", [])
                                ]
                            },
                            "user_info": {
                                "mid": parsed["id"],
                                "target": parsed["target"],
                                "total": len(archives),
                                "items": archives
                            }
                        }
                    )
        
        # 普通视频链接处理（视频类型）
        else:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, headers=headers)
                response.raise_for_status()
                data = response.json()
            
            if data["code"] != 0:
                return ParseLinkResponse(
                    success=False,
                    message=data.get("message", "获取视频信息失败")
                )
            
            video_data = data["data"]
            
            # 检查视频数据是否完整
            if not video_data.get("cid"):
                return ParseLinkResponse(
                    success=False,
                    message="视频不可访问或已删除"
                )
            
            # 构建返回数据
            video_info = {
                "parsed_id": ParsedVideoId(
                    type=parsed["type"].value,
                    id=str(parsed["id"]),
                    original=parsed["original"]
                ),
                "video": VideoInfo(
                    bvid=video_data["bvid"],
                    aid=video_data["aid"],
                    title=video_data["title"],
                    desc=video_data["desc"],
                    pic=video_data["pic"],
                    duration=video_data["duration"],
                    pubdate=video_data["pubdate"],
                    cid=video_data.get("cid", 0),
                    owner={
                        "mid": video_data["owner"]["mid"],
                        "name": video_data["owner"]["name"],
                        "face": video_data["owner"]["face"]
                    },
                    stat={
                        "view": video_data["stat"].get("view", 0),
                        "danmaku": video_data["stat"].get("danmaku", 0),
                        "reply": video_data["stat"].get("reply", 0),
                        "favorite": video_data["stat"].get("favorite", 0),
                        "coin": video_data["stat"].get("coin", 0),
                        "share": video_data["stat"].get("share", 0),
                        "like": video_data["stat"].get("like", 0)
                    }
                ),
                "download_options": DownloadOptionsResponse(
                    qualities=[VideoQuality(**q) for q in QUALITY_OPTIONS],
                    formats=[VideoFormat(**f) for f in FORMAT_OPTIONS],
                    subtitle_supported=True,
                    danmaku_supported=True,
                    multi_part=len(video_data.get("pages", [])) > 1,
                    pages=[
                        VideoPages(
                            page=page["page"],
                            cid=page["cid"],
                            part=page["part"],
                            duration=page["duration"]
                        ) for page in video_data.get("pages", [])
                    ] if video_data.get("pages") else None
                )
            }
            
            return ParseLinkResponse(
                success=True,
                data=video_info
            )
            
    except ValueError as e:
        return ParseLinkResponse(
            success=False,
            message=str(e)
        )
    except httpx.HTTPError as e:
        return ParseLinkResponse(
            success=False,
            message=f"网络请求失败: {str(e)}"
        )
    except Exception as e:
        return ParseLinkResponse(
            success=False,
            message=f"解析链接失败: {str(e)}"
        )


@router.post("/convert")
async def convert_video_id(video_id: str, target_type: str = "bvid"):
    """
    转换视频ID格式 (BV <-> AV)
    
    Args:
        video_id: 视频ID
        target_type: 目标类型，bvid 或 aid
    """
    try:
        if target_type not in ["bvid", "aid"]:
            raise HTTPException(status_code=400, detail="target_type 必须是 bvid 或 aid")
        
        converted_id = link_parser.normalize_video_id(video_id, target_type)
        
        return {
            "success": True,
            "data": {
                "original": video_id,
                "converted": converted_id,
                "type": target_type
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"转换失败: {str(e)}"
        }


@router.post("/start", response_model=StartDownloadResponse)
async def start_download(request: StartDownloadRequest, background_tasks: BackgroundTasks):
    """
    创建并启动下载任务
    """
    try:
        # 创建下载任务
        download_id = download_service.create_download_task(
            bvid=request.bvid,
            title=request.title,
            cid=request.cid,
            aid=request.aid,
            quality=request.quality,
            output_format=request.output_format,
            thumbnail_url=request.thumbnail_url,
            duration=request.duration,
            uploader=request.uploader,
            uploader_mid=request.uploader_mid,
            sessdata=request.sessdata,
            audio_bitrate=request.audio_bitrate,
            codec=request.codec,
            enable_subtitle=request.enable_subtitle,
            enable_nfo=request.enable_nfo,
            enable_cover=request.enable_cover,
            enable_avatar=request.enable_avatar
        )

        # 在后台启动下载任务
        background_tasks.add_task(download_service._process_download, download_id)

        return StartDownloadResponse(
            success=True,
            download_id=download_id,
            message="下载任务创建成功"
        )

    except Exception as e:
        return StartDownloadResponse(
            success=False,
            message=f"创建下载任务失败: {str(e)}"
        )


@router.post("/add", response_model=StartDownloadResponse)
async def add_to_download_queue(request: StartDownloadRequest):
    """
    添加到下载队列，不立即开始下载

    此接口与POST /start的区别在于：
    - 只创建下载任务，状态为pending
    - 不立即启动下载
    - 用户可以在下载管理页面批量开始下载
    """
    try:
        # 创建下载任务（状态为pending，不立即下载）
        download_id = download_service.create_download_task(
            bvid=request.bvid,
            title=request.title,
            cid=request.cid,
            aid=request.aid,
            quality=request.quality,
            output_format=request.output_format,
            thumbnail_url=request.thumbnail_url,
            duration=request.duration,
            uploader=request.uploader,
            uploader_mid=request.uploader_mid,
            sessdata=request.sessdata,
            audio_bitrate=request.audio_bitrate,
            codec=request.codec,
            enable_subtitle=request.enable_subtitle,
            enable_nfo=request.enable_nfo,
            enable_cover=request.enable_cover,
            enable_avatar=request.enable_avatar
        )

        return StartDownloadResponse(
            success=True,
            download_id=download_id,
            message="已添加到下载列表"
        )

    except Exception as e:
        return StartDownloadResponse(
            success=False,
            message=f"添加到下载列表失败: {str(e)}"
        )


@router.get("/list", response_model=DownloadListResponse)
async def get_download_list(status: Optional[str] = None):
    """
    获取下载任务列表（包含旧的下载任务和新的队列任务）
    
    动态数据处理：
    - 下载中：从内存中的 download_manager 获取实时进度、速度、ETA
    - 完成：从文件系统获取实际文件大小
    
    Args:
        status: 可选，筛选特定状态的任务
    """
    import os
    
    try:
        # 获取旧的下载任务
        downloads = download_service.get_all_downloads(status)
        
        # 转换为字典格式
        download_list = []
        for download in downloads:
            # 判断是否是活跃下载任务
            is_active = download.id in download_manager.active_downloads
            
            if is_active:
                # 从内存中获取实时进度
                # 这些数据只在下载过程中有意义，不存储到数据库
                download_data = {
                    "id": download.id,
                    "bvid": download.bvid,
                    "title": download.title,
                    "status": download.status,
                    "progress": download.progress if download.progress > 0 else 0,
                    "downloaded_bytes": download.downloaded_bytes if download.downloaded_bytes > 0 else 0,
                    "total_bytes": download.total_bytes if download.total_bytes > 0 else 0,
                    "download_speed": download.download_speed if download.download_speed > 0 else 0,
                    "eta": download.eta if download.eta > 0 else 0,
                    "thumbnail_url": download.thumbnail_url,
                    "duration": download.duration,
                    "uploader": download.uploader,
                    "file_path": download.file_path,
                    "file_size": 0,  # 下载中不显示文件大小
                    "error_message": download.error_message,
                    "created_at": download.created_at.isoformat() if download.created_at else None,
                    "started_at": download.started_at.isoformat() if download.started_at else None,
                    "completed_at": None,
                    "aid": download.aid,
                    "quality": download.quality,
                    "audio_bitrate": download.audio_bitrate,
                    "codec": download.codec,
                    "source": "legacy"
                }
            elif download.status == "completed":
                # 下载完成：从文件系统获取实际文件大小
                actual_file_size = 0
                actual_file_path = None
                
                if download.file_path:
                    # 尝试多个可能的路径
                    possible_paths = [
                        download.file_path,  # 原始路径
                        os.path.join("apps/api", download.file_path),  # 添加 apps/api 前缀
                        os.path.join("apps/api/downloads", os.path.basename(download.file_path)),  # downloads 目录
                    ]
                    
                    # 首先尝试直接路径
                    for path in possible_paths:
                        if os.path.exists(path):
                            try:
                                actual_file_size = os.path.getsize(path)
                                actual_file_path = path
                                logger.info(f"Found file at: {path}, size: {actual_file_size}")
                                break
                            except Exception as e:
                                logger.error(f"Failed to get file size for {path}: {e}")
                    
                    # 如果直接路径失败，尝试智能搜索
                    if not actual_file_path:
                        try:
                            # 搜索 apps/api/downloads 目录
                            downloads_dir = "apps/api/downloads"
                            if os.path.exists(downloads_dir):
                                # 简化标题用于匹配（去除特殊字符）
                                import re
                                simplified_title = re.sub(r'[\/\|\\:<>?*\x00-\x1f]', '', download.title).strip()
                                
                                # 遍历 downloads 目录
                                for root, dirs, files in os.walk(downloads_dir):
                                    for file in files:
                                        if file.endswith(('.mp4', '.flv', '.mkv', '.webm')):
                                            # 简化文件名用于匹配
                                            simplified_file = re.sub(r'[\/\|\\:<>?*\x00-\x1f]', '', file.replace('.mp4', '').replace('.flv', '').replace('.mkv', '').replace('.webm', '')).strip()
                                            
                                            # 检查是否有共同字符（简化版本）
                                            # 如果简化后的标题和文件名有足够相似性
                                            if simplified_title and simplified_file:
                                                # 计算相似度
                                                common_chars = len(set(simplified_title) & set(simplified_file))
                                                if common_chars >= 3:  # 至少有3个共同字符
                                                    full_path = os.path.join(root, file)
                                                    try:
                                                        actual_file_size = os.path.getsize(full_path)
                                                        actual_file_path = full_path
                                                        logger.info(f"Found file by character match: {full_path}, size: {actual_file_size}")
                                                        break
                                                    except Exception as e:
                                                        logger.error(f"Failed to get file size for {full_path}: {e}")
                                # 如果找到文件，跳出外层循环
                                if actual_file_path:
                                    pass
                        except Exception as e:
                            logger.error(f"Error searching for file: {e}")
                
                download_data = {
                    "id": download.id,
                    "bvid": download.bvid,
                    "title": download.title,
                    "status": download.status,
                    "progress": 100.0,
                    "downloaded_bytes": actual_file_size,
                    "total_bytes": actual_file_size,
                    "download_speed": 0,  # 完成后不显示速度
                    "eta": 0,  # 完成后不显示ETA
                    "thumbnail_url": download.thumbnail_url,
                    "duration": download.duration,
                    "uploader": download.uploader,
                    "file_path": actual_file_path or download.file_path,
                    "file_size": actual_file_size,
                    "error_message": download.error_message,
                    "created_at": download.created_at.isoformat() if download.created_at else None,
                    "started_at": download.started_at.isoformat() if download.started_at else None,
                    "completed_at": download.completed_at.isoformat() if download.completed_at else None,
                    "aid": download.aid,
                    "quality": download.quality,
                    "audio_bitrate": download.audio_bitrate,
                    "codec": download.codec,
                    "source": "legacy"
                }
            else:
                # 其他状态（pending, queued, paused, failed, cancelled）
                download_data = {
                    "id": download.id,
                    "bvid": download.bvid,
                    "title": download.title,
                    "status": download.status,
                    "progress": download.progress if download.progress > 0 else 0,
                    "downloaded_bytes": 0,
                    "total_bytes": 0,
                    "download_speed": 0,
                    "eta": 0,
                    "thumbnail_url": download.thumbnail_url,
                    "duration": download.duration,
                    "uploader": download.uploader,
                    "file_path": download.file_path,
                    "file_size": 0,
                    "error_message": download.error_message,
                    "created_at": download.created_at.isoformat() if download.created_at else None,
                    "started_at": download.started_at.isoformat() if download.started_at else None,
                    "completed_at": download.completed_at.isoformat() if download.completed_at else None,
                    "aid": download.aid,
                    "quality": download.quality,
                    "audio_bitrate": download.audio_bitrate,
                    "codec": download.codec,
                    "source": "legacy"
                }
            
            download_list.append(download_data)
        
        # 获取新的队列任务
        from src.database import SessionLocal
        from src.models.task import Task, TaskState
        from src.models.scheduler import Scheduler
        
        with SessionLocal() as db:
            # 获取所有队列任务
            queue_tasks = db.query(Task).order_by(Task.created_at.desc()).all()
            
            # 获取调度器信息
            schedulers = {s.id: s for s in db.query(Scheduler).all()}
            
            for task in queue_tasks:
                # 状态映射
                state_map = {
                    TaskState.BACKLOG: "pending",
                    TaskState.PENDING: "pending",
                    TaskState.ACTIVE: "downloading",
                    TaskState.COMPLETED: "completed",
                    TaskState.PAUSED: "paused",
                    TaskState.FAILED: "failed",
                    TaskState.CANCELLED: "cancelled"
                }
                
                # 获取元数据
                meta = task.meta or {}
                owner = meta.get('owner', {})
                stat = meta.get('stat', {})
                
                # 查找调度器
                scheduler = None
                for s in schedulers.values():
                    if task.id in s.list:
                        scheduler = s
                        break
                
                # 转换为下载列表格式
                download_list.append({
                    "id": task.id,
                    "bvid": task.media_id if task.media_type == "video" else "",
                    "title": task.title,
                    "status": state_map.get(task.state, "unknown"),
                    "progress": 0,  # 队列系统暂时不支持进度
                    "downloaded_bytes": 0,
                    "total_bytes": 0,
                    "download_speed": 0,
                    "eta": 0,
                    "thumbnail_url": meta.get('pic', task.cover),
                    "duration": meta.get('duration', 0),
                    "uploader": owner.get('name') if isinstance(owner, dict) else "",
                    "file_path": scheduler.folder if scheduler else "",
                    "file_size": 0,
                    "error_message": task.status.get('error') if isinstance(task.status, dict) else "",
                    "created_at": datetime.fromtimestamp(task.created_at).isoformat() if task.created_at else None,
                    "started_at": datetime.fromtimestamp(task.updated_at).isoformat() if task.updated_at else None,
                    "completed_at": datetime.fromtimestamp(task.updated_at).isoformat() if task.state == TaskState.COMPLETED else None,
                    "aid": stat.get('aid') if isinstance(stat, dict) else None,
                    "quality": 64,  # 默认质量
                    "audio_bitrate": 192,  # 默认音频码率
                    "codec": "avc",  # 默认编码
                    "source": "queue"  # 标记为新系统
                })
        
        return DownloadListResponse(
            success=True,
            downloads=download_list,
            total=len(download_list)
        )
        
    except Exception as e:
        logger.error(f"Error in get_download_list: {e}", exc_info=True)
        return DownloadListResponse(
            success=False,
            downloads=[],
            total=0,
            message=str(e)
        )


@router.get("/bvid/{bvid}", response_model=DownloadListResponse)
async def get_downloads_by_bvid(bvid: str, status: Optional[str] = None):
    """
    根据bvid或aid获取下载任务
    
    Args:
        bvid: B站视频ID（可以是bvid或aid）
        status: 可选，筛选特定状态的任务
    """
    try:
        from src.database import SessionLocal
        from src.models.download import Download
        
        with SessionLocal() as db:
            # 尝试同时通过bvid和aid查询
            query = db.query(Download).filter(
                (Download.bvid == bvid) | (Download.aid == int(bvid) if bvid.isdigit() else False)
            )
            if status:
                query = query.filter(Download.status == status)
            downloads = query.order_by(Download.created_at.desc()).all()
        
        # 转换为字典格式
        download_list = []
        for download in downloads:
            download_list.append({
                "id": download.id,
                "bvid": download.bvid,
                "title": download.title,
                "status": download.status,
                "progress": download.progress,
                "downloaded_bytes": download.downloaded_bytes,
                "total_bytes": download.total_bytes,
                "download_speed": download.download_speed,
                "eta": download.eta,
                "thumbnail_url": download.thumbnail_url,
                "duration": download.duration,
                "uploader": download.uploader,
                "file_path": download.file_path,
                "error_message": download.error_message,
                "created_at": download.created_at.isoformat() if download.created_at else None,
                "started_at": download.started_at.isoformat() if download.started_at else None,
                "completed_at": download.completed_at.isoformat() if download.completed_at else None,
                "aid": download.aid
            })
        
        return DownloadListResponse(
            success=True,
            downloads=download_list,
            total=len(download_list)
        )
        
    except Exception as e:
        return DownloadListResponse(
            success=False,
            downloads=[],
            total=0
        )


@router.get("/{download_id}", response_model=DownloadDetailResponse)
async def get_download_detail(download_id: str):
    """
    获取单个下载任务详情
    """
    try:
        download = download_service.get_download(download_id)
        
        if not download:
            return DownloadDetailResponse(
                success=False,
                message="下载任务不存在"
            )
        
        download_data = {
            "id": download.id,
            "bvid": download.bvid,
            "title": download.title,
            "status": download.status,
            "progress": download.progress,
            "downloaded_bytes": download.downloaded_bytes,
            "total_bytes": download.total_bytes,
            "download_speed": download.download_speed,
            "eta": download.eta,
            "thumbnail_url": download.thumbnail_url,
            "duration": download.duration,
            "uploader": download.uploader,
            "file_path": download.file_path,
            "file_size": download.file_size,
            "error_message": download.error_message,
            "created_at": download.created_at.isoformat() if download.created_at else None,
            "started_at": download.started_at.isoformat() if download.started_at else None,
            "completed_at": download.completed_at.isoformat() if download.completed_at else None
        }
        
        return DownloadDetailResponse(
            success=True,
            download=download_data
        )
        
    except Exception as e:
        return DownloadDetailResponse(
            success=False,
            message=f"获取下载详情失败: {str(e)}"
        )


@router.post("/{download_id}/cancel")
async def cancel_download(download_id: str):
    """
    取消下载任务
    """
    try:
        success = download_service.cancel_download(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已取消"}
        else:
            return {"success": False, "message": "下载任务不存在"}
            
    except Exception as e:
        return {"success": False, "message": f"取消下载失败: {str(e)}"}


@router.post("/{download_id}/retry")
async def retry_download(download_id: str):
    """
    重试失败的下载任务
    """
    try:
        success = download_service.retry_download(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已重新开始"}
        else:
            return {"success": False, "message": "无法重试此任务"}
            
    except Exception as e:
        return {"success": False, "message": f"重试失败: {str(e)}"}


class BatchStartRequest(BaseModel):
    download_ids: Optional[List[str]] = None
    status: Optional[str] = "pending"


class BatchStartResponse(BaseModel):
    success: bool
    started_count: int
    message: Optional[str] = None


@router.post("/start/batch", response_model=BatchStartResponse)
async def start_batch_downloads(request: BatchStartRequest, background_tasks: BackgroundTasks):
    """
    批量开始下载任务
    
    如果提供了download_ids，则开始指定的下载任务
    如果没有提供download_ids，则开始所有pending状态的下载任务
    """
    try:
        from src.database import SessionLocal
        from src.models.download import Download
        
        with SessionLocal() as db:
            if request.download_ids:
                # 开始指定的下载任务
                downloads = db.query(Download).filter(
                    Download.id.in_(request.download_ids),
                    Download.status == "pending"
                ).all()
            else:
                # 开始所有pending状态的下载任务
                downloads = db.query(Download).filter(
                    Download.status == request.status or "pending"
                ).all()
            
            started_count = 0
            for download in downloads:
                try:
                    background_tasks.add_task(download_service._process_download, download.id)
                    started_count += 1
                except Exception as e:
                    print(f"启动下载任务失败: {download.id}, 错误: {e}")
            
            return BatchStartResponse(
                success=True,
                started_count=started_count,
                message=f"已开始 {started_count} 个下载任务"
            )
            
    except Exception as e:
        return BatchStartResponse(
            success=False,
            started_count=0,
            message=f"批量开始下载失败: {str(e)}"
        )


@router.delete("/{download_id}")
async def delete_download(download_id: str):
    """
    删除下载任务记录和相关文件（支持新旧两种系统）
    """
    try:
        import os
        import shutil
        from src.database import SessionLocal
        from src.models.download import Download
        from src.models.task import Task
        from src.models.scheduler import Scheduler
        from pathlib import Path
        import logging
        
        logger = logging.getLogger(__name__)
        
        # 先尝试旧系统的Download表
        with SessionLocal() as session:
            download = session.query(Download).filter(Download.id == download_id).first()
            if download:
                # 先取消正在进行的下载
                download_service.cancel_download(download_id)
                
                # 删除文件和目录
                if download.file_path:
                    file_path = Path(download.file_path)
                    if file_path.is_file():
                        # 如果file_path是文件，删除其父目录（包含所有相关文件）
                        parent_dir = file_path.parent
                        try:
                            if parent_dir.exists() and parent_dir.is_dir():
                                shutil.rmtree(parent_dir)
                                logger.info(f"Deleted directory: {parent_dir}")
                        except Exception as e:
                            logger.error(f"Failed to delete directory {parent_dir}: {e}")
                    elif file_path.is_dir():
                        # 如果file_path是目录，删除整个目录
                        try:
                            shutil.rmtree(file_path)
                            logger.info(f"Deleted directory: {file_path}")
                        except Exception as e:
                            logger.error(f"Failed to delete directory {file_path}: {e}")
                
                session.delete(download)
                session.commit()
                return {"success": True, "message": "下载任务已删除"}
        
        # 如果旧系统找不到，尝试新系统的Task表
        with SessionLocal() as session:
            task = session.query(Task).filter(Task.id == download_id).first()
            if task:
                # 查找任务所属的调度器
                scheduler = None
                schedulers = session.query(Scheduler).all()
                for s in schedulers:
                    if task.id in s.list:
                        scheduler = s
                        break
                
                # 删除文件（从调度器的文件夹中）
                if scheduler and scheduler.folder:
                    folder_path = Path(scheduler.folder)
                    # 查找所有相关文件（视频、字幕、弹幕、封面、NFO等）
                    files_to_delete = []
                    if task.title:
                        # 根据标题匹配文件
                        for ext in ['.mp4', '.mkv', '.flv', '.srt', '.xml', '.jpg', '.nfo']:
                            files_to_delete.extend(folder_path.glob(f"*{ext}"))
                    
                    for file in files_to_delete:
                        try:
                            os.remove(file)
                            logger.info(f"Deleted file: {file}")
                        except Exception as e:
                            logger.error(f"Failed to delete file {file}: {e}")
                
                # 删除任务记录
                session.delete(task)
                session.commit()
                return {"success": True, "message": "任务已删除"}
            
            return {"success": False, "message": "任务不存在"}
            
    except Exception as e:
        logger.error(f"删除失败: {e}")
        return {"success": False, "message": f"删除失败: {str(e)}"}


@router.post("/clear-all")
async def clear_all_downloads():
    """
    清空所有下载任务
    """
    try:
        deleted_count = download_service.clear_all_downloads()
        return {
            "success": True,
            "message": f"已清空 {deleted_count} 个下载任务",
            "deleted_count": deleted_count
        }
    except Exception as e:
        return {"success": False, "message": f"清空失败: {str(e)}"}


@router.delete("/bvid/{bvid}")
async def delete_download_by_bvid(bvid: str, status: Optional[str] = None):
    """
    根据bvid删除下载任务和相关文件（支持新旧两种系统）
    
    Args:
        bvid: B站视频ID
        status: 可选，只删除特定状态的任务
    """
    try:
        import os
        import shutil
        from src.database import SessionLocal
        from src.models.download import Download
        from src.models.task import Task
        from src.models.scheduler import Scheduler
        from pathlib import Path
        import logging
        
        logger = logging.getLogger(__name__)
        
        deleted_count = 0
        
        # 先删除旧系统的Download记录
        with SessionLocal() as session:
            query = session.query(Download).filter(Download.bvid == bvid)
            if status:
                query = query.filter(Download.status == status)
            downloads = query.all()
            
            for download in downloads:
                # 先取消正在进行的下载
                download_service.cancel_download(download.id)
                
                # 删除文件和目录
                if download.file_path:
                    file_path = Path(download.file_path)
                    if file_path.is_dir():
                        shutil.rmtree(file_path)
                        logger.info(f"Deleted directory: {file_path}")
                    elif file_path.is_file():
                        os.remove(file_path)
                        logger.info(f"Deleted file: {file_path}")
                
                session.delete(download)
                deleted_count += 1
            
            session.commit()
        
        # 然后删除新系统的Task记录
        with SessionLocal() as session:
            query = session.query(Task).filter(Task.media_id == bvid)
            if status:
                # 将前端status映射到TaskState
                from src.models.task import TaskState
                state_map = {
                    "pending": TaskState.BACKLOG,
                    "downloading": TaskState.ACTIVE,
                    "completed": TaskState.COMPLETED,
                    "paused": TaskState.PAUSED,
                    "failed": TaskState.FAILED,
                    "cancelled": TaskState.CANCELLED
                }
                if status in state_map:
                    query = query.filter(Task.state == state_map[status])
            
            tasks = query.all()
            
            for task in tasks:
                # 查找任务所属的调度器
                scheduler = None
                schedulers = session.query(Scheduler).all()
                for s in schedulers:
                    if task.id in s.list:
                        scheduler = s
                        break
                
                # 删除文件
                if scheduler and scheduler.folder:
                    folder_path = Path(scheduler.folder)
                    if task.title:
                        # 根据标题匹配文件
                        for ext in ['.mp4', '.mkv', '.flv', '.srt', '.xml', '.jpg', '.nfo']:
                            for file in folder_path.glob(f"*{ext}"):
                                try:
                                    os.remove(file)
                                    logger.info(f"Deleted file: {file}")
                                except Exception as e:
                                    logger.error(f"Failed to delete file {file}: {e}")
                
                session.delete(task)
                deleted_count += 1
            
            session.commit()
        
        return {
            "success": True,
            "message": f"已删除 {deleted_count} 个下载任务",
            "deleted_count": deleted_count
        }
            
    except Exception as e:
        logger.error(f"删除失败: {e}")
        return {"success": False, "message": f"删除失败: {str(e)}"}


@router.get("/quality/options")
async def get_quality_options():
    """
    获取支持的画质选项
    """
    return {
        "success": True,
        "data": QUALITY_OPTIONS
    }


@router.get("/format/options")
async def get_format_options():
    """
    获取支持的格式选项
    """
    return {
        "success": True,
        "data": FORMAT_OPTIONS
    }


# ===== 任务管理API =====

@router.post("/{download_id}/start")
async def start_download_task(download_id: str):
    """
    开始下载任务
    
    Args:
        download_id: 下载任务ID
    """
    try:
        success = await download_manager.start_task(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已开始"}
        else:
            return {"success": False, "message": "无法开始下载任务"}
            
    except Exception as e:
        return {"success": False, "message": f"开始下载失败: {str(e)}"}


@router.post("/{download_id}/pause")
async def pause_download_task(download_id: str):
    """
    暂停下载任务
    
    Args:
        download_id: 下载任务ID
    """
    try:
        success = await download_manager.pause_task(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已暂停"}
        else:
            return {"success": False, "message": "无法暂停下载任务"}
            
    except Exception as e:
        return {"success": False, "message": f"暂停下载失败: {str(e)}"}


@router.post("/{download_id}/resume")
async def resume_download_task(download_id: str):
    """
    继续下载任务
    
    Args:
        download_id: 下载任务ID
    """
    try:
        success = await download_manager.resume_task(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已继续"}
        else:
            return {"success": False, "message": "无法继续下载任务"}
            
    except Exception as e:
        return {"success": False, "message": f"继续下载失败: {str(e)}"}


@router.post("/{download_id}/cancel")
async def cancel_download_task(download_id: str):
    """
    取消下载任务
    
    Args:
        download_id: 下载任务ID
    """
    try:
        success = await download_manager.cancel_task(download_id)
        
        if success:
            return {"success": True, "message": "下载任务已取消"}
        else:
            return {"success": False, "message": "无法取消下载任务"}
            
    except Exception as e:
        return {"success": False, "message": f"取消下载失败: {str(e)}"}


@router.get("/{download_id}/status")
async def get_download_task_status(download_id: str):
    """
    获取下载任务状态
    
    Args:
        download_id: 下载任务ID
    """
    try:
        status = await download_manager.get_task_status(download_id)
        
        if status:
            return {"success": True, "data": status}
        else:
            return {"success": False, "message": "下载任务不存在"}
            
    except Exception as e:
        return {"success": False, "message": f"获取任务状态失败: {str(e)}"}


@router.get("/manager/tasks")
async def get_all_download_tasks(status: Optional[str] = None):
    """
    获取所有下载任务（使用下载管理器）
    
    Args:
        status: 可选，筛选特定状态的任务
    """
    try:
        tasks = await download_manager.get_all_tasks(status)
        
        return {
            "success": True,
            "data": tasks,
            "total": len(tasks)
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"获取任务列表失败: {str(e)}",
            "data": [],
            "total": 0
        }


@router.get("/engine/stats")
async def get_download_engine_stats():
    """
    获取下载引擎统计信息
    
    Returns:
        下载引擎配置和状态
    """
    try:
        from src.services.download_engine import DownloadEngine
        
        # 创建下载引擎实例
        engine = DownloadEngine()
        
        # 获取统计信息
        stats = engine.get_download_stats()
        
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"获取下载引擎状态失败: {str(e)}"
        }