"""
模拟bilibili API响应数据

提供各种bilibili API接口的模拟响应数据，用于测试时避免真实API调用：
- 视频信息API响应
- 番剧信息API响应  
- 音乐信息API响应
- 用户信息API响应
- 弹幕API响应
- 字幕API响应
- 错误响应
"""

from typing import Dict, Any, List
from datetime import datetime


class MockBilibiliResponses:
    """bilibili API模拟响应数据"""
    
    @staticmethod
    def get_video_info_response(
        bvid: str = "BV1xx411c7mD",
        aid: int = 123456789,
        title: str = "测试视频标题"
    ) -> Dict[str, Any]:
        """视频信息API响应 (https://api.bilibili.com/x/web-interface/view)"""
        return {
            "code": 0,
            "message": "0",
            "ttl": 1,
            "data": {
                "bvid": bvid,
                "aid": aid,
                "videos": 1,
                "tid": 122,
                "tname": "野生技术协会",
                "copyright": 1,
                "pic": f"https://i2.hdslb.com/bfs/archive/{bvid}.jpg",
                "title": title,
                "pubdate": int(datetime.now().timestamp()) - 86400,  # 1天前
                "ctime": int(datetime.now().timestamp()) - 86400,
                "desc": "这是一个测试视频的描述信息，包含了详细的内容介绍。",
                "desc_v2": [
                    {
                        "raw_text": "这是一个测试视频的描述信息，包含了详细的内容介绍。",
                        "type": 1,
                        "biz_id": 0
                    }
                ],
                "state": 0,
                "duration": 3600,  # 1小时
                "forward": None,
                "mission_id": None,
                "redirect_url": "",
                "rights": {
                    "bp": 0,
                    "elec": 0,
                    "download": 1,
                    "movie": 0,
                    "pay": 0,
                    "hd5": 1,
                    "no_reprint": 1,
                    "autoplay": 1,
                    "ugc_pay": 0,
                    "is_cooperation": 0,
                    "ugc_pay_preview": 0,
                    "no_background": 0,
                    "clean_mode": 0,
                    "is_stein_gate": 0,
                    "is_360": 0,
                    "no_share": 0,
                    "arc_pay": 0,
                    "free_watch": 0
                },
                "owner": {
                    "mid": 12345,
                    "name": "测试UP主",
                    "face": "https://i2.hdslb.com/bfs/face/test.jpg"
                },
                "stat": {
                    "aid": aid,
                    "view": 10000,
                    "danmaku": 500,
                    "reply": 200,
                    "favorite": 300,
                    "coin": 150,
                    "share": 50,
                    "now_rank": 0,
                    "his_rank": 0,
                    "like": 800,
                    "dislike": 0,
                    "evaluation": "",
                    "argue_msg": ""
                },
                "dynamic": "#测试视频# #技术分享#",
                "cid": 987654321,
                "dimension": {
                    "width": 1920,
                    "height": 1080,
                    "rotate": 0
                },
                "premiere": None,
                "teenage_mode": 0,
                "is_chargeable_season": False,
                "is_story": False,
                "no_cache": False,
                "pages": [
                    {
                        "cid": 987654321,
                        "page": 1,
                        "from": "vupload",
                        "part": "测试分P标题",
                        "duration": 3600,
                        "vid": "",
                        "weblink": "",
                        "dimension": {
                            "width": 1920,
                            "height": 1080,
                            "rotate": 0
                        }
                    }
                ],
                "subtitle": {
                    "allow_submit": False,
                    "list": [
                        {
                            "id": 123456,
                            "lan": "zh-CN",
                            "lan_doc": "中文（中国）",
                            "is_lock": False,
                            "subtitle_url": "https://i0.hdslb.com/bfs/subtitle/test.json",
                            "type": 0,
                            "id_str": "123456",
                            "ai_type": 0,
                            "ai_status": 2
                        }
                    ]
                },
                "staff": None,
                "is_season_display": False,
                "user_garb": {
                    "url_image_ani_cut": ""
                },
                "honor_reply": {},
                "like_icon": ""
            }
        }
    
    @staticmethod
    def get_video_playurl_response(
        cid: int = 987654321,
        quality: int = 80
    ) -> Dict[str, Any]:
        """视频播放地址API响应 (https://api.bilibili.com/x/player/playurl)"""
        return {
            "code": 0,
            "message": "0",
            "ttl": 1,
            "data": {
                "from": "local",
                "result": "suee",
                "message": "",
                "quality": quality,
                "format": "mp4",
                "timelength": 3600000,  # 毫秒
                "accept_format": "flv720,flv480,flv360",
                "accept_description": ["高清 720P", "清晰 480P", "流畅 360P"],
                "accept_quality": [80, 64, 32],
                "video_codecid": 7,
                "seek_param": "start",
                "seek_type": "offset",
                "durl": [
                    {
                        "order": 1,
                        "length": 3600000,
                        "size": 104857600,  # 100MB
                        "ahead": "",
                        "vhead": "",
                        "url": "https://test-video-url.com/video.mp4",
                        "backup_url": [
                            "https://backup1-video-url.com/video.mp4",
                            "https://backup2-video-url.com/video.mp4"
                        ]
                    }
                ],
                "support_formats": [
                    {
                        "quality": 80,
                        "format": "mp4",
                        "new_description": "高清 720P",
                        "display_desc": "720P",
                        "superscript": ""
                    },
                    {
                        "quality": 64,
                        "format": "flv",
                        "new_description": "清晰 480P", 
                        "display_desc": "480P",
                        "superscript": ""
                    }
                ]
            }
        }
    
    @staticmethod
    def get_bangumi_info_response(
        ep_id: str = "ep123456",
        season_id: str = "ss12345"
    ) -> Dict[str, Any]:
        """番剧信息API响应 (https://api.bilibili.com/pgc/view/web/season)"""
        return {
            "code": 0,
            "message": "success",
            "result": {
                "activity": {
                    "head_bg_url": "",
                    "id": 0,
                    "title": ""
                },
                "alias": "",
                "bkg_cover": f"https://i0.hdslb.com/bfs/bangumi/{season_id}_bg.jpg",
                "cover": f"https://i0.hdslb.com/bfs/bangumi/{season_id}.jpg",
                "episodes": [
                    {
                        "aid": 234567890,
                        "badge": "",
                        "badge_info": {
                            "bg_color": "",
                            "bg_color_night": "",
                            "text": ""
                        },
                        "badge_type": 0,
                        "cid": 876543210,
                        "cover": f"https://i0.hdslb.com/bfs/archive/{ep_id}.jpg",
                        "dimension": {
                            "height": 1080,
                            "rotate": 0,
                            "width": 1920
                        },
                        "duration": 1440000,  # 24分钟，毫秒
                        "ep_id": int(ep_id.replace("ep", "")),
                        "from": "bangumi",
                        "id": int(ep_id.replace("ep", "")),
                        "is_view_hide": False,
                        "link": f"https://www.bilibili.com/bangumi/play/{ep_id}",
                        "long_title": "第一话：开始的故事",
                        "pub_time": int(datetime.now().timestamp()) - 86400,
                        "pv": "",
                        "release_date": "",
                        "rights": {
                            "allow_demand": 0,
                            "allow_dm": 1,
                            "allow_download": 1,
                            "area_limit": 0
                        },
                        "share_copy": "《测试番剧》第1话 第一话：开始的故事",
                        "share_url": f"https://www.bilibili.com/bangumi/play/{ep_id}",
                        "short_link": f"https://b23.tv/{ep_id}",
                        "status": 2,
                        "subtitle": "第1话",
                        "title": "1",
                        "vid": ""
                    }
                ],
                "evaluate": "这是一个测试番剧的评价描述。",
                "freya": {
                    "bubble_desc": "",
                    "bubble_show_cnt": 0,
                    "icon_show": 0
                },
                "jp_title": "テスト番組",
                "link": f"https://www.bilibili.com/bangumi/play/{season_id}",
                "media_id": int(season_id.replace("ss", "")),
                "mode": 2,
                "new_ep": {
                    "desc": "全12话",
                    "id": int(ep_id.replace("ep", "")),
                    "is_new": 0,
                    "title": "01"
                },
                "payment": {
                    "discount": 100,
                    "pay_type": {
                        "allow_discount": 1,
                        "allow_pack": 1,
                        "allow_ticket": 1,
                        "allow_time_limit": 1,
                        "allow_vip_discount": 1,
                        "forbid_bb": 0
                    },
                    "price": "0.0",
                    "promotion": "",
                    "tip": "",
                    "view_start_time": 0,
                    "vip_discount": 100,
                    "vip_first_time": 0,
                    "vip_price": "0.0"
                },
                "positive": {
                    "id": 0,
                    "title": ""
                },
                "publish": {
                    "is_finish": 1,
                    "is_started": 1,
                    "pub_time": "2023-01-01 00:00:00",
                    "pub_time_show": "2023年1月1日",
                    "unknow_pub_date": 0,
                    "weekday": 0
                },
                "rating": {
                    "count": 1000,
                    "score": 9.5
                },
                "record": "",
                "rights": {
                    "allow_bp": 1,
                    "allow_bp_rank": 1,
                    "allow_download": 1,
                    "allow_review": 1,
                    "area_limit": 0,
                    "ban_area_show": 1,
                    "can_watch": 1,
                    "copyright": "bilibili",
                    "forbid_pre": 0,
                    "freya_white": 0,
                    "is_cover_show": 1,
                    "is_preview": 0,
                    "only_vip_download": 0,
                    "resource": "",
                    "watch_platform": 0
                },
                "season_id": int(season_id.replace("ss", "")),
                "season_title": "测试番剧",
                "seasons": [],
                "section": [],
                "series": {
                    "series_id": 12345,
                    "title": "测试系列"
                },
                "share_copy": "《测试番剧》",
                "share_sub_title": "全12话",
                "share_url": f"https://www.bilibili.com/bangumi/play/{season_id}",
                "show": {
                    "wide_screen": 0
                },
                "square_cover": f"https://i0.hdslb.com/bfs/bangumi/{season_id}_square.jpg",
                "stat": {
                    "coins": 5000,
                    "danmakus": 10000,
                    "favorite": 8000,
                    "favorites": 8000,
                    "likes": 12000,
                    "reply": 3000,
                    "share": 1500,
                    "views": 50000
                },
                "status": 2,
                "subtitle": "",
                "title": "测试番剧",
                "total": 12,
                "type": 1,
                "up_info": {
                    "avatar": "https://i2.hdslb.com/bfs/face/bangumi.jpg",
                    "follower": 1000000,
                    "is_follow": 0,
                    "mid": 98765,
                    "pendant": {
                        "image": "",
                        "name": "",
                        "pid": 0
                    },
                    "theme_type": 0,
                    "uname": "哔哩哔哩番剧",
                    "verify_type": 1,
                    "vip_status": 0,
                    "vip_type": 0
                }
            }
        }
    
    @staticmethod
    def get_music_info_response(
        auid: str = "au123456"
    ) -> Dict[str, Any]:
        """音乐信息API响应 (https://www.bilibili.com/audio/music-service-c/web/song/info)"""
        return {
            "code": 0,
            "msg": "success",
            "data": {
                "id": int(auid.replace("au", "")),
                "uid": 54321,
                "uname": "测试音乐人",
                "author": "测试歌手",
                "title": "测试音乐标题",
                "cover": f"https://i0.hdslb.com/bfs/music/{auid}.jpg",
                "intro": "这是一个测试音乐的介绍",
                "lyric": "https://i0.hdslb.com/bfs/music/lyric/test.lrc",
                "crtype": 1,
                "duration": 240,  # 4分钟，秒
                "passtime": int(datetime.now().timestamp()) - 86400,
                "curtime": int(datetime.now().timestamp()),
                "aid": 345678901,
                "bvid": "BV1music123",
                "cid": 456789012,
                "msid": int(auid.replace("au", "")),
                "attr": 0,
                "limit": 0,
                "activityId": 0,
                "limitdesc": "",
                "ctime": int(datetime.now().timestamp()) - 86400,
                "statistic": {
                    "sid": int(auid.replace("au", "")),
                    "play": 5000,
                    "collect": 800,
                    "comment": 200,
                    "share": 100
                },
                "vipInfo": {
                    "type": 0,
                    "status": 0,
                    "due_date": 0,
                    "vip_pay_type": 0
                },
                "collectIds": [],
                "coin_num": 50
            }
        }
    
    @staticmethod
    def get_danmaku_response(
        cid: int = 987654321
    ) -> str:
        """弹幕XML响应 (https://api.bilibili.com/x/v1/dm/list.so)"""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<i>
    <chatserver>chat.bilibili.com</chatserver>
    <chatid>{cid}</chatid>
    <mission>0</mission>
    <maxlimit>8000</maxlimit>
    <state>0</state>
    <real_name>0</real_name>
    <source>k-v</source>
    <d p="15.233,1,25,16777215,1640995200,0,12345678,0">这是第一条测试弹幕</d>
    <d p="30.567,1,25,16711680,1640995260,0,87654321,0">这是第二条测试弹幕</d>
    <d p="45.890,1,25,65280,1640995320,0,11223344,0">这是第三条测试弹幕</d>
    <d p="60.123,4,25,16777215,1640995380,0,44332211,0">这是滚动弹幕</d>
    <d p="75.456,5,25,16777215,1640995440,0,55667788,0">这是顶部弹幕</d>
    <d p="90.789,1,25,16777215,1640995500,0,99887766,0">这是底部弹幕</d>
    <d p="105.012,1,25,16777215,1640995560,0,66778899,0">测试中文弹幕内容</d>
    <d p="120.345,1,25,16777215,1640995620,0,33445566,0">测试特殊字符 &lt;&gt;&amp;</d>
    <d p="135.678,1,25,16777215,1640995680,0,77889900,0">测试emoji弹幕 😀😂🎉</d>
    <d p="150.901,1,25,16777215,1640995740,0,22334455,0">最后一条测试弹幕</d>
</i>"""
    
    @staticmethod
    def get_subtitle_response(
        language: str = "zh-CN"
    ) -> Dict[str, Any]:
        """字幕JSON响应 (https://i0.hdslb.com/bfs/subtitle/xxx.json)"""
        return {
            "font_size": 0.4,
            "font_color": "#FFFFFF",
            "background_alpha": 0.5,
            "background_color": "#9C27B0",
            "Stroke": "none",
            "body": [
                {
                    "from": 0.0,
                    "to": 3.5,
                    "location": 2,
                    "content": "欢迎观看测试视频"
                },
                {
                    "from": 3.5,
                    "to": 7.2,
                    "location": 2,
                    "content": "这是第一段字幕内容"
                },
                {
                    "from": 7.2,
                    "to": 11.8,
                    "location": 2,
                    "content": "字幕包含了完整的时间轴信息"
                },
                {
                    "from": 11.8,
                    "to": 16.5,
                    "location": 2,
                    "content": "可以准确同步视频播放"
                },
                {
                    "from": 16.5,
                    "to": 21.0,
                    "location": 2,
                    "content": "支持多种语言和格式"
                },
                {
                    "from": 21.0,
                    "to": 25.3,
                    "location": 2,
                    "content": "这是最后一段测试字幕"
                }
            ]
        }
    
    @staticmethod
    def get_user_info_response(
        mid: int = 12345
    ) -> Dict[str, Any]:
        """用户信息API响应 (https://api.bilibili.com/x/space/acc/info)"""
        return {
            "code": 0,
            "message": "0",
            "ttl": 1,
            "data": {
                "mid": mid,
                "name": "测试UP主",
                "sex": "保密",
                "face": "https://i2.hdslb.com/bfs/face/test.jpg",
                "face_nft": 0,
                "face_nft_type": 0,
                "sign": "这是测试UP主的个人签名",
                "rank": 10000,
                "level": 6,
                "jointime": 1234567890,
                "moral": 70,
                "silence": 0,
                "coins": 1000,
                "fans_badge": True,
                "fans_medal": {
                    "show": True,
                    "wear": True,
                    "medal": {
                        "uid": mid,
                        "target_id": mid,
                        "target_name": "测试UP主",
                        "target_face": "https://i2.hdslb.com/bfs/face/test.jpg",
                        "level": 20,
                        "medal_name": "测试勋章",
                        "medal_color": 6067854,
                        "intimacy": 10000,
                        "next_intimacy": 50000,
                        "day_limit": 1500,
                        "today_feed": 0,
                        "medal_color_start": 6067854,
                        "medal_color_end": 6067854,
                        "medal_color_border": 6067854,
                        "is_lighted": 1,
                        "light_status": 1,
                        "wearing_status": 1,
                        "score": 10000
                    }
                },
                "official": {
                    "role": 0,
                    "title": "",
                    "desc": "",
                    "type": -1
                },
                "vip": {
                    "type": 2,
                    "status": 1,
                    "due_date": 1735689600000,
                    "vip_pay_type": 1,
                    "theme_type": 0,
                    "label": {
                        "path": "",
                        "text": "年度大会员",
                        "label_theme": "annual_vip",
                        "text_color": "#FFFFFF",
                        "bg_style": 1,
                        "bg_color": "#FB7299",
                        "border_color": ""
                    },
                    "avatar_subscript": 1,
                    "nickname_color": "#FB7299",
                    "role": 3,
                    "avatar_subscript_url": "",
                    "tv_vip_status": 1,
                    "tv_vip_pay_type": 1,
                    "tv_due_date": 1735689600
                },
                "pendant": {
                    "pid": 0,
                    "name": "",
                    "image": "",
                    "expire": 0,
                    "image_enhance": "",
                    "image_enhance_frame": ""
                },
                "nameplate": {
                    "nid": 0,
                    "name": "",
                    "image": "",
                    "image_small": "",
                    "level": "",
                    "condition": ""
                },
                "user_honour_info": {
                    "mid": mid,
                    "colour": None,
                    "tags": []
                },
                "is_followed": False,
                "top_photo": f"https://i2.hdslb.com/bfs/space/{mid}_top.jpg",
                "theme": {},
                "sys_notice": {},
                "live_room": {
                    "roomStatus": 0,
                    "liveStatus": 0,
                    "url": f"https://live.bilibili.com/{mid}",
                    "title": "",
                    "cover": "",
                    "roomid": 0,
                    "roundStatus": 0,
                    "broadcast_type": 0,
                    "watched_show": {
                        "switch": False,
                        "num": 0,
                        "text_small": "",
                        "text_large": "",
                        "icon": "",
                        "icon_location": "",
                        "icon_web": ""
                    }
                },
                "birthday": "01-01",
                "school": {
                    "name": ""
                },
                "profession": {
                    "name": "",
                    "department": "",
                    "title": "",
                    "is_show": 0
                },
                "tags": None,
                "series": {
                    "user_upgrade_status": 3,
                    "show_upgrade_window": False
                },
                "is_senior_member": 0,
                "mcn_info": None,
                "gaia_res_type": 0,
                "gaia_data": None,
                "is_risk": False,
                "elec": {
                    "show_info": {
                        "show": True,
                        "state": 1,
                        "title": "",
                        "icon": "",
                        "jump_url": ""
                    }
                },
                "contract": {
                    "is_display": False,
                    "is_follow_display": False
                }
            }
        }


class MockErrorResponses:
    """模拟错误响应"""
    
    @staticmethod
    def get_video_not_found_response() -> Dict[str, Any]:
        """视频不存在错误响应"""
        return {
            "code": -404,
            "message": "视频不存在",
            "ttl": 1,
            "data": None
        }
    
    @staticmethod
    def get_access_denied_response() -> Dict[str, Any]:
        """访问被拒绝错误响应"""
        return {
            "code": -403,
            "message": "访问权限不足",
            "ttl": 1,
            "data": None
        }
    
    @staticmethod
    def get_rate_limit_response() -> Dict[str, Any]:
        """请求频率限制错误响应"""
        return {
            "code": -509,
            "message": "请求过于频繁，请稍后再试",
            "ttl": 1,
            "data": None
        }
    
    @staticmethod
    def get_network_error_response() -> Dict[str, Any]:
        """网络错误响应"""
        return {
            "code": -500,
            "message": "网络连接异常",
            "ttl": 1,
            "data": None
        }
    
    @staticmethod
    def get_invalid_parameter_response() -> Dict[str, Any]:
        """参数错误响应"""
        return {
            "code": -400,
            "message": "请求参数错误",
            "ttl": 1,
            "data": None
        }


class MockResponseHelper:
    """模拟响应辅助工具"""
    
    @staticmethod
    def create_paginated_response(
        data: List[Any],
        page: int = 1,
        page_size: int = 20,
        total: int = None
    ) -> Dict[str, Any]:
        """创建分页响应"""
        if total is None:
            total = len(data)
            
        start = (page - 1) * page_size
        end = start + page_size
        page_data = data[start:end]
        
        return {
            "code": 0,
            "message": "0",
            "ttl": 1,
            "data": {
                "list": page_data,
                "page": {
                    "pn": page,
                    "ps": page_size,
                    "count": total,
                    "total": (total + page_size - 1) // page_size
                }
            }
        }
    
    @staticmethod
    def simulate_network_delay(min_ms: int = 100, max_ms: int = 500) -> float:
        """模拟网络延迟（返回秒数）"""
        import random
        return random.randint(min_ms, max_ms) / 1000.0
    
    @staticmethod
    def create_download_progress_updates(
        total_size: int = 100 * 1024 * 1024,  # 100MB
        chunk_size: int = 1024 * 1024,  # 1MB
        speed_range: tuple = (500 * 1024, 2 * 1024 * 1024)  # 500KB/s - 2MB/s
    ) -> List[Dict[str, Any]]:
        """创建下载进度更新序列"""
        import random
        
        updates = []
        downloaded = 0
        
        while downloaded < total_size:
            speed = random.randint(*speed_range)
            downloaded = min(downloaded + chunk_size, total_size)
            progress = (downloaded / total_size) * 100
            eta = (total_size - downloaded) / speed if speed > 0 else 0
            
            updates.append({
                "progress": round(progress, 2),
                "speed": speed,
                "eta": round(eta, 1),
                "downloaded": downloaded,
                "total": total_size,
                "stage": "downloading" if downloaded < total_size else "completed"
            })
        
        return updates