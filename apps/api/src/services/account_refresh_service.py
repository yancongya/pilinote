"""
账号刷新服务

功能：
- 定时刷新账号的cookie
- 自动刷新SESSDATA
- 自动刷新WBI签名
- 支持多个账号轮询
"""
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from src.database import engine
from src.models.user import User
from src.services.bilibili import BilibiliService
from src.services.headers_manager import get_headers_manager
import logging

logger = logging.getLogger(__name__)


class AccountRefreshService:
    """账号刷新服务"""
    
    def __init__(self):
        self.is_running = False
        self.refresh_interval = 3600  # 默认1小时刷新一次
        self.task: Optional[asyncio.Task] = None
    
    async def start(self, interval: int = 3600):
        """
        启动刷新服务
        
        Args:
            interval: 刷新间隔（秒），默认1小时
        """
        if self.is_running:
            logger.warning("账号刷新服务已经在运行中")
            return
        
        self.is_running = True
        self.refresh_interval = interval
        
        logger.info(f"启动账号刷新服务，刷新间隔: {interval}秒")
        
        self.task = asyncio.create_task(self._refresh_loop())
    
    async def stop(self):
        """停止刷新服务"""
        if not self.is_running:
            return
        
        self.is_running = False
        
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        
        logger.info("账号刷新服务已停止")
    
    async def _refresh_loop(self):
        """刷新循环"""
        while self.is_running:
            try:
                await self._refresh_all_accounts()
            except Exception as e:
                logger.error(f"刷新账号时出错: {e}")
            
            # 等待下一次刷新
            await asyncio.sleep(self.refresh_interval)
    
    async def _refresh_all_accounts(self):
        """刷新所有账号"""
        with Session(engine) as db:
            # 获取所有活跃账号
            users = db.query(User).filter(User.is_active == True).all()
            
            if not users:
                logger.info("没有活跃账号需要刷新")
                return
            
            logger.info(f"开始刷新 {len(users)} 个账号")
            
            for user in users:
                try:
                    await self._refresh_account(user.id, db)
                except Exception as e:
                    logger.error(f"刷新账号 {user.username} 失败: {e}")
    
    async def _refresh_account(self, account_id: int, db: Session):
        """
        刷新单个账号
        
        Args:
            account_id: 账号ID
            db: 数据库会话
        """
        from src.models.cookie import Cookie
        
        user = db.query(User).filter(User.id == account_id).first()
        if not user:
            logger.warning(f"账号 {account_id} 不存在")
            return
        
        service = BilibiliService()
        try:
            # 初始化 service
            await service.init()
            
            # 设置SESSDATA
            await service.headers_manager.update_cookie("SESSDATA", user.sessdata)
            
            # 检查并刷新cookie
            refresh_result = await service.headers_manager.check_and_refresh_cookies()
            
            if refresh_result.get("success"):
                logger.info(f"账号 {user.username} cookie刷新成功")
            else:
                logger.warning(f"账号 {user.username} cookie刷新失败: {refresh_result.get('message')}")
            
            # 获取用户信息（验证有效性）
            user_info_result = await service.get_user_info(user.sessdata)
            
            if not user_info_result.get("success"):
                logger.warning(f"账号 {user.username} SESSDATA无效或已过期")
                return
            
            # 获取当前所有cookies
            cookies_dict = service.headers_manager.cookie_manager.get_cookies()
            
            # 更新用户信息
            user_info = user_info_result.get("data", {})
            user.username = user_info.get("uname", user.username)
            user.avatar = user_info.get("face", user.avatar)
            user.bili_jct = cookies_dict.get("bili_jct", user.bili_jct)
            user.dedeuserid = cookies_dict.get("DedeUserID", user.dedeuserid)
            user.access_token = cookies_dict.get("access_token", user.access_token)
            user.last_refresh_time = datetime.now()
            user.updated_at = datetime.now()
            
            db.commit()
            
            # 保存所有cookie到数据库
            save_result = await service.headers_manager.cookie_manager.save_to_db(user.id)
            
            logger.info(f"账号 {user.username} 刷新成功，保存了 {save_result.get('saved_count', 0)} 个cookie")
            
        except Exception as e:
            logger.error(f"刷新账号 {user.username} 时出错: {e}")
        finally:
            service.close()
    
    def get_status(self) -> Dict:
        """
        获取服务状态
        
        Returns:
            Dict: 服务状态信息
        """
        return {
            "is_running": self.is_running,
            "refresh_interval": self.refresh_interval
        }
    
    def set_refresh_interval(self, interval: int):
        """
        设置刷新间隔
        
        Args:
            interval: 刷新间隔（秒）
        """
        self.refresh_interval = interval
        logger.info(f"刷新间隔已更新为: {interval}秒")


# 全局单例
_account_refresh_service: Optional[AccountRefreshService] = None


def get_account_refresh_service() -> AccountRefreshService:
    """
    获取全局账号刷新服务单例
    
    Returns:
        AccountRefreshService: 账号刷新服务实例
    """
    global _account_refresh_service
    if _account_refresh_service is None:
        _account_refresh_service = AccountRefreshService()
    return _account_refresh_service