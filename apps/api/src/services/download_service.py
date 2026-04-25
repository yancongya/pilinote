# 下载元数据配置详解

## 概述

PiliNote下载系统支持丰富的元数据下载，包括字幕、封面、头像、NFO文件等。这些元数据能让下载的视频更加完整，便于媒体库管理和内容展示。

## 元数据类型

### 1. 字幕 (Subtitles)
**处理器**: `apps/api/src/services/queue/handlers/subtitle.py`
**类型**: `SubTaskType.SUBTITLES`

#### 支持的字幕格式
- **语言**: 中文(zh-CN)、英文(en-US)优先
- **来源**: AI字幕、人工字幕、B站官方字幕
- **格式**: SRT格式 (.srt)
- **编码**: UTF-8

#### 字幕下载流程
```python
# 1. 获取视频字幕信息
subtitles = await self._get_subtitles(download)

# 2. 筛选偏好语言
preferred_languages = ["zh-CN", "en-US"]
downloadable_subtitles = self._get_subtitle_candidates(subtitles, preferred_languages)

# 3. 下载字幕文件
for subtitle in downloadable_subtitles:
    await self._download_subtitle_from_info(download, output_dir, subtitle, index)
```

#### 字幕文件命名
```
{视频标题}.srt
{视频标题}.zh-CN.srt  # 中文字幕
{视频标题}.en-US.srt  # 英文字幕
```

### 2. 封面 (Cover/Thumbnail)
**处理器**: `apps/api/src/services/queue/task.py:_download_thumb()`
**类型**: `SubTaskType.THUMB`

#### 封面下载配置
```python
# 从视频信息中提取封面URL
if info.get('pic'):
    subtasks.append({
        'type': SubTaskType.THUMB,
        'url': info['pic'],  # 封面图片URL
        'filename': 'cover.jpg'  # 固定文件名
    })
```

#### 支持的图片格式
- **格式**: JPG、PNG、WebP
- **质量**: 原图质量下载
- **大小**: B站高清封面（通常800x450像素）

#### 封面文件位置
```
{视频目录}/
├── cover.jpg          # 视频封面
├── cover.webp         # WebP格式封面
└── cover.png          # PNG格式封面
```

### 3. UP主头像 (Avatar)
**处理器**: `apps/api/src/services/queue/task.py:_download_avatar()`
**类型**: `AVATAR` (自定义类型)

#### 头像下载配置
```python
# 从UP主信息中提取头像
if info.get('owner', {}).get('mid') and info.get('owner', {}).get('face'):
    subtasks.append({
        'type': 'AVATAR',
        'uploader_mid': info['owner']['mid'],
        'uploader': info['owner']['name'],
        'avatar_url': info['owner']['face'],
        'filename': 'avatar.jpg'
    })
```

#### 头像文件位置
```
{视频目录}/
└── avatar.jpg         # UP主头像
```

### 4. NFO文件 (NFO Metadata)
**处理器**: `apps/api/src/services/queue/handlers/nfo.py`
**类型**: `SubTaskType.SINGLE_NFO`

#### NFO文件结构
```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <bvid>BV1WNoKBYEZh</bvid>
  <title>视频标题</title>
  <plot>视频简介</plot>
  <studio>UP主名称</studio>
  <premiered>2024-01-01</premiered>
  <runtime>10:30</runtime>
  <thumb>https://example.com/cover.jpg</thumb>
  <statistics>
    <play>100000</play>
    <like>5000</like>
    <coin>1000</coin>
    <favorite>800</favorite>
    <share>200</share>
    <danmaku>3000</danmaku>
    <reply>500</reply>
  </statistics>
  <rating>4.2</rating>
  <tags>
    <tag>教程</tag>
    <tag>科技</tag>
  </tags>
  <comments>
    <comment type="top" like="100" reply="20" author="用户A" time="1640995200">
      <content>置顶评论内容</content>
    </comment>
  </comments>
</movie>
```

#### NFO评分算法
```python
def _calculate_rating(self, stats: Dict[str, Any]) -> float:
    """
    基于B站数据计算视频评分（五分制）
    
    算法步骤：
    1. 计算互动得分（点赞×0.4 + 投币×0.4 + 收藏×0.3 + 分享×0.6 + 弹幕×0.4 + 评论×0.4）
    2. 计算互动率（互动得分 ÷ 播放量）
    3. 对数平滑处理（避免极端值）
    4. 贝叶斯平均调整（避免小样本偏差）
    """
```

## 元数据下载流程

### 任务准备阶段 (prepare)
```python
async def _prepare_video(self, bilibili_service: BilibiliService):
    """准备视频下载任务"""
    
    # 1. 获取视频基本信息
    result = await bilibili_service.get_video_info(self.task.media_id)
    video_info = result['data']
    
    # 2. 创建子任务列表
    subtasks = []
    
    # 视频文件
    subtasks.append({
        'type': SubTaskType.VIDEO,
        'filename': f"{video_info.get('title', 'video')}.mp4"
    })
    
    # 字幕
    subtasks.append({
        'type': SubTaskType.SUBTITLES,
        'bvid': self.task.media_id,
        'filename': f"{video_info.get('title', 'video')}.srt"
    })
    
    # 封面
    if video_info.get('pic'):
        subtasks.append({
            'type': SubTaskType.THUMB,
            'url': video_info['pic'],
            'filename': 'cover.jpg'
        })
    
    # 头像
    if video_info.get('owner', {}).get('face'):
        subtasks.append({
            'type': 'AVATAR',
            'avatar_url': video_info['owner']['face'],
            'filename': 'avatar.jpg'
        })
    
    # NFO
    subtasks.append({
        'type': SubTaskType.SINGLE_NFO,
        'meta': video_info,
        'filename': f"{video_info.get('title', 'video')}.nfo"
    })
    
    # 保存到任务元数据
    self.task.meta = {**video_info, 'subtasks': subtasks}
```

### 执行阶段 (execute)
```python
async def execute(self):
    """执行下载任务"""
    
    # 1. 下载主视频文件
    await self._download_media()
    
    # 2. 处理后处理子任务
    for subtask in self.task.meta.get('subtasks', []):
        subtask_type = subtask['type']
        
        if subtask_type == SubTaskType.SUBTITLES:
            await self._download_subtitles(subtask)
        elif subtask_type == SubTaskType.THUMB:
            await self._download_thumb(subtask)
        elif subtask_type == 'AVATAR':
            await self._download_avatar(subtask)
        elif subtask_type == SubTaskType.SINGLE_NFO:
            await self._generate_nfo(subtask)
```

## 配置选项

### 字幕配置
```python
# apps/api/src/services/download_service.py
preferred_languages = ["zh-CN", "en-US"]  # 偏好语言
subtitle_formats = ["srt", "vtt", "ass"]   # 支持格式
```

### 图片质量配置
```python
# 封面下载选项
cover_options = {
    "quality": "original",  # original, high, medium, low
    "format": "jpg",        # jpg, png, webp
    "size": "large"         # large, medium, small
}
```

### NFO配置
```python
# NFO生成选项
nfo_options = {
    "include_comments": True,     # 是否包含评论
    "max_comments": 10,           # 最大评论数
    "include_tags": True,         # 是否包含标签
    "max_tags": 5,               # 最大标签数
    "calculate_rating": True      # 是否计算评分
}
```

## 目录结构

下载完成后，视频目录结构如下：

```
{下载目录}/{视频标题}/
├── {视频标题}.mp4              # 主视频文件
├── {视频标题}.srt              # 中文字幕
├── {视频标题}.en-US.srt        # 英文字幕
├── cover.jpg                   # 视频封面
├── avatar.jpg                  # UP主头像
├── {视频标题}.nfo             # NFO元数据文件
├── subtitles/                  # 字幕子目录（如果有多个）
│   ├── zh-CN.srt
│   ├── en-US.srt
│   └── ja-JP.srt
└── thumbs/                     # 缩略图子目录
    ├── cover_large.jpg
    ├── cover_medium.jpg
    └── cover_small.jpg
```

## 错误处理

### 字幕下载失败
```python
# 字幕下载失败时的处理
if result.get('downloaded', 0) == 0:
    logger.warning(f"字幕未成功下载: bvid={bvid}, title={title}")
    # 继续执行，不影响主视频下载
```

### 封面下载失败
```python
# 封面下载失败时的处理
try:
    await self._download_file(url, output_path)
except Exception as e:
    logger.warning(f"封面下载失败: {url}, 错误: {e}")
    # 继续执行，不影响主视频下载
```

### NFO生成失败
```python
# NFO生成失败时的处理
try:
    nfo_content = self._generate_nfo(meta)
    output_path.write_text(nfo_content, encoding='utf-8')
except Exception as e:
    logger.error(f"NFO生成失败: {e}")
    # 记录错误，但不影响整体下载
```

## 性能优化

### 并行下载
```python
# 元数据文件并行下载
metadata_tasks = []
for subtask in metadata_subtasks:
    if subtask['type'] in [SubTaskType.THUMB, 'AVATAR']:
        task = asyncio.create_task(self._download_metadata_file(subtask))
        metadata_tasks.append(task)

# 等待所有元数据下载完成
await asyncio.gather(*metadata_tasks, return_exceptions=True)
```

### 缓存机制
```python
# 避免重复下载相同封面
cover_cache_key = f"cover:{bvid}"
if await cache.get(cover_cache_key):
    logger.info("封面已存在，跳过下载")
    return
```

## 扩展配置

### 自定义元数据类型
```python
# 添加新的元数据类型
class SubTaskType(str, Enum):
    VIDEO = "video"
    SUBTITLES = "subtitles"
    THUMB = "thumb"
    SINGLE_NFO = "single_nfo"
    # 新增类型
    LYRIC = "lyric"           # 歌词
    SCREENSHOT = "screenshot" # 截图
    TRANSCRIPT = "transcript" # 转录文本
```

### 配置开关
```python
# 用户可配置的选项
download_options = {
    "subtitles": {
        "enabled": True,
        "languages": ["zh-CN", "en-US"],
        "formats": ["srt"]
    },
    "covers": {
        "enabled": True,
        "quality": "high",
        "formats": ["jpg", "webp"]
    },
    "avatars": {
        "enabled": False,  # 默认关闭，节省空间
        "quality": "medium"
    },
    "nfo": {
        "enabled": True,
        "include_comments": True,
        "include_stats": True,
        "calculate_rating": True
    }
}
```

## 监控和统计

### 下载统计
```python
# 统计信息
download_stats = {
    "video_size": video_file_size,
    "metadata_size": metadata_files_size,
    "total_size": total_size,
    "subtitles_count": downloaded_subtitles,
    "covers_count": downloaded_covers,
    "nfo_generated": nfo_created
}
```

### 成功率监控
```python
# 元数据下载成功率
metadata_success_rate = {
    "subtitles": downloaded_subtitles / total_subtitles,
    "covers": downloaded_covers / total_covers,
    "avatars": downloaded_avatars / total_avatars,
    "nfo": nfo_success_count / total_nfo_attempts
}
```

这个元数据系统让PiliNote下载的视频更加完整和专业，支持媒体库自动识别和管理。</content>
<parameter name="filePath">METADATA_DOWNLOAD_CONFIG.md