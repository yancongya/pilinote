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
    SmsCodeRequest,
    SmsCodeWithCaptchaRequest,
    SmsLoginRequest,
)
from src.services.bilibili import BilibiliService
from src.services.geetest_service import GeetestService
from src.models.user import User

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.post("/init", response_model=dict)
async def init_fingerprint():
    """初始化指纹系统（使用HeadersManager）"""
    service = BilibiliService()
    try:
        result = await service.init()
        return result
    finally:
        service.close()


@router.post("/refresh/cookies", response_model=dict)
async def refresh_cookies():
    """检查并刷新cookie（使用HeadersManager）"""
    service = BilibiliService()
    try:
        result = await service.check_and_refresh_cookies()
        return result
    finally:
        service.close()


# Week 3: Geetest验证支持
@router.get("/captcha/params", response_model=dict)
async def get_captcha_params():
    """获取Geetest验证码参数（使用HeadersManager）"""
    from src.services.headers_manager import init_headers
    try:
        # 初始化HeadersManager
        await init_headers()
        
        service = GeetestService()
        try:
            result = await service.get_captcha_params()
            if result["success"]:
                return {
                    "success": True,
                    "data": result["data"]
                }
            raise HTTPException(status_code=400, detail=result["message"])
        finally:
            service.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取验证码参数失败: {str(e)}")


@router.post("/captcha/validate", response_model=dict)
def validate_captcha(challenge: str, validate: str, seccode: str):
    """验证Geetest验证码结果（Week 3: Geetest验证支持）"""
    service = GeetestService()
    try:
        result = service.validate_captcha(challenge, validate, seccode)
        if result["success"]:
            return {
                "success": True,
                "data": result["data"]
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()


@router.post("/sms/send", response_model=dict)
async def send_sms_code_with_captcha(request: SmsCodeWithCaptchaRequest):
    """发送手机验证码（支持Geetest验证，使用HeadersManager）"""
    from src.services.headers_manager import init_headers
    try:
        # 初始化HeadersManager
        await init_headers()
        
        service = GeetestService()
        try:
            result = await service.send_sms_code(
                request.cid, 
                request.tel, 
                request.token, 
                request.challenge, 
                request.geetest_validate, 
                request.seccode
            )
            if result["success"]:
                return {
                    "success": True,
                    "data": result["data"],
                    "message": result["message"]
                }
            raise HTTPException(status_code=400, detail=result["message"])
        finally:
            service.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"发送短信验证码失败: {str(e)}")


@router.get("/qrcode", response_model=dict)
async def get_qrcode():
    """获取登录二维码（使用HeadersManager）"""
    service = BilibiliService()
    try:
        # 初始化HeadersManager
        await service.init()
        
        result = await service.get_qrcode()
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
    """查询二维码登录状态（使用HeadersManager）"""
    service = BilibiliService()
    try:
        # 初始化HeadersManager
        await service.init()
        
        result = await service.query_qrcode_status(qrcode_key)
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
    """通过SESSDATA登录（使用HeadersManager）"""
    service = BilibiliService()
    try:
        # 初始化HeadersManager
        await service.init()
        
        result = await service.login_by_sessdata(request.sessdata)
        if result["success"]:
            user_data = result["data"]
            mid = user_data["mid"]

            # 检查用户是否已存在
            existing_user = db.query(User).filter(User.mid == mid).first()
            
            # 将所有用户设置为非活跃
            db.query(User).update({"is_active": False})
            
            if existing_user:
                existing_user.sessdata = user_data["sessdata"]
                existing_user.username = user_data["username"]
                existing_user.avatar = user_data.get("avatar")
                existing_user.is_active = True
                existing_user.updated_at = None
                db.commit()
                user_id = existing_user.id
            else:
                new_user = User(
                    mid=mid,
                    username=user_data["username"],
                    avatar=user_data.get("avatar"),
                    sessdata=user_data["sessdata"],
                    is_active=True
                )
                db.add(new_user)
                db.commit()
                db.flush()
                user_id = new_user.id
            
            # 保存所有cookie到数据库（关联user_id）
            cookies_dict = service.headers_manager.cookie_manager.get_cookies()
            save_result = await service.headers_manager.cookie_manager.save_to_db(user_id)
            
            print(f"[Login] 用户 {user_data['username']} (mid={mid}) 登录成功")
            print(f"[Login] 保存了{save_result.get('saved_count', 0)}个cookie")

            return {
                "success": True,
                "message": "登录成功",
                "data": {
                    "mid": user_data["mid"],
                    "username": user_data["username"],
                    "avatar": user_data.get("avatar"),
                    "level": user_data.get("level"),
                    "vip_status": user_data.get("vip_status"),
                    "sessdata": user_data["sessdata"]  # 添加sessdata字段
                }
            }
        raise HTTPException(status_code=400, detail=result["message"])
    finally:
        service.close()


@router.post("/password", response_model=dict)
async def login_by_password(request: PasswordLoginRequest, db: Session = Depends(get_db)):
    """通过密码登录（使用HeadersManager）"""
    service = BilibiliService()
    try:
        # 初始化HeadersManager
        await service.init()
        
        result = await service.login_by_password(
            request.username,
            request.password,
            request.token,
            request.challenge,
            request.geetest_validate,
            request.seccode
        )
        if result["success"]:
            return {
                "success": True,
                "message": "登录成功",
                "data": result["data"]
            }
        
        # 检查是否为验证码错误
        message = result.get("message", "登录失败")
        if "验证码" in message:
            raise HTTPException(
                status_code=422, 
                detail={
                    "message": "密码登录需要验证码",
                    "error_type": "captcha_required",
                    "hint": "请使用扫码登录或SESSDATA登录方式"
                }
            )
        
        raise HTTPException(status_code=400, detail=message)
    finally:
        service.close()


@router.post("/sms/login", response_model=dict)
async def login_by_sms(request: SmsLoginRequest, db: Session = Depends(get_db)):
    """通过手机验证码登录（使用HeadersManager）"""
    service = BilibiliService()
    try:
        # 初始化HeadersManager
        await service.init()
        
        result = await service.login_by_sms(request.phone, request.code, request.captcha_key)
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
                    "code": 0,
                    "mid": user_data["mid"],
                    "username": user_data["username"],
                    "avatar": user_data.get("avatar"),
                    "level": user_data.get("level"),
                    "vip_status": user_data.get("vip_status"),
                    "sessdata": user_data["sessdata"]
                }
            }
        raise HTTPException(status_code=400, detail=result.get("message", "登录失败"))
    finally:
        service.close()


@router.get("/user-info", response_model=dict)
async def get_user_info(sessdata: str, db: Session = Depends(get_db)):
    """获取用户信息（使用HeadersManager）"""
    service = BilibiliService()
    try:
        # 初始化HeadersManager
        await service.init()
        
        result = await service.login_by_sessdata(sessdata)
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


@router.post("/refresh-cookie", response_model=dict)
async def refresh_cookie():
    """
    使用refresh_token自动刷新cookie（优先级1核心功能）
    
    功能：
    - 使用refresh_token刷新过期的cookie
    - 自动更新新的refresh_token
    - 刷新失败时提示需要重新登录
    
    Returns:
        Dict: 刷新结果
    """
    service = BilibiliService()
    try:
        result = await service.refresh_cookie()
        return result
    finally:
        service.close()


@router.post("/logout", response_model=dict)
async def logout(db: Session = Depends(get_db)):
    """
    退出登录（优先级1核心功能）
    
    功能：
    - 通知B站账号登出
    - 清理本地Cookie
    - 更新前端登录状态
    - 清除用户的is_active状态
    
    Returns:
        Dict: 登出结果
    """
    service = BilibiliService()
    try:
        # 清除所有用户的is_active状态
        db.query(User).update({"is_active": False})
        db.commit()
        
        # 获取当前cookies
        cookies_dict = service.headers_manager.cookie_manager.get_cookies()
        bili_csrf = cookies_dict.get("bili_jct")
        
        if not bili_csrf:
            # 如果没有bili_csrf，直接清理本地cookie
            await service.headers_manager.cookie_manager.clear_cookies()
            await service.headers_manager.refresh()
            return {
                "success": True,
                "message": "已清理本地cookie"
            }
        
        # 通知B站账号登出
        url = "https://passport.bilibili.com/login/exit/v2"
        params = {"biliCSRF": bili_csrf}
        
        async_client = await service._get_client()
        await async_client.post(url, params=params)
        
        # 清理本地cookie
        await service.headers_manager.cookie_manager.clear_cookies()
        await service.headers_manager.refresh()
        
        print("[Logout] 退出登录成功")
        
        return {
            "success": True,
            "message": "退出登录成功"
        }
    except Exception as e:
        # 即使退出请求失败，也要清理本地cookie和is_active状态
        db.query(User).update({"is_active": False})
        db.commit()
        
        await service.headers_manager.cookie_manager.clear_cookies()
        await service.headers_manager.refresh()
        
        print(f"[Logout] 退出登录异常（已清理本地数据）: {str(e)}")
        
        return {
            "success": True,
            "message": "退出登录成功（通知服务异常，但已清理本地数据）"
        }
    finally:
        service.close()


@router.get("/accounts", response_model=dict)
async def get_accounts(db: Session = Depends(get_db)):
    """
    获取账号列表（优先级2增强功能）
    
    功能：
    - 获取所有已登录的账号
    - 标识当前活跃账号
    
    Returns:
        Dict: 账号列表
    """
    try:
        # 查询所有用户
        users = db.query(User).order_by(User.created_at.desc()).all()
        
        accounts_list = []
        for user in users:
            accounts_list.append({
                "id": user.id,
                "mid": user.mid,
                "username": user.username,
                "avatar": user.avatar,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None
            })
        
        return {
            "success": True,
            "data": {
                "accounts": accounts_list,
                "total": len(accounts_list)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取账号列表失败: {str(e)}")


@router.get("/status", response_model=dict)
async def get_login_status(db: Session = Depends(get_db)):
    """
    获取登录状态（优先级2增强功能）
    
    功能：
    - 检查当前登录状态
    - 返回当前活跃账号信息
    - 检测cookie有效性
    
    Returns:
        Dict: 登录状态信息
    """
    from src.services.headers_manager import get_headers_manager
    
    service = BilibiliService()
    try:
        # 查找活跃用户
        active_user = db.query(User).filter(User.is_active == True).first()
        
        if not active_user:
            return {
                "success": True,
                "data": {
                    "is_logged_in": False,
                    "message": "未登录"
                }
            }
        
        # 检查cookie有效性
        headers_manager = get_headers_manager()
        cookies_dict = headers_manager.cookie_manager.get_cookies()
        
        has_sessdata = "SESSDATA" in cookies_dict and cookies_dict["SESSDATA"]
        
        if not has_sessdata:
            return {
                "success": True,
                "data": {
                    "is_logged_in": False,
                    "message": "Cookie已失效",
                    "user": {
                        "id": active_user.id,
                        "mid": active_user.mid,
                        "username": active_user.username,
                        "avatar": active_user.avatar
                    }
                }
            }
        
        # 尝试获取用户信息以验证登录状态
        try:
            user_info = await service.get_user_info(cookies_dict["SESSDATA"])
            
            if user_info.get("code") != 0:
                return {
                    "success": True,
                    "data": {
                        "is_logged_in": False,
                        "message": f"登录已失效: {user_info.get('message', '未知错误')}",
                        "user": {
                            "id": active_user.id,
                            "mid": active_user.mid,
                            "username": active_user.username,
                            "avatar": active_user.avatar
                        }
                    }
                }
            
            # 登录有效
            return {
                "success": True,
                "data": {
                    "is_logged_in": True,
                    "message": "已登录",
                    "user": {
                        "id": active_user.id,
                        "mid": active_user.mid,
                        "username": active_user.username,
                        "avatar": active_user.avatar,
                        "user_info": user_info.get("data", {})
                    }
                }
            }
        except Exception as e:
            return {
                "success": True,
                "data": {
                    "is_logged_in": False,
                    "message": f"验证登录状态失败: {str(e)}",
                    "user": {
                        "id": active_user.id,
                        "mid": active_user.mid,
                        "username": active_user.username,
                        "avatar": active_user.avatar
                    }
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取登录状态失败: {str(e)}")
    finally:
        service.close()


@router.post("/accounts/switch", response_model=dict)
async def switch_account(account_id: int, db: Session = Depends(get_db)):
    """
    切换账号（优先级2增强功能）
    
    功能：
    - 切换到指定账号
    - 加载该账号的cookie
    - 设置为活跃账号
    
    Args:
        account_id: 账号ID
        
    Returns:
        Dict: 切换结果
    """
    from src.services.headers_manager import get_headers_manager
    
    service = BilibiliService()
    try:
        # 查找目标账号
        user = db.query(User).filter(User.id == account_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="账号不存在")
        
        # 将所有用户设置为非活跃
        db.query(User).update({"is_active": False})
        
        # 设置目标账号为活跃
        user.is_active = True
        db.commit()
        
        # 获取全局headers_manager
        headers_manager = get_headers_manager()
        
        # 清除当前cookie
        await headers_manager.cookie_manager.clear_cookies()
        
        # 从数据库加载该账号的cookie
        load_result = await headers_manager.cookie_manager.load_from_db(user.id)
        
        # 设置SESSDATA到HeadersManager（注意：set_cookie是同步方法）
        if user.sessdata:
            headers_manager.cookie_manager.set_cookie("SESSDATA", user.sessdata)
            await headers_manager.refresh()
        
        # 更新用户信息
        user_info = await service.get_user_info(user.sessdata)
        
        
        return {
            "success": True,
            "message": f"切换到账号: {user.username}",
            "data": {
                "mid": user.mid,
                "username": user.username,
                "avatar": user.avatar,
                "sessdata": user.sessdata,  # 添加sessdata字段
                "user_info": user_info.get("data", {})
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"切换账号失败: {str(e)}")
    finally:
        service.close()


@router.delete("/accounts/{account_id}", response_model=dict)
async def delete_account(account_id: int, db: Session = Depends(get_db)):
    """
    删除账号（优先级2增强功能）
    
    功能：
    - 删除指定账号
    - 清理该账号的cookie
    
    Args:
        account_id: 账号ID
        
    Returns:
        Dict: 删除结果
    """
    from src.services.headers_manager import get_headers_manager
    
    try:
        # 查找目标账号
        user = db.query(User).filter(User.id == account_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="账号不存在")
        
        username = user.username
        mid = user.mid
        
        # 如果删除的是当前活跃账号，清除所有cookie
        if user.is_active:
            headers_manager = get_headers_manager()
            await headers_manager.cookie_manager.clear_cookies()
            await headers_manager.refresh()
        
        # 删除用户
        db.delete(user)
        db.commit()
        
        # 删除该用户的所有cookie
        from src.models.cookie import Cookie
        db.query(Cookie).filter(Cookie.user_id == account_id).delete()
        db.commit()
        
        print(f"[Account Delete] 删除账号: {username} (mid={mid})")
        
        return {
            "success": True,
            "message": f"已删除账号: {username}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除账号失败: {str(e)}")