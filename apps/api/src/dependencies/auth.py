"""
公共认证依赖

统一的用户认证和 SESSDATA 获取逻辑，
避免在每个路由中重复相同的认证代码。
"""
from typing import Tuple
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from src.database import get_db
from src.models.user import User
from src.services.headers_manager import get_headers_manager


async def get_current_user_with_sessdata(
    db: Session = Depends(get_db)
) -> Tuple[User, str]:
    """获取当前活跃用户和 SESSDATA
    
    统一的认证逻辑，用于需要 B站 API 认证的路由。
    
    Args:
        db: 数据库会话
        
    Returns:
        Tuple[User, str]: (用户对象, SESSDATA)
        
    Raises:
        HTTPException: 401 未登录或未找到 SESSDATA
    """
    # 获取当前活跃用户
    active_user = db.query(User).filter(User.is_active == True).first()
    if not active_user:
        raise HTTPException(status_code=401, detail="未登录")
    
    # 从 HeadersManager 获取 sessdata
    headers_manager = get_headers_manager()
    
    # 同步活跃用户的 cookies 到内存
    try:
        await headers_manager.sync_cookies_from_db(active_user.id)
    except Exception:
        # 同步失败不影响后续获取 SESSDATA
        pass
    
    sessdata = headers_manager.get_cookie("SESSDATA")
    if not sessdata:
        raise HTTPException(status_code=401, detail="未找到登录凭证")
    
    return active_user, sessdata


async def get_current_user_with_refreshed_sessdata(
    db: Session = Depends(get_db)
) -> Tuple[User, str]:
    """获取当前活跃用户并刷新 SESSDATA
    
    与 get_current_user_with_sessdata 的区别在于：
    - 强制刷新 cookies 到内存
    - 确保后续请求可用最新的 cookies
    
    Args:
        db: 数据库会话
        
    Returns:
        Tuple[User, str]: (用户对象, SESSDATA)
        
    Raises:
        HTTPException: 401 未登录或未找到 SESSDATA
    """
    # 获取当前活跃用户
    active_user = db.query(User).filter(User.is_active == True).first()
    if not active_user:
        raise HTTPException(status_code=401, detail="未登录")
    
    # 从 HeadersManager 获取 sessdata
    headers_manager = get_headers_manager()
    
    # 同步活跃用户的 cookies 到内存
    try:
        await headers_manager.sync_cookies_from_db(active_user.id)
    except Exception:
        pass
    
    # 强制刷新 cookies
    try:
        await headers_manager.cookie_manager.load_from_db(active_user.id)
        await headers_manager.refresh()
    except Exception:
        pass
    
    sessdata = headers_manager.get_cookie("SESSDATA")
    if not sessdata:
        raise HTTPException(status_code=401, detail="未找到登录凭证")
    
    return active_user, sessdata