# 阶段6：API端点统一

## 概述

本阶段的目标是统一API端点设计，解决当前项目中API端点重复、数据格式不一致的问题，参考BiliTools的架构设计，提供统一、清晰、易用的API接口。

## 核心问题

### 当前问题

1. **API端点重复**
   - `/api/video/{video_id}` 和 `/api/download/parse` 都能获取视频信息
   - 数据格式不同，功能重叠
   - 前端不知道该用哪个

2. **多个收藏夹接口**
   - `/api/favorites/folders/{folder_id}` 使用B站原生API
   - `/api/download/parse` 解析收藏夹链接（使用HTML解析）
   - 功能重复，实现方式不同

3. **数据结构不一致**
   - `VideoInfo`和`MediaInfo`描述相同实体但字段不同
   - 统计信息字段命名不一致（play vs view）
   - 前端需要适配多种格式

## 解决方案

### 1. 统一的媒体信息API

**文件**: `apps/api/src/routers/media.py`

```python
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from schemas.media import MediaType, MediaInfo, MediaItem, MediaNfo, MediaStats
from services.bilibili import BilibiliService
from services.cache.video_cache import video_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["media"])

@router.get("/{media_type}/{media_id}", response_model=MediaInfo)
async def get_media_info(media_type: MediaType, media_id: str):
    """
    获取媒体信息（统一接口）

    支持的媒体类型：
    - video: 普通视频（bvid）
    - bangumi: 番剧（ssid/epid）
    - music: 音乐（au）
    - lesson: 课程（ssid）
    - favorite: 收藏夹（fid）
    - watchlater: 稍后再看（无需ID）
    """
    logger.info(f"获取媒体信息: {media_type} - {media_id}")

    try:
        # 根据媒体类型获取信息
        if media_type == MediaType.VIDEO:
            info = await BilibiliService.get_video_info(media_id)
            return _convert_to_media_info(media_type, media_id, info)

        elif media_type == MediaType.BANGUMI:
            info = await BilibiliService.get_bangumi_info(media_id)
            return _convert_to_media_info(media_type, media_id, info)

        elif media_type == MediaType.MUSIC:
            info = await BilibiliService.get_music_info(media_id)
            return _convert_to_media_info(media_type, media_id, info)

        elif media_type == MediaType.LESSON:
            info = await BilibiliService.get_lesson_info(media_id)
            return _convert_to_media_info(media_type, media_id, info)

        elif media_type == MediaType.FAVORITE:
            info = await BilibiliService.get_favorites(media_id, "")
            return _convert_to_media_info(media_type, media_id, info)

        elif media_type == MediaType.WATCH_LATER:
            info = await BilibiliService.get_watchlater()
            return _convert_to_media_info(media_type, "", info)

        else:
            raise HTTPException(status_code=400, detail=f"不支持的媒体类型: {media_type}")

    except Exception as e:
        logger.error(f"获取媒体信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/favorites/{fid}", response_model=MediaInfo)
async def get_favorite_media(fid: str, mid: Optional[str] = None):
    """获取收藏夹媒体信息"""
    logger.info(f"获取收藏夹媒体信息: {fid}")

    try:
        info = await BilibiliService.get_favorites(fid, mid or "")
        return _convert_to_media_info(MediaType.FAVORITE, fid, info)
    except Exception as e:
        logger.error(f"获取收藏夹媒体信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlater", response_model=MediaInfo)
async def get_watchlater_media():
    """获取稍后再看媒体信息"""
    logger.info("获取稍后再看媒体信息")

    try:
        info = await BilibiliService.get_watchlater()
        return _convert_to_media_info(MediaType.WATCH_LATER, "", info)
    except Exception as e:
        logger.error(f"获取稍后再看媒体信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _convert_to_media_info(media_type: MediaType, media_id: str, info: dict) -> MediaInfo:
    """转换为统一的媒体信息格式"""
    # 构建媒体项列表
    items = []

    if media_type == MediaType.VIDEO:
        # 单个视频
        items.append(_create_media_item(info, media_type))

    elif media_type in [MediaType.FAVORITE, MediaType.WATCH_LATER]:
        # 列表类型
        for item in info.get('media_list', []):
            items.append(_create_media_item(item, MediaType.VIDEO))

    elif media_type in [MediaType.BANGUMI, MediaType.LESSON]:
        # 番剧/课程
        for episode in info.get('episodes', []):
            items.append(_create_media_item(episode, media_type))

    # 构建NFO
    nfo = MediaNfo(
        title=info.get('title', ''),
        plot=info.get('desc', ''),
        studio=info.get('uploader', ''),
        premiered=_format_timestamp(info.get('pubdate')),
        runtime=info.get('duration', 0),
        thumb=info.get('pic', '')
    )

    # 构建统计信息
    stats = MediaStats(
        play=info.get('stat', {}).get('view', 0),
        danmaku=info.get('stat', {}).get('danmaku', 0),
        reply=info.get('stat', {}).get('reply', 0),
        like=info.get('stat', {}).get('like', 0),
        coin=info.get('stat', {}).get('coin', 0),
        favorite=info.get('stat', {}).get('favorite', 0),
        share=info.get('stat', {}).get('share', 0)
    )

    return MediaInfo(
        type=media_type,
        id=media_id,
        title=info.get('title', ''),
        cover=info.get('pic', ''),
        desc=info.get('desc', ''),
        nfo=nfo,
        stats=stats,
        list=items
    )


def _create_media_item(info: dict, media_type: MediaType) -> MediaItem:
    """创建媒体项"""
    return MediaItem(
        title=info.get('title', ''),
        cover=info.get('pic', ''),
        desc=info.get('desc', ''),
        duration=info.get('duration', 0),
        pubtime=info.get('pubdate', 0),
        is_target=False,
        type=media_type,
        url=info.get('short_link', ''),
        aid=info.get('aid'),
        bvid=info.get('bvid'),
        cid=info.get('cid'),
        epid=info.get('epid'),
        ssid=info.get('ssid'),
        index=info.get('page', 0)
    )


def _format_timestamp(timestamp: Optional[int]) -> Optional[str]:
    """格式化时间戳"""
    if not timestamp:
        return None
    from datetime import datetime
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%Y-%m-%d")
```

### 2. 统一的Schema定义

**文件**: `apps/api/src/schemas/media.py`

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class MediaType(str, Enum):
    """媒体类型枚举"""
    VIDEO = "video"
    BANGUMI = "bangumi"
    MUSIC = "music"
    MUSIC_LIST = "music_list"
    LESSON = "lesson"
    WATCH_LATER = "watch_later"
    FAVORITE = "favorite"
    OPUS = "opus"
    OPUS_LIST = "opus_list"
    USER_VIDEO = "user_video"
    USER_OPUS = "user_opus"
    USER_AUDIO = "user_audio"


class MediaNfo(BaseModel):
    """媒体NFO信息"""
    title: str = Field(default="")
    plot: str = Field(default="")
    studio: str = Field(default="")
    premiered: Optional[str] = None
    runtime: int = Field(default=0)
    thumb: str = Field(default="")


class MediaStats(BaseModel):
    """媒体统计信息"""
    play: int = Field(default=0, alias="view")
    danmaku: int = Field(default=0)
    reply: int = Field(default=0)
    like: int = Field(default=0)
    coin: int = Field(default=0)
    favorite: int = Field(default=0)
    share: int = Field(default=0)

    class Config:
        allow_population_by_field_name = True


class MediaItem(BaseModel):
    """媒体项"""
    title: str
    cover: str
    desc: str
    duration: int
    pubtime: int
    is_target: bool
    type: MediaType
    url: str
    aid: Optional[int] = None
    bvid: Optional[str] = None
    cid: Optional[int] = None
    epid: Optional[int] = None
    ssid: Optional[int] = None
    index: int = 0


class MediaInfo(BaseModel):
    """媒体信息（统一格式）"""
    type: MediaType
    id: str
    title: str
    cover: str
    desc: str
    nfo: MediaNfo
    stats: MediaStats
    list: List[MediaItem]
```

### 3. 更新主应用注册路由

**文件**: `apps/api/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers import media, queue, download, video, favorites, watchlater, auth, settings, cache
from services.queue.manager import queue_manager
from services.cache.video_cache import video_cache

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger.info("启动应用...")

    # 初始化队列管理器
    await queue_manager.initialize()
    logger.info("✓ 队列管理器已初始化")

    # 清理过期缓存
    await video_cache.cleanup_expired()
    logger.info("✓ 过期缓存已清理")

    yield

    # 关闭时清理
    logger.info("关闭应用...")

    # 关闭队列管理器
    await queue_manager.shutdown()
    logger.info("✓ 队列管理器已关闭")

app = FastAPI(
    title="PiliNote API",
    description="B站视频下载管理系统",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由（优先级：统一接口 > 旧接口）
app.include_router(media.router)
app.include_router(cache.router)
app.include_router(queue.router)
app.include_router(download.router)
app.include_router(video.router)
app.include_router(favorites.router)
app.include_router(watchlater.router)
app.include_router(auth.router)
app.include_router(settings.router)

@app.get("/")
async def root():
    return {"message": "PiliNote API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

### 4. API文档

**文件**: `apps/api/README.md`

```markdown
# PiliNote API 文档

## 概述

PiliNote API 提供统一的B站视频下载管理接口。

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API Version**: 1.0.0
- **Content-Type**: `application/json`

## 统一媒体接口

### 获取媒体信息

```
GET /api/media/{media_type}/{media_id}
```

**参数**:
- `media_type`: 媒体类型（video/bangumi/music/lesson/favorite/watchlater）
- `media_id`: 媒体ID

**示例**:
```bash
# 获取视频信息
curl http://localhost:8000/api/media/video/BV1xx411c7mD

# 获取番剧信息
curl http://localhost:8000/api/media/bangumi/ss123

# 获取收藏夹信息
curl http://localhost:8000/api/media/favorites/123456

# 获取稍后再看
curl http://localhost:8000/api/media/watchlater
```

**响应**:
```json
{
  "type": "video",
  "id": "BV1xx411c7mD",
  "title": "视频标题",
  "cover": "https://...",
  "desc": "视频描述",
  "nfo": {
    "title": "视频标题",
    "plot": "视频描述",
    "studio": "UP主名称",
    "premiered": "2024-01-01",
    "runtime": 600,
    "thumb": "https://..."
  },
  "stats": {
    "play": 10000,
    "danmaku": 500,
    "reply": 100,
    "like": 1000,
    "coin": 500,
    "favorite": 200,
    "share": 50
  },
  "list": [...]
}
```

## 队列管理接口

### 提交任务

```
POST /api/queue/tasks
```

**请求体**:
```json
{
  "media_type": "video",
  "media_id": "BV1xx411c7mD",
  "title": "视频标题"
}
```

### 创建调度器

```
POST /api/queue/schedulers
```

**请求体**:
```json
{
  "title": "下载任务",
  "folder": "/path/to/output"
}
```

### 启动调度器

```
POST /api/queue/schedulers/{scheduler_id}/start
```

## 缓存管理接口

### 获取缓存统计

```
GET /api/cache/stats
```

### 清理过期缓存

```
POST /api/cache/cleanup
```

### 清空所有缓存

```
POST /api/cache/clear
```

## 旧接口（已废弃）

以下接口已废弃，请使用统一的媒体接口：

- `GET /api/video/{video_id}` → 使用 `GET /api/media/video/{video_id}`
- `GET /api/favorites/folders/{folder_id}` → 使用 `GET /api/media/favorites/{folder_id}`
- `GET /api/watchlater/list` → 使用 `GET /api/media/watchlater`

## 错误码

- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误
```

## 实施步骤

### 步骤1：创建统一的媒体路由

```bash
touch apps/api/src/routers/media.py
```

### 步骤2：创建统一的Schema

```bash
touch apps/api/src/schemas/media.py
```

### 步骤3：更新main.py

编辑 `apps/api/main.py`，添加媒体路由。

### 步骤4：测试统一接口

```bash
# 测试视频信息
curl http://localhost:8000/api/media/video/BV1xx411c7mD

# 测试收藏夹信息
curl http://localhost:8000/api/media/favorites/123456

# 测试稍后再看
curl http://localhost:8000/api/media/watchlater
```

### 步骤5：更新前端API调用

修改前端代码，使用新的统一接口。

## 注意事项

1. **向后兼容**
   - 保留旧接口，标记为废弃
   - 逐步迁移前端到新接口
   - 提供迁移文档

2. **数据一致性**
   - 统一字段命名
   - 统一数据格式
   - 统一错误处理

3. **API文档**
   - 完善Swagger文档
   - 提供示例代码
   - 标注废弃接口

4. **版本管理**
   - 使用API版本号
   - 支持多版本并存
   - 平滑升级

5. **性能优化**
   - 统一使用缓存
   - 减少重复请求
   - 优化响应速度

6. **错误处理**
   - 统一错误码
   - 统一错误信息
   - 统一日志格式

## 总结

通过本阶段的实施，实现了：

1. ✅ 统一的媒体信息接口
2. ✅ 统一的数据结构
3. ✅ 清晰的API设计
4. ✅ 完善的文档
5. ✅ 向后兼容

## 完成清单

- [x] 阶段1：数据模型重构
- [x] 阶段2：队列管理系统
- [x] 阶段3：任务系统重构
- [x] 阶段4：缓存系统
- [x] 阶段5：处理器系统
- [x] 阶段6：API端点统一

## 下一步

所有核心功能已完成，可以开始：

1. **测试验证**：全面测试所有功能
2. **性能优化**：优化关键路径性能
3. **前端适配**：更新前端使用新API
4. **文档完善**：完善用户文档和开发文档
5. **发布准备**：准备版本发布