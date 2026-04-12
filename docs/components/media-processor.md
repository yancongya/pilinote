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
| `get_media_info()` | 获取媒体信息 |
| `get_media_list()` | 获取媒体列表 |
| `get_video_urls()` | 获取播放地址 |

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

---

[返回上级](./README.md)