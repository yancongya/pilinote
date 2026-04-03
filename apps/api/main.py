from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import json

from src.config import settings
from src.database import engine, Base
from src.routers.auth import router as auth_router
from src.routers.favorites import router as favorites_router
from src.routers.video import router as video_router
from src.routers.watchlater import router as watchlater_router
from src.routers.download import router as download_router
from src.routers.settings import router as settings_router
from src.routers.queue import router as queue_router
from src.routers.cache import router as cache_router
from src.routers.media import router as media_router
from src.routers.websocket import manager as ws_manager
from src.services.scheduler_service import scheduler_service
from src.services.queue.manager import queue_manager
from src.services.cache.video_cache import video_cache
from src.services.account_refresh_service import get_account_refresh_service
from src.services.tool_initializer import initialize_tools_on_startup, ToolInitializer

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)


async def update_tool_paths_in_database():
    """更新数据库中的工具路径设置"""
    from src.database import SessionLocal
    from src.models.setting import Setting
    import json
    
    db = SessionLocal()
    try:
        initializer = ToolInitializer()
        
        # 获取项目内工具路径
        ffmpeg_path = initializer.get_tool_path('ffmpeg')
        aria2c_path = initializer.get_tool_path('aria2c')
        
        if not ffmpeg_path and not aria2c_path:
            logger.info("No bundled tools found, skipping database update")
            return
        
        # 获取当前设置
        sidecar_setting = db.query(Setting).filter_by(key='storage.sidecar').first()
        if not sidecar_setting:
            logger.info("Sidecar setting not found, skipping update")
            return
        
        try:
            current_value = json.loads(sidecar_setting.value)
            
            # 更新工具路径
            updated = False
            if ffmpeg_path:
                current_value['ffmpeg'] = ffmpeg_path
                updated = True
            if aria2c_path:
                current_value['aria2c'] = aria2c_path
                updated = True
            
            if updated:
                sidecar_setting.value = json.dumps(current_value)
                db.commit()
                logger.info(f"Updated tool paths in database: ffmpeg={ffmpeg_path}, aria2c={aria2c_path}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse sidecar setting: {e}")
    except Exception as e:
        logger.error(f"Failed to update tool paths in database: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 初始化工具
    logger.info("Initializing tools...")
    initialize_tools_on_startup()
    
    # 更新数据库中的工具路径设置
    logger.info("Updating tool paths in database...")
    await update_tool_paths_in_database()
    
    # 启动队列管理器
    logger.info("Starting queue manager...")
    await queue_manager.initialize()
    logger.info("Queue manager started")

    # 清理过期缓存
    logger.info("Cleaning up expired cache...")
    await video_cache.cleanup_expired()
    logger.info("Expired cache cleaned up")

    # 启动定时任务
    scheduler_service.start()

    # 启动账号刷新服务（默认1小时刷新一次）
    logger.info("Starting account refresh service...")
    account_refresh_service = get_account_refresh_service()
    await account_refresh_service.start(interval=3600)
    logger.info("Account refresh service started")

    yield

    # 停止账号刷新服务
    logger.info("Stopping account refresh service...")
    await account_refresh_service.stop()
    logger.info("Account refresh service stopped")

    # 停止定时任务
    scheduler_service.stop()

    # 关闭队列管理器
    logger.info("Shutting down queue manager...")
    await queue_manager.shutdown()
    logger.info("Queue manager shutdown")


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

app.include_router(media_router)
app.include_router(cache_router)
app.include_router(queue_router)
app.include_router(auth_router)
app.include_router(favorites_router)
app.include_router(video_router)
app.include_router(watchlater_router)
app.include_router(download_router)
app.include_router(settings_router)


@app.websocket("/ws/queue")
async def websocket_queue(websocket: WebSocket):
    """队列系统 WebSocket 端点"""
    await ws_manager.connect(websocket)

    try:
        # 发送连接确认
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connection established"
        })

        # 保持连接活跃
        while True:
            try:
                # 接收客户端消息（心跳等）
                data = await websocket.receive_text()
                message = json.loads(data)

                # 处理心跳
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)


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
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )