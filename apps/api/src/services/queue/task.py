import asyncio
from typing import Dict, List
from pathlib import Path
from datetime import datetime
import logging

from src.models.task import Task, TaskState
from src.schemas.task import SubTask, SubTaskType
from src.services.bilibili import BilibiliService
from src.database import SessionLocal

logger = logging.getLogger(__name__)


class TaskService:
    """任务服务 - 管理单个任务的执行"""

    def __init__(self, task: Task):
        self.task = task
        self.task_id = task.id  # 保存 task_id，避免后续访问分离的对象
        self._cancelled = False
        self._progress_cancelled = False  # 用于停止进度广播

    async def _progress_broadcaster(self):
        """定期广播进度到前端"""
        from src.routers.websocket import broadcast_task_progress
        from src.services.queue.manager import queue_manager

        print(f"=== _progress_broadcaster() called: task_id={self.task_id} ===")
        logger.info(f"📡 进度广播器启动: task_id={self.task_id}")
        print(f"=== 进度广播器启动: task_id={self.task_id} ===")

        while not self._progress_cancelled:
            try:
                # 从 queue_manager 获取最新的任务状态
                task = queue_manager.tasks.get(self.task_id)
                if not task:
                    logger.warning(f"任务 {self.task_id} 不存在于 queue_manager 中")
                    break

                # 检查任务状态
                if task.state != TaskState.ACTIVE:
                    logger.info(f"任务状态不是 ACTIVE，停止广播: state={task.state}")
                    break

                progress = task.status.get('progress', 0)
                speed = task.status.get('speed', 0)
                eta = task.status.get('eta', 0)

                print(f"=== 进度广播器循环: progress={progress}%, speed={speed}KB/s, eta={eta}s ===")

                if progress > 0:
                    logger.info(f"📤 推送进度: {progress}%, 速度: {speed/1024/1024:.2f}MB/s, ETA: {eta}秒")
                    print(f"=== 推送进度: {progress}%, 速度: {speed/1024/1024:.2f}MB/s, ETA: {eta}秒 ===")
                    broadcast_task_progress(
                        self.task_id,
                        progress=progress,
                        speed=speed,
                        eta=eta
                    )
                    logger.info(f"✓ 进度推送完成")
                    print(f"=== 进度推送完成 ===")
                else:
                    logger.debug(f"进度为 0，跳过推送")
                    print(f"=== 进度为 0，跳过推送 ===")

                await asyncio.sleep(1)  # 每秒推送一次
            except Exception as e:
                logger.error(f"❌ 推送进度失败: {e}", exc_info=True)
                print(f"=== 推送进度失败: {e} ===")
                await asyncio.sleep(1)

        logger.info(f"📡 进度广播器停止: task_id={self.task_id}, cancelled={self._progress_cancelled}")
        print(f"=== 进度广播器停止: task_id={self.task_id}, cancelled={self._progress_cancelled} ===")

    async def _check_task_status(self):
        """检查任务状态（是否被暂停或取消）"""
        db = SessionLocal()
        try:
            # 从数据库重新加载任务状态
            fresh_task = db.query(Task).filter(Task.id == self.task.id).first()
            if fresh_task:
                self.task.state = fresh_task.state
                
                # 检查是否被取消
                if fresh_task.state == TaskState.CANCELLED:
                    self._cancelled = True
                    raise asyncio.CancelledError("任务已取消")
                
                # 检查是否被暂停
                if fresh_task.state == TaskState.PAUSED:
                    logger.info(f"任务 {self.task.id} 被暂停")
                    # 等待恢复
                    while True:
                        await asyncio.sleep(1)
                        fresh_task = db.query(Task).filter(Task.id == self.task.id).first()
                        if fresh_task and fresh_task.state != TaskState.PAUSED:
                            break
                        if fresh_task and fresh_task.state == TaskState.CANCELLED:
                            self._cancelled = True
                            raise asyncio.CancelledError("任务已取消")
                    logger.info(f"任务 {self.task.id} 恢复执行")
        finally:
            db.close()

    async def prepare(self):
        """准备任务"""
        logger.info(f"准备任务 {self.task.id}...")

        # 初始化Bilibili服务
        bilibili_service = BilibiliService()
        await bilibili_service.init()

        # 根据媒体类型准备数据
        if self.task.media_type == "video":
            await self._prepare_video(bilibili_service)
        elif self.task.media_type == "bangumi":
            await self._prepare_bangumi()
        elif self.task.media_type == "favorite":
            await self._prepare_favorite()

        logger.info(f"✓ 任务 {self.task.id} 准备完成")

    async def _prepare_video(self, bilibili_service: BilibiliService):
        """准备视频任务"""
        # 获取视频信息
        result = await bilibili_service.get_video_info(self.task.media_id)

        if not result.get('success'):
            raise Exception(result.get('message', '获取视频信息失败'))

        video_info = result['data']

        # 保存元数据
        self.task.meta = video_info

        # 构建准备数据
        self.task.prepare = {
            'subtasks': self._create_subtasks(video_info)
        }

        # 更新时间（不改变状态）
        self.task.updated_at = int(datetime.now().timestamp())

        # 持久化
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    def _create_subtasks(self, info: dict) -> List[dict]:
        """创建子任务列表"""
        subtasks = []

        # 视频下载
        subtasks.append({
            'type': SubTaskType.VIDEO,
            'bvid': self.task.media_id,
            'filename': f"{info.get('title', 'video')}.mp4"
        })

        # 字幕下载
        subtasks.append({
            'type': SubTaskType.SUBTITLES,
            'bvid': self.task.media_id,
            'filename': f"{info.get('title', 'video')}.zh.srt"
        })

        # 弹幕下载
        subtasks.append({
            'type': SubTaskType.DANMAKU,
            'bvid': self.task.media_id,
            'filename': f"{info.get('title', 'video')}.xml"
        })

        # 封面下载
        if info.get('pic'):
            subtasks.append({
                'type': SubTaskType.THUMB,
                'url': info['pic'],
                'filename': f"{info.get('title', 'video')}.jpg"
            })

        # NFO文件
        subtasks.append({
            'type': SubTaskType.SINGLE_NFO,
            'meta': info,
            'filename': f"{info.get('title', 'video')}.nfo"
        })

        return subtasks

    async def _prepare_bangumi(self):
        """准备番剧任务"""
        # TODO: 实现番剧准备逻辑
        raise Exception("Bangumi类型暂未实现")

    async def _prepare_favorite(self):
        """准备收藏夹任务"""
        # TODO: 实现收藏夹准备逻辑
        raise Exception("Favorite类型暂未实现")

    async def execute(self, temp_dir: Path, output_dir: Path):
        """执行任务"""
        print(f"=== TaskService.execute() called: task_id={self.task.id} ===")
        logger.info(f"🚀 开始执行任务 {self.task.id}...")
        print(f"=== 开始执行任务 {self.task.id}... ===")

        # 更新状态为 active
        self.task.state = TaskState.ACTIVE
        self.task.started_at = int(datetime.now().timestamp())
        self.task.updated_at = int(datetime.now().timestamp())

        # 持久化状态更新
        db = SessionLocal()
        try:
            db.merge(self.task)  # 使用 merge 而不是 add，避免 DetachedInstanceError
            db.commit()
        finally:
            db.close()

        logger.info(f"✓ 任务状态已更新为 ACTIVE")
        print(f"=== 任务状态已更新为 ACTIVE ===")

        # 创建进度推送任务
        from src.routers.websocket import broadcast_task_progress
        logger.info(f"📡 创建进度广播任务...")
        print(f"=== 创建进度广播任务... ===")
        progress_task = asyncio.create_task(self._progress_broadcaster())
        logger.info(f"✓ 进度广播任务已创建")
        print(f"=== 进度广播任务已创建 ===")

        try:
            # 创建最终输出目录（按视频标题创建子文件夹）
            video_title = self.task.title.replace('/', '_').replace('\\', '_').replace(':', '_')
            final_output_dir = output_dir / video_title
            final_output_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"最终输出目录: {final_output_dir}")

            # 检查任务状态
            await self._check_task_status()

            # 1. 下载视频/音频到临时目录
            await self._download_media(temp_dir, final_output_dir)

            # 检查任务状态
            await self._check_task_status()

            # 2. 依次执行其他子任务
            subtasks = self.task.prepare.get('subtasks', [])
            total_subtasks = len(subtasks)
            
            for idx, subtask_data in enumerate(subtasks):
                # 检查任务状态
                await self._check_task_status()
                
                subtask_type = subtask_data['type']
                
                # 跳过视频和音频，因为已经下载了
                if subtask_type in [SubTaskType.VIDEO, SubTaskType.AUDIO, SubTaskType.AUDIO_VIDEO]:
                    continue
                
                logger.info(f"执行子任务 {idx + 1}/{total_subtasks}: {subtask_type}")
                
                try:
                    await self._execute_subtask(subtask_data, temp_dir, final_output_dir)
                    
                    # 更新进度
                    progress = int(((idx + 1) / total_subtasks) * 100)
                    self.update_progress(progress)
                    
                except Exception as e:
                    logger.error(f"子任务 {subtask_type} 执行失败: {e}")
                    # 子任务失败不影响整体任务继续执行

            # 检查任务状态
            await self._check_task_status()

            # 3. 清理临时目录
            await self._cleanup_temp_dir(temp_dir)

            # 4. 标记任务为完成
            self.task.state = TaskState.COMPLETED
            self.task.completed_at = int(datetime.now().timestamp())
            self.task.updated_at = int(datetime.now().timestamp())
            
            # 持久化完成状态
            db = SessionLocal()
            try:
                db.commit()
            finally:
                db.close()

            logger.info(f"✓ 任务 {self.task.id} 执行完成")

        except asyncio.CancelledError as e:
            logger.info(f"任务 {self.task.id} 被取消: {e}")
            self.task.state = TaskState.CANCELLED
            self.task.updated_at = int(datetime.now().timestamp())
            
            # 持久化取消状态
            db = SessionLocal()
            try:
                db.commit()
            finally:
                db.close()
            
            if not self._cancelled:
                raise  # 只有非主动取消才重新抛出
                
        except Exception as e:
            logger.error(f"✗ 任务 {self.task.id} 执行失败: {e}")
            
            # 标记任务为失败
            self.task.state = TaskState.FAILED
            self.task.status['error'] = str(e)
            self.task.updated_at = int(datetime.now().timestamp())
            
            # 持久化失败状态
            db = SessionLocal()
            try:
                db.commit()
            finally:
                db.close()
            
            raise
        finally:
            # 停止进度广播
            self._progress_cancelled = True

    async def _download_media(self, temp_dir: Path, final_output_dir: Path):
        """下载媒体文件（视频/音频）"""
        logger.info(f"下载媒体文件: {self.task.media_id}")
        logger.info(f"临时目录: {temp_dir}")
        logger.info(f"最终目录: {final_output_dir}")
        
        # 查找视频或音频子任务
        subtasks = self.task.prepare.get('subtasks', [])
        media_subtask = None
        
        for subtask in subtasks:
            if subtask['type'] in [SubTaskType.VIDEO, SubTaskType.AUDIO, SubTaskType.AUDIO_VIDEO]:
                media_subtask = subtask
                break
        
        if not media_subtask:
            raise Exception("未找到媒体下载子任务")
        
        # 下载到临时目录
        try:
            from src.services.download_engine import DownloadEngine
            from src.services.settings_service import SettingsService
            from src.models.cookie import Cookie
            import shutil
            
            # 获取数据库连接
            db = SessionLocal()
            try:
                # 创建 SettingsService 并获取设置
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                
                # 获取 SESSDATA cookie
                sessdata_cookie = db.query(Cookie).filter(Cookie.name == 'SESSDATA').first()
                sessdata = sessdata_cookie.value if sessdata_cookie else None
                
                if not sessdata:
                    logger.warning("未找到 SESSDATA cookie，可能无法下载高画质视频")
                
                engine = DownloadEngine(settings)
                
                # 确保临时目录存在
                if not temp_dir.exists():
                    temp_dir.mkdir(parents=True, exist_ok=True)
                    logger.info(f"创建临时目录: {temp_dir}")
                
                # 进度回调（只更新本地状态）
                def progress_callback(download_id: str, progress: float, downloaded_bytes: int, total_bytes: int, download_speed: float, eta: float):
                    logger.info(f"📥 下载进度回调: {progress}%, 速度: {download_speed/1024/1024:.2f}MB/s, 已下载: {downloaded_bytes/1024/1024:.2f}MB, 总大小: {total_bytes/1024/1024:.2f}MB, ETA: {eta}秒")
                    # 只更新本地状态，不触发WebSocket广播
                    self.task.status['progress'] = int(progress // 2)
                    self.task.status['speed'] = download_speed
                    self.task.status['eta'] = eta
                    self.task.updated_at = int(datetime.now().timestamp())
                    logger.info(f"✓ 状态已更新: progress={self.task.status['progress']}%")
                
                # 下载到临时目录
                await engine.download_video(
                    bvid=self.task.media_id,
                    quality=80,  # 默认1080P
                    output_format='mp4',
                    output_path=str(temp_dir),  # 先下载到临时目录
                    sessdata=sessdata,
                    progress_callback=progress_callback
                )
                
                logger.info("✓ 媒体文件下载到临时目录完成")
                
                # 查找下载的文件
                downloaded_files = list(temp_dir.glob("*.mp4"))
                if not downloaded_files:
                    raise Exception("未找到下载的视频文件")
                
                # 移动文件到最终目录
                for file_path in downloaded_files:
                    final_path = final_output_dir / file_path.name
                    logger.info(f"移动文件: {file_path} -> {final_path}")
                    shutil.move(str(file_path), str(final_path))
                
                logger.info("✓ 媒体文件已移动到最终目录")
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"媒体文件下载失败: {e}")
            raise

    async def _cleanup_temp_dir(self, temp_dir: Path):
        """清理临时目录"""
        if temp_dir.exists():
            import shutil
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"✓ 已清理临时目录: {temp_dir}")
            except Exception as e:
                logger.warning(f"清理临时目录失败: {e}")

    async def _execute_subtask(self, subtask_data: dict, temp_dir: Path, output_dir: Path):
        """执行子任务"""
        from src.services.download_service import DownloadService

        subtask_type = subtask_data['type']

        # 处理封面下载
        if subtask_type == SubTaskType.THUMB:
            url = subtask_data.get('url')
            filename = subtask_data.get('filename', 'cover.jpg')
            
            if not url:
                logger.warning("封面 URL 为空，跳过下载")
                return
            
            output_file = output_dir / filename
            
            # 检查文件是否已存在且大小合理
            if output_file.exists() and output_file.stat().st_size > 1000:
                logger.info(f"封面文件已存在: {filename}")
                return
            
            logger.info(f"开始下载封面: {url}")
            
            try:
                # 使用 DownloadService 的 _download_image 方法
                download_service = DownloadService()
                success = await download_service._download_image(url, output_file)
                
                if success:
                    logger.info(f"封面下载成功: {filename}, 大小: {output_file.stat().st_size} 字节")
                else:
                    logger.error(f"封面下载失败: {url}")
            except Exception as e:
                logger.error(f"封面下载异常: {e}")

        # 处理字幕下载（占位实现）
        elif subtask_type == SubTaskType.SUBTITLES:
            filename = subtask_data.get('filename', 'subtitles.srt')
            output_file = output_dir / filename
            
            # 检查文件是否已存在且有内容
            if output_file.exists() and output_file.stat().st_size > 50:
                logger.info(f"字幕文件已存在: {filename}")
                return
            
            logger.warning(f"字幕下载功能暂未实现，创建占位文件: {filename}")
            
            # 创建占位文件
            content = f"""1
00:00:00,000 --> 00:00:05,000
字幕占位文件: {self.task.media_id}

2
00:00:05,000 --> 00:00:10,000
语言: zh
"""
            output_file.write_text(content, encoding='utf-8')

        # 处理弹幕下载（占位实现）
        elif subtask_type == SubTaskType.DANMAKU:
            filename = subtask_data.get('filename', 'danmaku.xml')
            output_file = output_dir / filename
            
            # 检查文件是否已存在且有内容
            if output_file.exists() and output_file.stat().st_size > 50:
                logger.info(f"弹幕文件已存在: {filename}")
                return
            
            logger.warning(f"弹幕下载功能暂未实现，创建占位文件: {filename}")
            
            # 创建占位文件
            content = f"""<?xml version="1.0" encoding="UTF-8"?>
<i>
  <d p="0.000,1,25,16777215,1586984241,0,0,0">弹幕占位文件: {self.task.media_id}</d>
  <d p="5.000,1,25,16777215,1586984241,0,0,0">B站视频弹幕</d>
</i>
"""
            output_file.write_text(content, encoding='utf-8')

        # 处理 NFO 文件生成
        elif subtask_type == SubTaskType.SINGLE_NFO:
            filename = subtask_data.get('filename', 'video.nfo')
            meta_data = subtask_data.get('meta', self.task.meta)
            
            output_file = output_dir / filename
            
            # 检查文件是否已存在
            if output_file.exists():
                logger.info(f"NFO 文件已存在: {filename}")
                return
            
            logger.info(f"生成 NFO 文件: {filename}")
            
            # 构建 NFO 内容
            title = meta_data.get('title', 'Unknown')
            desc = meta_data.get('desc', '')
            owner = meta_data.get('owner', {})
            uploader = owner.get('name', 'Unknown')
            pic = meta_data.get('pic', '')
            stat = meta_data.get('stat', {})
            
            # 转换发布时间
            pubdate = meta_data.get('pubdate', 0)
            from datetime import datetime
            if pubdate:
                try:
                    pub_date_str = datetime.fromtimestamp(pubdate).strftime('%Y-%m-%d')
                except:
                    pub_date_str = 'Unknown'
            else:
                pub_date_str = 'Unknown'
            
            content = f"""<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>{title}</title>
  <plot>{desc}</plot>
  <studio>{uploader}</studio>
  <premiered>{pub_date_str}</premiered>
  <thumb>{pic}</thumb>
  <statistics>
    <play>{stat.get('view', 0)}</play>
    <like>{stat.get('like', 0)}</like>
    <coin>{stat.get('coin', 0)}</coin>
    <favorite>{stat.get('favorite', 0)}</favorite>
    <share>{stat.get('share', 0)}</share>
    <danmaku>{stat.get('danmaku', 0)}</danmaku>
    <reply>{stat.get('reply', 0)}</reply>
  </statistics>
</movie>
"""
            
            output_file.write_text(content, encoding='utf-8')
            logger.info(f"NFO 文件生成成功: {filename}")

        # 视频和音频已经在主下载流程中处理
        elif subtask_type in [SubTaskType.VIDEO, SubTaskType.AUDIO, SubTaskType.AUDIO_VIDEO]:
            logger.info(f"{subtask_type} 文件已在主下载流程中处理")
            pass

        else:
            logger.warning(f"未知的子任务类型: {subtask_type}，跳过")

    def update_progress(self, progress: int):
        """更新进度"""
        self.task.status['progress'] = progress
        self.task.updated_at = int(datetime.now().timestamp())

        # 持久化
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()
        
        # 广播任务状态更新（包含进度信息）
        from src.routers.websocket import broadcast_task_updated
        broadcast_task_updated(self.task.id, str(self.task.state))