import httpx
from typing import Dict, Optional
from src.config import settings
from src.services.headers_manager import get_headers_manager, init_headers
from src.utils.crypto import CryptoUtils
from src.utils.rsa_utils import RSAUtils


class BilibiliService:
    def __init__(self):
        self.api_base = settings.bilibili_api_base
        self.passport_base = settings.bilibili_passport_base
        
        # 使用HeadersManager（完全复刻BiliTools的HEADERS机制）
        self.headers_manager = get_headers_manager()
        
        # 创建HTTP客户端（不带默认headers，headers动态获取）
        self.client = httpx.Client(timeout=30.0, follow_redirects=True)
    
    async def _get_client(self) -> httpx.AsyncClient:
        """
        获取配置好headers和cookies的异步HTTP客户端
        
        Returns:
            httpx.AsyncClient: 配置好的HTTP客户端
        """
        return await self.headers_manager.get_client()
    
    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        """
        使用异步客户端发送请求的辅助方法
        
        Args:
            method: HTTP方法 (GET, POST等)
            url: 请求URL
            **kwargs: 其他参数
            
        Returns:
            httpx.Response: HTTP响应
        """
        async_client = await self._get_client()
        return await async_client.request(method, url, **kwargs)
    
    async def init(self) -> Dict:
        """
        初始化BilibiliService（完全复刻BiliTools的init流程）
        
        这是必须调用的方法，在创建BilibiliService后立即调用。
        它会初始化指纹系统、获取必要的cookie，并设置headers。
        
        Returns:
            Dict: 初始化结果
        """
        return await init_headers()
    
    async def check_and_refresh_cookies(self) -> Dict:
        """
        检查并刷新cookie（使用HeadersManager）
        
        Returns:
            Dict: 刷新结果
        """
        return await self.headers_manager.check_and_refresh_cookies()
    
    # Week 4: 参数签名和RSA加密
    def sign_params(self, params: Dict) -> Dict:
        """为参数添加签名（Week 4: 加密和签名增强）"""
        return CryptoUtils.add_signature(params)
    
    def encrypt_password(self, password: str, key_hash: str = "") -> Dict[str, str]:
        """RSA加密密码（Week 4: 加密和签名增强）
        
        Args:
            password: 原始密码
            key_hash: 密钥哈希（可选）
            
        Returns:
            Dict: 加密后的密码信息
        """
        encrypted_password, hash_value = RSAUtils.encrypt_password(password, key_hash)
        return {
            "password": encrypted_password,
            "hash": hash_value
        }

    async def get_qrcode(self) -> Dict:
        """获取登录二维码（使用HeadersManager的request方法）"""
        url = f"{self.passport_base}/x/passport-login/web/qrcode/generate"
        try:
            # 使用异步请求
            response = await self._request("GET", url)
            print(f"Response status: {response.status_code}")
            print(f"Response text: {response.text[:500]}")

            if response.status_code != 200:
                return {
                    "success": False,
                    "message": f"HTTP错误: {response.status_code}"
                }

            data = response.json()

            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取二维码失败")
            }
        except Exception as e:
            print(f"获取二维码异常: {str(e)}")
            return {
                "success": False,
                "message": f"获取二维码异常: {str(e)}"
            }

    async def query_qrcode_status(self, qrcode_key: str) -> Dict:
        """查询二维码登录状态（使用HeadersManager）"""
        url = f"{self.passport_base}/x/passport-login/web/qrcode/poll"
        params = {"qrcode_key": qrcode_key}

        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)
            data = response.json()

            code = data.get("data", {}).get("code")
            message_map = {
                86101: "未扫码",
                86090: "已扫码，请确认",
                0: "登录成功",
                86038: "二维码已过期"
            }

            if code == 0:
                # 登录成功，处理cookie
                login_data = data.get("data", {})
                url = login_data.get("url", "")
                
                # 从响应中获取所有cookies
                cookies_dict = dict(response.cookies)
                
                # 从响应数据中获取refresh_token
                refresh_token = login_data.get("refresh_token", "")
                sessdata = cookies_dict.get("SESSDATA", "") or refresh_token
                
                if cookies_dict:
                    # 更新headers_manager中的cookies
                    await self.headers_manager.update_cookies(cookies_dict)
                    
                    # 如果有refresh_token，也保存
                    if refresh_token:
                        from src.services.cookie_manager import CookieManager
                        cookie_manager = CookieManager()
                        cookie_manager.set_refresh_token(refresh_token)
                    
                    # 获取用户详细信息
                    try:
                        user_info = await self.login_by_sessdata(sessdata)
                        if user_info.get("success"):
                            # 先提取用户信息，然后确保sessdata不为空
                            user_data = user_info.get("data", {})
                            # 确保使用原始的sessdata（从cookie中获取的）
                            user_data["sessdata"] = sessdata
                            
                            return {
                                "success": True,
                                "data": {
                                    "code": 0,
                                    **user_data,
                                    "refresh_token": refresh_token
                                }
                            }
                    except Exception as e:
                        print(f"获取用户信息失败: {e}")
                
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            
            return {
                "success": False,
                "code": code,
                "message": message_map.get(code, "未知状态")
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"查询二维码状态异常: {str(e)}"
            }

    async def login_by_sessdata(self, sessdata: str) -> Dict:
        """通过SESSDATA登录（使用HeadersManager管理cookie）"""
        # 设置SESSDATA到headers_manager
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        # 检查并刷新cookie
        refresh_result = await self.headers_manager.check_and_refresh_cookies()
        
        url = f"{self.api_base}/x/web-interface/nav"
        headers = await self.headers_manager.get_headers()
        
        # 使用异步请求
        response = await self._request("GET", url)
        data = response.json()

        if data.get("code") == 0 and data.get("data", {}).get("isLogin"):
            user_info = data.get("data", {})
            return {
                "success": True,
                "data": {
                    "mid": user_info.get("mid"),
                    "username": user_info.get("uname"),
                    "avatar": user_info.get("face"),
                    "level": user_info.get("level_info", {}).get("current_level"),
                    "vip_status": user_info.get("vip", {}).get("status"),
                    "sessdata": sessdata
                }
            }
        return {
            "success": False,
            "message": "SESSDATA无效或已过期"
        }

    async def get_web_key(self) -> Dict:
        """获取密码加密密钥（使用HeadersManager获取headers）"""
        url = f"{self.passport_base}/x/passport-login/web/key"
        
        # 使用异步请求
        response = await self._request("GET", url)
        data = response.json()

        if data.get("code") == 0:
            return {
                "success": True,
                "data": data.get("data", {})
            }
        return {
            "success": False,
            "message": data.get("message", "获取密钥失败")
        }

    async def login_by_password(self, username: str, password: str, token: Optional[str] = None,
                          challenge: Optional[str] = None, validate: Optional[str] = None,
                          seccode: Optional[str] = None) -> Dict:
        """通过密码登录（使用HeadersManager管理cookie）"""
        url = f"{self.passport_base}/x/passport-login/web/login"

        # RSA加密密码
        key_hash = ""
        try:
            # 获取加密密钥
            key_result = await self.get_web_key()
            if key_result["success"]:
                key_data = key_result["data"]
                key_hash = key_data.get("hash", "")
            
            # 加密密码
            encrypted_data = self.encrypt_password(password, key_hash)
            encrypted_password = encrypted_data["password"]
            key_hash = encrypted_data["hash"]
        except Exception as e:
            # 加密失败，使用原始密码（向后兼容）
            encrypted_password = password

        form_data = {
            "username": username,
            "password": encrypted_password,
            "source": "main-fe-header",
            "go_url": "https://www.bilibili.com/"
        }
        
        # 如果使用了RSA加密，添加密钥哈希
        if key_hash:
            form_data["key_hash"] = key_hash

        # 添加Geetest验证码参数（如果有）
        if token:
            form_data.update({
                "token": token,
                "challenge": challenge,
                "validate": validate,
                "seccode": seccode
            })

        # 添加参数签名
        try:
            signed_params = self.sign_params(form_data)
            form_data.update(signed_params)
        except Exception as e:
            # 签名失败，继续使用未签名的参数
            pass

        headers = await self.headers_manager.get_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"

        # 使用异步客户端
        async_client = await self._get_client()
        response = await async_client.post(url, data=form_data, headers=headers)
        data = response.json()
        
        # 添加调试日志
        print(f"[Password Login Debug] Response code: {data.get('code')}, message: {data.get('message')}")
        print(f"[Password Login Debug] Full response: {data}")

        if data.get("code") == 0:
            login_data = data.get("data", {})
            if login_data.get("status") == 0:
                # 保存refresh_token和cookies
                refresh_token = login_data.get("refresh_token", "")
                cookies_dict = dict(response.cookies)
                
                if cookies_dict:
                    await self.headers_manager.update_cookies(cookies_dict)
                
                if refresh_token:
                    from src.services.cookie_manager import CookieManager
                    cookie_manager = CookieManager()
                    cookie_manager.set_refresh_token(refresh_token)
                
                return {
                    "success": True,
                    "data": login_data
                }
            return {
                "success": False,
                "message": login_data.get("message", "登录失败"),
                "data": login_data
            }
        return {
            "success": False,
            "message": data.get("message", "登录失败")
        }

    async def send_sms_code(self, phone: str) -> Dict:
        """发送手机验证码（使用HeadersManager获取headers）"""
        url = f"{self.passport_base}/x/passport-login/web/sms/send"
        
        form_data = {
            "tel": phone,
            "cid": 86,
            "source": "main_web"
        }
        
        # 使用异步请求
        try:
            response = await self._request("POST", url, data=form_data)
            data = response.json()
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "发送验证码失败")
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"发送验证码异常: {str(e)}"
            }

    async def login_by_sms(self, phone: str, code: str, captcha_key: str = "") -> Dict:
        """通过手机验证码登录（使用HeadersManager管理cookie）"""
        url = f"{self.passport_base}/x/passport-login/web/login/sms"
        
        params = {
            "cid": 86,
            "tel": phone,
            "code": code,
            "source": "main-fe-header",
            "captcha_key": captcha_key,
            "keep": "true"
        }
        
        # 使用异步请求
        try:
            response = await self._request("POST", url, params=params)
            data = response.json()
            
            # 添加调试日志
            print(f"[SMS Login Debug] Response code: {data.get('code')}, message: {data.get('message')}")
            print(f"[SMS Login Debug] Full response: {data}")
            
            if data.get("code") == 0:
                # 登录成功，处理cookie
                login_data = data.get("data", {})
                cookies_dict = dict(response.cookies)
                sessdata = cookies_dict.get("SESSDATA") or login_data.get("refresh_token", "")
                
                if cookies_dict:
                    await self.headers_manager.update_cookies(cookies_dict)
                
                if sessdata:
                    # 获取用户详细信息
                    try:
                        user_info = await self.login_by_sessdata(sessdata)
                        if user_info.get("success"):
                            return {
                                "success": True,
                                "data": {
                                    **user_info.get("data", {}),
                                    "sessdata": sessdata
                                }
                            }
                    except Exception as e:
                        print(f"获取用户信息失败: {e}")
                
                return {
                    "success": True,
                    "data": {
                        "code": 0,
                        "sessdata": sessdata
                    }
                }
            return {
                "success": False,
                "message": data.get("message", "登录失败")
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"登录异常: {str(e)}"
            }

    async def get_folder_list(self, sessdata: str, up_mid: int, page: int = 1, page_size: int = 20) -> Dict:
        """获取收藏夹列表（使用HeadersManager获取headers）"""
        # 确保SESSDATA在headers中
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        url = f"{self.api_base}/x/v3/fav/folder/created/list"
        headers = await self.headers_manager.get_headers()
        
        params = {
            "pn": page,
            "ps": page_size,
            "up_mid": up_mid
        }
        
        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)
            data = response.json()
            print(f"收藏夹列表响应: {data}")
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取收藏夹列表失败"),
                "code": data.get("code")
            }
        except Exception as e:
            print(f"获取收藏夹列表异常: {str(e)}")
            return {
                "success": False,
                "message": f"获取收藏夹列表异常: {str(e)}"
            }

    async def get_folder_detail(self, sessdata: str, media_id: int, page: int = 1, page_size: int = 20, 
                         keyword: str = "", order: str = "mtime", type: str = "0", tid: int = 0) -> Dict:
        """获取收藏夹详情（使用HeadersManager获取headers）"""
        # 确保SESSDATA在headers中
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        url = f"{self.api_base}/x/v3/fav/resource/list"
        headers = await self.headers_manager.get_headers()
        
        params = {
            "media_id": media_id,
            "pn": page,
            "ps": page_size,
            "keyword": keyword,
            "order": order,
            "type": type,
            "tid": tid
        }
        
        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)
            data = response.json()
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取收藏夹详情失败")
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"获取收藏夹详情异常: {str(e)}"
            }

    async def get_watch_later(self, sessdata: str) -> Dict:
        """获取稍后再看列表（全部，使用HeadersManager获取headers）"""
        # 确保SESSDATA在headers中
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        url = f"{self.api_base}/x/v2/history/toview"
        headers = await self.headers_manager.get_headers()
        
        # 传递大参数获取全部数据，B站API默认只返回20个
        params = {
            "ps": 1000  # 获取1000个视频，确保覆盖全部
        }
        
        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)
            data = response.json()
            print(f"稍后再看列表响应: {data}")
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取稍后再看列表失败"),
                "code": data.get("code")
            }
        except Exception as e:
            print(f"获取稍后再看列表异常: {str(e)}")
            return {
                "success": False,
                "message": f"获取稍后再看列表异常: {str(e)}"
            }

    async def get_collected_folders(self, sessdata: str, up_mid: int, page: int = 1, page_size: int = 20) -> Dict:
        """获取用户订阅的收藏夹列表（使用HeadersManager获取headers）"""
        # 确保SESSDATA在headers中
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        url = f"{self.api_base}/x/v3/fav/folder/collected/list"
        headers = await self.headers_manager.get_headers()
        
        params = {
            "up_mid": up_mid,
            "pn": page,
            "ps": page_size
        }
        
        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)
            data = response.json()
            print(f"订阅收藏夹列表响应: {data}")
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取订阅收藏夹列表失败"),
                "code": data.get("code")
            }
        except Exception as e:
            print(f"获取订阅收藏夹列表异常: {str(e)}")
            return {
                "success": False,
                "message": f"获取订阅收藏夹列表异常: {str(e)}"
            }

    async def get_user_info(self, sessdata: str) -> Dict:
        """获取用户信息（使用HeadersManager获取headers）"""
        # 确保SESSDATA在headers中
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        url = f"{self.api_base}/x/web-interface/nav"
        headers = await self.headers_manager.get_headers()
        
        try:
            # 使用异步请求
            response = await self._request("GET", url)
            data = response.json()
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取用户信息失败"),
                "code": data.get("code")
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"获取用户信息异常: {str(e)}"
            }

    async def get_classroom_episodes(self, season_id: int, sessdata: str, page: int = 1, page_size: int = 20) -> Dict:
        """获取课程下的视频列表（使用HeadersManager获取headers）"""
        # 确保SESSDATA在headers中
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        # 使用B站PUGV课程系统API
        url = f"{self.api_base}/pugv/view/web/ep/list"
        headers = await self.headers_manager.get_headers()
        
        params = {
            "season_id": season_id,
            "pn": page,
            "ps": page_size
        }
        
        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)
            data = response.json()
            print(f"课程视频列表响应: {data}")
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取课程视频列表失败"),
                "code": data.get("code")
            }
        except Exception as e:
            print(f"获取课程视频列表异常: {str(e)}")
            return {
                "success": False,
                "message": f"获取课程视频列表异常: {str(e)}"
            }

    async def get_classroom_detail(self, season_id: int, sessdata: str) -> Dict:
        """获取课程详细信息（使用HeadersManager获取headers）"""
        # 确保SESSDATA在headers中
        await self.headers_manager.update_cookie("SESSDATA", sessdata)
        
        # 使用B站PUGV课程系统API获取课程详情
        url = f"{self.api_base}/pugv/view/web/season"
        headers = await self.headers_manager.get_headers()
        
        params = {
            "season_id": season_id
        }
        
        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)
            data = response.json()
            print(f"课程详情响应: {data}")
            
            if data.get("code") == 0:
                return {
                    "success": True,
                    "data": data.get("data", {})
                }
            return {
                "success": False,
                "message": data.get("message", "获取课程详情失败"),
                "code": data.get("code")
            }
        except Exception as e:
            print(f"获取课程详情异常: {str(e)}")
            return {
                "success": False,
                "message": f"获取课程详情异常: {str(e)}"
            }

    async def refresh_cookie(self) -> Dict:
        """
        使用refresh_token自动刷新cookie（复刻BiliTools的refresh_cookie功能）
        
        Returns:
            Dict: 刷新结果
        """
        try:
            # 获取当前的cookies
            cookies_dict = self.headers_manager.cookie_manager.get_cookies()
            
            # 检查是否有refresh_token和bili_jct
            refresh_token = cookies_dict.get("refresh_token")
            bili_csrf = cookies_dict.get("bili_jct")
            
            if not refresh_token:
                return {
                    "success": False,
                    "message": "缺少refresh_token，无法刷新cookie"
                }
            
            if not bili_csrf:
                return {
                    "success": False,
                    "message": "缺少bili_jct，无法刷新cookie"
                }
            
            # 调用B站的cookie刷新接口
            url = "https://passport.bilibili.com/x/passport-login/web/cookie/refresh"
            params = {
                "csrf": bili_csrf,
                "refresh_csrf": refresh_token,
                "refresh_token": refresh_token,
                "source": "main_web"
            }
            
            async_client = await self._get_client()
            response = await async_client.post(url, params=params)
            
            print(f"[Cookie Refresh] Response status: {response.status_code}")
            print(f"[Cookie Refresh] Response text: {response.text[:500]}")
            
            # 检查响应
            if response.status_code != 200:
                return {
                    "success": False,
                    "message": f"HTTP错误: {response.status_code}"
                }
            
            data = response.json()
            print(f"[Cookie Refresh] Response code: {data.get('code')}, message: {data.get('message')}")
            
            if data.get("code") == 0:
                # 刷新成功，处理新的cookies
                response_cookies = dict(response.cookies)
                
                # 更新cookie管理器
                for name, value in response_cookies.items():
                    await self.headers_manager.cookie_manager.set_cookie(name, value)
                
                # 刷新headers
                await self.headers_manager.refresh()
                
                print(f"[Cookie Refresh] Cookie刷新成功，更新了{len(response_cookies)}个cookie")
                
                return {
                    "success": True,
                    "message": "Cookie刷新成功",
                    "data": {
                        "refreshed_cookies": list(response_cookies.keys())
                    }
                }
            else:
                # 刷新失败，可能是refresh_token过期
                error_message = data.get("message", "刷新失败")
                return {
                    "success": False,
                    "message": f"Cookie刷新失败: {error_message}",
                    "code": data.get("code"),
                    "need_relogin": True  # 需要重新登录
                }
                
        except Exception as e:
            print(f"[Cookie Refresh] 刷新异常: {str(e)}")
            return {
                "success": False,
                "message": f"Cookie刷新异常: {str(e)}",
                "need_relogin": True
            }

    async def get_uploader_info(self, uploader_mid: int, sessdata: str = "") -> Dict:
        """获取UP主信息（使用HeadersManager获取headers）- 参考BiliTools getUserInfo实现

        Args:
            uploader_mid: UP主MID
            sessdata: SESSDATA（可选）

        Returns:
            Dict: UP主信息，包含name、mid、avatar
        """
        # 确保SESSDATA在headers中
        if sessdata:
            await self.headers_manager.update_cookie("SESSDATA", sessdata)

        # 使用B站空间API（参考BiliTools）
        url = f"{self.api_base}/x/space/wbi/acc/info"
        headers = await self.headers_manager.get_headers()

        # 添加WBI签名（如果需要）
        params = {
            "mid": uploader_mid
        }

        try:
            # 使用异步请求
            response = await self._request("GET", url, params=params)

            # 尝试解析JSON，处理编码问题
            try:
                data = response.json()
            except Exception as json_error:
                # 如果JSON解析失败，尝试使用更宽松的编码
                try:
                    import json
                    content = response.content.decode('utf-8', errors='ignore')
                    data = json.loads(content)
                except Exception as decode_error:
                    return {
                        "success": False,
                        "message": f"解析响应数据失败: {str(json_error)}, {str(decode_error)}"
                    }

            if data.get("code") == 0:
                info = data.get("data", {})
                return {
                    "success": True,
                    "data": {
                        "name": info.get("name"),
                        "mid": info.get("mid"),
                        "avatar": info.get("face")  # face字段是头像URL
                    }
                }
            return {
                "success": False,
                "message": data.get("message", "获取UP主信息失败"),
                "code": data.get("code")
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"获取UP主信息异常: {str(e)}"
            }

    async def get_video_info(self, bvid: str, sessdata: str = "") -> Dict:
        """获取视频详情信息（使用HTML解析方法）

        Args:
            bvid: 视频BV号
            sessdata: SESSDATA（可选）

        Returns:
            Dict: 视频详情信息，包含desc、stat等
        """
        import re
        import json

        # 确保SESSDATA在headers中
        if sessdata:
            await self.headers_manager.update_cookie("SESSDATA", sessdata)

        # 获取headers
        headers = await self.headers_manager.get_headers()
        headers["Referer"] = f"https://www.bilibili.com/video/{bvid}"

        try:
            # 使用HTML解析方法（绕过API限制）
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(
                    f"https://www.bilibili.com/video/{bvid}",
                    headers=headers
                )
                response.raise_for_status()
                html = response.text

                # 从HTML中提取__INITIAL_STATE__数据
                patterns = [
                    r'__INITIAL_STATE__\s*=\s*({.*?});',
                    r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                    r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>'
                ]

                data = None
                for pattern in patterns:
                    match = re.search(pattern, html)
                    if match:
                        try:
                            data = json.loads(match.group(1))
                            break
                        except json.JSONDecodeError:
                            continue

                if not data or 'videoData' not in data:
                    return {
                        "success": False,
                        "message": "无法从页面中提取视频信息"
                    }

                video_data = data['videoData']

                return {
                    "success": True,
                    "data": {
                        "desc": video_data.get("desc", ""),
                        "stat": video_data.get("stat", {}),
                        "owner": video_data.get("owner", {}),
                        "pic": video_data.get("pic", ""),
                        "title": video_data.get("title", ""),
                        "pubdate": video_data.get("pubdate", 0)
                    }
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"获取视频信息失败: {str(e)}"
            }

    def close(self):
        """关闭HTTP客户端"""
        self.client.close()