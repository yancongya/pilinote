from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from src.database import get_db
from src.schemas.login import (
    QrcodeResponse,
    QrcodeStatusResponse,
    SessdataLoginRequest,
    SessdataLoginResponse,
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
            # 确保data是字典类型
            if not isinstance(data, dict):
                return {
                    "success": False,
                    "message": f"返回数据格式错误: {type(data)}"
                }

            # 如果登录成功，保存用户信息到数据库
            if data.get("code") == 0 and "mid" in data:
                mid = data.get("mid")
                sessdata = data.get("sessdata", "")

                # 将所有用户设置为非活跃
                db.query(User).update({"is_active": False})

                existing_user = db.query(User).filter(User.mid == mid).first()
                if existing_user:
                    existing_user.sessdata = sessdata
                    existing_user.username = data.get("username", "")
                    existing_user.avatar = data.get("avatar", "")
                    existing_user.is_active = True
                    existing_user.last_refresh_time = datetime.now()
                    existing_user.updated_at = None
                    db.commit()
                else:
                    new_user = User(
                        mid=mid,
                        username=data.get("username", ""),
                        avatar=data.get("avatar", ""),
                        sessdata=sessdata,
                        is_active=True,
                        last_refresh_time=datetime.now()
                    )
                    db.add(new_user)
                    db.commit()
                    db.flush()

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
                existing_user.last_refresh_time = datetime.now()
                existing_user.updated_at = None
                db.commit()
                user_id = existing_user.id
            else:
                new_user = User(
                    mid=mid,
                    username=user_data["username"],
                    avatar=user_data.get("avatar"),
                    sessdata=user_data["sessdata"],
                    is_active=True,
                    last_refresh_time=datetime.now()
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
        raise HTTPException(
    status_code=400,
    detail={
        "message": result.get("message", "SESSDATA登录失败"),
        "success": False
    }
)
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
            # 确保user_data是字典类型
            if not isinstance(user_data, dict):
                raise HTTPException(status_code=500, detail=f"用户数据格式错误: {type(user_data)}")

            # 检查是否有必要的字段
            mid = user_data.get("mid")
            if not mid:
                # 如果没有mid，可能用户信息获取失败，返回基本登录成功信息
                return {
                    "success": True,
                    "message": "登录成功（未获取到用户信息）",
                    "data": {
                        "code": 0,
                        "sessdata": user_data.get("sessdata", "")
                    }
                }

            # 将所有用户设置为非活跃
            db.query(User).update({"is_active": False})

            existing_user = db.query(User).filter(User.mid == mid).first()
            if existing_user:
                existing_user.sessdata = user_data.get("sessdata", "")
                existing_user.username = user_data.get("username", "")
                existing_user.avatar = user_data.get("avatar")
                existing_user.is_active = True
                existing_user.last_refresh_time = datetime.now()
                existing_user.updated_at = None
                db.commit()
                user_id = existing_user.id
            else:
                new_user = User(
                    mid=mid,
                    username=user_data.get("username", ""),
                    avatar=user_data.get("avatar"),
                    sessdata=user_data.get("sessdata", ""),
                    is_active=True,
                    last_refresh_time=datetime.now()
                )
                db.add(new_user)
                db.commit()
                db.flush()
                user_id = new_user.id

            # 保存所有cookie到数据库（关联user_id）
            cookies_dict = service.headers_manager.cookie_manager.get_cookies()
            save_result = await service.headers_manager.cookie_manager.save_to_db(user_id)

            print(f"[SMS Login] 用户 {user_data.get('username', '')} (mid={mid}) 登录成功")
            print(f"[SMS Login] 保存了{save_result.get('saved_count', 0)}个cookie")

            return {
                "success": True,
                "message": "登录成功",
                "data": {
                    "code": 0,
                    "mid": user_data.get("mid"),
                    "username": user_data.get("username"),
                    "avatar": user_data.get("avatar"),
                    "level": user_data.get("level"),
                    "vip_status": user_data.get("vip_status"),
                    "sessdata": user_data.get("sessdata")
                }
            }
        raise HTTPException(
    status_code=400,
    detail={
        "message": result.get("message", "登录失败"),
        "code": result.get("code"),
        "success": False
    }
)
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
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_refresh_time": user.last_refresh_time.isoformat() if user.last_refresh_time else None
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
            
            if not user_info.get("success"):
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
    from datetime import datetime
    
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
        user_info_result = await service.get_user_info(user.sessdata)
        
        return {
            "success": True,
            "message": f"切换到账号: {user.username}",
            "data": {
                "mid": user.mid,
                "username": user.username,
                "avatar": user.avatar,
                "sessdata": user.sessdata,  # 添加sessdata字段
                "user_info": user_info_result.get("data", {}) if user_info_result.get("success") else {}
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


@router.post("/accounts/refresh", response_model=dict)
async def refresh_account(account_id: int, db: Session = Depends(get_db)):
    """
    刷新账号数据（Cookie/SESSDATA/WBI等）
    
    功能：
    - 刷新账号的cookie
    - 刷新SESSDATA
    - 刷新WBI签名
    - 更新用户信息
    - 保存到数据库
    - 更新刷新时间
    
    Args:
        account_id: 账号ID
        
    Returns:
        Dict: 刷新结果
    """
    from src.services.headers_manager import get_headers_manager
    from datetime import datetime
    from src.models.cookie import Cookie
    
    service = BilibiliService()
    try:
        # 查找目标账号
        user = db.query(User).filter(User.id == account_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="账号不存在")
        
        # 初始化 service
        await service.init()
        
        # 设置SESSDATA
        await service.headers_manager.update_cookie("SESSDATA", user.sessdata)
        
        # 检查并刷新cookie
        print(f"[Account Refresh] 开始刷新账号: {user.username} (mid={user.mid})")
        refresh_result = await service.headers_manager.check_and_refresh_cookies()

        if refresh_result.get("success"):
            print(f"[Account Refresh] Cookie刷新成功: {refresh_result.get('message')}")
        else:
            print(f"[Account Refresh] Cookie刷新失败: {refresh_result.get('message')}")

        # 访问B站首页和 nav 接口以获取完整的cookies（bili_jct, DedeUserID等）
        try:
            client = await service._get_client()

            # 访问首页
            response = await client.get("https://www.bilibili.com/")
            print(f"[Account Refresh] 访问首页获取cookies，状态码: {response.status_code}")

            # 访问 nav 接口
            response = await client.get("https://api.bilibili.com/x/web-interface/nav")
            print(f"[Account Refresh] 访问nav接口获取cookies，状态码: {response.status_code}")
        except Exception as e:
            print(f"[Account Refresh] 访问页面失败: {str(e)}")

        # 获取用户信息（验证有效性）
        user_info_result = await service.get_user_info(user.sessdata)

        if not user_info_result.get("success"):
            raise HTTPException(status_code=400, detail="SESSDATA无效或已过期")

        # 获取当前所有cookies
        cookies_dict = service.headers_manager.cookie_manager.get_cookies()

        # 保存 WBI 信息到 cookies
        user_info = user_info_result.get("data", {})
        wbi_img = user_info.get("wbi_img", {})
        if wbi_img.get("img_url"):
            await service.headers_manager.update_cookie("wbi_img_url", wbi_img.get("img_url"))
        if wbi_img.get("sub_url"):
            await service.headers_manager.update_cookie("wbi_sub_url", wbi_img.get("sub_url"))
        
        # 更新用户信息
        user_info = user_info_result.get("data", {})
        user.username = user_info.get("uname", user.username)
        user.avatar = user_info.get("face", user.avatar)
        user.bili_jct = cookies_dict.get("bili_jct", user.bili_jct)
        user.dedeuserid = cookies_dict.get("DedeUserID", user.dedeuserid)
        user.access_token = cookies_dict.get("access_token", user.access_token)
        user.last_refresh_time = datetime.now()  # 始终更新刷新时间（使用本地时区）
        user.updated_at = datetime.now()
        
        db.commit()
        
        # 保存所有cookie到数据库
        save_result = await service.headers_manager.cookie_manager.save_to_db(user.id)
        print(f"[Account Refresh] 保存了{save_result.get('saved_count', 0)}个cookie")
        
        print(f"[Account Refresh] 账号刷新成功: {user.username}")
        
        return {
            "success": True,
            "message": f"账号刷新成功: {user.username}",
            "data": {
                "mid": user.mid,
                "username": user.username,
                "avatar": user.avatar,
                "last_refresh_time": user.last_refresh_time.isoformat() if user.last_refresh_time else None,
                "user_info": user_info
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Account Refresh] 刷新失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"刷新账号失败: {str(e)}")
    finally:
        service.close()


@router.get("/accounts/refresh/status", response_model=dict)
async def get_refresh_status():
    """
    获取账号刷新服务状态

    Returns:
        Dict: 刷新服务状态
    """
    from src.services.account_refresh_service import get_account_refresh_service

    service = get_account_refresh_service()
    status = service.get_status()

    return {
        "success": True,
        "data": status
    }


@router.get("/accounts/{account_id}/credentials", response_model=dict)
async def get_account_credentials(account_id: int, db: Session = Depends(get_db)):
    """
    获取账号的验证数据（Cookie、SESSDATA、WBI等）

    Args:
        account_id: 账号ID

    Returns:
        Dict: 账号验证数据
    """
    from src.models.cookie import Cookie
    from src.services.headers_manager import get_headers_manager

    # 查找目标账号
    user = db.query(User).filter(User.id == account_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="账号不存在")

    # 获取该账号的所有cookies
    cookies = db.query(Cookie).filter(Cookie.user_id == account_id).all()

    # 构建cookies字典
    cookies_dict = {}
    for cookie in cookies:
        cookies_dict[cookie.name] = cookie.value

    # 从 cookies 中获取验证数据（优先从 cookies 表获取，因为 user 表可能没有更新）
    bili_jct = cookies_dict.get("bili_jct") or user.bili_jct
    dedeuserid = cookies_dict.get("DedeUserID") or user.dedeuserid
    access_token = cookies_dict.get("access_token") or user.access_token

    # 从WBI缓存中获取WBI签名
    wbi_img_url = cookies_dict.get("wbi_img_url", "")
    wbi_sub_url = cookies_dict.get("wbi_sub_url", "")

    return {
        "success": True,
        "data": {
            "mid": user.mid,
            "username": user.username,
            "sessdata": user.sessdata,
            "bili_jct": bili_jct,
            "dedeuserid": dedeuserid,
            "access_token": access_token,
            "cookies_count": len(cookies_dict),
            "cookies": cookies_dict,
            "wbi": {
                "img_url": wbi_img_url,
                "sub_url": wbi_sub_url
            }
        }
    }


@router.post("/accounts/refresh/start", response_model=dict)
async def start_refresh_service(interval: int = 3600):
    """
    启动账号刷新服务
    
    Args:
        interval: 刷新间隔（秒），默认1小时
        
    Returns:
        Dict: 启动结果
    """
    from src.services.account_refresh_service import get_account_refresh_service
    
    service = get_account_refresh_service()
    await service.start(interval)
    
    return {
        "success": True,
        "message": f"账号刷新服务已启动，刷新间隔: {interval}秒"
    }


@router.post("/accounts/refresh/stop", response_model=dict)
async def stop_refresh_service():
    """
    停止账号刷新服务
    
    Returns:
        Dict: 停止结果
    """
    from src.services.account_refresh_service import get_account_refresh_service
    
    service = get_account_refresh_service()
    await service.stop()
    
    return {
        "success": True,
        "message": "账号刷新服务已停止"
    }