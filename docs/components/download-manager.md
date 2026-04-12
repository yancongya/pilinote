# DownloadManager 下载管理

## 概述

下载任务管理器，负责队列管理、并发控制和任务状态追踪。

## 文件位置

`apps/api/src/services/download_manager.py`

## 下载状态

| 状态 | 说明 |
|------|------|
| PENDING | 待处理 |
| QUEUED | 队列中 |
| DOWNLOADING | 下载中 |
| PAUSED | 已暂停 |
| PROCESSING | 处理中 |
| COMPLETED | 已完成 |
| FAILED | 失败 |
| CANCELLED | 已取消 |

## 主要功能

### 队列管理

| 方法 | 说明 |
|------|------|
| `add_task()` | 添加任务 |
| `remove_task()` | 删除任务 |
| `get_queue()` | 获取队列 |
| `clear_queue()` | 清空队列 |

### 任务控制

| 方法 | 说明 |
|------|------|
| `pause_task()` | 暂停任务 |
| `resume_task()` | 恢复任务 |
| `cancel_task()` | 取消任务 |
| `retry_task()` | 重试任务 |

### 并发控制

```python
# 最多同时下载 3 个任务
MAX_CONCURRENT = 3
```

## 使用方式

```python
from src.services.download_manager import DownloadManager, DownloadStatus

manager = DownloadManager()

# 添加任务
task_id = await manager.add_task({
    "bvid": "BV1xx411c7mD",
    "quality": 80
})

# 暂停任务
await manager.pause_task(task_id)

# 获取队列
queue = manager.get_queue()
```

## 关联服务

- [DownloadEngine](download-engine.md) - 下载引擎
- [DownloadService](download-service.md) - 下载服务

---

[返回上级](./README.md)