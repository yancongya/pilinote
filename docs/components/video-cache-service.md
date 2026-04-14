# VideoCacheService 视频缓存服务

## 概述

`VideoCacheService` 是一个高性能的缓存服务，用于缓存B站视频详情信息，减少API调用次数，提升系统性能。

## 文件位置

```
apps/api/src/services/cache/video_cache.py
```

## 主要功能

### 1. 多层缓存架构

**内存缓存**：
- 最快的响应速度
- 适合频繁访问的数据
- 服务重启后丢失

**数据库缓存**：
- 持久化存储
- 支持服务重启
- 作为内存缓存的后备

### 2. 缓存策略

**TTL配置**：
```python
self.ttls = {
    'video_info': 3600,        # 视频信息：1小时
    'favorites': 600,          # 收藏夹列表：10分钟
    'watch_later': 300,        # 稍后再看：5分钟
    'user_info': 3600,         # 用户信息：1小时
    'uploader_info': 7200,     # UP主信息：2小时
}
```

**缓存流程**：
1. 检查内存缓存（最快）
2. 检查数据库缓存（备用）
3. 从B站API获取数据
4. 更新内存和数据库缓存

### 3. 异步数据获取

**主要方法**：
```python
async def get_video_info(self, bvid: str, sessdata: str = "") -> dict:
    """获取视频信息（带缓存）
    
    Args:
        bvid: 视频BV号
        sessdata: SESSDATA（可选）
        
    Returns:
        dict: 视频详情信息
    """
```

**并发优化**：
- 使用信号量限制并发数
- 避免过多并发请求导致系统负载过高
- 提升整体响应速度

## 使用示例

### 基础使用

```python
from src.services.cache.video_cache import VideoCacheService

cache_service = VideoCacheService()

# 获取视频信息
video_info = await cache_service.get_video_info("BV1JA9wBqEbi", "your_sessdata")

if video_info.get("success"):
    stat = video_info["data"].get("stat", {})
    print(f"评论数: {stat.get('reply', 0)}")
    print(f"分享数: {stat.get('share', 0)}")
```

### 并发使用

```python
import asyncio

async def get_multiple_videos(bvids: list, sessdata: str):
    """并发获取多个视频信息"""
    cache_service = VideoCacheService()
    
    # 限制并发数为3
    semaphore = asyncio.Semaphore(3)
    
    async def get_with_semaphore(bvid):
        async with semaphore:
            return await cache_service.get_video_info(bvid, sessdata)
    
    # 并发获取
    results = await asyncio.gather(
        *[get_with_semaphore(bvid) for bvid in bvids],
        return_exceptions=True
    )
    
    return results
```

## 性能优化

### 1. 缓存命中率

**内存缓存**：
- 命中速度：约0.1毫秒
- 适合频繁访问的热门视频

**数据库缓存**：
- 命中速度：约10毫秒
- 作为内存缓存的后备

**API调用**：
- 响应速度：约1秒（取决于网络）
- 最慢，但数据最新

### 2. 并发优化

**并发限制**：
- 默认并发数：3
- 平衡速度和系统负载
- 避免触发B站API频率限制

**速度提升**：
- 10个视频：从10秒优化到4秒
- 提升约2.5倍

### 3. 缓存预热

**预热策略**：
- 系统启动时预热热门视频
- 减少首次访问延迟
- 提升用户体验

## 缓存管理

### 清除缓存

```python
# 清除单个视频缓存
cache_service.invalidate('video_info', bvid='BV1JA9wBqEbi')

# 清除所有视频缓存
cache_service.clear_all()

# 清除过期缓存
cache_service.cleanup_expired()
```

### 缓存统计

```python
stats = cache_service.get_stats()

print(f"内存缓存数量: {stats['memory_count']}")
print(f"数据库缓存数量: {stats['db_count']}")
print(f"总缓存大小: {stats['total_size']} bytes")
```

## 注意事项

1. **缓存一致性**：
   - 视频数据变化后需要清除缓存
   - TTL设置为1小时，平衡新鲜度和性能

2. **内存管理**：
   - 内存缓存大小受限于服务器内存
   - 使用LRU策略管理内存缓存

3. **并发限制**：
   - 默认并发数为3，避免系统过载
   - 可根据服务器性能调整

4. **错误处理**：
   - 缓存获取失败时降级到API调用
   - 单个失败不影响整体性能

## 性能指标

| 操作 | 无缓存 | 内存缓存 | 数据库缓存 |
|------|--------|----------|------------|
| 获取视频信息 | ~1000ms | ~0.1ms | ~10ms |
| 并发10个视频 | ~10000ms | ~0.1ms | ~10ms |
| 缓存命中率 | 0% | ~90% | ~99% |

## 相关文档

- [收藏夹API](../api/favorites-api.md) - 使用缓存服务的API
- [BilibiliService](./bilibili-service.md) - B站API服务
- [API实现文档](../api/implementation.md) - 缓存机制实现

---

[返回上级](./README.md)