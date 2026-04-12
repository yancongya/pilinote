# MediaProcessor 媒体处理

## 概述

统一媒体数据处理器，负责获取和处理 Bilibili 媒体信息。

## 文件位置

`apps/api/src/services/media_processor.py`

## 主要功能

### 获取媒体数据

| 方法 | 说明 |
|------|------|
| `get_video_info()` | 获取视频信息 |
| `get_media_info()` | 获取媒体信息（支持视频、图文、课程、番剧） |
| `get_media_list()` | 获取媒体列表 |
| `get_video_urls()` | 获取播放地址 |

### 支持的媒体类型

| 类型 | ID格式 | 说明 |
|------|--------|------|
| VIDEO | BV号、AV号 | 普通视频 |
| OPUS | cv号、opus号 | 图文专栏 |
| LESSON | ss号（season_id） | 课程（需完整URL） |
| BANGUMI | ep号、ss号、md号 | 番剧 |

### 数据处理

| 方法 | 说明 |
|------|------|
| `_format_timestamp()` | 格式化时间戳 |
| `_parse_duration()` | 解析时长 |
| `_fetch_with_retry()` | 重试获取 |

## MediaInfo 结构

```python
class MediaInfo:
    bvid: str
    aid: int
    title: str
    pic: str
    desc: str
    duration: int
    owner: MediaUpper
    stat: MediaStats
    sections: List[MediaSection]
```

## 使用方式

```python
from src.services.media_processor import MediaDataProcessor

processor = MediaDataProcessor()

# 获取视频信息
info = processor.get_video_info("BV1xx411c7mD")

# 获取播放地址
urls = processor.get_video_urls(aid=170001, cid=123456, quality=80)
```

## 关联服务

- [BilibiliService](bilibili-service.md) - Bilibili API 服务
- [MediaDataTransformer](media-data-transformer.md) - 数据转换

## 课程处理

### 处理流程

```python
# 获取课程信息
result = processor.get_media_info(
    media_type="lesson",
    media_id="292774372",  # season_id
    sessdata="your_sessdata"  # 必须提供
)

# 返回数据结构
{
    "success": True,
    "data": MediaInfo(
        type=MediaType.LESSON,
        id="ss292774372",
        title="课程标题",
        cover="封面URL",
        desc="课程简介",
        nfo=MediaNfo(
            showtitle="课程标题",
            intro="课程副标题/简介",
            url="https://www.bilibili.com/cheese/play/ss292774372",
            thumbs=[MediaThumbnail(...)],
            premiered=1234567890
        ),
        stats=MediaStats(
            play=0,  # 课程可能不提供播放量
            danmaku=0,
            reply=0,
            like=0,
            coin=0,
            favorite=0,
            share=0
        ),
        list=[
            MediaItem(
                title="分集标题",
                cover="分集封面",
                desc="分集简介",
                duration=300,
                type=MediaType.LESSON,
                aid=123456,
                bvid="BVxxx",
                cid=123456,
                ssid=292774372,
                index=0
            ),
            ...
        ]
    )
}
```

### 课程处理注意事项

1. **必须提供 SESSDATA**：课程为付费内容，必须提供有效的 SESSDATA
2. **需要购买**：只有购买后的课程才能获取详细信息
3. **分集列表**：默认获取前100集，可通过调整 `get_classroom_episodes` 参数获取更多
4. **统计信息**：课程可能不提供播放量等统计数据，这些字段默认为0

### 错误处理

```python
# 获取课程信息失败
{
    "success": False,
    "message": "课程信息失败"
}

# 课程暂无分集
{
    "success": False,
    "message": "课程暂无分集内容或需要购买"
}
```

---

[返回上级](./README.md)