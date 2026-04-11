# 在SchedulerService中添加清理任务

## 概述

本文档详细说明了如何在SchedulerService中添加定时清理任务，用于清理超过24小时的临时文件。

## 功能描述

### 定时清理任务
- **清理对象**：超过24小时的临时文件
- **清理目标**：
  - `temp/` 目录下的所有临时目录
  - `temp/` 目录下的 `.temp` 后缀目录
  - `temp/` 目录下的 `.failed` 和 `.cancelled` 目录
- **清理策略**：根据修改时间判断是否超过24小时
- **执行频率**：每小时检查一次

### 清理逻辑
1. 遍历 `temp/` 目录下的所有项目
2. 检查每个项目的修改时间
3. 如果超过24小时，删除该项目
4. 记录清理日志

## 实施步骤

### 步骤1：添加清理方法到SchedulerService

**文件**：`apps/api/src/services/scheduler_service.py`

**修改内容**：

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path
import logging
import shutil

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
        
        # 添加定时任务：每小时清理一次临时文件
        self.scheduler.add_job(
            self.cleanup_old_temp_files,
            trigger=IntervalTrigger(hours=1),
            id='cleanup_temp_files',
            name='清理临时文件任务',
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
    
    # ... 其他现有方法保持不变 ...
```

### 步骤2：修改main.py中的启动逻辑

**文件**：`apps/api/main.py`

**修改内容**：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from src.config import settings
from src.database import engine, Base
from src.routers.auth import router as auth_router
from src.routers.favorites import router as favorites_router
from src.routers.video import router as video_router
from src.routers.watchlater import router as watchlater_router
from src.routers.download import router as download_router
from src.routers.settings import router as settings_router
from src.services.scheduler_service import scheduler_service

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动定时任务
    logger.info("Starting scheduler service...")
    scheduler_service.start()
    logger.info("Scheduler service started")
    
    yield
    
    # 停止定时任务
    logger.info("Stopping scheduler service...")
    scheduler_service.stop()
    logger.info("Scheduler service stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(favorites_router)
app.include_router(video_router)
app.include_router(watchlater_router)
app.include_router(download_router)
app.include_router(settings_router)


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    import logging
    
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
```

### 步骤3：添加清理日志配置

**文件**：`apps/api/src/config.py` 或 `apps/api/main.py`

**修改内容**：

```python
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/scheduler.log', encoding='utf-8')
    ]
)
```

### 步骤4：添加清理API端点（可选）

**文件**：`apps/api/src/routers/settings.py` 或创建新的 `apps/api/src/routers/cleanup.py`

**新增端点**：

```python
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter(prefix="/cleanup", tags=["清理"])

@router.post("/trigger")
async def trigger_cleanup() -> Dict[str, Any]:
    """
    手动触发清理任务
    
    Returns:
        清理结果
    """
    try:
        from src.services.scheduler_service import scheduler_service
        
        # 执行清理
        scheduler_service.cleanup_old_temp_files()
        
        return {
            "success": True,
            "message": "清理任务已触发"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"清理任务触发失败: {str(e)}"
        )

@router.get("/status")
async def get_cleanup_status() -> Dict[str, Any]:
    """
    获取清理状态
    
    Returns:
        清理状态信息
    """
    try:
        from pathlib import Path
        from datetime import datetime, timedelta
        
        # 获取临时路径
        from src.services.settings_service import SettingsService
        from src.database import SessionLocal
        
        with SessionLocal() as db:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            temp_path = settings.storage.temp_path
        
        temp_dir = Path(temp_path)
        if not temp_dir.exists():
            return {
                "temp_path": str(temp_path),
                "exists": False,
                "total_count": 0,
                "old_count": 0,
                "recent_count": 0
            }
        
        # 统计临时文件
        now = datetime.now()
        cutoff_time = now - timedelta(hours=24)
        
        total_count = 0
        old_count = 0
        recent_count = 0
        
        for item in temp_dir.iterdir():
            if item.is_dir():
                total_count += 1
                mod_time = datetime.fromtimestamp(item.stat().st_mtime)
                if mod_time < cutoff_time:
                    old_count += 1
                else:
                    recent_count += 1
        
        return {
            "temp_path": str(temp_path),
            "exists": True,
            "total_count": total_count,
            "old_count": old_count,
            "recent_count": recent_count,
            "cutoff_time": cutoff_time.strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取清理状态失败: {str(e)}"
        )
```

## 测试计划

### 测试1：手动触发清理

```python
# 1. 创建一些临时文件
import os
import time
from pathlib import Path

temp_dir = Path("temp")
temp_dir.mkdir(exist_ok=True)

# 创建一个旧的临时目录
old_dir = temp_dir / "old_download"
old_dir.mkdir(exist_ok=True)
# 修改修改时间为25小时前
old_time = time.time() - 25 * 3600
os.utime(str(old_dir), (old_time, old_time))

# 创建一个新的临时目录
new_dir = temp_dir / "new_download"
new_dir.mkdir(exist_ok=True)

# 2. 触发清理
response = await client.post("/cleanup/trigger")

# 3. 验证结果
assert response.json()["success"] == True
assert not old_dir.exists()  # 旧目录被清理
assert new_dir.exists()  # 新目录保留
```

### 测试2：获取清理状态

```python
# 1. 创建一些临时文件
# ...

# 2. 获取清理状态
response = await client.get("/cleanup/status")
status = response.json()

# 3. 验证结果
assert status["exists"] == True
assert status["total_count"] > 0
assert "old_count" in status
assert "recent_count" in status
```

### 测试3：定时清理任务

```python
# 1. 创建一些临时文件
# ...

# 2. 等待1小时（定时任务执行）
# 注意：实际测试时可以修改触发间隔为更短的时间

# 3. 验证旧文件被清理
# ...
```

### 测试4：清理日志

```python
# 1. 检查日志文件
with open('logs/scheduler.log', 'r') as f:
    logs = f.read()

# 2. 验证日志包含清理信息
assert "清理临时目录" in logs
assert "临时文件清理完成" in logs
```

## 注意事项

1. **时间判断**：使用修改时间（mtime）而不是创建时间（ctime），因为某些系统不支持精确的创建时间
2. **并发安全**：清理操作和下载操作可能同时进行，需要确保文件操作不会冲突
3. **权限问题**：确保有权限删除临时文件
4. **路径验证**：确保只清理临时目录，避免误删其他文件
5. **错误处理**：单个文件清理失败不应影响其他文件的清理

## 依赖关系

- 依赖 `apps/api/src/services/settings_service.py` - 读取临时路径
- 依赖 `apps/api/src/schemas/settings.py` - 存储设置数据结构
- 依赖 `APScheduler` - 定时任务调度

## 与其他功能的集成

### 自动清理功能
- 本文档实现了定时清理任务
- 与文档02的下载完成时自动清理功能配合使用

### 保留失败任务功能
- 定时清理会清理超过24小时的失败任务
- 如果用户需要保留更长时间，可以调整清理策略

## 后续优化

1. **清理策略优化**：
   - 支持自定义清理时间阈值
   - 支持按文件大小清理
   - 支持按文件类型清理

2. **清理通知**：
   - 清理前发送通知
   - 清理后发送报告

3. **清理统计**：
   - 记录清理历史
   - 统计清理空间

## 回归测试

修改后需要确保：
- 原有的cookie刷新任务仍然正常工作
- 新的清理任务不影响其他功能
- 应用启动和关闭正常
- 日志记录正常