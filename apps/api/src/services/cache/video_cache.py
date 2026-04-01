import json
import time
from typing import Dict, List, Optional, Any
from pathlib import Path
import logging
import hashlib

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
        # 暂时返回空数据，因为BiliService还未集成
        info = {"success": False, "message": "API未集成"}

        # 4. 更新缓存
        cache_data = {
            'data': info,
            'timestamp': time.time()
        }
        self.cache[key] = cache_data
        self._save_to_db(key, cache_data, self.ttls['video_info'])

        return info

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
