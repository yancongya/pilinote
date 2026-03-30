"""
定时任务服务（优先级2增强功能）

功能：
- 定时检查cookie有效期
- 自动刷新即将过期的cookie
- 支持多账号的定时刷新
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from typing import Optional
import logging

from src.services.bilibili import BilibiliService
from src.services.headers_manager import get_headers_manager
from src.models.user import User
from src.models.cookie import Cookie
from src.database import SessionLocal

logger = logging.getLogger(__name__)


class SchedulerService:
    """定时任务服务"""
    
    def __init__(self):
        self.scheduler: Optional[BackgroundScheduler] = None
    
    def start(self):
        """启动定时任务"""
        if self.scheduler and self.scheduler.running:
            logger.warning("[Scheduler] 定时任务已经在运行")
            return
        
        # 创建调度器
        self.scheduler = BackgroundScheduler()
        
        # 添加定时任务：每30分钟检查一次cookie有效期
        self.scheduler.add_job(
            self.check_and_refresh_cookies,
            trigger=IntervalTrigger(minutes=30),
            id='refresh_cookies',
            name='刷新Cookie任务',
            replace_existing=True
        )
        
        # 启动调度器
        self.scheduler.start()
        logger.info("[Scheduler] 定时任务已启动")
    
    def stop(self):
        """停止定时任务"""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("[Scheduler] 定时任务已停止")
    
    async def check_and_refresh_cookies(self):
        """
        检查并刷新cookie
        
        任务：
        1. 查询所有用户
        2. 检查每个用户的cookie是否即将过期
        3. 如果即将过期，尝试刷新
        4. 刷新成功后保存到数据库
        """
        db = SessionLocal()
        try:
            # 查询所有用户
            users = db.query(User).all()
            
            logger.info(f"[Scheduler] 开始检查 {len(users)} 个用户的cookie有效期")
            
            for user in users:
                try:
                    # 检查该用户的cookie是否即将过期（30天内）
                    cookies = db.query(Cookie).filter(Cookie.user_id == user.id).all()
                    
                    needs_refresh = False
                    for cookie in cookies:
                        if cookie.expires_at:
                            expires_at = datetime.fromtimestamp(cookie.expires_at)
                            now = datetime.now()
                            
                            # 如果cookie在30天内过期，需要刷新
                            if expires_at - now < timedelta(days=30):
                                needs_refresh = True
                                logger.info(
                                    f"[Scheduler] 用户 {user.username} 的cookie "
                                    f"{cookie.name} 即将过期 (过期时间: {expires_at})"
                                )
                                break
                    
                    if needs_refresh and user.sessdata:
                        logger.info(f"[Scheduler] 尝试刷新用户 {user.username} 的cookie")
                        
                        # 切换到该用户
                        headers_manager = get_headers_manager()
                        await headers_manager.cookie_manager.clear_cookies()
                        await headers_manager.cookie_manager.set_cookie("SESSDATA", user.sessdata)
                        await headers_manager.refresh()
                        
                        # 刷新cookie
                        service = BilibiliService()
                        try:
                            refresh_result = await service.refresh_cookie()
                            
                            if refresh_result.get("success"):
                                logger.info(f"[Scheduler] 用户 {user.username} 的cookie刷新成功")
                                
                                # 保存刷新后的cookie到数据库
                                save_result = await service.headers_manager.cookie_manager.save_to_db(user.id)
                                
                                if save_result.get("success"):
                                    logger.info(
                                        f"[Scheduler] 用户 {user.username} 的cookie已保存到数据库，"
                                        f"共 {save_result.get('count', 0)} 个cookie"
                                    )
                            else:
                                logger.warning(
                                    f"[Scheduler] 用户 {user.username} 的cookie刷新失败: "
                                    f"{refresh_result.get('message', '未知错误')}"
                                )
                        finally:
                            service.close()
                except Exception as e:
                    logger.error(f"[Scheduler] 检查用户 {user.username} 时发生错误: {str(e)}")
            
            logger.info("[Scheduler] Cookie检查完成")
            
        except Exception as e:
            logger.error(f"[Scheduler] 定时任务执行失败: {str(e)}")
        finally:
            db.close()


# 全局实例
scheduler_service = SchedulerService()