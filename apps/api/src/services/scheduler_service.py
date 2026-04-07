"""
定时任务服务（优先级2增强功能）

功能：
- 定时检查cookie有效期
- 自动刷新即将过期的cookie
- 支持多账号的定时刷新
- 定时清理临时文件
- 自动下载定时扫描
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path
import logging
import shutil

from src.services.bilibili import BilibiliService
from src.services.headers_manager import get_headers_manager
from src.services.scan_service import ScanService
from src.models.user import User
from src.models.cookie import Cookie
from src.database import SessionLocal

logger = logging.getLogger(__name__)


class SchedulerService:
    """定时任务服务"""
    
    def __init__(self):
        self.scheduler: Optional[BackgroundScheduler] = None
        self.auto_scan_job_id = 'auto_scan'
    
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
        
        # 添加定时任务：每小时清理一次临时文件
        self.scheduler.add_job(
            self.cleanup_old_temp_files,
            trigger=IntervalTrigger(hours=1),
            id='cleanup_temp_files',
            name='清理临时文件任务',
            replace_existing=True
        )
        
        # 添加定时任务：每5分钟检查并更新自动扫描配置
        self.scheduler.add_job(
            self.update_auto_scan_schedule,
            trigger=IntervalTrigger(minutes=5),
            id='update_auto_scan_schedule',
            name='更新自动扫描配置',
            replace_existing=True
        )
        
        # 初始化自动扫描任务
        self.update_auto_scan_schedule()
        
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
    
    def cleanup_old_temp_files(self):
        """
        清理超过24小时的临时文件
        
        目标：
        - temp/ 目录下的所有临时目录
        - temp/ 目录下的 .temp 后缀目录
        - temp/ 目录下的 .failed 和 .cancelled 目录
        """
        try:
            # 获取设置中的临时路径
            temp_path = self._get_temp_path()
            if not temp_path:
                logger.warning("[Scheduler] 无法获取临时路径，跳过清理")
                return
            
            temp_dir = Path(temp_path)
            if not temp_dir.exists():
                logger.info(f"[Scheduler] 临时目录不存在: {temp_dir}")
                return
            
            # 获取当前时间
            now = datetime.now()
            # 计算24小时前的时间
            cutoff_time = now - timedelta(hours=24)
            
            # 统计清理数量
            cleaned_count = 0
            skipped_count = 0
            
            # 遍历临时目录
            for item in temp_dir.iterdir():
                try:
                    # 只处理目录
                    if not item.is_dir():
                        continue
                    
                    # 获取修改时间
                    mod_time = datetime.fromtimestamp(item.stat().st_mtime)
                    
                    # 检查是否超过24小时
                    if mod_time < cutoff_time:
                        # 删除目录
                        shutil.rmtree(str(item))
                        cleaned_count += 1
                        logger.info(
                            f"[Scheduler] 清理临时目录: {item.name} "
                            f"(修改时间: {mod_time.strftime('%Y-%m-%d %H:%M:%S')})"
                        )
                    else:
                        skipped_count += 1
                        logger.debug(
                            f"[Scheduler] 跳过临时目录: {item.name} "
                            f"(修改时间: {mod_time.strftime('%Y-%m-%d %H:%M:%S')})"
                        )
                        
                except Exception as e:
                    logger.error(f"[Scheduler] 处理临时目录 {item} 时出错: {str(e)}")
            
            logger.info(
                f"[Scheduler] 临时文件清理完成 - "
                f"清理: {cleaned_count} 个, 跳过: {skipped_count} 个"
            )
            
        except Exception as e:
            logger.error(f"[Scheduler] 清理临时文件任务执行失败: {str(e)}")
    
    def _get_temp_path(self) -> Optional[str]:
        """
        获取临时路径
        
        Returns:
            临时路径，如果获取失败返回None
        """
        try:
            from src.services.settings_service import SettingsService
            
            with SessionLocal() as db:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                return settings.storage.temp_path
        except Exception as e:
            logger.warning(f"[Scheduler] 获取临时路径失败: {str(e)}")
            return None
    
    def update_auto_scan_schedule(self):
        """
        更新自动扫描的定时任务配置
        
        从设置中读取自动下载配置，动态调整扫描任务
        """
        try:
            from src.services.settings_service import SettingsService
            
            with SessionLocal() as db:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                auto_download = getattr(settings, 'auto_download', None)
                
                if not auto_download:
                    logger.debug("[Scheduler] 未找到自动下载配置")
                    self._remove_auto_scan_job()
                    return
                
                # 检查是否启用自动下载
                if not auto_download.get('enabled', False):
                    logger.debug("[Scheduler] 自动下载未启用")
                    self._remove_auto_scan_job()
                    return
                
                # 根据触发类型设置不同的定时任务
                trigger_type = auto_download.get('trigger_type', 'interval')
                
                if trigger_type == 'interval':
                    # 间隔执行
                    scan_interval = auto_download.get('scan_interval', 60)
                    self._schedule_interval_scan(scan_interval)
                elif trigger_type == 'cron':
                    # Cron 表达式
                    cron_expression = auto_download.get('cron_expression', '')
                    self._schedule_cron_scan(cron_expression)
                else:
                    logger.warning(f"[Scheduler] 未知的触发类型: {trigger_type}")
                    self._remove_auto_scan_job()
                    
        except Exception as e:
            logger.error(f"[Scheduler] 更新自动扫描配置失败: {str(e)}")
    
    def _schedule_interval_scan(self, minutes: int):
        """
        设置间隔扫描任务
        
        Args:
            minutes: 扫描间隔（分钟）
        """
        try:
            # 移除旧的定时任务
            self._remove_auto_scan_job()
            
            # 添加新的定时任务
            self.scheduler.add_job(
                self.perform_auto_scan,
                trigger=IntervalTrigger(minutes=minutes),
                id=self.auto_scan_job_id,
                name='自动扫描任务',
                replace_existing=True
            )
            
            logger.info(f"[Scheduler] 已设置间隔扫描任务，间隔: {minutes}分钟")
        except Exception as e:
            logger.error(f"[Scheduler] 设置间隔扫描任务失败: {str(e)}")
    
    def _schedule_cron_scan(self, cron_expression: str):
        """
        设置 Cron 扫描任务
        
        Args:
            cron_expression: Cron 表达式
        """
        try:
            if not cron_expression:
                logger.warning("[Scheduler] Cron 表达式为空，取消定时扫描")
                self._remove_auto_scan_job()
                return
            
            # 移除旧的定时任务
            self._remove_auto_scan_job()
            
            # 添加新的定时任务
            self.scheduler.add_job(
                self.perform_auto_scan,
                trigger=CronTrigger.from_crontab(cron_expression),
                id=self.auto_scan_job_id,
                name='自动扫描任务',
                replace_existing=True
            )
            
            logger.info(f"[Scheduler] 已设置 Cron 扫描任务，表达式: {cron_expression}")
        except Exception as e:
            logger.error(f"[Scheduler] 设置 Cron 扫描任务失败: {str(e)}")
    
    def _remove_auto_scan_job(self):
        """移除自动扫描任务"""
        try:
            if self.scheduler and self.scheduler.get_job(self.auto_scan_job_id):
                self.scheduler.remove_job(self.auto_scan_job_id)
                logger.debug("[Scheduler] 已移除自动扫描任务")
        except Exception as e:
            logger.error(f"[Scheduler] 移除自动扫描任务失败: {str(e)}")
    
    async def perform_auto_scan(self):
        """
        执行自动扫描
        
        扫描收藏夹和稍后再看，将新视频添加到队列
        """
        try:
            logger.info("[Scheduler] 开始执行自动扫描...")
            
            # 获取活跃用户
            db = SessionLocal()
            try:
                from src.services.settings_service import SettingsService
                
                active_user = db.query(User).filter(User.is_active == True).first()
                if not active_user:
                    logger.warning("[Scheduler] 未找到活跃用户，跳过扫描")
                    return
                
                # 获取用户配置的扫描源类型
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                auto_download = getattr(settings, 'auto_download', None)
                
                if not auto_download or not auto_download.get('enabled', False):
                    logger.debug("[Scheduler] 自动下载未启用，跳过扫描")
                    return
                
                # 创建扫描服务
                scan_service = ScanService(db)
                
                # 扫描收藏夹
                logger.info("[Scheduler] 开始扫描收藏夹...")
                try:
                    result = await scan_service.trigger_scan(
                        source_type='favorite',
                        source_id='all',
                        user_mid=active_user.mid
                    )
                    logger.info(f"[Scheduler] 收藏夹扫描完成: 总计={result.total}, 新视频={result.new}, 已添加={result.added}")
                except Exception as e:
                    logger.error(f"[Scheduler] 收藏夹扫描失败: {str(e)}")
                
                # 扫描稍后再看
                logger.info("[Scheduler] 开始扫描稍后再看...")
                try:
                    result = await scan_service.trigger_scan(
                        source_type='watch_later',
                        source_id='all',
                        user_mid=active_user.mid
                    )
                    logger.info(f"[Scheduler] 稍后再看扫描完成: 总计={result.total}, 新视频={result.new}, 已添加={result.added}")
                except Exception as e:
                    logger.error(f"[Scheduler] 稍后再看扫描失败: {str(e)}")
                
                logger.info("[Scheduler] 自动扫描完成")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"[Scheduler] 执行自动扫描失败: {str(e)}")


# 全局实例
scheduler_service = SchedulerService()