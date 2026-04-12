# 设置管理

本目录包含设置功能文档。

## 文档索引

### 1. 下载设置
**文件**: [download.md](download.md)

内容：
- 视频质量默认编码
- 音视频编码格式
- 并发数设置
- 速度限制
- 元数据设置（NFO、字幕、封面、头像）

### 2. 存储设置
**文件**: [storage.md](storage.md)

内容：
- 下载路径配置
- 临时路径配置
- 自动清理设置
- 失败任务保留设置
- sidecar 工具路径配置
- FTP 备份配置

### 3. 通用设置
**文件**: [general.md](general.md)

内容：
- 主题设置
- 语言设置
- 剪贴板监控

### 4. 自动下载设置
**文件**: [auto-download.md](auto-download.md)

内容：
- 自动下载开关
- 扫描间隔配置
- 收藏夹扫描配置
- 稍后再看扫描配置
- 存储空间阈值

### 5. 备份设置
**文件**: [backup.md](backup.md)

内容：
- FTP 备份

---

## 配置结构

```json
{
  "download": {
    "video": { "default_quality": 64, "audio_bitrate": 192, "codec": "avc", "output_format": "mp4" },
    "max_concurrent": 3,
    "speed_limit": 0,
    "metadata": { "enable_nfo": true, "enable_subtitle": true, "enable_cover": true, "enable_avatar": false }
  },
  "storage": {
    "download_path": "./downloads",
    "temp_path": "./temp",
    "auto_cleanup": true,
    "keep_failed": false,
    "sidecar": { "ffmpeg": "ffmpeg", "aria2c": "aria2c" },
    "ftp": { "host": "", "username": "", "password": "", "remote_path": "/pilinote", "use_tls": false }
  },
  "general": {
    "theme": "auto",
    "language": "zh-CN",
    "auto_download": false,
    "clipboard_monitor": false
  },
  "auto_download": {
    "enabled": false,
    "trigger_type": "interval",
    "scan_interval": 60,
    "cron_expression": "",
    "concurrent_limit": { "video": 3, "page": 3 },
    "custom_scan": { "enabled": false, "folder_list": [] },
    "watch_later_max": 0,
    "auto_start_after_scan": false,
    "storage_threshold_gb": 20
  }
}
```

---

## 涉及文件

### 后端
- `apps/api/src/routers/settings.py` - API路由
- `apps/api/src/services/settings_service.py` - 设置服务
- `apps/api/src/schemas/settings.py` - 数据模型

### 前端
- `apps/web/src/stores/settings.ts` - 状态管理
- `apps/web/src/pages/settings/DownloadSettings.tsx` - 下载设置页面
- `apps/web/src/pages/settings/StorageSettings.tsx` - 存储设置页面
- `apps/web/src/pages/settings/AccountsSettings.tsx` - 通用设置页面
- `apps/web/src/pages/settings/AutoDownloadSettings.tsx` - 自动下载设置页面

---

[返回上级](../README.md)