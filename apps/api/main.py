from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

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
from src.services.scheduler_service import scheduler_service
from src.services.queue.manager import queue_manager
from src.services.cache.video_cache import video_cache

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
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

    yield

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