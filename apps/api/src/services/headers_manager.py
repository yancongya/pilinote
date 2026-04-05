"""
Headers管理器 - 完全复刻BiliTools的HEADERS机制

BiliTools使用全局HEADERS单例来管理所有HTTP请求的headers，
包括cookie的自动刷新和管理。这个模块实现相同的功能。
"""
import time
from typing import Dict, Optional
import httpx
from src.services.fingerprint_manager import FingerprintManager
from src.services.cookie_manager import CookieManager


class HeadersManager:
    """全局Headers管理器（单例模式）"""
    
    _instance: Optional['HeadersManager'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # 基础headers（模仿BiliTools的默认headers）
        self.base_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/",
            "Origin": "https://www.bilibili.com",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "Sec-Ch-Ua": '"Chromium";v="132", "Google Chrome";v="132", "Not:A-Brand";v="24"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"'
        }
        
        # Cookie管理器
        self.cookie_manager = CookieManager()
        
        # 当前headers缓存
        self._cached_headers: Optional[Dict[str, str]] = None
        self._cache_time: float = 0
        
        # 创建异步HTTP客户端（用于内部使用）
        self._async_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
        
        # 指纹管理器（传递async_client作为参数）
        self.fingerprint_manager = FingerprintManager(async_client=self._async_client)
        
        # 初始化标志
        self._initialized = True
    
    async def init(self) -> Dict:
        """
        初始化Headers系统（完全复刻BiliTools的init流程）
        
        BiliTools的初始化顺序：
        1. get_buvid() - 获取设备指纹
        2. get_bili_ticket() - 获取BiliTicket签名
        3. get_uuid() - 生成UUID
        4. HEADERS.refresh() - 刷新headers
        
        Returns:
            Dict: 初始化结果
        """
        try:
            # Step 1: 获取buvid指纹
            buvid_result = await self.fingerprint_manager.generate_buvid()
            if not buvid_result.get("success"):
                return {
                    "success": False,
                    "message": f"获取buvid失败: {buvid_result.get('message')}"
                }
            
            # Step 2: 获取bili_ticket
            bili_csrf = self.fingerprint_manager.get_bili_csrf()
            if bili_csrf:
                ticket_result = await self.fingerprint_manager.generate_bili_ticket(bili_csrf)
                if not ticket_result.get("success"):
                    print(f"获取bili_ticket失败: {ticket_result.get('message')}")
            
            # Step 3: 生成UUID
            uuid_result = await self.fingerprint_manager.generate_uuid()
            if not uuid_result.get("success"):
                print(f"生成UUID失败: {uuid_result.get('message')}")
            
            # 将fingerprint_manager中的cookies复制到cookie_manager
            fingerprint_cookies = self.fingerprint_manager.get_cookies()
            for name, value in fingerprint_cookies.items():
                self.cookie_manager.set_cookie(name, value)
            
            # 加载活跃用户的cookies从数据库
            try:
                from src.database import SessionLocal
                from src.models.user import User
                
                db = SessionLocal()
                try:
                    active_user = db.query(User).filter(User.is_active == True).first()
                    if active_user:
                        load_result = await self.cookie_manager.load_from_db(active_user.id)
                        if load_result.get("success"):
                            print(f"[HeadersManager] 从数据库加载了{load_result.get('loaded_count', 0)}个用户cookie")
                finally:
                    db.close()
            except Exception as e:
                print(f"[HeadersManager] 加载用户cookie失败: {str(e)}")
            
            # Step 4: 刷新headers
            await self.refresh()
            
            return {
                "success": True,
                "message": "Headers初始化成功"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Headers初始化异常: {str(e)}"
            }
    
    async def refresh(self) -> None:
        """
        刷新headers（完全复刻BiliTools的refresh方法）
        
        BiliTools的refresh()方法：
        1. 从cookie存储加载所有cookies
        2. 构建cookie字符串
        3. 更新headers中的Cookie字段
        4. 通知前端headers已更新
        """
        try:
            # 从cookie管理器加载所有cookies
            cookies_dict = self.cookie_manager.get_cookies()
            
            # 构建cookie字符串
            cookie_string = "; ".join([f"{k}={v}" for k, v in cookies_dict.items()])
            
            # 构建完整headers
            self._cached_headers = {
                **self.base_headers,
                "Cookie": cookie_string
            }
            
            # 更新缓存时间
            self._cache_time = time.time()
            
            print(f"Headers刷新成功，包含{len(cookies_dict)}个cookie")
        except Exception as e:
            print(f"Headers刷新异常: {str(e)}")
            # 即使失败也要设置基础headers
            self._cached_headers = self.base_headers.copy()
            self._cache_time = time.time()
    
    async def get_headers(self) -> Dict[str, str]:
        """
        获取当前headers（带缓存机制）
        
        Returns:
            Dict[str, str]: headers字典
        """
        # 如果缓存过期（超过60秒），刷新headers
        if self._cached_headers is None or time.time() - self._cache_time > 60:
            await self.refresh()
        
        return self._cached_headers.copy()
    
    def get_headers_sync(self) -> Dict[str, str]:
        """
        同步获取headers（用于非异步场景）
        
        Returns:
            Dict[str, str]: headers字典
        """
        if self._cached_headers is None:
            # 如果没有缓存，返回基础headers
            return self.base_headers.copy()
        
        return self._cached_headers.copy()
    
    async def get_client(self) -> httpx.AsyncClient:
        """
        获取配置好headers和cookies的异步HTTP客户端
        
        Returns:
            httpx.AsyncClient: 配置好的HTTP客户端
        """
        # 获取最新的headers
        headers = await self.get_headers()
        
        # 获取cookies
        cookies = self.cookie_manager.get_cookies()
        
        # 创建新的客户端实例
        client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers=headers,
            cookies=cookies
        )
        
        return client
    
    async def request(self, method: str, url: str, **kwargs) -> httpx.Response:
        """
        使用HeadersManager发起HTTP请求（确保headers和cookies是最新的）
        
        Args:
            method: HTTP方法（GET, POST等）
            url: 请求URL
            **kwargs: 其他httpx请求参数
            
        Returns:
            httpx.Response: HTTP响应
        """
        # 获取最新的headers
        headers = await self.get_headers()
        
        # 更新请求headers
        if "headers" not in kwargs:
            kwargs["headers"] = {}
        kwargs["headers"].update(headers)
        
        # 更新cookies
        cookies = self.cookie_manager.get_cookies()
        if cookies:
            if "cookies" not in kwargs:
                kwargs["cookies"] = {}
            kwargs["cookies"].update(cookies)
        
        # 使用内部客户端发起请求
        response = await self._async_client.request(method, url, **kwargs)
        
        # 打印响应信息用于调试
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        return response
    
    async def update_cookie(self, name: str, value: str) -> None:
        """
        更新单个cookie并刷新headers
        
        Args:
            name: cookie名称
            value: cookie值
        """
        self.cookie_manager.set_cookie(name, value)
        await self.refresh()
    
    async def update_cookies(self, cookies: Dict[str, str]) -> None:
        """
        批量更新cookie并刷新headers
        
        Args:
            cookies: cookie字典
        """
        for name, value in cookies.items():
            self.cookie_manager.set_cookie(name, value)
        await self.refresh()
    
    def get_cookie(self, name: str) -> Optional[str]:
        """
        获取单个cookie值
        
        Args:
            name: cookie名称
            
        Returns:
            Optional[str]: cookie值，如果不存在返回None
        """
        return self.cookie_manager.get_cookie(name)
    
    def get_cookies(self) -> Dict[str, str]:
        """
        获取所有cookies
        
        Returns:
            Dict[str, str]: cookie字典
        """
        return self.cookie_manager.get_cookies()
    
    async def check_and_refresh_cookies(self) -> Dict:
        """
        检查并刷新cookie（集成到headers管理）
        
        Returns:
            Dict: 刷新结果
        """
        try:
            if self.cookie_manager.should_refresh():
                bili_csrf = self.cookie_manager.get_cookie("bili_jct")
                if bili_csrf:
                    result = await self.cookie_manager.refresh_cookies(bili_csrf)
                    if result["success"]:
                        await self.refresh()
                        return result
                return {
                    "success": True,
                    "message": "Cookie仍有效，无需刷新"
                }
            else:
                return {
                    "success": True,
                    "message": "Cookie仍有效，无需刷新"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"检查cookie状态异常: {str(e)}"
            }


# 全局单例
_headers_manager: Optional[HeadersManager] = None


def get_headers_manager() -> HeadersManager:
    """
    获取全局HeadersManager单例
    
    Returns:
        HeadersManager: 全局headers管理器
    """
    global _headers_manager
    if _headers_manager is None:
        _headers_manager = HeadersManager()
    return _headers_manager


async def init_headers() -> Dict:
    """
    初始化全局headers系统
    
    Returns:
        Dict: 初始化结果
    """
    manager = get_headers_manager()
    return await manager.init()


async def get_headers() -> Dict[str, str]:
    """
    获取全局headers
    
    Returns:
        Dict[str, str]: headers字典
    """
    manager = get_headers_manager()
    return await manager.get_headers()