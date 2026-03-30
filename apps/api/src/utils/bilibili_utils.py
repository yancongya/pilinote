# Copyright (c) 2025 PiliNote

import re
from typing import Dict, Optional, Union
from enum import Enum


class MediaType(str, Enum):
    """媒体类型枚举"""
    VIDEO = "video"
    BANGUMI = "bangumi"
    MUSIC = "music"
    MUSIC_LIST = "music_list"
    LESSON = "lesson"
    WATCH_LATER = "watch_later"
    FAVORITE = "favorite"
    OPUS = "opus"
    OPUS_LIST = "opus_list"
    USER_VIDEO = "user_video"
    USER_OPUS = "user_opus"
    USER_AUDIO = "user_audio"


class BilibiliIDConverter:
    """B站BV和AV编号转换工具"""
    
    def __init__(self):
        self.XOR_CODE = 23442827791579
        self.MASK_CODE = 2251799813685247
        self.MAX_AID = 1 << 51
        self.ALPHABET = "FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf"
        self.ENCODE_MAP = (8, 7, 0, 5, 1, 3, 2, 4, 6)
        self.DECODE_MAP = tuple(reversed(self.ENCODE_MAP))
        self.BASE = len(self.ALPHABET)
        self.PREFIX = "BV1"

    def av2bv(self, aid: int) -> str:
        """AV编号转BV编号"""
        bvid = [""] * 9
        tmp = (self.MAX_AID | aid) ^ self.XOR_CODE
        for i in range(len(self.ENCODE_MAP)):
            bvid[self.ENCODE_MAP[i]] = self.ALPHABET[tmp % self.BASE]
            tmp //= self.BASE
        return self.PREFIX + "".join(bvid)

    def bv2av(self, bvid: str) -> int:
        """BV编号转AV编号"""
        bvid = bvid[3:]  # 移除"BV1"前缀
        tmp = 0
        for i in range(len(self.DECODE_MAP)):
            idx = self.ALPHABET.index(bvid[self.DECODE_MAP[i]])
            tmp = tmp * self.BASE + idx
        return (tmp & self.MASK_CODE) ^ self.XOR_CODE

    def is_bvid(self, bvid: str) -> bool:
        """检查是否为有效的BV编号"""
        if len(bvid) != 12:
            return False
        if bvid[0:2] != "BV":
            return False
        return True


class LinkParser:
    """B站链接解析器 - 支持12种链接类型"""
    
    def __init__(self):
        self.converter = BilibiliIDConverter()
        
    def parse_id(self, input_str: str) -> Dict[str, Union[str, int, MediaType, None]]:
        """
        解析B站链接，返回链接类型和ID
        
        支持的格式:
        视频: av\d+, BV\w{10}
        番剧: ep\d+, ss\d+, md\d+
        音乐: au\d+
        歌单: am\d+
        课程: cheese.play/ss\d+
        稍后再看: /watchlater
        收藏夹: space.bilibili.com/{mid}/favlist?fid={fid}
        图文: cv\d+
        图文合集: rl\d+
        用户视频: space.bilibili.com/{mid}/video
        用户图文: space.bilibili.com/{mid}/opus
        用户音频: space.bilibili.com/{mid}/audio
        短链接: b23.tv
        
        Returns:
            {
                "id": str | int,  # 资源ID
                "type": MediaType,  # 媒体类型
                "target": int | None,  # 可选的目标ID（如收藏夹ID）
                "original": str  # 原始链接
            }
        """
        url = input_str.strip()
        
        # 1. 处理ID格式 (av\d+, BV\w{10}, ep\d+, ss\d+, md\d+, au\d+, am\d+, cv\d+, rl\d+)
        id_pattern = r'^(av\d+|BV\w{10}|ep\d+|ss\d+|md\d+|au\d+|am\d+|cv\d+|rl\d+)$'
        id_match = re.match(id_pattern, url, re.IGNORECASE)
        if id_match:
            raw_id = id_match.group(0)
            prefix = raw_id[:2].lower()
            
            type_map = {
                'av': MediaType.VIDEO,
                'bv': MediaType.VIDEO,
                'ep': MediaType.BANGUMI,
                'ss': MediaType.BANGUMI,
                'md': MediaType.BANGUMI,
                'au': MediaType.MUSIC,
                'am': MediaType.MUSIC_LIST,
                'cv': MediaType.OPUS,
                'rl': MediaType.OPUS_LIST,
            }
            
            return {
                "id": raw_id,
                "type": type_map.get(prefix, MediaType.VIDEO),
                "target": None,
                "original": url
            }
        
        # 2. 处理URL格式
        try:
            # 提取URL
            picked = re.search(
                r'(?:https?:\/\/)?(?:[\w-]+\.)*(?:bilibili\.com|b23\.tv)\/.+',
                url,
                re.IGNORECASE
            )
            if not picked:
                picked = re.search(
                    r'(?:https?:\/\/)?(?:[\w-]+\.)*(?:bilibili\.com|b23\.tv)\/',
                    url,
                    re.IGNORECASE
                )
            
            if not picked:
                raise ValueError('不支持的链接格式')
            
            parsed_url = picked.group(0)
            if not parsed_url.startswith('http'):
                parsed_url = 'https://' + parsed_url
            
            from urllib.parse import urlparse
            parsed = urlparse(parsed_url)
            host = parsed.hostname.lower()
            path = parsed.path
            params = parsed.query
            
            # b23.tv 短链接需要重定向
            if host == 'b23.tv':
                # 需要通过HTTP请求获取重定向后的URL
                import httpx
                response = httpx.get(parsed_url, follow_redirects=True)
                final_url = str(response.url)
                return self.parse_id(final_url)
            
            if not host.endswith('bilibili.com'):
                raise ValueError('不支持的链接格式')
            
            segs = path.strip('/').split('/')
            
            # 处理 space.bilibili.com (用户相关)
            if host == 'space.bilibili.com':
                if len(segs) < 2:
                    raise ValueError('无效的用户链接')
                
                mid = segs[0]
                type_ = segs[1]
                
                # 收藏夹
                if type_ == 'favlist':
                    fid_match = re.search(r'fid=(\d+)', params)
                    fid = int(fid_match.group(1)) if fid_match else None
                    return {
                        "id": mid,
                        "type": MediaType.FAVORITE,
                        "target": fid,
                        "original": url
                    }
                
                # 用户视频
                if type_ == 'video' or type_ == 'lists' or len(segs) == 1:
                    list_id_match = re.search(r'/lists/(\d+)', path)
                    list_id = int(list_id_match.group(1)) if list_id_match else None
                    return {
                        "id": mid,
                        "type": MediaType.USER_VIDEO,
                        "target": list_id,
                        "original": url
                    }
                
                # 用户图文
                if segs[2] == 'opus' or type_ == 'article':
                    return {
                        "id": mid,
                        "type": MediaType.USER_OPUS,
                        "target": None,
                        "original": url
                    }
                
                # 用户音频
                if segs[2] == 'audio' or type_ == 'audio':
                    return {
                        "id": mid,
                        "type": MediaType.USER_AUDIO,
                        "target": None,
                        "original": url
                    }
                
                raise ValueError('无效的用户链接')
            
            # 处理 www.bilibili.com
            if len(segs) < 2:
                raise ValueError('无效的链接格式')
            
            type_ = segs[0]
            id_ = segs[1]
            
            # 视频
            if re.match(r'^(BV\w{10}|av\d+)$', id_, re.IGNORECASE):
                return {
                    "id": id_,
                    "type": MediaType.VIDEO,
                    "target": None,
                    "original": url
                }
            
            # 音乐/歌单
            if re.match(r'^(au\d+|am\d+)$', id_, re.IGNORECASE):
                if id_.lower().startswith('au'):
                    return {
                        "id": id_,
                        "type": MediaType.MUSIC,
                        "target": None,
                        "original": url
                    }
                else:
                    return {
                        "id": id_,
                        "type": MediaType.MUSIC_LIST,
                        "target": None,
                        "original": url
                    }
            
            # 图文
            if re.match(r'^cv\d+$', id_, re.IGNORECASE) or type_ == 'opus':
                return {
                    "id": id_,
                    "type": MediaType.OPUS,
                    "target": None,
                    "original": url
                }
            
            # 稍后再看
            if type_ == 'watchlater':
                return {
                    "id": "",
                    "type": MediaType.WATCH_LATER,
                    "target": None,
                    "original": url
                }
            
            # 番剧/课程 (检查第三段)
            id_ = segs[2] if len(segs) > 2 else id_
            if re.match(r'^(ep\d+|ss\d+|md\d+)$', id_, re.IGNORECASE):
                if type_ == 'bangumi':
                    return {
                        "id": id_,
                        "type": MediaType.BANGUMI,
                        "target": None,
                        "original": url
                    }
                if type_ == 'cheese':
                    return {
                        "id": id_,
                        "type": MediaType.LESSON,
                        "target": None,
                        "original": url
                    }
            
            # 图文合集
            if re.match(r'^rl\d+$', id_, re.IGNORECASE):
                return {
                    "id": id_,
                    "type": MediaType.OPUS_LIST,
                    "target": None,
                    "original": url
                }
            
            # 处理稍后再看的带参数情况
            type_ = segs[1]
            if type_ == 'watchlater':
                params_dict = dict(param.split('=') for param in params.split('&') if '=' in param)
                aid = params_dict.get('aid') or params_dict.get('oid') or params_dict.get('bvid')
                if aid:
                    return {
                        "id": aid,
                        "type": MediaType.VIDEO,
                        "target": None,
                        "original": url
                    }
            
            raise ValueError('不支持的链接格式')
            
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f'链接解析失败: {e}')

    def get_video_info_url(self, video_id: str, media_type: MediaType) -> str:
        """
        获取B站资源信息API URL
        
        Args:
            video_id: 资源ID
            media_type: 媒体类型
            
        Returns:
            API URL字符串
        """
        if media_type == MediaType.LESSON:
            # 课程
            return f"https://api.bilibili.com/pugv/view/web/season?season_id={video_id}"
        elif media_type == MediaType.BANGUMI:
            # 番剧
            return f"https://api.bilibili.com/pgc/view/web/season?season_id={video_id}"
        elif media_type == MediaType.VIDEO:
            # 视频
            return f"https://api.bilibili.com/x/web-interface/view?bvid={video_id}"
        elif media_type == MediaType.WATCH_LATER:
            # 稍后再看
            return f"https://api.bilibili.com/x/v2/history/toview"
        elif media_type == MediaType.FAVORITE:
            # 收藏夹
            return f"https://api.bilibili.com/x/v3/fav/resource/list?media_id={video_id}"
        elif media_type in [MediaType.OPUS, MediaType.OPUS_LIST]:
            # 图文
            return f"https://api.bilibili.com/x/article/viewinfo?cv={video_id}"
        elif media_type == MediaType.MUSIC:
            # 音乐
            return f"https://api.bilibili.com/audio/music-service-c/info?sid={video_id}"
        elif media_type == MediaType.MUSIC_LIST:
            # 歌单
            return f"https://api.bilibili.com/audio/music-service-c/playlist/detail?sid={video_id}"
        elif media_type in [MediaType.USER_VIDEO, MediaType.USER_OPUS, MediaType.USER_AUDIO]:
            # 用户内容
            return f"https://api.bilibili.com/x/space/arc/search?mid={video_id}"
        else:
            raise ValueError(f'不支持的媒体类型: {media_type}')


# 创建全局实例
link_parser = LinkParser()
id_converter = BilibiliIDConverter()