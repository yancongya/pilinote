# Copyright (c) 2025 PiliNote

import httpx
import hashlib
import hmac
import json
import time
import random
import string
from typing import Dict, Optional, Any

class FingerprintManager:
    """设备指纹管理器 - 完全复刻BiliTools的指纹管理"""
    
    BILI_TICKET_KEY = "XgwSnGZ1p"
    
    def __init__(self, async_client=None):
        self.async_client = async_client
        self.client = httpx.Client(timeout=30.0, follow_redirects=True)
        self.buvid3 = None
        self.buvid4 = None
        self.bili_ticket = None
        self.cookies = {}
    
    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        """
        统一的请求方法，优先使用异步客户端
        
        Args:
            method: HTTP方法
            url: 请求URL
            **kwargs: 其他请求参数
            
        Returns:
            httpx.Response: HTTP响应
        """
        if self.async_client:
            return await self.async_client.request(method, url, **kwargs)
        else:
            return self.client.request(method, url, **kwargs)
        
    async def generate_buvid(self) -> Dict[str, Any]:
        """
        生成buvid指纹（异步版本，完全复刻BiliTools的get_buvid方法）
        
        BiliTools的get_buvid流程：
        1. 访问https://www.bilibili.com获取基础cookie
        2. 调用https://api.bilibili.com/x/frontend/finger/spi获取buvid3和buvid4
        3. 保存到cookies
        
        Returns:
            Dict[str, Any]: 包含success, message, 和buvid数据
        """
        try:
            # Step 1: 访问B站首页获取基础cookie
            # 使用与BiliTools相同的headers
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Cache-Control": "max-age=0"
            }
            
            html_response = await self._request("GET", "https://www.bilibili.com", headers=headers)
            
            if html_response.status_code != 200:
                return {
                    "success": False,
                    "message": f"访问B站首页失败: {html_response.status_code}"
                }
            
            # 保存所有cookie（httpx的cookies是一个字典）
            if hasattr(html_response, 'cookies'):
                for name, value in html_response.cookies.items():
                    self.cookies[name] = value
                    
                    if name == "buvid3":
                        self.buvid3 = value
            
            # Step 2: 调用指纹API（使用相同的cookies，添加必要的headers）
            api_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Referer": "https://www.bilibili.com/",
                "Origin": "https://www.bilibili.com",
                "Connection": "keep-alive",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site"
            }
            
            response = await self._request("GET", "https://api.bilibili.com/x/frontend/finger/spi", headers=api_headers, cookies=self.cookies)
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "message": f"调用指纹API失败: {response.status_code}"
                }
            
            data = response.json()
            
            if data.get("code") == 0:
                buvid_data = data["data"]
                self.buvid3 = buvid_data["b_3"]
                self.buvid4 = buvid_data["b_4"]
                
                # 保存到cookies
                self.cookies["buvid3"] = self.buvid3
                self.cookies["buvid4"] = self.buvid4
                
                return {
                    "success": True,
                    "message": "buvid生成成功",
                    "buvid3": self.buvid3,
                    "buvid4": self.buvid4
                }
            else:
                return {
                    "success": False,
                    "message": f"获取buvid失败: {data.get('message')}"
                }
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"生成buvid异常: {str(e)}"
            }
    
    async def generate_bili_ticket(self, bili_csrf: str = "") -> Dict[str, Any]:
        """
        生成bili_ticket签名（异步版本，完全复刻BiliTools的get_bili_ticket方法）
        
        BiliTools的get_bili_ticket流程：
        1. 获取当前时间戳
        2. 使用HMAC-SHA256生成签名
        3. 调用BiliTicket API获取ticket
        4. 保存到cookies
        
        Args:
            bili_csrf: bili_jct cookie值
            
        Returns:
            Dict[str, Any]: 包含success, message, 和ticket数据
        """
        try:
            ts = int(time.time())
            
            # 生成HMAC-SHA256签名（完全复刻BiliTools）
            mac = hmac.new(
                self.BILI_TICKET_KEY.encode(),
                f"ts{ts}".encode(),
                hashlib.sha256
            )
            hexsign = mac.hexdigest()
            
            # 调用BiliTicket API
            response = await self._request(
                "POST",
                "https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket",
                params={
                    "key_id": "ec02",
                    "hexsign": hexsign,
                    "context[ts]": str(ts),
                    "csrf": bili_csrf
                },
                cookies=self.cookies
            )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "message": f"调用BiliTicket API失败: {response.status_code}"
                }
            
            data = response.json()
            
            if data.get("code") == 0 and data.get("data"):
                self.bili_ticket = data["data"]["ticket"]
                self.cookies["bili_ticket"] = self.bili_ticket
                
                return {
                    "success": True,
                    "message": "bili_ticket生成成功",
                    "ticket": self.bili_ticket
                }
            else:
                return {
                    "success": False,
                    "message": f"获取bili_ticket失败: {data.get('message')}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"生成bili_ticket异常: {str(e)}"
            }
    
    async def generate_uuid(self) -> Dict[str, Any]:
        """
        生成UUID cookie（完全复刻BiliTools的get_uuid方法）
        
        BiliTools的get_uuid逻辑：
        1. 生成时间戳
        2. 生成UUID字符串格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxxinfoc
        3. 保存到cookies
        
        Returns:
            Dict[str, Any]: 包含success, message, 和uuid数据
        """
        try:
            # 数字映射（完全复刻BiliTools）
            DIGIT_MAP = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "10"]
            
            # 生成随机字符串的函数
            def s(length: int) -> str:
                return "".join(random.choice(DIGIT_MAP) for _ in range(length))
            
            # 生成时间戳部分
            ts = int(time.time() * 1000) % 100000
            
            # 生成UUID（完全复刻BiliTools的格式）
            uuid_str = f"{s(8)}-{s(4)}-{s(4)}-{s(4)}-{s(12)}{ts:05d}infoc"
            
            # 保存到cookies
            self.cookies["_uuid"] = uuid_str
            
            return {
                "success": True,
                "message": "UUID生成成功",
                "uuid": uuid_str
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"生成UUID异常: {str(e)}"
            }
    
    def get_cookies_string(self) -> str:
        """获取cookie字符串"""
        cookie_parts = []
        for name, value in self.cookies.items():
            cookie_parts.append(f"{name}={value}")
        return "; ".join(cookie_parts)
    
    def get_bili_csrf(self) -> str:
        """获取bili_csrf"""
        return self.cookies.get("bili_jct", "")
    
    def get_cookies(self) -> Dict[str, str]:
        """获取所有cookies"""
        return self.cookies.copy()
    
    def close(self):
        """关闭客户端"""
        self.client.close()