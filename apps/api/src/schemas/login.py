from pydantic import BaseModel, Field
from typing import Optional


class QrcodeResponse(BaseModel):
    url: str
    qrcode_key: str

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://qr.bili.com/...",
                "qrcode_key": "..."
            }
        }


class QrcodeStatusResponse(BaseModel):
    code: int
    message: str
    data: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "code": 0,
                "message": "success",
                "data": {"url": "https://www.bilibili.com"}
            }
        }


class SessdataLoginRequest(BaseModel):
    sessdata: str = Field(..., description="B站SESSDATA cookie")

    class Config:
        json_schema_extra = {
            "example": {
                "sessdata": "your-sessdata-here"
            }
        }


class SessdataLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "登录成功",
                "data": {
                    "mid": 123456789,
                    "username": "test",
                    "avatar": "https://..."
                }
            }
        }


class PasswordLoginRequest(BaseModel):
    username: str = Field(..., description="B站用户名/手机号/邮箱")
    password: str = Field(..., description="B站密码")
    token: Optional[str] = None
    challenge: Optional[str] = None
    validate: Optional[str] = None
    seccode: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "username": "test@example.com",
                "password": "password123"
            }
        }


class PasswordLoginResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "登录成功",
                "data": {
                    "mid": 123456789,
                    "username": "test",
                    "avatar": "https://..."
                }
            }
        }


class UserInfoResponse(BaseModel):
    mid: int
    username: str
    avatar: Optional[str] = None
    is_login: bool
    level: Optional[int] = None
    vip_status: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "mid": 123456789,
                "username": "test",
                "avatar": "https://...",
                "is_login": True,
                "level": 6,
                "vip_status": True
            }
        }