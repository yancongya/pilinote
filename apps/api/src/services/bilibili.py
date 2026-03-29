import httpx
from typing import Dict, Optional
from src.config import settings


class BilibiliService:
    def __init__(self):
        self.api_base = settings.bilibili_api_base
        self.passport_base = settings.bilibili_passport_base
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        self.client = httpx.Client(timeout=30.0, headers=self.headers)

    def get_qrcode(self) -> Dict:
        """获取登录二维码"""
        url = f"{self.passport_base}/x/passport-login/web/qrcode/generate"
        try:
            response = self.client.get(url)
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

    def query_qrcode_status(self, qrcode_key: str) -> Dict:
        """查询二维码登录状态"""
        url = f"{self.passport_base}/x/passport-login/web/qrcode/poll"
        params = {"qrcode_key": qrcode_key}
        response = self.client.get(url, params=params)
        data = response.json()

        code = data.get("data", {}).get("code")
        message_map = {
            86101: "未扫码",
            86090: "已扫码，请确认",
            0: "登录成功",
            86038: "二维码已过期"
        }

        if code == 0:
            # 登录成功，获取用户信息
            login_data = data.get("data", {})
            url = login_data.get("url", "")

            # 从响应中获取cookie
            cookies = response.cookies
            sessdata = cookies.get("SESSDATA") or login_data.get("refresh_token", "")

            if sessdata:
                # 获取用户详细信息
                try:
                    user_info = self.login_by_sessdata(sessdata)
                    if user_info.get("success"):
                        return {
                            "success": True,
                            "data": {
                                "code": 0,
                                **user_info.get("data", {}),
                                "sessdata": sessdata
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

    def login_by_sessdata(self, sessdata: str) -> Dict:
        """通过SESSDATA登录"""
        url = f"{self.api_base}/x/web-interface/nav"
        headers = {
            "Cookie": f"SESSDATA={sessdata}",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = self.client.get(url, headers=headers)
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

    def get_web_key(self) -> Dict:
        """获取密码加密密钥"""
        url = f"{self.passport_base}/x/passport-login/web/key"
        response = self.client.get(url)
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

    def login_by_password(self, username: str, password: str, token: Optional[str] = None,
                          challenge: Optional[str] = None, validate: Optional[str] = None,
                          seccode: Optional[str] = None) -> Dict:
        """通过密码登录"""
        url = f"{self.passport_base}/x/passport-login/web/login"

        form_data = {
            "username": username,
            "password": password,
            "keep": 0,
            "source": "main-fe-header",
            "go_url": "https://www.bilibili.com"
        }

        if token:
            form_data.update({
                "token": token,
                "challenge": challenge,
                "validate": validate,
                "seccode": seccode
            })

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        response = self.client.post(url, data=form_data, headers=headers)
        data = response.json()

        if data.get("code") == 0:
            login_data = data.get("data", {})
            if login_data.get("status") == 0:
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

    def send_sms_code(self, phone: str) -> Dict:
        """发送手机验证码"""
        url = f"{self.passport_base}/x/passport-login/web/sms/send"
        
        form_data = {
            "tel": phone,
            "cid": 86,
            "source": "main_web"
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        try:
            response = self.client.post(url, data=form_data, headers=headers)
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

    def login_by_sms(self, phone: str, code: str) -> Dict:
        """通过手机验证码登录"""
        url = f"{self.passport_base}/x/passport-login/web/login/sms"
        
        form_data = {
            "tel": phone,
            "code": code,
            "cid": 86,
            "source": "main_web",
            "keep": 0,
            "go_url": "https://www.bilibili.com"
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        try:
            response = self.client.post(url, data=form_data, headers=headers)
            data = response.json()
            
            if data.get("code") == 0:
                # 登录成功，获取用户信息
                login_data = data.get("data", {})
                url = login_data.get("url", "")
                
                # 从响应中获取cookie
                cookies = response.cookies
                sessdata = cookies.get("SESSDATA") or login_data.get("refresh_token", "")
                
                if sessdata:
                    # 获取用户详细信息
                    try:
                        user_info = self.login_by_sessdata(sessdata)
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

    def get_folder_list(self, sessdata: str, up_mid: int, page: int = 1, page_size: int = 20) -> Dict:
        """获取收藏夹列表"""
        url = f"{self.api_base}/x/v3/fav/folder/created/list"
        headers = {
            "Cookie": f"SESSDATA={sessdata}",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        params = {
            "pn": page,
            "ps": page_size,
            "up_mid": up_mid
        }
        
        try:
            response = self.client.get(url, headers=headers, params=params)
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

    def get_folder_detail(self, sessdata: str, media_id: int, page: int = 1, page_size: int = 20, 
                         keyword: str = "", order: str = "mtime", type: str = "0", tid: int = 0) -> Dict:
        """获取收藏夹详情"""
        url = f"{self.api_base}/x/v3/fav/resource/list"
        headers = {
            "Cookie": f"SESSDATA={sessdata}",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
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
            response = self.client.get(url, headers=headers, params=params)
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

    def get_watch_later(self, sessdata: str) -> Dict:
        """获取稍后再看列表（全部）"""
        url = f"{self.api_base}/x/v2/history/toview"
        headers = {
            "Cookie": f"SESSDATA={sessdata}",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        # 传递大参数获取全部数据，B站API默认只返回20个
        params = {
            "ps": 1000  # 获取1000个视频，确保覆盖全部
        }
        
        try:
            response = self.client.get(url, headers=headers, params=params)
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

    def close(self):
        """关闭HTTP客户端"""
        self.client.close()