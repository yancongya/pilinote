# 阶段3：任务系统重构

## 概述

本阶段的目标是实现Scheduler调度器和Task任务的具体执行逻辑，参考BiliTools的架构设计，支持多种子任务类型（Video/Audio/Subtitle/Danmaku/NFO等），实现任务的准备、调度、执行、完成等完整流程。

## 核心问题

### 当前问题

1. **DownloadService职责过重**
   - 同时负责任务管理、文件处理、数据库操作
   - 代码复杂，难以测试和维护

2. **缺少子任务概念**
   - 没有将下载任务拆分为多个子任务
   - 无法并行处理视频、字幕、弹幕等

3. **任务执行流程不清晰**
   - 缺少任务准备阶段
   - 缺少任务调度机制
   - 缺少任务完成后的处理

## 解决方案

### 1. Scheduler - 调度器实现

**文件**: `apps/api/src/services/queue/scheduler.py`

```python
import asyncio
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime
import logging

from models.task import Task, TaskState
from models.scheduler import Scheduler, SchedulerState
from models.queue import QueueType
from services.queue.manager import queue_manager

logger = logging.getLogger(__name__)

class SchedulerService:
    """调度器服务"""

    def __init__(self, scheduler: Scheduler):
        self.scheduler = scheduler
        self.tasks: Dict[str, Task] = {}
        self.semaphore = asyncio.Semaphore(3)  # 并发控制
        self.cancel_event = asyncio.Event()

    async def initialize(self):
        """初始化调度器"""
        logger.info(f"初始化调度器 {self.scheduler.id}...")

        # 加载任务
        for task_id in self.scheduler.list:
            task = await queue_manager.get_task(task_id)
            if task:
                self.tasks[task_id] = task

        logger.info(f"✓ 调度器 {self.scheduler.id} 已加载 {len(self.tasks)} 个任务")

    async def prepare(self):
        """准备所有任务"""
        logger.info(f"准备调度器 {self.scheduler.id} 的任务...")

        for task_id, task in self.tasks.items():
            try:
                await self._prepare_task(task)
                logger.info(f"✓ 任务 {task_id} 准备完成")
            except Exception as e:
                logger.error(f"✗ 任务 {task_id} 准备失败: {e}")
                task.state = TaskState.FAILED

    async def _prepare_task(self, task: Task):
        """准备单个任务"""
        from services.bilibili import BilibiliService
        from services.utils.bilibili_utils import LinkParser

        parser = LinkParser()

        # 根据媒体类型获取信息
        if task.media_type == "video":
            # 获取视频信息
            info = await BilibiliService.get_video_info(task.media_id)

            # 构建准备数据
            task.prepare = {
                'video_urls': info.get('video_urls', []),
                'audio_urls': info.get('audio_urls', []),
                'subtitle_urls': info.get('subtitle_urls', []),
                'danmaku_urls': info.get('danmaku_urls', []),
                'cover_url': info.get('pic', ''),
                'uploader_avatar_url': info.get('uploader_avatar', ''),
                'subtasks': self._create_subtasks(task, info)
            }

            task.meta = info

        elif task.media_type == "bangumi":
            # 番剧处理
            pass

        elif task.media_type == "favorite":
            # 收藏夹处理
            pass

        # 更新任务状态
        task.state = TaskState.PENDING
        task.updated_at = int(datetime.now().timestamp())

        # 持久化
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    def _create_subtasks(self, task: Task, info: dict) -> List[dict]:
        """根据配置创建子任务"""
        from schemas.task import SubTaskType

        subtasks = []

        # 视频下载
        if info.get('video_urls'):
            subtasks.append({
                'type': SubTaskType.VIDEO,
                'url': info['video_urls'][0],
                'filename': f"{info['title']}.mp4"
            })

        # 音频下载
        if info.get('audio_urls'):
            subtasks.append({
                'type': SubTaskType.AUDIO,
                'url': info['audio_urls'][0],
                'filename': f"{info['title']}.m4a"
            })

        # 字幕下载
        if info.get('subtitle_urls'):
            for sub in info['subtitle_urls']:
                subtasks.append({
                    'type': SubTaskType.SUBTITLES,
                    'url': sub['url'],
                    'lang': sub.get('lang', 'zh'),
                    'filename': f"{info['title']}.{sub.get('lang', 'zh')}.srt"
                })

        # 弹幕下载
        if info.get('danmaku_urls'):
            subtasks.append({
                'type': SubTaskType.DANMAKU,
                'url': info['danmaku_urls'][0],
                'filename': f"{info['title']}.xml"
            })

        # 封面下载
        if info.get('pic'):
            subtasks.append({
                'type': SubTaskType.THUMB,
                'url': info['pic'],
                'filename': f"{info['title']}.jpg"
            })

        # NFO文件
        subtasks.append({
            'type': SubTaskType.SINGLE_NFO,
            'meta': info,
            'filename': f"{info['title']}.nfo"
        })

        return subtasks

    async def dispatch(self):
        """分发任务执行"""
        logger.info(f"开始执行调度器 {self.scheduler.id}...")

        self.scheduler.state = SchedulerState.ACTIVE
        self.scheduler.updated_at = int(datetime.now().timestamp())

        # 持久化状态
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

        # 创建任务集合
        tasks = []
        for task_id in self.scheduler.list:
            task = self.tasks.get(task_id)
            if task and task.state == TaskState.PENDING:
                tasks.append(self._run_task(task))

        # 并发执行任务
        try:
            await asyncio.gather(*tasks, return_exceptions=True)
        except asyncio.CancelledError:
            logger.info(f"调度器 {self.scheduler.id} 已取消")
            self.scheduler.state = SchedulerState.CANCELLED
        except Exception as e:
            logger.error(f"调度器 {self.scheduler.id} 执行失败: {e}")
            self.scheduler.state = SchedulerState.FAILED
        else:
            # 检查是否所有任务都完成
            all_completed = all(
                task.state == TaskState.COMPLETED
                for task in self.tasks.values()
            )

            if all_completed:
                self.scheduler.state = SchedulerState.COMPLETED
                logger.info(f"✓ 调度器 {self.scheduler.id} 已完成")
            else:
                self.scheduler.state = SchedulerState.FAILED
                logger.warning(f"调度器 {self.scheduler.id} 部分任务失败")

        # 更新状态
        self.scheduler.updated_at = int(datetime.now().timestamp())
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    async def _run_task(self, task: Task):
        """执行单个任务"""
        logger.info(f"开始执行任务 {task.id}...")

        # 获取信号量
        async with self.semaphore:
            # 检查是否取消
            if self.cancel_event.is_set():
                task.state = TaskState.CANCELLED
                return

            # 更新任务状态
            task.state = TaskState.ACTIVE
            task.updated_at = int(datetime.now().timestamp())

            db = SessionLocal()
            try:
                db.commit()
            finally:
                db.close()

            try:
                # 创建临时目录
                temp_dir = Path("temp") / task.id
                temp_dir.mkdir(parents=True, exist_ok=True)

                # 创建输出目录
                output_dir = Path(self.scheduler.folder)
                output_dir.mkdir(parents=True, exist_ok=True)

                # 执行所有子任务
                for subtask_data in task.prepare.get('subtasks', []):
                    if self.cancel_event.is_set():
                        break

                    await self._execute_subtask(task, subtask_data, temp_dir, output_dir)

                # 清理临时目录
                if temp_dir.exists():
                    import shutil
                    shutil.rmtree(temp_dir)

                # 任务完成
                task.state = TaskState.COMPLETED
                logger.info(f"✓ 任务 {task.id} 已完成")

            except Exception as e:
                logger.error(f"✗ 任务 {task.id} 执行失败: {e}")
                task.state = TaskState.FAILED
                task.status['error'] = str(e)

            # 更新任务状态
            task.updated_at = int(datetime.now().timestamp())
            db = SessionLocal()
            try:
                db.commit()
            finally:
                db.close()

    async def _execute_subtask(self, task: Task, subtask_data: dict, temp_dir: Path, output_dir: Path):
        """执行子任务"""
        from services.queue.handlers import SubTaskHandler

        subtask_type = subtask_data['type']

        # 获取处理器
        handler = SubTaskHandler.get_handler(subtask_type)
        if not handler:
            logger.warning(f"未找到 {subtask_type} 的处理器，跳过")
            return

        # 执行处理器
        await handler.handle(subtask_data, temp_dir, output_dir, task.meta)

    async def pause(self):
        """暂停调度器"""
        logger.info(f"暂停调度器 {self.scheduler.id}...")
        self.scheduler.state = SchedulerState.PAUSED
        self.scheduler.updated_at = int(datetime.now().timestamp())

        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    async def resume(self):
        """恢复调度器"""
        logger.info(f"恢复调度器 {self.scheduler.id}...")
        self.cancel_event.clear()
        await self.dispatch()

    async def cancel(self):
        """取消调度器"""
        logger.info(f"取消调度器 {self.scheduler.id}...")
        self.cancel_event.set()
        self.scheduler.state = SchedulerState.CANCELLED
        self.scheduler.updated_at = int(datetime.now().timestamp())

        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()
```

### 2. Task - 任务类

**文件**: `apps/api/src/services/queue/task.py`

```python
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import logging

from models.task import Task, TaskState
from schemas.task import SubTask, SubTaskType

logger = logging.getLogger(__name__)

class TaskService:
    """任务服务"""

    def __init__(self, task: Task):
        self.task = task
        self.subtasks: List[SubTask] = []

    async def prepare(self):
        """准备任务"""
        logger.info(f"准备任务 {self.task.id}...")

        # 根据媒体类型准备数据
        if self.task.media_type == "video":
            await self._prepare_video()
        elif self.task.media_type == "bangumi":
            await self._prepare_bangumi()
        elif self.task.media_type == "favorite":
            await self._prepare_favorite()

        logger.info(f"✓ 任务 {self.task.id} 准备完成")

    async def _prepare_video(self):
        """准备视频任务"""
        from services.bilibili import BilibiliService

        # 获取视频信息
        info = await BilibiliService.get_video_info(self.task.media_id)

        # 保存元数据
        self.task.meta = info

        # 构建准备数据
        self.task.prepare = {
            'video_urls': info.get('video_urls', []),
            'audio_urls': info.get('audio_urls', []),
            'subtitle_urls': info.get('subtitle_urls', []),
            'danmaku_urls': info.get('danmaku_urls', []),
            'cover_url': info.get('pic', ''),
            'uploader_avatar_url': info.get('uploader_avatar', ''),
            'subtasks': self._create_subtasks(info)
        }

        # 更新状态
        self.task.state = TaskState.PENDING
        self.task.updated_at = int(datetime.now().timestamp())

        # 持久化
        db = SessionLocal()
        try:
            db.commit()
        finally:
            db.close()

    def _create_subtasks(self, info: dict) -> List[dict]:
        """创建子任务列表"""
        from schemas.task import SubTaskType

        subtasks = []

        # 视频下载
        if info.get('video_urls'):
            subtasks.append({
                'type': SubTaskType.VIDEO,
                'url': info['video_urls'][0],
                'filename': f"{info['title']}.mp4"
            })

        # 音频下载
        if info.get('audio_urls'):
            subtasks.append({
                'type': SubTaskType.AUDIO,
                'url': info['audio_urls'][0],
                'filename': f"{info['title']}.m4a"
            })

        # 字幕下载
        if info.get('subtitle_urls'):
            for sub in info['subtitle_urls']:
                subtasks.append({
                    'type': SubTaskType.SUBTITLES,
                    'url': sub['url'],
                    'lang': sub.get('lang', 'zh'),
                    'filename': f"{info['title']}.{sub.get('lang', 'zh')}.srt"
                })

        # 弹幕下载
        if info.get('danmaku_urls'):
            subtasks.append({
                'type': SubTaskType.DANMAKU,
                'url': info['danmaku_urls'][0],
                'filename': f"{info['title']}.xml"
            })

        # 封面下载
        if info.get('pic'):
            subtasks.append({
                'type': SubTaskType.THUMB,
                'url': info['pic'],
                'filename': f"{info['title']}.jpg"
            })

        # NFO文件
        subtasks.append({
            'type': SubTaskType.SINGLE_NFO,
            'meta': info,
            'filename': f"{info['title']}.nfo"
        })

        return subtasks

    async def _prepare_bangumi(self):
        """准备番剧任务"""
        # TODO: 实现番剧准备逻辑
        pass

    async def _prepare_favorite(self):
        """准备收藏夹任务"""
        # TODO: 实现收藏夹准备逻辑
        pass

    async def execute(self, temp_dir, output_dir):
        """执行任务"""
        logger.info(f"执行任务 {self.task.id}...")

        # 遍历所有子任务
        for subtask_data in self.task.prepare.get('subtasks', []):
            await self._execute_subtask(subtask_data, temp_dir, output_dir)

        logger.info(f"✓ 任务 {self.task.id} 执行完成")

    async def _execute_subtask(self, subtask_data: dict, temp_dir, output_dir):
        """执行子任务"""
        from services.queue.handlers import SubTaskHandler

        subtask_type = subtask_data['type']

        # 获取处理器
        handler = SubTaskHandler.get_handler(subtask_type)
        if not handler:
            logger.warning(f"未找到 {subtask_type} 的处理器，跳过")
            return

        # 执行处理器
        await handler.handle(subtask_data, temp_dir, output_dir, self.task.meta)

    def update_progress(self, progress: int):
        """更新进度"""
        self.task.status['progress'] = progress
        self.task.updated_at = int(datetime.now().timestamp())
```

### 3. 更新Scheduler路由

**文件**: `apps/api/src/routers/queue.py`

```python
from fastapi import APIRouter, HTTPException
from typing import List
import logging

from schemas.queue import QueueType
from schemas.task import TaskCreate, TaskResponse
from schemas.scheduler import SchedulerCreate, SchedulerResponse
from services.queue.manager import queue_manager
from services.queue.scheduler import SchedulerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queue", tags=["queue"])

# ... 之前的代码 ...

# ========== 调度器执行相关 ==========

@router.post("/schedulers/{scheduler_id}/start")
async def start_scheduler(scheduler_id: str):
    """启动调度器"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="调度器不存在")

    # 创建调度器服务
    scheduler_service = SchedulerService(scheduler)

    # 初始化
    await scheduler_service.initialize()

    # 准备任务
    await scheduler_service.prepare()

    # 执行任务（后台运行）
    asyncio.create_task(scheduler_service.dispatch())

    return {"message": f"调度器 {scheduler_id} 已启动"}

@router.post("/schedulers/{scheduler_id}/pause")
async def pause_scheduler(scheduler_id: str):
    """暂停调度器"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="调度器不存在")

    scheduler_service = SchedulerService(scheduler)
    await scheduler_service.pause()

    return {"message": f"调度器 {scheduler_id} 已暂停"}

@router.post("/schedulers/{scheduler_id}/resume")
async def resume_scheduler(scheduler_id: str):
    """恢复调度器"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="调度器不存在")

    scheduler_service = SchedulerService(scheduler)
    await scheduler_service.resume()

    return {"message": f"调度器 {scheduler_id} 已恢复"}

@router.post("/schedulers/{scheduler_id}/cancel")
async def cancel_scheduler(scheduler_id: str):
    """取消调度器"""
    scheduler = await queue_manager.get_scheduler(scheduler_id)
    if not scheduler:
        raise HTTPException(status_code=404, detail="调度器不存在")

    scheduler_service = SchedulerService(scheduler)
    await scheduler_service.cancel()

    return {"message": f"调度器 {scheduler_id} 已取消"}
```

## 实施步骤

### 步骤1：创建Scheduler服务

```bash
touch apps/api/src/services/queue/scheduler.py
```

### 步骤2：创建Task服务

```bash
touch apps/api/src/services/queue/task.py
```

### 步骤3：更新Queue路由

编辑 `apps/api/src/routers/queue.py`，添加调度器执行相关端点。

### 步骤4：重启API服务

```bash
cd apps/api
python3 main.py
```

### 步骤5：测试流程

```bash
# 1. 提交任务
curl -X POST http://localhost:8000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "video",
    "media_id": "BV1xx411c7mD",
    "title": "测试视频"
  }'

# 2. 创建调度器
curl -X POST http://localhost:8000/api/queue/schedulers \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试调度器",
    "folder": "/Users/tanyancong/工作/开发/pilinote/downloads/test"
  }'

# 3. 启动调度器
curl -X POST http://localhost:8000/api/queue/schedulers/{scheduler_id}/start

# 4. 查看任务状态
curl http://localhost:8000/api/queue/tasks/{task_id}

# 5. 查看调度器状态
curl http://localhost:8000/api/queue/schedulers/{scheduler_id}
```

## 注意事项

1. **异步执行**
   - 调度器执行使用`asyncio.create_task`在后台运行
   - 不会阻塞API响应

2. **并发控制**
   - 使用信号量控制最大并发数
   - 避免过多同时下载

3. **错误处理**
   - 子任务失败不会影响其他子任务
   - 任务失败会记录错误信息

4. **临时文件管理**
   - 每个任务创建独立的临时目录
   - 任务完成后自动清理

5. **状态更新**
   - 每次状态变更都持久化到数据库
   - 支持暂停、恢复、取消操作

6. **资源清理**
   - 任务取消时清理临时文件
   - 确保不会残留临时文件

## 下一步

完成本阶段后，进入**阶段4：缓存系统**，实现视频数据缓存服务。