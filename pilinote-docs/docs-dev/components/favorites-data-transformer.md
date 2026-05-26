# 收藏夹数据转换

## 概述

`MediaDataTransformer` 是一个统一的数据转换服务，负责将 B 站 API 返回的原始数据转换为前端使用的统一格式（`CardData`）。

在收藏夹功能中，`MediaDataTransformer` 负责将收藏夹视频列表转换为统一的卡片数据格式。

## 文件位置

```
apps/api/src/services/media_data_transformer.py
```

## 核心方法

### transform_favorite_list()

转换收藏夹视频列表为统一卡片格式。

```python
def transform_favorite_list(self, medias: List[Dict]) -> List[CardData]:
    """转换收藏夹视频列表为统一卡片格式
    
    Args:
        medias: B站API返回的收藏夹媒体列表
        
    Returns:
        List[CardData]: 转换后的卡片数据列表
    """
    cards = []
    for media in medias:
        if media.get('type') == 2:  # 视频类型
            card = self.transform_favorite_video(media)
            cards.append(card)
    return cards
```

**参数说明**：
- `medias`: B 站 API 返回的媒体列表

**返回值**：
- `List[CardData]`: 转换后的卡片数据列表

**类型过滤**：
- 只转换 `type == 2` 的视频类型
- 忽略音频（type=21）和文章（type=12）

### transform_favorite_video()

转换单个收藏夹视频数据。

```python
def transform_favorite_video(self, media: Dict) -> CardData:
    """转换单个收藏夹视频
    
    Args:
        media: B站API返回的单个媒体数据
        
    Returns:
        CardData: 转换后的卡片数据
    """
    return CardData(
        id=media.get('id', ''),
        bvid=media.get('id', ''),
        title=media.get('title', ''),
        cover=media.get('cover', ''),
        duration=self._format_duration(media.get('duration', 0)),
        uploader=self.normalize_uploader(media.get('upper', {})),
        stats=self.normalize_stats(media.get('cnt_info', {})),
        pubtime=media.get('pubtime', 0),
        cid=media.get('id', 0),  # 收藏夹中没有 cid，使用 id
        aid=media.get('id', 0)
    )
```

**字段映射**：

| B站字段 | CardData 字段 | 说明 |
|---------|---------------|------|
| `id` | `id`, `bvid`, `cid`, `aid` | 视频 ID（多个字段使用相同值） |
| `title` | `title` | 视频标题 |
| `cover` | `cover` | 视频封面 |
| `duration` | `duration` | 视频时长（格式化后） |
| `upper` | `uploader` | UP 主信息 |
| `cnt_info` | `stats` | 统计数据 |
| `pubtime` | `pubtime` | 发布时间戳 |

### normalize_stats()

统一统计数据格式。

```python
def normalize_stats(self, cnt_info: Dict) -> CardStats:
    """统一统计数据格式
    
    Args:
        cnt_info: B站API返回的统计信息
        
    Returns:
        CardStats: 统一的统计数据
    """
    return CardStats(
        view=cnt_info.get('play', 0),
        danmaku=cnt_info.get('danmaku', 0),
        comment=cnt_info.get('comment', 0),
        like=cnt_info.get('thumb_up', 0),
        coin=cnt_info.get('coin', 0),
        favorite=cnt_info.get('collect', 0),
        share=cnt_info.get('share', 0)
    )
```

**字段映射**：

| B站字段 | CardStats 字段 | 说明 |
|---------|----------------|------|
| `play` | `view` | 播放量 |
| `danmaku` | `danmaku` | 弹幕数 |
| `comment` | `comment` | 评论数 |
| `thumb_up` | `like` | 点赞数 |
| `coin` | `coin` | 投币数 |
| `collect` | `favorite` | 收藏数 |
| `share` | `share` | 分享数 |

### normalize_uploader()

统一 UP 主信息格式。

```python
def normalize_uploader(self, upper: Dict) -> UploaderInfo:
    """统一UP主信息格式
    
    Args:
        upper: B站API返回的UP主信息
        
    Returns:
        UploaderInfo: 统一的UP主信息
    """
    return UploaderInfo(
        name=upper.get('name', ''),
        mid=upper.get('mid', 0),
        face=upper.get('face', '')
    )
```

**字段映射**：

| B站字段 | UploaderInfo 字段 | 说明 |
|---------|-------------------|------|
| `name` | `name` | UP 主名称 |
| `mid` | `mid` | UP 主 ID |
| `face` | `face` | UP 主头像 |

### _format_duration()

格式化视频时长。

```python
def _format_duration(self, duration: int) -> str:
    """格式化视频时长
    
    Args:
        duration: 视频时长（秒）
        
    Returns:
        str: 格式化后的时长（MM:SS 或 HH:MM:SS）
    """
    if duration < 60:
        return f"00:{duration:02d}"
    elif duration < 3600:
        minutes = duration // 60
        seconds = duration % 60
        return f"{minutes:02d}:{seconds:02d}"
    else:
        hours = duration // 3600
        minutes = (duration % 3600) // 60
        seconds = duration % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
```

## 数据结构

### B站 API 原始数据

```json
{
  "type": 2,
  "id": "BV1xx411c7mD",
  "title": "视频标题",
  "cover": "https://example.com/cover.jpg",
  "duration": 630,
  "pubtime": 1640000000,
  "upper": {
    "name": "UP主名称",
    "mid": 123456789,
    "face": "https://example.com/avatar.jpg"
  },
  "cnt_info": {
    "play": 100000,
    "danmaku": 5000,
    "comment": 2000,
    "thumb_up": 5000,
    "coin": 1000,
    "collect": 2000,
    "share": 500
  }
}
```

### CardData 统一格式

```python
from pydantic import BaseModel
from typing import Dict

class CardStats(BaseModel):
    """卡片统计数据"""
    view: int
    danmaku: int
    comment: int
    like: int
    coin: int
    favorite: int
    share: int

class UploaderInfo(BaseModel):
    """UP主信息"""
    name: str
    mid: int
    face: str

class CardData(BaseModel):
    """统一卡片数据"""
    id: str
    bvid: str
    title: str
    cover: str
    duration: str
    uploader: UploaderInfo
    stats: CardStats
    pubtime: int
    cid: int
    aid: int
```

```json
{
  "id": "BV1xx411c7mD",
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "cover": "https://example.com/cover.jpg",
  "duration": "10:30",
  "uploader": {
    "name": "UP主名称",
    "mid": 123456789,
    "face": "https://example.com/avatar.jpg"
  },
  "stats": {
    "view": 100000,
    "danmaku": 5000,
    "comment": 2000,
    "like": 5000,
    "coin": 1000,
    "favorite": 2000,
    "share": 500
  },
  "pubtime": 1640000000,
  "cid": 0,
  "aid": 0
}
```

## 使用示例

### 后端 API 使用

```python
# apps/api/src/routers/favorites.py
from src.services.media_data_transformer import transformer

@router.get("/folders/{folder_id}", response_model=CardListResponse)
async def get_folder_detail(
    folder_id: int,
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query("mtime", description="排序方式"),
    type: str = Query("0", description="类型"),
    tid: int = Query(0, description="分区ID")
):
    """获取收藏夹详情"""
    user, sessdata = user_sessdata
    
    service = BilibiliService()
    try:
        result = await service.get_folder_detail(
            sessdata, folder_id, page, page_size, keyword, order, type, tid
        )
        
        if result["success"]:
            data = result["data"]
            medias = data.get("medias", [])
            
            # 使用统一转换器转换数据
            video_list = transformer.transform_favorite_list(medias)
            
            # 转换为字典格式（保持向后兼容）
            list_data = [card.model_dump() for card in video_list]
            
            return CardListResponse(
                success=True,
                data={
                    "medias": list_data,
                    "page_size": page_size,
                    "info": data.get("info", {})
                },
                total=data.get("info", {}).get("media_count", 0)
            )
    finally:
        service.close()
```

## 与 Watch Later 对比

### 数据来源差异

| 功能 | 收藏夹 | 稍后再看 |
|------|--------|----------|
| API 端点 | `/fav/v2/fav/folder/list` | `/x/v2/history/toview` |
| 数据结构 | `cnt_info` | `stat` |
| UP 主字段 | `upper` | `owner` |
| 统计字段 | `thumb_up` | `like` |

### 字段映射差异

| 功能 | 收藏夹字段 | 稍后再看字段 | CardData 字段 |
|------|-----------|-------------|---------------|
| 播放量 | `cnt_info.play` | `stat.view` | `stats.view` |
| 点赞数 | `cnt_info.thumb_up` | `stat.like` | `stats.like` |
| UP 主名称 | `upper.name` | `owner.name` | `uploader.name` |

### 转换方法差异

```python
# 收藏夹转换
def transform_favorite_video(self, media: Dict) -> CardData:
    return CardData(
        stats=self.normalize_stats(media.get('cnt_info', {})),
        uploader=self.normalize_uploader(media.get('upper', {})),
        # ...
    )

# 稍后再看转换
def transform_toview_video(self, video: Dict) -> CardData:
    return CardData(
        stats=self.normalize_stats(video.get('stat', {})),
        uploader=self.normalize_uploader(video.get('owner', {})),
        # ...
    )
```

## 性能优化

### 1. 批量转换

```python
def transform_favorite_list(self, medias: List[Dict]) -> List[CardData]:
    """批量转换收藏夹视频列表"""
    cards = []
    for media in medias:
        if media.get('type') == 2:  # 类型过滤
            card = self.transform_favorite_video(media)
            cards.append(card)
    return cards
```

### 2. 类型过滤

只转换视频类型（type=2），忽略音频和文章，减少不必要的转换。

### 3. 默认值处理

所有字段都提供默认值，避免 KeyError。

```python
id=media.get('id', ''),
title=media.get('title', ''),
```

### 4. 数据完整化优化

**问题**：
- 收藏夹API原始数据缺少完整的评论数和分享数
- `cnt_info.reply` 和 `cnt_info.share` 字段可能为0或不准确

**解决方案**：
- **并发获取**：使用异步并发获取视频详情，限制并发数为3
- **智能缓存**：优先从缓存获取视频详情，减少B站API调用
- **速度提升**：10个视频从10次串行调用优化为4批次并发调用，速度提升约2.5倍
- **异常隔离**：单个视频获取失败不影响其他视频的加载

**实现位置**：
- 主要转换逻辑：`apps/api/src/routers/favorites.py`
- 缓存服务：`apps/api/src/services/cache/video_cache.py`

### 5. 多层缓存机制

**缓存架构**：
- **内存缓存**：1小时TTL，最快响应速度
- **数据库缓存**：持久化存储，支持服务重启
- **缓存策略**：视频详情信息优先从缓存获取

**缓存效果**：
- 首次请求：调用B站API获取完整数据
- 再次请求：直接从内存缓存返回
- 缓存有效期：1小时

## 注意事项

1. **CID 问题**：收藏夹 API 返回的数据中没有 `cid`，转换时使用 `id` 作为 `cid` 的值
2. **类型过滤**：只转换视频类型（type=2），忽略其他类型
3. **时长格式**：时长需要格式化为 `MM:SS` 或 `HH:MM:SS` 格式
4. **统计字段**：收藏夹使用 `cnt_info`，稍后再看使用 `stat`
5. **UP 主字段**：收藏夹使用 `upper`，稍后再看使用 `owner`
6. **数据完整性**：评论数和分享数通过异步获取视频详情补充
7. **性能平衡**：并发限制为3，平衡速度和系统负载

## 相关文档

- CardData 数据模型：统一数据模型定义以 `apps/web/src/components/media-list/MediaListState.tsx` 与后端返回结构为准（当前无独立 docs 条目时以源码为准）
- [收藏夹 API](../api/favorites-api.md) - API 文档
- [稍后再看数据转换](./toview-data-transformer.md) - 稍后再看转换
- [API 实现文档](../api/implementation.md) - 性能优化实现详情

---

[返回上级](./README.md)
