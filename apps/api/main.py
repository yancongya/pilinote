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
from src.services.scheduler_service import scheduler_service

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动定时任务
    scheduler_service.start()
    yield
    # 停止定时任务
    scheduler_service.stop()


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