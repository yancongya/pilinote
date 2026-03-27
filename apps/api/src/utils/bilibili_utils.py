# Copyright (c) 2025 PiliNote

import re
from typing import Dict, Optional


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
    """B站链接解析器"""
    
    def __init__(self):
        self.converter = BilibiliIDConverter()
        
    def parse_video_link(self, url: str) -> Dict[str, str]:
        """
        从各种格式的链接中提取视频ID
        
        支持的格式:
        - 直接BVid: BV1xx411c7mh
        - 完整URL: https://www.bilibili.com/video/BV1xx411c7mh
        - 短链接: https://b23.tv/BV1xx411c7mh
        - AV编号: av12345678 或直接数字 12345678
        - 带参数URL: https://www.bilibili.com/video/BV1xx411c7mh?p=2
        
        Returns:
            {
                "type": "bvid" | "aid",
                "id": "BV1xx411c7mh" | 12345678,
                "original": "原始链接"
            }
        """
        url = url.strip()
        
        # 1. 处理直接输入的BVid (必须是正好12位)
        if url.startswith('BV') and len(url) == 12:
            if self.converter.is_bvid(url):
                return {
                    "type": "bvid",
                    "id": url,
                    "original": url
                }
            else:
                raise ValueError(f'无效的BV编号格式: {url}')
        
        # 2. 提取BVid (支持BV前缀的10位字符)
        bvid_match = re.search(r'(BV[0-9A-Za-z]{10})', url)
        if bvid_match:
            bvid = bvid_match.group(1)
            # 验证BV编号是否有效，且确保URL中只有这个BV编号（没有额外字符）
            if self.converter.is_bvid(bvid) and (url == bvid or 'bilibili.com/video/' in url or 'b23.tv/' in url):
                return {
                    "type": "bvid",
                    "id": bvid,
                    "original": url
                }
        
        # 3. 提取Avid (支持av前缀或纯数字)
        aid_match = re.search(r'av(\d+)', url)
        if aid_match:
            aid = int(aid_match.group(1))
            return {
                "type": "aid", 
                "id": aid,
                "original": url
            }
        
        # 4. 处理纯数字输入
        if url.isdigit():
            aid = int(url)
            return {
                "type": "aid",
                "id": aid,
                "original": url
            }
        
        raise ValueError('不支持的链接格式。支持的格式包括：\n'
                        '- BV编号: BV1xx411c7mh\n'
                        '- 完整URL: https://www.bilibili.com/video/BV1xx411c7mh\n'
                        '- 短链接: https://b23.tv/BV1xx411c7mh\n'
                        '- AV编号: av12345678 或 12345678')

    def normalize_video_id(self, url: str, target_type: str = "bvid") -> str:
        """
        将视频ID统一转换为指定类型
        
        Args:
            url: 视频链接或ID
            target_type: 目标类型，"bvid" 或 "aid"
            
        Returns:
            转换后的视频ID
        """
        parsed = self.parse_video_link(url)
        
        if parsed["type"] == target_type:
            return parsed["id"]
        
        if target_type == "bvid" and parsed["type"] == "aid":
            return self.converter.av2bv(parsed["id"])
        elif target_type == "aid" and parsed["type"] == "bvid":
            return str(self.converter.bv2av(parsed["id"]))
        
        return parsed["id"]

    def get_video_info_url(self, video_id: str, id_type: str = "bvid") -> str:
        """
        获取B站视频信息API URL
        
        Args:
            video_id: 视频ID
            id_type: ID类型，"bvid" 或 "aid"
            
        Returns:
            API URL字符串
        """
        if id_type == "bvid":
            return f"https://api.bilibili.com/x/web-interface/view?bvid={video_id}"
        else:
            return f"https://api.bilibili.com/x/web-interface/view?aid={video_id}"


# 创建全局实例
link_parser = LinkParser()
id_converter = BilibiliIDConverter()