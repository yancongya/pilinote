# 下载设置

## 下载参数设置

### 1. 视频分辨率（quality）
- **16**: 360P 流畅
- **32**: 480P 清晰
- **64**: 720P 高清
- **80**: 1080P 高清
- **112**: 1080P+ 高码率
- **116**: 4K 超清

**说明**: 下载时会优先使用此处参数。若目标资源不支持此处选定的参数，则会使用其支持的最高参数。

### 2. 音频码率（audio_bitrate）
- **64**: 64K - 低质量音频
- **128**: 128K - 标准质量
- **132**: 132K - 高质量
- **192**: 192K - 高质量
- **30232**: 杜比全景声320K（实际约103Kbps）
- **30251**: Hi-Res 无损（使用最高可用音频流）
- **30250**: 无损FLAC（使用最高可用音频流）

**重要说明**:
- B站实际提供的音频流格式ID为：30216（约44K）、30232（约103K）、30280（约204K）
- 普通音频码率（64K-192K）会使用B站可用的最高质量音频
- 特殊格式（30232、30250、30251）会指定对应的音频流ID
- 音频码率取决于视频源和用户权限，不是所有视频都支持所有格式

### 3. 视频编码（codec）
- **avc**: AVC (H.264)
- **hevc**: HEVC (H.265)
- **av1**: AV1
- **vp9**: VP9

**说明**: 
- 格式字符串会尝试选择指定编码的流
- 如果视频源不支持该编码，会降级到其他可用编码

## 存储设置

### 路径设置

#### 下载路径
- 类型：`string`
- 默认值：`./downloads`
- 说明：视频文件保存路径

#### 临时文件路径
- 类型：`string`
- 默认值：`./temp`
- 说明：临时文件存储路径，用于存储未下载完毕的文件，经过处理后转移至下载路径

#### 自动清理临时文件
- 类型：`boolean`
- 默认值：`true`
- 说明：下载完成后自动清理临时文件

#### 保留失败的任务
- 类型：`boolean`
- 默认值：`false`
- 说明：下载失败时保留临时文件，便于调试

### 自定义执行路径（Sidecar）

#### FFmpeg 路径
- 类型：`string`
- 默认值：`ffmpeg`
- 说明：FFmpeg视频处理工具路径

#### Aria2c 路径
- 类型：`string`
- 默认值：`aria2c`
- 说明：Aria2c下载工具路径

#### Danmakufactory 路径
- 类型：`string`
- 默认值：`danmakufactory`
- 说明：弹幕处理工具路径

### 缓存管理

#### 缓存类型
- **日志缓存**：存储应用程序日志文件
- **临时缓存**：存储临时文件和缓存数据
- **WebView缓存**：存储WebView浏览器的缓存
- **数据库缓存**：存储数据库文件

#### 缓存操作
- **查看缓存大小**：显示每种缓存类型的占用空间和文件数量
- **清理指定缓存**：清理选中的缓存类型
- **打开缓存目录**：在文件浏览器中打开缓存目录
- **清理所有缓存**：一次性清理所有缓存类型

#### 缓存管理API

**获取缓存信息**:
```http
GET /api/settings/cache-info
```

**清理缓存**:
```http
POST /api/settings/clear-cache/{cache_type}
```

`cache_type` 参数：`log` | `temp` | `webview` | `database` | `downloads` | `all`

**打开缓存目录**:
```http
POST /api/settings/open-cache/{cache_type}
```

### 数据库管理

#### 数据库功能
- **导出数据库**：将数据库文件导出为备份文件
- **导入数据库**：从备份文件恢复数据库

#### 数据库管理API

**导出数据库**:
```http
GET /api/settings/database/export
```

**导入数据库**:
```http
POST /api/settings/database/import?file_path=/path/to/database.db
```

## 技术实现

### yt-dlp格式字符串构建
```python
def _build_format_string(self, quality: int, codec: str = 'avc', audio_bitrate: Optional[int] = 192) -> str:
    """
    根据质量、编码和音频码率构建yt-dlp格式字符串
    """
    # B站质量代码到视频高度的映射
    quality_map = {
        16: 360, 32: 480, 64: 720, 80: 1080, 112: 1080, 116: 2160
    }
    
    # B站编码格式到codec的映射
    codec_map = {
        'avc': 'avc1', 'hevc': 'hevc', 'av1': 'av01', 'vp9': 'vp09'
    }
    
    # B站音频码率到格式ID的映射
    audio_format_map = {
        64: '30216', 128: '30216', 132: '30216', 192: '30280',
        30232: '30232', 30251: '30280', 30250: '30280'
    }
    
    height = quality_map.get(quality, 720)
    video_codec = codec_map.get(codec, 'avc1')
    audio_format_id = audio_format_map.get(audio_bitrate, '30280')
    
    # 构建格式字符串
    if audio_bitrate >= 30232:
        # 高质量音频：使用指定的音频格式ID
        format_str = f'bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+{audio_format_id}/...'
    else:
        # 普通音频：使用bestaudio
        format_str = f'bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+bestaudio[ext=m4a]/...'
    
    return format_str
```

### 数据库字段
```python
class Download(Base):
    # ... 其他字段
    
    quality = Column(Integer, default=64)  # 视频质量
    audio_bitrate = Column(Integer, default=192)  # 音频码率
    codec = Column(String(10), default="avc")  # 视频编码
```

## 前端设置页面

### 下载设置页面（DownloadSettings）
- **分辨率选择**: 下拉选择视频分辨率
- **音频码率选择**: 下拉选择音频码率
- **编码格式选择**: 下拉选择视频编码格式

### 存储设置页面（StorageSettings）
- **下载路径设置**: 选择下载文件夹
- **临时路径设置**: 选择临时文件夹
- **缓存管理**: 清理缓存，查看缓存大小
- **数据库管理**: 导入导出数据库

## B站音频流格式说明

通过 `yt-dlp -F` 命令可以查看B站实际提供的音频流：

```
ID     EXT  RESOLUTION  |  FILESIZE   TBR  |  VCODEC        ACODEC      ABR
30216  m4a  audio only  |  ≈ 1.11MiB  44k  |  audio only   mp4a.40.5   44k
30232  m4a  audio only  |  ≈ 2.61MiB  103k |  audio only   mp4a.40.2   103k
30280  m4a  audio only  |  ≈ 5.16MiB  204k |  audio only   mp4a.40.2   204k
```

**格式ID对应关系**:
- 30216 → 约44Kbps（低质量）
- 30232 → 约103Kbps（中等质量）
- 30280 → 约204Kbps（高质量，B站最高可用）

## 使用示例

### 创建下载任务（带完整参数）
```http
POST /api/download/start
Content-Type: application/json

{
  "bvid": "BV1xx411c7mD",
  "title": "视频标题",
  "quality": 80,
  "output_format": "mp4",
  "audio_bitrate": 30232,
  "codec": "hevc",
  "sessdata": "用户SESSDATA（可选）"
}
```

### 更新存储设置
```typescript
await updateSettings({
  storage: {
    download_path: './downloads',
    temp_path: './temp',
    auto_cleanup: true,
    keep_failed: false,
    sidecar: {
      ffmpeg: 'ffmpeg',
      aria2c: 'aria2c',
      danmakufactory: 'danmakufactory'
    }
  }
})
```

## 注意事项

1. **路径权限**: 确保下载路径和临时路径有读写权限
2. **磁盘空间**: 确保有足够的磁盘空间用于下载和临时文件
3. **Sidecar工具**: FFmpeg、Aria2c、Danmakufactory需要正确安装并配置
4. **数据库备份**: 导入数据库前会自动备份当前数据库
5. **缓存清理**: 清理数据库缓存会删除所有数据，请谨慎操作

## 更新日志

### 2026-03-31
- ✅ 实现视频分辨率选择（360P/480P/720P/1080P/1080P+/4K）
- ✅ 实现音频码率选择（64K/128K/132K/192K/杜比全景声/Hi-Res无损/无损FLAC）
- ✅ 实现视频编码格式选择（AVC/H.264、HEVC/H.265、AV1、VP9）
- ✅ 完全复刻BiliTools下载设置UI
- ✅ 支持yt-dlp格式字符串构建
- ✅ 支持音频流ID选择（30216/30232/30280）
- ✅ 实现存储设置（路径设置、缓存管理、数据库管理）
- ✅ 实现缓存管理API
- ✅ 实现数据库导入导出功能