# DownloadService 下载服务

## 概述

下载服务层，提供高级下载功能和设置管理。

## 文件位置

`apps/api/src/services/download_service.py`

## 主要功能

### 任务管理

| 方法 | 说明 |
|------|------|
| `add_download_task()` | 添加下载任务 |
| `start_download()` | 开始下载 |
| `pause_download()` | 暂停下载 |
| `cancel_download()` | 取消下载 |
| `get_download_status()` | 获取下载状态 |

### 路径配置

```python
# 默认路径
download_dir: Path = "downloads"
temp_dir: Path = "temp"
```

## 使用方式

```python
from src.services.download_service import DownloadService

service = DownloadService()

# 添加任务
task_id = await service.add_download_task({
    "bvid": "BV1xx411c7mD",
    "quality": 80,
    "output_format": "mp4"
})

# 开始下载
await service.start_download(task_id)
```

## 配置项

| 配置 | 说明 | 默认值 |
|------|------|--------|
| video.default_quality | 默认质量 | 64 |
| video.codec | 视频编码 | avc |
| video.output_format | 输出格式 | mp4 |
| max_concurrent | 最大并发 | 3 |

## 关联服务

- [DownloadManager](download-manager.md) - 下载管理
- [DownloadEngine](download-engine.md) - 下载引擎
- [SettingsService](settings-service.md) - 设置服务

---

[返回上级](./README.md)