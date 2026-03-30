# Copyright (c) 2025 PiliNote

import httpx
from typing import Dict, Optional, Any
from src.services.headers_manager import get_headers_manager


class GeetestService:
    """Geetest验证码服务（使用HeadersManager管理cookie）"""
    
    def __init__(self):
        self.client = httpx.Client(timeout=30.0)
        self.passport_base = "https://passport.bilibili.com"
        
        # 使用HeadersManager管理cookie
        self.headers_manager = get_headers_manager()
    
    async def get_captcha_params(self) -> Dict[str, Any]:
        """
        获取Geetest验证码参数（使用HeadersManager获取headers）
        
        Returns:
            Dict: 包含token, gt, challenge的字典
        """
        try:
            # 使用异步请求
            async_client = await self.headers_manager.get_client()
            response = await async_client.get(
                f"{self.passport_base}/x/passport-login/captcha",
                params={"source": "main-fe-header"}
            )
            
            # 调试：打印响应状态和内容
            print(f"[Geetest Debug] Status: {response.status_code}")
            print(f"[Geetest Debug] Content: {response.text[:500]}")
            
            data = response.json()
            
            if data.get("code") == 0 and data.get("data"):
                result_data = data["data"]
                geetest_data = result_data.get("geetest", {})
                
                return {
                    "success": True,
                    "data": {
                        "token": result_data.get("token", ""),
                        "gt": geetest_data.get("gt", ""),
                        "challenge": geetest_data.get("challenge", "")
                    }
                }
            else:
                return {
                    "success": False,
                    "message": data.get("message", "获取验证码参数失败")
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"获取验证码参数异常: {str(e)}"
            }
    
    def validate_captcha(self, challenge: str, validate: str, seccode: str) -> Dict[str, Any]:
        """验证Geetest验证码结果
        
        Args:
            challenge: Geetest挑战字符串
            validate: 验证结果
            seccode: 安全码
            
        Returns:
            Dict: 验证结果
        """
        # 这里可以添加额外的验证逻辑
        # 目前只返回基本信息，具体验证在前端完成
        if not all([challenge, validate, seccode]):
            return {
                "success": False,
                "message": "验证码参数不完整"
            }
        
        return {
            "success": True,
            "data": {
                "challenge": challenge,
                "validate": validate,
                "seccode": seccode
            }
        }
    
    async def send_sms_code(self, cid: str, tel: str, token: str, 
                      challenge: str, validate: str, seccode: str) -> Dict[str, Any]:
        """
        发送短信验证码（使用HeadersManager获取headers）
        
        Args:
            cid: 国家代码
            tel: 手机号码
            token: 验证码token
            challenge: Geetest挑战字符串
            validate: 验证结果
            seccode: 安全码
            
        Returns:
            Dict: 包含captcha_key的响应
        """
        try:
            # 使用异步请求
            async_client = await self.headers_manager.get_client()
            response = await async_client.post(
                f"{self.passport_base}/x/passport-login/web/sms/send",
                params={
                    "cid": cid,
                    "tel": tel,
                    "token": token,
                    "source": "main-fe-header",
                    "challenge": challenge,
                    "validate": validate,
                    "seccode": seccode
                }
            )
            data = response.json()
            
            if data.get("code") == 0 and data.get("data"):
                return {
                    "success": True,
                    "data": {
                        "captcha_key": data["data"].get("captcha_key", "")
                    },
                    "message": data.get("message", "短信发送成功")
                }
            else:
                return {
                    "success": False,
                    "message": data.get("message", "发送短信验证码失败")
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"发送短信验证码异常: {str(e)}"
            }
    
    def close(self):
        """关闭客户端"""
        self.client.close()