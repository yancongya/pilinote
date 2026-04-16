# Copyright (c) 2025 PiliNote

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional, List
import httpx
import logging

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
)
from src.utils.bilibili_utils import link_parser, id_converter, MediaType

router = APIRouter(prefix="/api/download", tags=["下载-已废弃"])


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

    注意：此端点已迁移至新的队列系统，但为了向后兼容性保留。
    建议使用新的媒体API: /api/media/{media_type}/{media_id}
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
                # 去掉 ss 前缀再转换为整数
                season_id_str = str(parsed["id"]).replace("ss", "").replace("SS", "")
                season_id = int(season_id_str)
                course_detail_result = await bilibili_service.get_classroom_detail(season_id, request.sessdata or "")

                if not course_detail_result["success"]:
                    return ParseLinkResponse(
                        success=False,
                        message=course_detail_result.get("message", "获取课程信息失败")
                    )

                course_detail = course_detail_result["data"]
                course_episodes_result = await bilibili_service.get_classroom_episodes(season_id, request.sessdata or "", 1, 100)

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

                music_data = data.get("data")
                if not music_data:
                    return ParseLinkResponse(
                        success=False,
                        message="音乐数据为空"
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
                            bvid="",
                            aid=0,
                            title=music_data.get("title", ""),
                            desc=music_data.get("intro", ""),
                            pic=music_data.get("cover", ""),
                            duration=music_data.get("duration", 0),
                            pubtime=music_data.get("pub_time", 0),
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


@router.get("/quality/options")
async def get_quality_options():
    """
    获取支持的画质选项

    注意：此端点已废弃，建议使用队列系统中的meta字段获取画质信息
    """
    return {
        "success": True,
        "data": QUALITY_OPTIONS
    }


@router.get("/format/options")
async def get_format_options():
    """
    获取支持的格式选项

    注意：此端点已废弃，建议使用队列系统中的meta字段获取格式信息
    """
    return {
        "success": True,
        "data": FORMAT_OPTIONS
    }