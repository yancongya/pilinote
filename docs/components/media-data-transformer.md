# MediaDataTransformer 数据转换

## 概述

统一数据转换层，将 Bilibili API 原始数据转换为标准 CardData 格式。

## 文件位置

`apps/api/src/services/media_data_transformer.py`

## 主要功能

### 数据归一化

| 方法 | 说明 |
|------|------|
| `normalize_stats()` | 归一化统计数据 |
| `transform_video()` | 转换视频数据 |
| `transform_favorite_list()` | 转换收藏夹列表 |
| `transform_watchlater_list()` | 转换稍后再看列表 |

## CardData 结构

```python
class CardData:
    id: str
    bvid: str
    title: str
    cover: str
    duration: str
    pubtime: int  # 发布时间
    add_time: int  # 添加/收藏时间
    uploader: UploaderInfo
    stats: CardStats
    uploaded_at: Optional[str]
```

## 字段映射说明

### 稍后再看视频字段映射

| CardData字段 | B站API字段 | 说明 |
|-------------|-----------|------|
| `id` | `id` | 视频ID |
| `bvid` | `bvid` | BV号 |
| `title` | `title` | 视频标题 |
| `cover` | `pic` | 封面URL |
| `duration` | `duration` | 视频时长（秒） |
| `pubtime` | `pubdate` | 发布时间（优先）或`pubtime` |
| `add_time` | `add_time` | 添加到稍后再看的时间 |
| `view` | `stat.view` | 播放量 |
| `danmaku` | `stat.danmaku` | 弹幕数 |
| `comment` | `stat.reply` | 评论数 |
| `like` | `stat.like` | 点赞数 |
| `coin` | `stat.coin` | 投币数 |
| `favorite` | `stat.favorite` | 收藏数 |
| `share` | `stat.share` | 分享数 |

### 收藏夹视频字段映射

| CardData字段 | B站API字段 | 说明 |
|-------------|-----------|------|
| `id` | `id` | 视频ID |
| `bvid` | `bvid` | BV号 |
| `title` | `title` | 视频标题 |
| `cover` | `cover` | 封面URL |
| `duration` | `duration` | 视频时长（秒） |
| `pubtime` | `pubtime` | 发布时间 |
| `add_time` | `fav_time` | 收藏时间 |
| `view` | `cnt_info.play` | 播放量 |
| `danmaku` | `cnt_info.danmaku` | 弹幕数 |
| `comment` | `cnt_info.reply` | 评论数 |
| `like` | `cnt_info.like` | 点赞数 |
| `coin` | `cnt_info.coin` | 投币数 |
| `favorite` | `cnt_info.collect` | 收藏数 |
| `share` | `cnt_info.share` | 分享数 |

## 重要修复

### 1. 发布时间字段映射修复

**问题**: 稍后再看API返回的发布时间字段名不一致，导致排序失效

**修复**: 优先使用`pubdate`字段，如果不存在则使用`pubtime`

```python
# 修复前
pubtime=raw_video.get("pubtime", 0),

# 修复后
pubtime=raw_video.get("pubdate", raw_video.get("pubtime", 0)),
```

### 2. 收藏时间字段添加

**问题**: 收藏页排序功能缺少收藏时间字段，导致按收藏时间排序无效

**修复**: 添加`add_time`字段，使用`fav_time`作为收藏时间

```python
# 修复前
# 缺少add_time字段

# 修复后
add_time=raw_media.get("fav_time", 0),  # 收藏时间
```

### 3. 统一字段提升

**问题**: 前端需要访问统计字段，但需要通过`stats`属性

**修复**: 将统计字段提升到顶层，方便前端访问

```python
# 将stats字段提升到顶层
view=stats.view,
danmaku=stats.danmaku,
comment=stats.comment,
like=stats.like,
coin=stats.coin,
favorite=stats.favorite,
share=stats.share
```

## 使用方式

```python
from src.services.media_data_transformer import MediaDataTransformer

transformer = MediaDataTransformer()

# 归一化统计数据
stats = transformer.normalize_stats(
    raw_stats={"view": 1000, "like": 100},
    backup_stats={"play": 2000}
)

# 转换收藏夹列表
cards = transformer.transform_favorite_list(raw_data)
```

## 数据来源

| 来源 | 转换方法 |
|------|----------|
| 收藏夹 | `transform_favorite_list()` |
| 稍后再看 | `transform_watchlater_list()` |
| 搜索结果 | `transform_search_result()` |

## 关联服务

- [BilibiliService](bilibili-service.md) - Bilibili API 服务
- [VideoCacheService](../api/implementation.md#缓存机制) - 视频缓存服务
- [MediaProcessor](media-processor.md) - 媒体处理

## 性能优化

**收藏夹数据完整化**：
- 收藏夹API原始数据缺少完整的评论数和分享数
- 通过VideoCacheService异步获取视频详情
- 使用并发限制优化（最多3个并发）
- 多层缓存机制（内存+数据库）

**缓存策略**：
- 视频详情信息缓存1小时
- 优先从缓存获取，减少B站API调用
- 异常隔离，单个失败不影响其他视频

---

[返回上级](./README.md)