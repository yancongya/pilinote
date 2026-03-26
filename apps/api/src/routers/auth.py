from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from src.database import get_db
from src.schemas.login import (
    QrcodeResponse,
    QrcodeStatusResponse,
    SessdataLoginRequest,
    SessdataLoginResponse,
    PasswordLoginRequest,
    PasswordLoginResponse,
    UserInfoResponse,
)
from src.services.bilibili import BilibiliService
from src.models.user import User

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.get("/qrcode", response_model=dict)
async def get_qrcode():
    """获取登录二维码"""
    service = BilibiliService()
    try:
        result = service.get_qrcode()
        if result["success"]:
            data = result["data"]
            return {
                "success": True,
                "data": {
                    "url": data.get("url"),
                    "qrcode_key": data.get("qrcode_key")
                }
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()


@router.get("/qrcode/status/{qrcode_key}", response_model=dict)
async def query_qrcode_status(qrcode_key: str, db: Session = Depends(get_db)):
    """查询二维码登录状态"""
    service = BilibiliService()
    try:
        result = service.query_qrcode_status(qrcode_key)
        if result["success"]:
            data = result["data"]

            # 如果登录成功，保存用户信息到数据库
            if data.get("code") == 0 and "mid" in data:
                mid = data["mid"]
                sessdata = data.get("sessdata", "")

                existing_user = db.query(User).filter(User.mid == mid).first()
                if existing_user:
                    existing_user.sessdata = sessdata
                    existing_user.username = data.get("username", "")
                    existing_user.avatar = data.get("avatar", "")
                    existing_user.updated_at = None
                    db.commit()
                else:
                    new_user = User(
                        mid=mid,
                        username=data.get("username", ""),
                        avatar=data.get("avatar", ""),
                        sessdata=sessdata
                    )
                    db.add(new_user)
                    db.commit()

                # 返回用户信息，包含code字段
                return {
                    "success": True,
                    "data": {
                        "code": 0,
                        "mid": data.get("mid"),
                        "username": data.get("username"),
                        "avatar": data.get("avatar"),
                        "level": data.get("level"),
                        "vip_status": data.get("vip_status"),
                        "sessdata": sessdata
                    }
                }

            return {
                "success": True,
                "data": data
            }
        return {
            "success": False,
            "code": result.get("code"),
            "message": result["message"]
        }
    finally:
        service.close()


@router.post("/sessdata", response_model=dict)
async def login_by_sessdata(request: SessdataLoginRequest, db: Session = Depends(get_db)):
    """通过SESSDATA登录"""
    service = BilibiliService()
    try:
        result = service.login_by_sessdata(request.sessdata)
        if result["success"]:
            user_data = result["data"]
            mid = user_data["mid"]

            existing_user = db.query(User).filter(User.mid == mid).first()
            if existing_user:
                existing_user.sessdata = user_data["sessdata"]
                existing_user.username = user_data["username"]
                existing_user.avatar = user_data.get("avatar")
                existing_user.updated_at = None
                db.commit()
            else:
                new_user = User(
                    mid=mid,
                    username=user_data["username"],
                    avatar=user_data.get("avatar"),
                    sessdata=user_data["sessdata"]
                )
                db.add(new_user)
                db.commit()

            return {
                "success": True,
                "message": "登录成功",
                "data": {
                    "mid": user_data["mid"],
                    "username": user_data["username"],
                    "avatar": user_data.get("avatar"),
                    "level": user_data.get("level"),
                    "vip_status": user_data.get("vip_status")
                }
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()


@router.post("/password", response_model=dict)
async def login_by_password(request: PasswordLoginRequest, db: Session = Depends(get_db)):
    """通过密码登录"""
    service = BilibiliService()
    try:
        result = service.login_by_password(
            request.username,
            request.password,
            request.token,
            request.challenge,
            request.validate,
            request.seccode
        )
        if result["success"]:
            return {
                "success": True,
                "message": "登录成功",
                "data": result["data"]
            }
        raise HTTPException(status_code=400, detail=result.get("message", "登录失败"))
    finally:
        service.close()


@router.get("/user-info", response_model=dict)
async def get_user_info(sessdata: str, db: Session = Depends(get_db)):
    """获取用户信息"""
    service = BilibiliService()
    try:
        result = service.login_by_sessdata(sessdata)
        if result["success"]:
            user_data = result["data"]
            return {
                "success": True,
                "data": {
                    "mid": user_data["mid"],
                    "username": user_data["username"],
                    "avatar": user_data.get("avatar"),
                    "is_login": True,
                    "level": user_data.get("level"),
                    "vip_status": user_data.get("vip_status")
                }
            }
        return {
            "success": False,
            "data": {
                "is_login": False
            }
        }
    finally:
        service.close()


@router.get("/proxy/avatar")
async def proxy_avatar(url: str):
    """代理获取B站头像，解决403防盗链问题"""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 添加必要的请求头，模拟浏览器访问
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.bilibili.com"
            }
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                # 获取内容类型
                content_type = response.headers.get("content-type", "image/jpeg")
                return StreamingResponse(
                    response.aiter_bytes(),
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=3600"  # 缓存1小时
                    }
                )
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch avatar")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching avatar: {str(e)}")