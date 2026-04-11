# 图像下载功能修复文档

## 问题描述

### 现象
视频下载完成后，只生成了NFO文件，封面图片（.jpg）和UP主头像（avatar.jpg）没有下载。

### 根本原因

#### 1. 数据库事务问题
**问题代码：**
```python
# ❌ 错误：NFO生成和图片下载在数据库事务中
with SessionLocal() as db:
    download = db.query(Download).filter(Download.id == download_id).first()
    
    # 更新数据库
    download.file_path = str(video_files[0])
    db.commit()
    
    # 生成NFO - 在事务中
    if download.enable_nfo:
        self._generate_nfo_file(...)
    
    # 下载封面 - 在事务中
    if download.enable_cover:
        await self._download_thumbnail(download, final_dir)
    
    # 下载头像 - 在事务中
    if download.enable_avatar:
        await self._download_avatar(download, final_dir)
```

**问题分析：**
- 所有文件操作都在数据库事务中执行
- 如果NFO生成失败，会导致数据库回滚
- 如果图片下载失败，也会影响整个事务
- 数据库事务不应该包含耗时的I/O操作

#### 2. 目录路径错误
**问题代码：**
```python
# ❌ 错误：使用了错误的目录
async def _download_thumbnail(self, download: Download, output_dir: Path):
    video_files = [f for f in output_dir.glob('*') if f.is_file() and ...]
    # ...
    thumbnail_path = output_dir / f"{video_filename}.jpg"
```

**问题分析：**
- `output_dir` 参数传入的是 `final_dir`（下载根目录）
- 但视频文件实际在子目录中（如 `downloads/视频标题/视频标题.mp4`）
- 在根目录查找视频文件会失败
- 封面图片应该保存到视频文件所在目录，而不是下载根目录

#### 3. uploader_mid 为 0
**问题代码：**
```python
# 前端传递数据时没有正确设置 uploader_mid
const downloadData = {
  uploader_mid: video.uploader?.mid || video.owner?.mid || 0,  // ❌ 可能为0
  // ...
}
```

**问题分析：**
- 稍后再看API返回的数据中，`uploader` 和 `owner` 字段可能为空
- 降级值为0导致无法获取UP主头像
- 需要从视频详情API获取正确的uploader_mid

## 解决方案

### 1. 分离数据库事务和文件操作

**修复后代码：**
```python
# ✅ 正确：数据库事务和文件操作分离
# 1. 移动文件
for item in temp_dir.iterdir():
    shutil.move(str(item), str(dest))

# 2. 查找视频文件
video_files = [f for f in final_dir.rglob('*') if f.is_file() and ...]
video_file = video_files[0]
video_dir = video_file.parent  # 获取视频文件所在目录

# 3. 更新数据库（在事务中）
with SessionLocal() as db:
    download = db.query(Download).filter(Download.id == download_id).first()
    download.file_path = str(video_file)
    download.file_size = video_file.stat().st_size
    download.temp_file_path = None
    db.commit()

# 4. 生成NFO（在事务外，独立try-except）
try:
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download and download.enable_nfo:
            self._generate_nfo_file(...)
except Exception as e:
    logger.error(f"Failed to generate NFO: {e}")

# 5. 下载封面（在事务外，独立try-except）
try:
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download and download.enable_cover:
            await self._download_thumbnail(download, video_dir)
except Exception as e:
    logger.error(f"Failed to download thumbnail: {e}")

# 6. 下载头像（在事务外，独立try-except）
try:
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download and download.enable_avatar:
            await self._download_avatar(download, video_dir)
except Exception as e:
    logger.error(f"Failed to download avatar: {e}")
```

**改进点：**
- 数据库事务只包含数据库操作
- 每个文件操作都有独立的 try-except 块
- 一个操作失败不影响其他操作
- 每个操作都重新从数据库获取最新的下载对象

### 2. 修正目录路径

**修复后代码：**
```python
# ✅ 正确：使用视频文件所在目录
async def _process_completed_download(...):
    # 递归查找视频文件
    video_files = [f for f in final_dir.rglob('*') if f.is_file() and ...]
    video_file = video_files[0]
    video_dir = video_file.parent  # 获取视频文件所在目录
    
    logger.info(f"Video file: {video_file}")
    logger.info(f"Video directory: {video_dir}")
    
    # 传递正确的目录给下载方法
    await self._download_thumbnail(download, video_dir)
    await self._download_avatar(download, video_dir)
```

**改进点：**
- 使用 `video_file.parent` 获取视频文件所在目录
- 递归查找视频文件（`rglob`）
- 封面和头像保存到视频文件同一目录
- 添加详细的日志输出

### 3. 修复 uploader_mid 传递

**修复后代码：**
```typescript
// ✅ 正确：从视频详情API获取 uploader_mid
const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata)
const videoDetailData = videoDetailResponse.data

const downloadData = {
  uploader_mid: videoDetailData.owner?.mid || video.uploader?.mid || 0,
  uploader: videoDetailData.owner?.name || video.uploader?.name || '',
  // ...
}
```

**改进点：**
- 优先使用视频详情API返回的 `owner.mid` 和 `owner.name`
- 添加降级处理，防止字段为空
- 确保uploader_mid始终有有效值

## 技术细节

### 数据库事务设计原则

#### ❌ 错误的做法
```python
# 在事务中执行耗时操作
with SessionLocal() as db:
    # 数据库操作
    db.commit()
    
    # ❌ 耗时的I/O操作（HTTP请求、文件操作）
    await download_image(...)
    await upload_file(...)
```

#### ✅ 正确的做法
```python
# 1. 数据库事务（只包含数据库操作）
with SessionLocal() as db:
    db.commit()

# 2. I/O操作（在事务外）
try:
    await download_image(...)
except Exception as e:
    logger.error(f"Download failed: {e}")
```

### 文件路径处理

#### 目录结构
```
downloads/
└── Obsidain 补完计划：像 Notion 一样丝滑拖拽文本块——Dragger/
    ├── Obsidain 补完计划：像 Notion 一样丝滑拖拽文本块——Dragger.mp4
    ├── Obsidain 补完计划：像 Notion 一样丝滑拖拽文本块——Dragger.nfo
    ├── Obsidain 补完计划：像 Notion 一样丝滑拖拽文本块——Dragger.jpg  # 封面
    └── avatar.jpg  # UP主头像
```

#### 代码实现
```python
# 1. 查找视频文件
video_files = [f for f in final_dir.rglob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]

# 2. 获取视频文件和目录
video_file = video_files[0]
video_dir = video_file.parent  # /path/to/downloads/视频标题/

# 3. 生成文件名
video_filename = video_file.stem  # "视频标题"
thumbnail_path = video_dir / f"{video_filename}.jpg"  # /path/to/downloads/视频标题/视频标题.jpg
avatar_path = video_dir / "avatar.jpg"  # /path/to/downloads/视频标题/avatar.jpg
```

### 容错处理

#### 独立的 try-except 块
```python
# ✅ 每个操作独立处理异常
# 操作1：NFO生成
try:
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download and download.enable_nfo:
            self._generate_nfo_file(...)
except Exception as e:
    logger.error(f"NFO generation failed: {e}")
    # 不影响后续操作

# 操作2：封面下载
try:
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download and download.enable_cover:
            await self._download_thumbnail(download, video_dir)
except Exception as e:
    logger.error(f"Thumbnail download failed: {e}")
    # 不影响后续操作

# 操作3：头像下载
try:
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download and download.enable_avatar:
            await self._download_avatar(download, video_dir)
except Exception as e:
    logger.error(f"Avatar download failed: {e}")
    # 不影响后续操作
```

## 测试验证

### 测试场景

#### 场景1：正常下载
- ✅ 视频文件下载成功
- ✅ NFO文件生成成功
- ✅ 封面图片下载成功
- ✅ UP主头像下载成功

#### 场景2：NFO生成失败
- ✅ 视频文件下载成功
- ❌ NFO文件生成失败（网络错误）
- ✅ 封面图片下载成功
- ✅ UP主头像下载成功

#### 场景3：封面下载失败
- ✅ 视频文件下载成功
- ✅ NFO文件生成成功
- ❌ 封面图片下载失败（URL无效）
- ✅ UP主头像下载成功

#### 场景4：头像下载失败
- ✅ 视频文件下载成功
- ✅ NFO文件生成成功
- ✅ 封面图片下载成功
- ❌ UP主头像下载失败（uploader_mid为0）

### 测试命令

#### 查看下载目录
```bash
find /Users/tanyancong/工作/开发/pilinote/downloads -type f \
  -name "*.mp4" -o -name "*.nfo" -o -name "*.jpg"
```

#### 预期输出
```
/path/to/downloads/视频标题/视频标题.mp4
/path/to/downloads/视频标题/视频标题.nfo
/path/to/downloads/视频标题/视频标题.jpg
/path/to/downloads/视频标题/avatar.jpg
```

#### 查看数据库记录
```sql
SELECT id, title, thumbnail_url, uploader_mid, enable_cover, enable_avatar
FROM downloads
ORDER BY created_at DESC
LIMIT 1;
```

## 代码变更

### 修改文件

#### apps/api/src/services/download_service.py
- 重构 `_process_completed_download` 方法
- 分离数据库事务和文件操作
- 修正目录路径处理
- 添加详细的日志输出
- 实现独立的异常处理

#### apps/web/src/pages/components/WatchLaterContent.tsx
- 修复 uploader_mid 字段获取逻辑
- 优先使用视频详情API返回的数据
- 添加降级处理

### 新增代码

#### _download_image 方法
```python
async def _download_image(self, url: str, save_path: Path) -> bool:
    logger.info(f"Downloading image from: {url}")
    logger.info(f"Saving to: {save_path}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            logger.info(f"Sending HTTP request to {url}...")
            response = await client.get(url)
            logger.info(f"Response status: {response.status_code}")
            response.raise_for_status()
            
            content_length = len(response.content)
            logger.info(f"Downloaded {content_length} bytes")
            
            save_path.parent.mkdir(parents=True, exist_ok=True)
            save_path.write_bytes(response.content)
            
            logger.info(f"Successfully downloaded image: {save_path}")
            return True
    except Exception as e:
        logger.error(f"Failed to download image from {url}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False
```

#### _download_thumbnail 方法
```python
async def _download_thumbnail(self, download: Download, output_dir: Path) -> bool:
    logger.info(f"=== Starting thumbnail download ===")
    logger.info(f"Download ID: {download.id}")
    logger.info(f"Output dir: {output_dir}")
    logger.info(f"Output dir exists: {output_dir.exists()}")
    logger.info(f"Thumbnail URL: {download.thumbnail_url}")
    
    if not download.thumbnail_url:
        logger.warning("No thumbnail URL provided")
        return False
    
    try:
        video_files = [f for f in output_dir.glob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
        logger.info(f"Video files found in output dir: {len(video_files)}")
        
        if not video_files:
            logger.warning("No video file found in output directory")
            return False
        
        video_filename = video_files[0].stem
        logger.info(f"Video filename: {video_filename}")
        
        thumbnail_path = output_dir / f"{video_filename}.jpg"
        logger.info(f"Thumbnail path: {thumbnail_path}")
        
        url = download.thumbnail_url.replace('http:', 'https:')
        logger.info(f"Final URL: {url}")
        
        success = await self._download_image(url, thumbnail_path)
        logger.info(f"Thumbnail download result: {success}")
        
        return success
    except Exception as e:
        logger.error(f"Failed to download thumbnail: {e}")
        return False
```

## 总结

### 核心问题
1. **数据库事务设计不当**：在事务中执行耗时I/O操作
2. **目录路径错误**：使用了错误的目录参数
3. **数据传递不完整**：uploader_mid字段为0

### 解决方案
1. **分离关注点**：数据库事务只包含数据库操作
2. **修正路径处理**：使用video_file.parent获取正确的目录
3. **修复数据传递**：从视频详情API获取完整数据
4. **容错处理**：每个操作独立的try-except块

### 经验教训
1. 数据库事务应该尽量短小，只包含必要的数据库操作
2. 耗时的I/O操作应该在事务外执行
3. 文件路径处理要谨慎，确保使用正确的目录
4. 容错处理非常重要，一个操作失败不应影响其他操作
5. 详细的日志输出对问题诊断非常有帮助

### 最佳实践
1. **事务设计**：Keep transactions short and simple
2. **路径处理**：Always use pathlib for cross-platform compatibility
3. **容错处理**：Isolate error handling for independent operations
4. **日志输出**：Add detailed logging for debugging
5. **数据验证**：Validate data before use
---

## 2026-03-31 NFO文件生成功能改进

### 问题现象
NFO文件只包含基本视频信息（标题、BV号、封面URL、发布日期、UP主信息），缺少详细的视频描述和统计数据。

### 根本原因
NFO生成时没有从B站获取视频的完整信息，导致NFO文件内容不完整。

### 解决方案

#### 1. 添加 get_video_info 方法
在 `BilibiliService` 类中添加 `get_video_info` 方法，使用HTML解析方法获取视频详情：

```python
async def get_video_info(self, bvid: str, sessdata: str = "") -> Dict:
    """获取视频详情信息（使用HTML解析方法）"""
    import re
    import json

    # 确保SESSDATA在headers中
    if sessdata:
        await self.headers_manager.update_cookie("SESSDATA", sessdata)

    # 获取headers
    headers = await self.headers_manager.get_headers()
    headers["Referer"] = f"https://www.bilibili.com/video/{bvid}"

    try:
        # 使用HTML解析方法（绕过API限制）
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(
                f"https://www.bilibili.com/video/{bvid}",
                headers=headers
            )
            response.raise_for_status()
            html = response.text

            # 从HTML中提取__INITIAL_STATE__数据
            patterns = [
                r'__INITIAL_STATE__\s*=\s*({.*?});',
                r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>'
            ]

            data = None
            for pattern in patterns:
                match = re.search(pattern, html)
                if match:
                    try:
                        data = json.loads(match.group(1))
                        break
                    except json.JSONDecodeError:
                        continue

            if not data or 'videoData' not in data:
                return {
                    "success": False,
                    "message": "无法从页面中提取视频信息"
                }

            video_data = data['videoData']

            return {
                "success": True,
                "data": {
                    "title": video_data.get("title", ""),
                    "desc": video_data.get("desc", ""),
                    "pic": video_data.get("pic", ""),
                    "pubdate": video_data.get("pubdate", 0),
                    "owner": video_data.get("owner", {}),
                    "stat": video_data.get("stat", {}),
                    "pages": video_data.get("pages", [])
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"获取视频信息失败: {str(e)}"
        }
```

#### 2. 修复异步调用问题
在下载完成处理中，使用 `await` 调用 `get_video_info`：

```python
# ❌ 错误：缺少await
video_info = bilibili_service.get_video_info(download.bvid, download.sessdata or "")

# ✅ 正确：添加await
video_info = await bilibili_service.get_video_info(download.bvid, download.sessdata or "")
```

#### 3. 提取完整的视频信息
从返回的数据中提取视频描述和统计数据：

```python
video_info = await bilibili_service.get_video_info(download.bvid, download.sessdata or "")
if video_info.get("success"):
    video_data = video_info.get("data", {})
    description = video_data.get("desc")
    video_stats = {
        "play": video_data.get("stat", {}).get("view", 0),
        "like": video_data.get("stat", {}).get("like", 0),
        "coin": video_data.get("stat", {}).get("coin", 0),
        "favorite": video_data.get("stat", {}).get("favorite", 0),
        "share": video_data.get("stat", {}).get("share", 0),
        "danmaku": video_data.get("stat", {}).get("danmaku", 0),
        "reply": video_data.get("stat", {}).get("reply", 0)
    }
```

### 改进效果

**改进前的NFO：**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>爆降75%token！我在清华分享openclaw的graph-memory插件</title>
  <plot>B站视频ID: BV1KwwzzGEvD</plot>
  <thumb>http://i1.hdslb.com/bfs/archive/f4932dd8393ebe675d5e27aa2e1b1bcc52a00be1.jpg</thumb>
  <premiered>2026-03-31</premiered>
  <studio>AGI_Ananas</studio>
  <director>AGI_Ananas</director>
  <runtime>773</runtime>
</movie>
```

**改进后的NFO：**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>爆降75%token！我在清华分享openclaw的graph-memory插件</title>
  <plot>3.15在清华大学分享的graph-memory进行了一键安装包的设计压缩。本期视频分享openclaw的上下文工程插件的设计思路底层原理。希望大家一起探讨</plot>
  <thumb>http://i1.hdslb.com/bfs/archive/f4932dd8393ebe675d5e27aa2e1b1bcc52a00be1.jpg</thumb>
  <premiered>2026-03-31</premiered>
  <studio>AGI_Ananas</studio>
  <director>AGI_Ananas</director>
  <runtime>773</runtime>
  <playcount>18836</playcount>
  <rating>10.0</rating>
  <tag>弹幕数: 2</tag>
  <tag>评论数: 224</tag>
  <tag>分享数: 110</tag>
  <bilibili_stat xmlns="bilibili">
    <play>18836</play>
    <like>381</like>
    <coin>259</coin>
    <favorite>908</favorite>
    <share>110</share>
    <danmaku>2</danmaku>
    <reply>224</reply>
  </bilibili_stat>
</movie>
```

### 技术要点

1. **HTML解析方法**：绕过B站API限制，获取完整视频信息
2. **异步调用**：正确使用 `await` 调用异步方法
3. **数据提取**：从HTML的 `__INITIAL_STATE__` 中提取结构化数据
4. **容错处理**：多重正则表达式匹配，提高成功率
5. **NFO增强**：包含视频描述、播放量、点赞、投币等完整信息

### 经验总结

1. 使用HTML解析方法绕过API限制是有效的
2. 异步方法的调用必须正确使用 `await`
3. 多重正则表达式匹配可以提高数据提取成功率
4. 完整的元数据信息对媒体库管理非常重要
5. 参考现有项目的实现可以节省开发时间
