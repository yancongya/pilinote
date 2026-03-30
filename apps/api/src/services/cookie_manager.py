# Copyright (c) 2025 PiliNote

import httpx
import time
from typing import Dict, Optional, Any
from datetime import datetime, timedelta

class CookieManager:
    """Cookie管理器 - 完全复刻BiliTools的cookie管理机制"""
    
    def __init__(self):
        self.refresh_token = None
        self.refresh_csrf = None
        self.expires_at = None
        self.cookies = {}
        self.client = httpx.Client(timeout=30.0)
    
    def save_refresh_token(self, refresh_token: str, expires_in_days: int = 30):
        """保存refresh_token"""
        self.refresh_token = refresh_token
        # 计算过期时间（30天后）
        self.expires_at = datetime.now() + timedelta(days=expires_in_days)
    
    def save_cookies(self, cookies_dict: Dict[str, str]):
        """保存cookie"""
        self.cookies.update(cookies_dict)
    
    def set_cookies(self, cookies_dict: Dict[str, str]):
        """设置cookie（别名方法）"""
        self.save_cookies(cookies_dict)
    
    def set_cookie(self, name: str, value: str):
        """设置单个cookie"""
        self.cookies[name] = value
    
    def set_refresh_token(self, refresh_token: str, expires_in_days: int = 30):
        """设置refresh_token（别名方法）"""
        self.save_refresh_token(refresh_token, expires_in_days)
    
    def get_cookie(self, name: str) -> Optional[str]:
        """获取特定cookie"""
        return self.cookies.get(name)
    
    def get_cookies(self) -> Dict[str, str]:
        """获取所有cookies"""
        return self.cookies.copy()
    
    def get_refresh_token(self) -> Optional[str]:
        """获取refresh_token"""
        return self.refresh_token
    
    def get_remaining_time(self) -> int:
        """获取剩余有效时间（秒）"""
        if not self.expires_at:
            return 0
        remaining = (self.expires_at - datetime.now()).total_seconds()
        return max(0, int(remaining))
    
    def get_cookies_string(self) -> str:
        """获取cookie字符串"""
        cookie_parts = []
        for name, value in self.cookies.items():
            cookie_parts.append(f"{name}={value}")
        return "; ".join(cookie_parts)
    
    def should_refresh(self) -> bool:
        """检查是否需要刷新cookie"""
        if not self.expires_at:
            return True
        return datetime.now() >= self.expires_at
    
    async def refresh_cookies(self, bili_csrf: str) -> Dict[str, Any]:
        """
        刷新cookie（异步版本，完全复刻BiliTools的cookie刷新流程）
        
        BiliTools的刷新流程：
        1. 调用/x/passport-login/web/cookie/refresh
        2. 更新cookies和refresh_token
        3. 调用/x/passport-login/web/confirm/refresh确认
        4. 更新过期时间
        
        Args:
            bili_csrf: bili_jct cookie值
            
        Returns:
            Dict[str, Any]: 刷新结果
        """
        if not self.refresh_token:
            return {
                "success": False,
                "message": "没有refresh_token，无法刷新cookie"
            }
        
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Referer": "https://www.bilibili.com",
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": self.get_cookies_string()
            }
            
            # 1. 调用刷新API
            response = self.client.post(
                "https://passport.bilibili.com/x/passport-login/web/cookie/refresh",
                params={
                    "csrf": bili_csrf,
                    "refresh_csrf": bili_csrf,  # 使用相同的csrf
                    "refresh_token": self.refresh_token,
                    "source": "main_web"
                },
                headers=headers,
                cookies=self.cookies
            )
            data = response.json()
            
            if data.get("code") == 0 and data.get("data"):
                # 更新cookie
                for cookie in response.cookies:
                    self.cookies[cookie.name] = cookie.value
                
                # 更新refresh_token
                refresh_data = data["data"]
                self.refresh_token = refresh_data.get("refresh_token", "")
                self.cookies["refresh_token"] = self.refresh_token
                
                # 2. 确认刷新
                confirm_result = await self._confirm_refresh(bili_csrf)
                
                # 3. 更新过期时间
                self.expires_at = datetime.now() + timedelta(days=30)
                
                return {
                    "success": True,
                    "data": {
                        "status": refresh_data.get("status"),
                        "message": refresh_data.get("message", ""),
                        "refresh_token": self.refresh_token,
                        "confirmed": confirm_result["success"]
                    }
                }
            else:
                return {
                    "success": False,
                    "message": data.get("message", "刷新cookie失败")
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"刷新cookie异常: {str(e)}"
            }
    
    async def _confirm_refresh(self, bili_csrf: str) -> Dict[str, Any]:
        """确认刷新（异步版本）"""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Referer": "https://www.bilibili.com",
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": self.get_cookies_string()
            }
            
            response = self.client.post(
                "https://passport.bilibili.com/x/passport-login/web/confirm/refresh",
                params={
                    "csrf": bili_csrf,
                    "refresh_token": self.refresh_token
                },
                headers=headers,
                cookies=self.cookies
            )
            data = response.json()
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "message": "刷新确认成功"
                }
            else:
                return {
                    "success": False,
                    "message": data.get("message", "刷新确认失败")
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"刷新确认异常: {str(e)}"
            }
    
    def close(self):
        """关闭客户端"""
        self.client.close()