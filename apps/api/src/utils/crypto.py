# Copyright (c) 2025 PiliNote

import hashlib
import json
from typing import Dict, Any
from passlib.context import CryptContext


class CryptoUtils:
    """加密和签名工具类（Week 4: 加密和签名增强）"""
    
    # B站APP密钥
    APP_KEY = "27eb53fc9058f8c3"
    APP_SEC = "c2ed53a74eeefb53"
    
    # 密码哈希上下文
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    @staticmethod
    def md5_sign(params: Dict[str, Any]) -> str:
        """MD5参数签名（复刻BiliTools）
        
        Args:
            params: 需要签名的参数字典
            
        Returns:
            str: MD5签名结果
        """
        # 添加appkey到参数中
        params_with_key = params.copy()
        params_with_key['appkey'] = CryptoUtils.APP_KEY
        
        # 按key排序参数
        sorted_params = sorted(params_with_key.items())
        
        # 构造签名字符串
        sign_str = '&'.join([f"{k}={v}" for k, v in sorted_params])
        sign_str += CryptoUtils.APP_SEC
        
        # MD5签名
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest()
    
    @staticmethod
    def add_signature(params: Dict[str, Any]) -> Dict[str, Any]:
        """为参数添加签名
        
        Args:
            params: 需要签名的参数字典
            
        Returns:
            Dict: 包含签名的参数字典
        """
        result = params.copy()
        result['appkey'] = CryptoUtils.APP_KEY
        result['sign'] = CryptoUtils.md5_sign(params)
        return result
    
    @staticmethod
    def calculate_wbi_sign(params: Dict[str, Any], wbi_img: Dict[str, str]) -> Dict[str, Any]:
        """计算WBI签名（用于B站API签名）
        
        Args:
            params: 请求参数
            wbi_img: WBI图片数据，包含img_key和sub_key
            
        Returns:
            Dict: 包含WBI签名的参数
        """
        from urllib.parse import urlencode
        import hashlib
        import time
        
        # 获取当前的混合密钥
        img_key = wbi_img.get('img_key', '')
        sub_key = wbi_img.get('sub_key', '')
        
        # 每12小时更换一次混合密钥
        now = int(time.time())
        offset = now % 24 // 12
        if offset == 0:
            mixed_key = img_key + sub_key
        else:
            mixed_key = sub_key + img_key
        
        # 构造签名字符串
        params_copy = params.copy()
        params_copy['wts'] = now  # 添加时间戳
        
        # 按key排序
        sorted_params = sorted(params_copy.items())
        query_str = '&'.join([f"{k}={v}" for k, v in sorted_params])
        
        # WBI签名
        wbi_sign = hashlib.md5((query_str + mixed_key).encode()).hexdigest()
        
        result = params_copy
        result['w_rid'] = wbi_sign
        return result
    
    @staticmethod
    def calculate_mixin_key(wbi_img: Dict[str, str]) -> str:
        """计算混合密钥（用于WBI签名）
        
        Args:
            wbi_img: WBI图片数据
            
        Returns:
            str: 混合密钥
        """
        import time
        
        img_key = wbi_img.get('img_key', '')
        sub_key = wbi_img.get('sub_key', '')
        
        now = int(time.time())
        offset = now % 24 // 12
        
        if offset == 0:
            return img_key + sub_key
        else:
            return sub_key + img_key


# 兼容性函数：密码哈希和验证
def hash_password(password: str) -> str:
    """哈希密码（用于本地用户密码存储）
    
    Args:
        password: 原始密码
        
    Returns:
        str: 哈希后的密码
    """
    return CryptoUtils.pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码（用于本地用户密码验证）
    
    Args:
        plain_password: 原始密码
        hashed_password: 哈希后的密码
        
    Returns:
        bool: 密码是否匹配
    """
    return CryptoUtils.pwd_context.verify(plain_password, hashed_password)