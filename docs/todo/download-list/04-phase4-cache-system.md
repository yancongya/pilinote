# 阶段4：缓存系统

## 概述

本阶段的目标是实现视频数据缓存系统，参考BiliTools的架构设计，使用SQLite+内存双缓存机制，解决当前项目中所有视频信息都从B站API实时获取、加载速度慢、API调用频繁的问题。

## 核心问题

### 当前问题

1. **缺少视频数据缓存**
   - 所有视频信息都从B站API实时获取
   - 收藏夹和稍后再看列表每次都需要网络请求
   - 没有本地缓存机制减少API调用

2. **HeadersManager功能有限**
   - 只缓存HTTP Headers
   - 不缓存响应数据
   - TTL固定为60秒

3. **容易触发B站限流**
   - 频繁的API调用
   - 没有请求频率控制
   - 容易被B站限制

## 解决方案

### 1. VideoCacheService - 视频缓存服务

**文件**: `apps/api/src/services/cache/video_cache.py`

```python
import json
import time
from typing import Dict, List, Optional, Any
from pathlib import Path
import logging
import hashlib

from services.bilibili import BilibiliService

logger = logging.getLogger(__name__)

class VideoCacheService:
    """视频缓存服务"""

    _instance: Optional['VideoCacheService'] = None

    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True

        # 内存缓存
        self.cache: Dict[str, dict] = {}

        # TTL配置
        self.ttls = {
            'video_info': 3600,        # 视频信息：1小时
            'favorites': 600,          # 收藏夹列表：10分钟
            'watchlater': 300,         # 稍后再看：5分钟
            'user_info': 3600,         # 用户信息：1小时
            'uploader_info': 7200,     # UP主信息：2小时
        }

        # 数据库路径
        self.db_path = Path("data/video_cache.db")
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        import sqlite3

        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 创建缓存表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                ttl INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)

        # 创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_created_at
            ON cache(created_at)
        """)

        conn.commit()
        conn.close()

        logger.info(f"✓ 视频缓存数据库已初始化: {self.db_path}")

    def _generate_key(self, cache_type: str, **kwargs) -> str:
        """生成缓存键"""
        # 将参数转换为字符串并排序
        params = sorted(kwargs.items())
        param_str = json.dumps(params, sort_keys=True)

        # 生成哈希
        hash_obj = hashlib.md5(f"{cache_type}:{param_str}".encode())
        return hash_obj.hexdigest()

    async def get_video_info(self, bvid: str) -> dict:
        """获取视频信息（带缓存）"""
        key = self._generate_key('video_info', bvid=bvid)

        # 1. 检查内存缓存
        if key in self.cache:
            cached = self.cache[key]
            if time.time() - cached['timestamp'] < self.ttls['video_info']:
                logger.debug(f"✓ 视频信息命中内存缓存: {bvid}")
                return cached['data']

        # 2. 检查数据库缓存
        db_cached = self._get_from_db(key)
        if db_cached:
            if time.time() - db_cached['timestamp'] < self.ttls['video_info']:
                # 加载到内存缓存
                self.cache[key] = db_cached
                logger.debug(f"✓ 视频信息命中数据库缓存: {bvid}")
                return db_cached['data']

        # 3. 从B站API获取
        logger.info(f"从B站API获取视频信息: {bvid}")
        info = await BilibiliService.get_video_info(bvid)

        # 4. 更新缓存
        cache_data = {
            'data': info,
            'timestamp': time.time()
        }
        self.cache[key] = cache_data
        self._save_to_db(key, cache_data, self.ttls['video_info'])

        return info

    async def get_favorites(self, fid: str, mid: str) -> List[dict]:
        """获取收藏夹列表（带缓存）"""
        key = self._generate_key('favorites', fid=fid, mid=mid)

        # 1. 检查内存缓存
        if key in self.cache:
            cached = self.cache[key]
            if time.time() - cached['timestamp'] < self.ttls['favorites']:
                logger.debug(f"✓ 收藏夹列表命中内存缓存: {fid}")
                return cached['data']

        # 2. 检查数据库缓存
        db_cached = self._get_from_db(key)
        if db_cached:
            if time.time() - db_cached['timestamp'] < self.ttls['favorites']:
                # 加载到内存缓存
                self.cache[key] = db_cached
                logger.debug(f"✓ 收藏夹列表命中数据库缓存: {fid}")
                return db_cached['data']

        # 3. 从B站API获取
        logger.info(f"从B站API获取收藏夹列表: {fid}")
        favorites = await BilibiliService.get_favorites(fid, mid)

        # 4. 更新缓存
        cache_data = {
            'data': favorites,
            'timestamp': time.time()
        }
        self.cache[key] = cache_data
        self._save_to_db(key, cache_data, self.ttls['favorites'])

        return favorites

    async def get_watchlater(self) -> List[dict]:
        """获取稍后再看列表（带缓存）"""
        key = self._generate_key('watchlater')

        # 1. 检查内存缓存
        if key in self.cache:
            cached = self.cache[key]
            if time.time() - cached['timestamp'] < self.ttls['watchlater']:
                logger.debug(f"✓ 稍后再看列表命中内存缓存")
                return cached['data']

        # 2. 检查数据库缓存
        db_cached = self._get_from_db(key)
        if db_cached:
            if time.time() - db_cached['timestamp'] < self.ttls['watchlater']:
                # 加载到内存缓存
                self.cache[key] = db_cached
                logger.debug(f"✓ 稍后再看列表命中数据库缓存")
                return db_cached['data']

        # 3. 从B站API获取
        logger.info(f"从B站API获取稍后再看列表")
        watchlater = await BilibiliService.get_watchlater()

        # 4. 更新缓存
        cache_data = {
            'data': watchlater,
            'timestamp': time.time()
        }
        self.cache[key] = cache_data
        self._save_to_db(key, cache_data, self.ttls['watchlater'])

        return watchlater

    async def get_user_info(self, mid: str) -> dict:
        """获取用户信息（带缓存）"""
        key = self._generate_key('user_info', mid=mid)

        # 1. 检查内存缓存
        if key in self.cache:
            cached = self.cache[key]
            if time.time() - cached['timestamp'] < self.ttls['user_info']:
                logger.debug(f"✓ 用户信息命中内存缓存: {mid}")
                return cached['data']

        # 2. 检查数据库缓存
        db_cached = self._get_from_db(key)
        if db_cached:
            if time.time() - db_cached['timestamp'] < self.ttls['user_info']:
                # 加载到内存缓存
                self.cache[key] = db_cached
                logger.debug(f"✓ 用户信息命中数据库缓存: {mid}")
                return db_cached['data']

        # 3. 从B站API获取
        logger.info(f"从B站API获取用户信息: {mid}")
        user_info = await BilibiliService.get_user_info(mid)

        # 4. 更新缓存
        cache_data = {
            'data': user_info,
            'timestamp': time.time()
        }
        self.cache[key] = cache_data
        self._save_to_db(key, cache_data, self.ttls['user_info'])

        return user_info

    async def get_uploader_info(self, mid: str) -> dict:
        """获取UP主信息（带缓存）"""
        key = self._generate_key('uploader_info', mid=mid)

        # 1. 检查内存缓存
        if key in self.cache:
            cached = self.cache[key]
            if time.time() - cached['timestamp'] < self.ttls['uploader_info']:
                logger.debug(f"✓ UP主信息命中内存缓存: {mid}")
                return cached['data']

        # 2. 检查数据库缓存
        db_cached = self._get_from_db(key)
        if db_cached:
            if time.time() - db_cached['timestamp'] < self.ttls['uploader_info']:
                # 加载到内存缓存
                self.cache[key] = db_cached
                logger.debug(f"✓ UP主信息命中数据库缓存: {mid}")
                return db_cached['data']

        # 3. 从B站API获取
        logger.info(f"从B站API获取UP主信息: {mid}")
        uploader_info = await BilibiliService.get_uploader_info(mid)

        # 4. 更新缓存
        cache_data = {
            'data': uploader_info,
            'timestamp': time.time()
        }
        self.cache[key] = cache_data
        self._save_to_db(key, cache_data, self.ttls['uploader_info'])

        return uploader_info

    def _get_from_db(self, key: str) -> Optional[dict]:
        """从数据库获取缓存"""
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute(
                "SELECT value, created_at FROM cache WHERE key = ?",
                (key,)
            )
            row = cursor.fetchone()

            if row:
                value, created_at = row
                return {
                    'data': json.loads(value),
                    'timestamp': created_at
                }
            return None
        finally:
            conn.close()

    def _save_to_db(self, key: str, data: dict, ttl: int):
        """保存缓存到数据库"""
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute("""
                INSERT OR REPLACE INTO cache (key, value, ttl, created_at)
                VALUES (?, ?, ?, ?)
            """, (
                key,
                json.dumps(data['data']),
                ttl,
                data['timestamp']
            ))
            conn.commit()
        finally:
            conn.close()

    async def invalidate(self, cache_type: str, **kwargs):
        """使缓存失效"""
        key = self._generate_key(cache_type, **kwargs)

        # 从内存缓存中删除
        if key in self.cache:
            del self.cache[key]

        # 从数据库缓存中删除
        self._delete_from_db(key)

        logger.info(f"✓ 缓存已失效: {cache_type} {kwargs}")

    def _delete_from_db(self, key: str):
        """从数据库删除缓存"""
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute("DELETE FROM cache WHERE key = ?", (key,))
            conn.commit()
        finally:
            conn.close()

    async def clear_all(self):
        """清空所有缓存"""
        # 清空内存缓存
        self.cache.clear()

        # 清空数据库缓存
        self._clear_db()

        logger.info("✓ 所有缓存已清空")

    def _clear_db(self):
        """清空数据库缓存"""
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute("DELETE FROM cache")
            conn.commit()
        finally:
            conn.close()

    async def cleanup_expired(self):
        """清理过期缓存"""
        import sqlite3

        current_time = time.time()
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # 获取所有缓存
            cursor.execute("SELECT key, created_at, ttl FROM cache")
            rows = cursor.fetchall()

            # 找出过期的缓存
            expired_keys = []
            for key, created_at, ttl in rows:
                if current_time - created_at > ttl:
                    expired_keys.append(key)

            # 删除过期缓存
            if expired_keys:
                cursor.executemany(
                    "DELETE FROM cache WHERE key = ?",
                    [(key,) for key in expired_keys]
                )
                conn.commit()
                logger.info(f"✓ 已清理 {len(expired_keys)} 个过期缓存")

        finally:
            conn.close()

    def get_stats(self) -> dict:
        """获取缓存统计信息"""
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # 统计总数
            cursor.execute("SELECT COUNT(*) FROM cache")
            total_count = cursor.fetchone()[0]

            # 统计内存缓存数
            memory_count = len(self.cache)

            # 统计过期缓存数
            current_time = time.time()
            cursor.execute("SELECT key, created_at, ttl FROM cache")
            rows = cursor.fetchall()
            expired_count = sum(
                1 for _, created_at, ttl in rows
                if current_time - created_at > ttl
            )

            return {
                'total_count': total_count,
                'memory_count': memory_count,
                'expired_count': expired_count,
                'db_path': str(self.db_path)
            }
        finally:
            conn.close()

# 全局单例
video_cache = VideoCacheService()
```

### 2. 更新BilibiliService使用缓存

**文件**: `apps/api/src/services/bilibili.py`

```python
from services.cache.video_cache import video_cache

class BilibiliService:
    """B站API服务"""

    @staticmethod
    async def get_video_info(bvid: str) -> dict:
        """获取视频信息"""
        # 使用缓存
        return await video_cache.get_video_info(bvid)

    @staticmethod
    async def get_favorites(fid: str, mid: str) -> List[dict]:
        """获取收藏夹列表"""
        # 使用缓存
        return await video_cache.get_favorites(fid, mid)

    @staticmethod
    async def get_watchlater() -> List[dict]:
        """获取稍后再看列表"""
        # 使用缓存
        return await video_cache.get_watchlater()

    @staticmethod
    async def get_user_info(mid: str) -> dict:
        """获取用户信息"""
        # 使用缓存
        return await video_cache.get_user_info(mid)

    @staticmethod
    async def get_uploader_info(mid: str) -> dict:
        """获取UP主信息"""
        # 使用缓存
        return await video_cache.get_uploader_info(mid)

    @staticmethod
    async def invalidate_video_cache(bvid: str):
        """使视频缓存失效"""
        await video_cache.invalidate('video_info', bvid=bvid)

    @staticmethod
    async def invalidate_favorites_cache(fid: str, mid: str):
        """使收藏夹缓存失效"""
        await video_cache.invalidate('favorites', fid=fid, mid=mid)

    @staticmethod
    async def invalidate_watchlater_cache():
        """使稍后再看缓存失效"""
        await video_cache.invalidate('watchlater')
```

### 3. 缓存管理API端点

**文件**: `apps/api/src/routers/cache.py`

```python
from fastapi import APIRouter, HTTPException
import logging

from services.cache.video_cache import video_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cache", tags=["cache"])

@router.get("/stats")
async def get_cache_stats():
    """获取缓存统计信息"""
    return video_cache.get_stats()

@router.post("/cleanup")
async def cleanup_expired_cache():
    """清理过期缓存"""
    await video_cache.cleanup_expired()
    return {"message": "过期缓存已清理"}

@router.post("/clear")
async def clear_all_cache():
    """清空所有缓存"""
    await video_cache.clear_all()
    return {"message": "所有缓存已清空"}

@router.post("/invalidate/video/{bvid}")
async def invalidate_video_cache(bvid: str):
    """使视频缓存失效"""
    from services.bilibili import BilibiliService
    await BilibiliService.invalidate_video_cache(bvid)
    return {"message": f"视频 {bvid} 缓存已失效"}

@router.post("/invalidate/favorites/{fid}/{mid}")
async def invalidate_favorites_cache(fid: str, mid: str):
    """使收藏夹缓存失效"""
    from services.bilibili import BilibiliService
    await BilibiliService.invalidate_favorites_cache(fid, mid)
    return {"message": f"收藏夹 {fid} 缓存已失效"}

@router.post("/invalidate/watchlater")
async def invalidate_watchlater_cache():
    """使稍后再看缓存失效"""
    from services.bilibili import BilibiliService
    await BilibiliService.invalidate_watchlater_cache()
    return {"message": "稍后再看缓存已失效"}
```

### 4. 应用启动时清理过期缓存

**文件**: `apps/api/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routers import queue, download, video, favorites, watchlater, auth, settings, cache
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

# 注册路由
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

## 实施步骤

### 步骤1：创建缓存服务目录

```bash
mkdir -p apps/api/src/services/cache
```

### 步骤2：创建VideoCacheService

```bash
touch apps/api/src/services/cache/video_cache.py
touch apps/api/src/services/cache/__init__.py
```

### 步骤3：更新BilibiliService

编辑 `apps/api/src/services/bilibili.py`，添加缓存支持。

### 步骤4：创建缓存管理路由

```bash
touch apps/api/src/routers/cache.py
```

### 步骤5：更新main.py

编辑 `apps/api/main.py`，添加缓存路由和启动清理。

### 步骤6：重启API服务

```bash
cd apps/api
python3 main.py
```

### 步骤7：测试缓存

```bash
# 测试缓存统计
curl http://localhost:8000/api/cache/stats

# 测试清理过期缓存
curl -X POST http://localhost:8000/api/cache/cleanup

# 测试清空所有缓存
curl -X POST http://localhost:8000/api/cache/clear

# 测试使缓存失效
curl -X POST http://localhost:8000/api/cache/invalidate/video/BV1xx411c7mD
```

## 注意事项

1. **缓存策略**
   - 内存缓存：快速访问，但容量有限
   - 数据库缓存：持久化存储，容量大
   - 双层缓存：结合两者优势

2. **TTL配置**
   - 视频信息：1小时（变化较少）
   - 收藏夹列表：10分钟（可能变化）
   - 稍后再看：5分钟（经常变化）
   - 用户信息：1小时（变化较少）
   - UP主信息：2小时（变化最少）

3. **缓存失效**
   - 支持手动失效
   - 自动过期清理
   - 定期清理任务

4. **性能优化**
   - 使用哈希生成键，避免键冲突
   - 批量删除过期缓存
   - 索引优化查询性能

5. **数据一致性**
   - 缓存更新与数据库更新同步
   - 避免脏数据
   - 支持强制刷新

6. **监控**
   - 提供缓存统计信息
   - 监控缓存命中率
   - 调整TTL配置

## 下一步

完成本阶段后，进入**阶段5：处理器系统**，实现子任务处理器系统，分离文件处理逻辑。