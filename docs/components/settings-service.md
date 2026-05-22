# SettingsService 设置服务

## 概述

系统设置管理服务，负责设置存储、读取和更新。

## 文件位置

`apps/api/src/services/settings_service.py`

## 主要功能

### 设置管理

| 方法 | 说明 |
|------|------|
| `get_settings()` | 获取所有设置 |
| `update_settings()` | 更新设置 |
| `get_setting()` | 获取单个设置 |
| `set_setting()` | 设置单个值 |
| `reset_settings()` | 重置为默认 |

### 数据模型

```python
class Settings:
    download: DownloadSettings
    storage: StorageSettings
    general: GeneralSettings
    auto_download: AutoDownloadSettings
```

## 使用方式

```python
from src.services.settings_service import SettingsService

with SessionLocal() as db:
    service = SettingsService(db)
    
    # 获取设置
    settings = service.get_settings()
    
    # 更新设置
    service.update_settings({
        "download.video.default_quality": 80
    })
```

## 关联服务

- [DownloadService](download-service.md) - 下载服务
- [存储设置文档](../settings/storage.md) - 存储设置（docs/settings）

---

[返回上级](./README.md)
