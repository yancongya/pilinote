# 稍后再看数据转换

## 概述

`MediaDataTransformer` 是一个统一的数据转换服务，负责将 B 站 API 返回的原始数据转换为前端使用的统一格式（`CardData`）。

在稍后再看功能中，`MediaDataTransformer` 负责将稍后再看视频列表转换为统一的卡片数据格式。

## 文件位置

```
apps/api/src/services/media_data_transformer.py
```

## 核心方法

### transform_watchlater_list()

转换稍后再看视频列表为统一卡片格式。

```python
def transform_watchlater_list(self, videos: List[Dict]) -> List[CardData]:
    """转换稍后再看视频列表为统一卡片格式
    
    Args:
        videos: B站API返回的稍后再看视频列表
        
    Returns:
        List[CardData]: 转换后的卡片数据列表
    """
    cards = []
    for video in videos:
        card = self.transform_watchlater_video(video)
        cards.append(card)
    return cards
```

**参数说明**：
- `videos`: B 站 API 返回的视频列表

**返回值**：
- `List[CardData]`: 转换后的卡片数据列表

### transform_watchlater_video()

转换单个稍后再看视频数据。

```python
def transform_watchlater_video(self, video: Dict) -> CardData:
    """转换单个稍后再看视频
    
    Args:
        video: B站API返回的单个视频数据
        
    Returns:
        CardData: 转换后的卡片数据
    """
    return CardData(
        id=video.get('aid', 0),
        bvid=video.get('bvid', ''),
        title=video.get('title', ''),
        cover=video.get('pic', ''),
        duration=video.get('duration', 0),
        uploader=self.normalize_uploader(video.get('owner', {})),
        stats=self.normalize_stats(video.get('stat', {})),
        pubtime=video.get('pubtime', 0),
        cid=video.get('cid', 0),
        aid=video.get('aid', 0),
        progress=video.get('progress', 0),
        add_time=video.get('add_time', 0),
        intro=video.get('intro', '')
    )
```

**字段映射**：

| B站字段 | CardData 字段 | 说明 |
|---------|---------------|------|
| `aid` | `id`, `aid` | 视频 ID（数字类型） |
| `bvid` | `bvid` | B 站视频 ID |
| `title` | `title` | 视频标题 |
| `pic` | `cover` | 视频封面 |
| `duration` | `duration` | 视频时长（秒数） |
| `owner` | `uploader` | UP 主信息 |
| `stat` | `stats` | 统计数据 |
| `pubtime` | `pubtime` | 发布时间戳 |
| `cid` | `cid` | 视频 CID |
| `aid` | `aid` | 视频 AID |
| `progress` | `progress` | 观看进度（秒数） |
| `add_time` | `add_time` | 添加到稍后再看的时间戳 |
| `intro` | `intro` | 视频简介 |

### normalize_stats()

统一统计数据格式。

```python
def normalize_stats(self, stat: Dict) -> CardStats:
    """统一统计数据格式（稍后再看版本）
    
    Args:
        stat: B站API返回的统计信息
        
    Returns:
        CardStats: 统一的统计数据
    """
    return CardStats(
        view=stat.get('view', 0),
        danmaku=stat.get('danmaku', 0),
        comment=stat.get('comment', 0),
        like=stat.get('like', 0),
        coin=stat.get('coin', 0),
        favorite=stat.get('collect', 0),
        share=stat.get('share', 0)
    )
```

**字段映射**：

| B站字段 | CardStats 字段 | 说明 |
|---------|----------------|------|
| `view` | `view` | 播放量 |
| `danmaku` | `danmaku` | 弹幕数 |
| `comment` | `comment` | 评论数 |
| `like` | `like` | 点赞数 |
| `coin` | `coin` | 投币数 |
| `collect` | `favorite` | 收藏数 |
| `share` | `share` | 分享数 |

### normalize_uploader()

统一 UP 主信息格式。

```python
def normalize_uploader(self, owner: Dict) -> UploaderInfo:
    """统一UP主信息格式（稍后再看版本）
    
    Args:
        owner: B站API返回的UP主信息
        
    Returns:
        UploaderInfo: 统一的UP主信息
    """
    return UploaderInfo(
        name=owner.get('name', ''),
        mid=owner.get('mid', 0),
        face=owner.get('face', '')
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
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "pic": "https://example.com/cover.jpg",
  "duration": 630,
  "pubtime": 1640000000,
  "add_time": 1640000000,
  "progress": 315,
  "owner": {
    "name": "UP主名称",
    "mid": 123456789,
    "face": "https://example.com/avatar.jpg"
  },
  "stat": {
    "view": 100000,
    "danmaku": 5000,
    "comment": 2000,
    "like": 5000,
    "coin": 1000,
    "collect": 2000,
    "share": 500
  },
  "cid": 123456789,
  "aid": 987654321
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
    id: int  # aid (数字类型)
    bvid: str
    title: str
    cover: str
    duration: int  # 秒数（不是格式化字符串）
    uploader: UploaderInfo
    stats: CardStats
    pubtime: int
    cid: int
    aid: int
    # 为了前端兼容，将统计字段提升到顶层
    view: int
    danmaku: int
    comment: int
    like: int
    coin: int
    favorite: int
    share: int
    # 稍后再看专用字段
    progress: int  # 观看进度（秒数）
    add_time: int
    intro: str  # 视频简介
```

```json
{
  "id": 987654321,
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "cover": "https://example.com/cover.jpg",
  "duration": 630,
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
  "cid": 123456789,
  "aid": 987654321
}
```

## 使用示例

### 后端 API 使用

```python
# apps/api/src/routers/media.py
from src.services.media_data_transformer import transformer

@router.get("/watchlater", response_model=CardListResponse)
async def get_watch_later_media(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取稍后再看媒体信息 - 使用统一数据格式"""
    user, sessdata = user_sessdata
    
    service = BilibiliService()
    try:
        result = await service.get_watch_later(sessdata, user.mid, pn, ps)
        
        if result["success"]:
            data = result["data"]
            videos = data.get("list", [])
            
            # 使用统一转换器转换数据
            video_list = transformer.transform_watchlater_list(videos)
            
            # 转换为字典格式（保持向后兼容）
            list_data = [card.model_dump() for card in video_list]
            
            return CardListResponse(
                success=True,
                data={
                    "medias": list_data,
                    "page_size": ps,
                    "info": {
                        "total_count": data.get("count", 0)
                    }
                },
                total=data.get("count", 0)
            )
    finally:
        service.close()
```

## 与收藏夹对比

### 数据来源差异

| 功能 | 稍后再看 | 收藏夹 |
|------|----------|--------|
| API 端点 | `/x/v2/history/toview` | `/fav/v2/fav/folder/list` |
| 数据结构 | `stat` | `cnt_info` |
| UP 主字段 | `owner` | `upper` |
| 统计字段 | `like` | `thumb_up` |

### 字段映射差异

| 功能 | 稍后再看字段 | 收藏夹字段 | CardData 字段 |
|------|-------------|-------------|---------------|
| 播放量 | `stat.view` | `cnt_info.play` | `stats.view` |
| 点赞数 | `stat.like` | `cnt_info.thumb_up` | `stats.like` |
| UP 主名称 | `owner.name` | `upper.name` | `uploader.name` |
| 收藏数 | `stat.collect` | `cnt_info.collect` | `stats.favorite` |

### 转换方法差异

```python
# 稍后再看转换
def transform_watchlater_video(self, video: Dict) -> CardData:
    return CardData(
        stats=self.normalize_stats(video.get('stat', {})),
        uploader=self.normalize_uploader(video.get('owner', {})),
        # ...
    )

# 收藏夹转换
def transform_favorite_video(self, media: Dict) -> CardData:
    return CardData(
        stats=self.normalize_stats(media.get('cnt_info', {})),
        uploader=self.normalize_uploader(media.get('upper', {})),
        # ...
    )
```

## 观看进度处理

稍后再看数据包含观看进度（`progress`）字段，在 `CardData` 中保留了此字段。前端可以同时从 `progress` 字段和格式化后的 `watched` 字段获取观看进度信息。

### 前端进度处理

```typescript
// apps/web/src/pages/components/WatchLaterContent.tsx
formatItem: (video: any) => ({
  id: video.id,
  bvid: video.bvid,
  title: video.title,
  cover: video.cover,
  duration: formatDuration(video.duration),
  durationSeconds: video.duration,      // 保留原始时长（秒）
  progress: video.progress,             // 观看进度（秒）
  watched: formatProgress(video.progress, video.duration),  // 格式化进度文本
  // ... 其他字段
})
```

### 进度格式化

```typescript
// apps/web/src/utils/videoFormatters.ts
export const formatProgress = (progress: number, duration: number): string => {
  if (!duration || duration <= 0) {
    return '未观看';
  }
  
  const percent = (progress / duration) * 100;
  
  if (percent >= 100) {
    return '已看完';
  } else if (percent >= 90) {
    return '快看完了';
  } else if (percent >= 50) {
    return `已观看 ${Math.round(percent)}%`;
  } else if (percent > 0) {
    return `已观看 ${Math.round(percent)}%`;
  } else {
    return '未观看';
  }
};
```

## 性能优化

### 1. 批量转换

```python
def transform_watchlater_list(self, videos: List[Dict]) -> List[CardData]:
    """批量转换稍后再看视频列表"""
    cards = []
    for video in videos:
        card = self.transform_watchlater_video(video)
        cards.append(card)
    return cards
```

### 2. 默认值处理

所有字段都提供默认值，避免 KeyError。

```python
id=video.get('bvid', ''),
title=video.get('title', ''),
```

## 注意事项

1. **观看进度**：观看进度不在 `CardData` 中，由前端单独处理
2. **统计字段**：稍后再看使用 `stat`，收藏夹使用 `cnt_info`
3. **UP 主字段**：稍后再看使用 `owner`，收藏夹使用 `upper`
4. **时长格式**：时长需要格式化为 `MM:SS` 或 `HH:MM:SS` 格式
5. **进度计算**：前端使用 `progress / duration` 计算百分比

## 相关文档

- [CardData 数据模型](../api/schemas.md) - 统一数据模型
- [稍后再看 API](../api/watchlater-api.md) - API 文档
- [收藏夹数据转换](./favorites-data-transformer.md) - 收藏夹转换
- [稍后再看页前端实现](../web/watchlater-page.md) - 前端实现

---

[返回上级](./README.md)