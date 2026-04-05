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
                    # 处理不同类型的cookie对象
                    if hasattr(cookie, 'name') and hasattr(cookie, 'value'):
                        cookie_name = cookie.name
                        cookie_value = cookie.value
                    else:
                        # 如果是字典项，使用键值
                        cookie_name = cookie[0] if isinstance(cookie, tuple) else cookie
                        cookie_value = response.cookies[cookie_name]
                    
                    self.cookies[cookie_name] = cookie_value
                
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
    
    async def save_to_db(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        保存cookie到数据库（优先级1核心功能）
        
        Args:
            user_id: 用户ID，支持多账号管理
            
        Returns:
            Dict[str, Any]: 保存结果
        """
        try:
            from src.database import SessionLocal
            from src.models.cookie import Cookie
            
            db = SessionLocal()
            try:
                # 删除该用户的所有旧cookie
                if user_id:
                    db.query(Cookie).filter(Cookie.user_id == user_id).delete()
                else:
                    # 如果没有user_id，删除所有cookie
                    db.query(Cookie).delete()
                
                # 保存新cookie
                saved_count = 0
                for name, value in self.cookies.items():
                    cookie = Cookie(
                        user_id=user_id,
                        name=name,
                        value=value,
                        expires_at=int(self.expires_at.timestamp()) if self.expires_at else None
                    )
                    db.add(cookie)
                    saved_count += 1
                
                db.commit()
                
                print(f"[Cookie Persistence] 保存了{saved_count}个cookie到数据库")
                
                return {
                    "success": True,
                    "message": f"保存了{saved_count}个cookie到数据库",
                    "saved_count": saved_count
                }
            except Exception as e:
                db.rollback()
                print(f"[Cookie Persistence] 保存失败: {str(e)}")
                return {
                    "success": False,
                    "message": f"保存cookie到数据库失败: {str(e)}"
                }
            finally:
                db.close()
        except Exception as e:
            print(f"[Cookie Persistence] 初始化失败: {str(e)}")
            return {
                "success": False,
                "message": f"初始化数据库失败: {str(e)}"
            }
    
    async def load_from_db(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        从数据库加载cookie（优先级1核心功能）
        
        Args:
            user_id: 用户ID，支持多账号管理
            
        Returns:
            Dict[str, Any]: 加载结果
        """
        try:
            from src.database import SessionLocal
            from src.models.cookie import Cookie
            
            db = SessionLocal()
            try:
                # 查询cookie
                query = db.query(Cookie)
                if user_id:
                    query = query.filter(Cookie.user_id == user_id)
                
                cookies = query.all()
                
                if not cookies:
                    print(f"[Cookie Persistence] 数据库中没有找到cookie")
                    return {
                        "success": True,
                        "message": "数据库中没有cookie",
                        "loaded_count": 0
                    }
                
                # 加载cookie
                loaded_count = 0
                for cookie in cookies:
                    # 确保cookie对象有name和value属性
                    if hasattr(cookie, 'name') and hasattr(cookie, 'value'):
                        # 对SESSDATA和bili_jct等关键cookies进行URL解码
                        cookie_value = cookie.value
                        if cookie.name in ["SESSDATA", "bili_jct"]:
                            from urllib.parse import unquote
                            cookie_value = unquote(cookie_value)
                        
                        self.cookies[cookie.name] = cookie_value
                        loaded_count += 1
                        
                        # 特殊处理refresh_token
                        if cookie.name == "refresh_token":
                            self.refresh_token = cookie_value
                            if hasattr(cookie, 'expires_at') and cookie.expires_at:
                                self.expires_at = datetime.fromtimestamp(cookie.expires_at)
                    else:
                        print(f"[Cookie Persistence] 警告: cookie对象缺少name或value属性: {cookie}")
                
                print(f"[Cookie Persistence] 从数据库加载了{loaded_count}个cookie")
                
                return {
                    "success": True,
                    "message": f"从数据库加载了{loaded_count}个cookie",
                    "loaded_count": loaded_count
                }
            except Exception as e:
                print(f"[Cookie Persistence] 加载失败: {str(e)}")
                return {
                    "success": False,
                    "message": f"从数据库加载cookie失败: {str(e)}"
                }
            finally:
                db.close()
        except Exception as e:
            print(f"[Cookie Persistence] 初始化失败: {str(e)}")
            return {
                "success": False,
                "message": f"初始化数据库失败: {str(e)}"
            }
    
    async def clear_cookies(self) -> Dict[str, Any]:
        """
        清除所有cookie（优先级1核心功能）
        
        Returns:
            Dict[str, Any]: 清除结果
        """
        try:
            # 清除内存中的cookie
            cookie_count = len(self.cookies)
            self.cookies.clear()
            self.refresh_token = None
            self.refresh_csrf = None
            self.expires_at = None
            
            # 清除数据库中的cookie
            from src.database import SessionLocal
            from src.models.cookie import Cookie
            
            db = SessionLocal()
            try:
                db.query(Cookie).delete()
                db.commit()
                
                print(f"[Cookie Persistence] 清除了{cookie_count}个cookie（内存+数据库）")
                
                return {
                    "success": True,
                    "message": f"清除了{cookie_count}个cookie",
                    "cleared_count": cookie_count
                }
            except Exception as e:
                db.rollback()
                print(f"[Cookie Persistence] 清除数据库cookie失败: {str(e)}")
                return {
                    "success": False,
                    "message": f"清除数据库cookie失败: {str(e)}"
                }
            finally:
                db.close()
        except Exception as e:
            print(f"[Cookie Persistence] 清除失败: {str(e)}")
            return {
                "success": False,
                "message": f"清除cookie失败: {str(e)}"
            }
    
    def close(self):
        """关闭客户端"""
        self.client.close()