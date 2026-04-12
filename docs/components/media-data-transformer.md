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
    uploader: UploaderInfo
    stats: CardStats
    uploaded_at: Optional[str]
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
- [MediaProcessor](media-processor.md) - 媒体处理

---

[返回上级](./README.md)