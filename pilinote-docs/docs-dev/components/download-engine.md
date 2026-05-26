# DownloadEngine 下载引擎

## 概述

基于 yt-dlp 的视频下载引擎，支持多种格式和进度回调。

## 文件位置

`apps/api/src/services/download_engine.py`

## 主要功能

### 下载控制

| 方法 | 说明 |
|------|------|
| `download()` | 下载视频 |
| `download_single()` | 下载单个视频 |
| `pause()` | 暂停下载 |
| `resume()` | 恢复下载 |
| `cancel()` | 取消下载 |

### 工具检测

| 方法 | 说明 |
|------|------|
| `_auto_detect_aria2c()` | 自动检测 aria2c |
| `_auto_detect_ffmpeg()` | 自动检测 ffmpeg |

## yt-dlp 配置

```python
ydl_opts = {
    'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    'outtmpl': '%(title)s.%(ext)s',
    'progress_hooks': [progress_hook],
    'quiet': True,
    'no_warnings': True,
}
```

## 使用方式

```python
from src.services.download_engine import DownloadEngine

engine = DownloadEngine()

# 下载视频
await engine.download(
    url="BV1xx411c7mD",
    output_dir="./downloads",
    quality=80,
    progress_callback=lambda progress: print(f"进度: {progress}")
)
```

## 特性

| 特性 | 说明 |
|------|------|
| 多线程下载 | 支持 aria2c |
| 格式转换 | 支持 ffmpeg |
| 进度回调 | 实时进度更新 |
| 暂停恢复 | 支持暂停/恢复 |

## 依赖工具

- yt-dlp
- aria2c（多线程）
- ffmpeg（格式转换）

## 关联服务

- [DownloadManager](download-manager.md) - 下载管理
- [DownloadService](download-service.md) - 下载服务

---

[返回上级](./README.md)