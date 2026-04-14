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

## NFO文件生成

### 概述

下载服务在下载完成后会自动生成NFO（Info）文件，用于存储视频的元数据信息。NFO文件与视频文件一起存储，方便本地播放器（如Kodi、Emby、Plex等）读取和显示视频信息。

### 生成时机

1. **下载完成时**：视频下载完成后自动生成NFO文件
2. **文件移动后**：文件从临时目录移动到最终目录后生成
3. **启用NFO选项时**：只有当`enable_nfo`选项为true时才生成

### 生成流程

```
1. 下载完成
   ↓
2. 移动文件到最终目录
   ↓
3. 查找视频文件
   ↓
4. 获取视频元数据（从BVID获取）
   ↓
5. 生成NFO文件
   ↓
6. 下载封面图（如果启用）
   ↓
7. 下载UP主头像（如果启用）
   ↓
8. 更新数据库状态为completed
```

### NFO文件内容

NFO文件包含以下信息：

#### 基本信息字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `bvid` | B站视频ID | `BV1xx411c7mD` |
| `title` | 视频标题 | `【Blender教程】基础操作` |
| `plot` | 视频简介 | `这是Blender的基础操作教程...` |
| `studio` | UP主名称 | `UP主名` |
| `premiered` | 发布日期 | `2024-01-01` |
| `thumb` | 封面图片URL | `https://i0.hdslb.com/...` |

#### 统计数据字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `statistics/play` | 播放量 | `10000` |
| `statistics/like` | 点赞数 | `500` |
| `statistics/coin` | 投币数 | `200` |
| `statistics/favorite` | 收藏数 | `100` |
| `statistics/share` | 分享数 | `50` |
| `statistics/danmaku` | 弹幕数 | `100` |
| `statistics/reply` | 评论数 | `80` |

#### 扩展字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `runtime` | 视频时长 | `12:34` |
| `rating` | 评分（基于互动率） | `8.5` |
| `tags/tag` | 标签（从统计数据生成） | `弹幕:100` |

### 评分计算

评分基于互动率计算（10分制）：

```python
interaction_score = (like * 0.4 + coin * 0.3 + favorite * 0.3)
interaction_rate = interaction_score / play
rating = min(interaction_rate * 500, 10)
```

**说明**：
- 播放量`play`作为基数
- 点赞`like`权重40%，投币`coin`权重30%，收藏`favorite`权重30%
- 互动率乘以500得到10分制评分
- 最高不超过10分

### 标签生成

标签从统计数据自动生成：

- 弹幕数 > 0：生成`弹幕:{danmaku_count}`标签
- 评论数 > 0：生成`评论:{reply_count}`标签
- 分享数 > 0：生成`分享:{share_count}`标签

### 相关代码

**文件**：`apps/api/src/services/download_service.py`

```python
async def _process_completed_download(
    self,
    download_id: str,
    temp_dir: Path,
    final_dir: Path,
    storage_settings
):
    """处理已完成的下载 - 移动文件并清理"""
    
    # 1. 移动临时目录中的所有内容到最终目录
    for item in temp_dir.iterdir():
        shutil.move(str(item), str(dest))
    
    # 2. 查找视频文件
    video_files = [f for f in final_dir.rglob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
    
    if video_files:
        video_file = video_files[0]
        video_dir = video_file.parent
        
        # 3. 更新数据库
        download.file_path = str(video_file)
        download.file_size = video_file.stat().st_size
        download.temp_file_path = None
        
        # 4. 生成NFO文件
        if download.enable_nfo:
            await self._generate_nfo_file(video_file, download)
        
        # 5. 下载封面图（如果启用）
        if download.enable_cover and download.thumbnail_url:
            await self._download_thumbnail(download, video_dir)
        
        # 6. 下载UP主头像
        if download.enable_avatar and download.uploader_mid:
            await self._download_avatar(download, video_dir)
```

### NFO文件更新

下载服务还支持更新现有的NFO文件，从B站API获取最新的统计数据：

**API端点**：
- `POST /api/library/nfo/update` - 更新单个NFO文件
- `POST /api/library/nfo/batch-update` - 批量更新NFO文件

**更新内容**：
- 更新统计数据（播放量、点赞数等）
- 重新计算评分
- 重新生成标签
- 保留基本信息不变

### 相关文档

- [NFO文件格式](../download/nfo-format.md) - 详细的NFO文件格式说明
- [NFO处理器](../download/handlers.md) - NFO文件生成和处理
- [本地视频库API](../api/library-api.md) - NFO更新API文档

## 关联服务

- [DownloadManager](download-manager.md) - 下载管理
- [DownloadEngine](download-engine.md) - 下载引擎
- [SettingsService](settings-service.md) - 设置服务
- [BilibiliService](bilibili-service.md) - B站API服务

---

[返回上级](./README.md)