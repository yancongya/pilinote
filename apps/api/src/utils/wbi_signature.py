# Copyright (c) 2025 PiliNote

"""
WBI签名实现 - 完全复刻BiliTools的WBI签名算法

参考：BiliTools/src/services/auth.ts
"""

import hashlib
import base64
import time
from typing import Dict, Any, Tuple


def get_webgl_fingerprint() -> Dict[str, str]:
    """
    获取WebGL指纹（模拟BiliTools的getWebGLFingerPrint）
    
    由于Python后端无法直接访问WebGL API，使用固定的、看起来真实的WebGL指纹。
    这个指纹基于常见的macOS + Chrome组合。
    
    Returns:
        Dict[str, str]: 包含dm_img_str和dm_cover_img_str的字典
    """
    # 模拟WebGL版本和渲染器信息（macOS + Chrome组合）
    webgl_version = "WebGL 2.0 (OpenGL ES 3.0 Chromium)"
    webgl_renderer = "ANGLE (Apple M1 Pro GPU)"
    webgl_vendor = "Apple Inc."
    
    # Base64编码（BiliTools的方式）
    dm_img_str = base64.b64encode(webgl_version.encode()).decode()[:-2]
    dm_cover_img_str = base64.b64encode((webgl_renderer + webgl_vendor).encode()).decode()[:-2]
    
    return {
        "dm_img_str": dm_img_str,
        "dm_cover_img_str": dm_cover_img_str
    }


# BiliTools的mixinKeyEncTab数组（64个数字）
MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
]


def calculate_mixin_key(img_key: str, sub_key: str) -> str:
    """
    计算混合密钥（完全复刻BiliTools的算法）
    
    Args:
        img_key: 图片密钥
        sub_key: 子密钥
        
    Returns:
        str: 混合密钥（32字符）
    """
    # 使用mixinKeyEncTab数组重新排列密钥
    mixed_key = "".join((img_key + sub_key)[i] for i in MIXIN_KEY_ENC_TAB)
    
    # 取前32个字符
    return mixed_key[:32]


def calculate_wbi_sign(params: Dict[str, Any], wbi_img: Dict[str, str]) -> Dict[str, Any]:
    """
    计算WBI签名（完全复刻BiliTools的算法）
    
    Args:
        params: 请求参数
        wbi_img: WBI图片数据，包含img_key和sub_key
        
    Returns:
        Dict: 包含WBI签名的参数
    """
    from urllib.parse import urlencode, quote
    
    # 获取WebGL指纹
    fingerprint = get_webgl_fingerprint()
    
    # 获取混合密钥
    img_key = wbi_img.get('img_key', '')
    sub_key = wbi_img.get('sub_key', '')
    mixed_key = calculate_mixin_key(img_key, sub_key)
    
    # 添加时间戳和WebGL指纹
    params_copy = params.copy()
    params_copy['wts'] = int(time.time())
    params_copy['dm_img_str'] = fingerprint['dm_img_str']
    params_copy['dm_cover_img_str'] = fingerprint['dm_cover_img_str']
    params_copy['dm_img_list'] = '[]'  # 空数组
    
    # 过滤特殊字符（BiliTools使用 /[!'()*]/g）
    def filter_value(value: Any) -> str:
        """过滤特殊字符"""
        value_str = str(value)
        # 过滤掉 '!'、'*'、'('、')' 等字符
        return "".join(char for char in value_str if char not in "!'()*")
    
    # 对参数排序并编码
    sorted_params = sorted(params_copy.items())
    query_parts = []
    for key, value in sorted_params:
        if value is not None:
            filtered_value = filter_value(value)
            query_parts.append(f"{key}={quote(filtered_value, safe='')}")
    
    query_str = "&".join(query_parts)
    
    # WBI签名（使用query + mixed_key）
    wbi_sign = hashlib.md5((query_str + mixed_key).encode()).hexdigest()
    
    # 添加w_rid参数
    result = params_copy
    result['w_rid'] = wbi_sign
    
    return result


def parse_wbi_img(nav_data: Dict) -> Dict[str, str]:
    """
    从nav API响应中解析WBI图片数据
    
    Args:
        nav_data: nav API响应数据
        
    Returns:
        Dict[str, str]: 包含img_key和sub_key的字典
    """
    wbi_img = nav_data.get('data', {}).get('wbi_img', {})
    img_url = wbi_img.get('img_url', '')
    sub_url = wbi_img.get('sub_url', '')
    
    # 提取密钥（从URL中提取文件名）
    img_key = img_url.split('/')[-1].split('.')[0] if img_url else ''
    sub_key = sub_url.split('/')[-1].split('.')[0] if sub_url else ''
    
    return {
        'img_key': img_key,
        'sub_key': sub_key
    }


# 测试函数
if __name__ == "__main__":
    # 测试WebGL指纹
    fingerprint = get_webgl_fingerprint()
    print(f"WebGL指纹:")
    print(f"  dm_img_str: {fingerprint['dm_img_str']}")
    print(f"  dm_cover_img_str: {fingerprint['dm_cover_img_str']}")
    
    # 测试混合密钥
    img_key = "test_img_key_1234567890"
    sub_key = "test_sub_key_0987654321"
    mixed_key = calculate_mixin_key(img_key, sub_key)
    print(f"\n混合密钥: {mixed_key}")
    
    # 测试WBI签名
    params = {
        "mid": "396997624",
        "test_param": "test_value"
    }
    wbi_img = {
        'img_key': img_key,
        'sub_key': sub_key
    }
    signed_params = calculate_wbi_sign(params, wbi_img)
    print(f"\nWBI签名后的参数:")
    for key, value in signed_params.items():
        print(f"  {key}: {value}")