# ScanService 扫描服务

## 概述

自动下载扫描服务，定期扫描收藏夹和稍后再看。

## 文件位置

`apps/api/src/services/scan_service.py`

## 主要功能

### 扫描操作

| 方法 | 说明 |
|------|------|
| `scan_favorites()` | 扫描收藏夹 |
| `scan_watchlater()` | 扫描稍后再看 |
| `scan_custom_folders()` | 扫描自定义收藏夹 |
| `get_scan_result()` | 获取扫描结果 |

## 使用方式

```python
from src.services.scan_service import ScanService

service = ScanService(db)

# 扫描收藏夹
result = await service.scan_favorites(
    folder_id=123456,
    quality=80
)

# 添加到下载队列
for video in result.new_videos:
    await service.add_to_queue(video)
```

## 关联服务

- [BilibiliService](bilibili-service.md) - Bilibili API
- [DownloadService](download-service.md) - 下载服务

---

[返回上级](./README.md)