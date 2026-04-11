# 下载配置面板升级方案

## 概述

本文档详细说明了如何参考BiliTools项目，为PiliNote实现完整的下载配置面板。该面板将在解析视频后显示，允许用户配置8个分类的下载设置：分辨率、编码格式、比特率、流媒体格式、NFO、弹幕、图像、杂项。

## BiliTools设置面板分析

### 8个配置分类

#### 1. 杂项
- 添加元数据
- 阻止PCDN
- 自动下载

#### 2. NFO（元数据）
- 下载时添加NFO文件
- 包含视频信息、UP主信息、统计数据等

#### 3. 弹幕
- 下载弹幕
- 转换弹幕格式（ASS/XML/SRT）

#### 4. 图像
- 下载封面图片
- 下载UP主头像

#### 5. 分辨率
- 视频分辨率选择：
  - 16 = 360P（标清）
  - 32 = 480P（高清）
  - 64 = 720P（超清）
  - 80 = 1080P（全高清）
  - 112 = 1080P+（高清+）
  - 116 = 4K（超高清）

#### 6. 编码格式
- 视频编码选择：
  - AVC (H.264) - 兼容性好
  - HEVC (H.265) - 体积小
  - AV1 - 新一代编码
  - VP9 - Google开源

#### 7. 比特率
- 音频码率选择：
  - 64K - 低音质
  - 128K - 标准音质
  - 132K - 中音质
  - 192K - 高音质
  - 30232 (320K) - 高品质
  - 30251 (杜比全景声) - 空间音频
  - 30250 (Hi-Res) - 无损音频

#### 8. 流媒体格式
- 输出容器格式：
  - MP4 - 通用格式
  - FLV - Flash格式
  - MKV - 多媒体容器
  - WEBM - Web格式

## PiliNote当前状态

### 已有设置
- ✅ 分辨率选择
- ✅ 输出格式选择（MP4）
- ✅ 最大并发数
- ✅ 速度限制
- ✅ 下载路径
- ✅ 临时路径
- ✅ 自动清理
- ✅ 保留失败任务
- ✅ FFmpeg/aria2c/danmakufactory路径

### 缺少设置
- ❌ 音频码率选择
- ❌ 视频编码选择
- ❌ 元数据下载（NFO）
- ❌ 弹幕下载和格式转换
- ❌ 图像下载（封面、头像）
- ❌ 阻止PCDN
- ❌ 下载配置面板UI

## 完整升级方案

### 阶段1：扩展后端设置结构

#### 1.1 修改`apps/api/src/schemas/settings.py`

```python
class VideoSettings(BaseModel):
    """Video quality settings"""
    default_quality: int = Field(
        default=64,
        description="Default video quality (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)"
    )
    audio_bitrate: int = Field(
        default=192,
        description="Audio bitrate (64/128/132/192/30232/30251/30250)"
    )
    codec: str = Field(
        default="avc",
        description="Video codec (avc/hevc/av1/vp9)"
    )
    output_format: str = Field(
        default="mp4",
        description="Output format (mp4/flv/mkv/webm)"
    )


class MetadataSettings(BaseModel):
    """Metadata settings"""
    enable_nfo: bool = Field(default=True, description="Enable NFO metadata file")
    enable_subtitle: bool = Field(default=True, description="Download subtitles")
    enable_danmaku: bool = Field(default=False, description="Download danmaku")
    danmaku_format: str = Field(default="xml", description="Danmaku format (xml/ass/srt)")
    enable_cover: bool = Field(default=True, description="Download cover image")
    enable_avatar: bool = Field(default=False, description="Download uploader avatar")
    block_pcdn: bool = Field(default=True, description="Block PCDN nodes")


class DownloadSettings(BaseModel):
    """Download settings"""
    video: VideoSettings = Field(default_factory=VideoSettings)
    max_concurrent: int = Field(default=3, ge=1, le=5, description="Max concurrent downloads")
    speed_limit: int = Field(default=0, ge=0, description="Speed limit (KB/s), 0 means no limit")
    metadata: MetadataSettings = Field(default_factory=MetadataSettings)


class Settings(BaseModel):
    """All settings"""
    download: DownloadSettings
    storage: StorageSettings
    general: GeneralSettings
```

#### 1.2 修改`apps/api/src/models/download.py`

添加新字段支持：

```python
class Download(Base):
    # ... 现有字段 ...

    # 新增视频质量设置
    audio_bitrate = Column(Integer, nullable=True)
    codec = Column(String(20), nullable=True)

    # 新增元数据设置
    enable_nfo = Column(Boolean, default=True)
    enable_subtitle = Column(Boolean, default=True)
    enable_danmaku = Column(Boolean, default=False)
    danmaku_format = Column(String(20), default='xml')
    enable_cover = Column(Boolean, default=True)
    enable_avatar = Column(Boolean, default=False)
    block_pcdn = Column(Boolean, default=True)
```

### 阶段2：创建下载配置面板组件

#### 2.1 创建`apps/web/src/components/DownloadConfigPanel.tsx`

完整组件代码（约400行）：

```tsx
import { useState } from 'react'
import { X, Download, Film, FileText, MessageSquare, Image, Settings, Gauge, Music, Type } from 'lucide-react'

interface DownloadConfigPanelProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (config: DownloadConfig) => void
  defaultConfig: DownloadConfig
  videoInfo: VideoInfo
}

interface DownloadConfig {
  // 分辨率
  quality: number
  // 音频码率
  audio_bitrate: number
  // 编码格式
  codec: string
  // 输出格式
  output_format: string
  // 元数据
  enable_nfo: boolean
  enable_subtitle: boolean
  enable_danmaku: boolean
  danmaku_format: string
  // 图像
  enable_cover: boolean
  enable_avatar: boolean
  // 杂项
  block_pcdn: boolean
}

interface VideoInfo {
  bvid: string
  title: string
  cover: string
  uploader: string
}

export default function DownloadConfigPanel({
  isOpen,
  onClose,
  onConfirm,
  defaultConfig,
  videoInfo
}: DownloadConfigPanelProps) {
  const [config, setConfig] = useState<DownloadConfig>(defaultConfig)
  const [activeTab, setActiveTab] = useState<string>('quality')

  const tabs = [
    { id: 'quality', name: '分辨率', icon: Film },
    { id: 'codec', name: '编码格式', icon: Settings },
    { id: 'bitrate', name: '比特率', icon: Music },
    { id: 'format', name: '流媒体格式', icon: Type },
    { id: 'nfo', name: 'NFO', icon: FileText },
    { id: 'danmaku', name: '弹幕', icon: MessageSquare },
    { id: 'image', name: '图像', icon: Image },
    { id: 'misc', name: '杂项', icon: Download },
  ]

  // ... 选项定义 ...

  if (!isOpen) return null

  return (
    <div className="download-config-panel-overlay">
      <div className="download-config-panel">
        {/* 头部 */}
        {/* 视频信息预览 */}
        {/* 标签页 */}
        {/* 内容区域 - 8个Tab */}
        {/* 底部按钮 */}
      </div>
    </div>
  )
}
```

#### 2.2 创建CSS样式`apps/web/src/components/DownloadConfigPanel.css`

```css
.download-config-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.download-config-panel {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.download-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.download-config-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.download-config-preview {
  display: flex;
  gap: 16px;
  padding: 20px 24px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.download-config-preview img {
  width: 80px;
  height: 50px;
  object-fit: cover;
  border-radius: 8px;
}

.download-config-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 24px;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #6b7280;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab:hover {
  background: #f3f4f6;
}

.tab.active {
  background: #2563eb;
  color: white;
}

.download-config-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.config-section h4 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.checkbox-option:hover {
  background: #f3f4f6;
}

.option-desc {
  margin: 8px 0 0 28px;
  font-size: 13px;
  color: #6b7280;
}

.download-config-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
}

.cancel-button,
.confirm-button {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button {
  background: #f3f4f6;
  color: #374151;
}

.cancel-button:hover {
  background: #e5e7eb;
}

.confirm-button {
  background: #2563eb;
  color: white;
}

.confirm-button:hover {
  background: #1d4ed8;
}
```

### 阶段3：修改VideoDetailPage集成配置面板

#### 3.1 修改`apps/web/src/pages/VideoDetailPage.tsx`

```tsx
import DownloadConfigPanel from '../components/DownloadConfigPanel'

export default function VideoDetailPage() {
  // ... 现有代码 ...

  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [downloadConfig, setDownloadConfig] = useState<DownloadConfig>({
    quality: 64,
    audio_bitrate: 192,
    codec: 'avc',
    output_format: 'mp4',
    enable_nfo: true,
    enable_subtitle: true,
    enable_danmaku: false,
    danmaku_format: 'xml',
    enable_cover: true,
    enable_avatar: false,
    block_pcdn: true,
  })

  // 修改"添加到列表"按钮点击事件
  const handleAddToDownloadClick = () => {
    setShowConfigPanel(true)
  }

  // 处理配置确认
  const handleConfigConfirm = async (config: DownloadConfig) => {
    setShowConfigPanel(false)
    setDownloadConfig(config)
    
    // 使用配置进行下载
    await handleAddToDownloadWithConfig(config)
  }

  // 带配置的下载逻辑
  const handleAddToDownloadWithConfig = async (config: DownloadConfig) => {
    // ... 使用config参数创建下载任务 ...
  }

  return (
    <div className="video-detail-page">
      {/* ... 现有内容 ... */}

      {/* 修改"添加到列表"按钮 */}
      <button onClick={handleAddToDownloadClick}>
        添加到列表
      </button>

      {/* 下载配置面板 */}
      <DownloadConfigPanel
        isOpen={showConfigPanel}
        onClose={() => setShowConfigPanel(false)}
        onConfirm={handleConfigConfirm}
        defaultConfig={downloadConfig}
        videoInfo={{
          bvid: video?.bvid || '',
          title: video?.title || '',
          cover: video?.cover || '',
          uploader: video?.uploader?.name || ''
        }}
      />
    </div>
  )
}
```

### 阶段4：扩展DownloadEngine支持新功能

#### 4.1 修改`apps/api/src/services/download_engine.py`

```python
class DownloadEngine:
    async def download_video(
        self,
        bvid: str,
        quality: int,
        output_format: str,
        output_path: str,
        sessdata: Optional[str] = None,
        progress_callback: Optional[Callable] = None,
        pause_event: Optional[asyncio.Event] = None,
        cid: Optional[int] = None,
        audio_bitrate: Optional[int] = 192,  # 新增
        codec: Optional[str] = 'avc',  # 新增
        enable_nfo: bool = True,  # 新增
        enable_subtitle: bool = True,  # 新增
        enable_danmaku: bool = False,  # 新增
        danmaku_format: str = 'xml',  # 新增
        enable_cover: bool = True,  # 新增
        enable_avatar: bool = False,  # 新增
        block_pcdn: bool = True,  # 新增
    ):
        """下载视频"""
        # ... 现有代码 ...

        # 构建格式字符串
        format_str = self._build_format_string(quality, codec, audio_bitrate)

        # 构建yt-dlp配置
        ydl_opts = {
            'format': format_str,
            'outtmpl': str(output_dir / '%(title)s.%(ext)s'),
            'quiet': False,
            'no_warnings': True,
            'merge_output_format': output_format,
            'postprocessors': [],
            'progress_hooks': [lambda d: self._progress_hook(d, progress_callback)],
        }

        # 添加后处理器
        postprocessors = []

        # 视频转换器
        postprocessors.append({
            'key': 'FFmpegVideoConvertor',
            'preferedformat': output_format,
        })

        # 下载字幕
        if enable_subtitle:
            ydl_opts['writesubtitles'] = True
            ydl_opts['subtitleslangs'] = ['zh-Hans', 'zh-Hant']

        # 下载弹幕
        if enable_danmaku:
            # 使用danmakufactory处理弹幕
            ydl_opts['writedescription'] = True
            postprocessors.append({
                'key': 'FFmpegMetadata',
            })

        # 下载封面
        if enable_cover:
            ydl_opts['writethumbnail'] = True
            postprocessors.append({
                'key': 'FFmpegThumbnail',
            })

        # 阻止PCDN
        if block_pcdn:
            ydl_opts['http_headers'] = {
                'Referer': 'https://www.bilibili.com/',
                'User-Agent': 'Mozilla/5.0',
            }

        # 构建后处理器配置
        ydl_opts['postprocessors'] = postprocessors

        # 下载
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            await asyncio.to_thread(ydl.download, [f'https://www.bilibili.com/video/{bvid}'])

        # 生成NFO文件
        if enable_nfo:
            await self._generate_nfo_file(output_dir, video_info)

    def _build_format_string(self, quality: int, codec: str, audio_bitrate: int) -> str:
        """构建格式选择字符串"""
        # 质量映射
        quality_map = {
            16: 'worst[height<=360]',
            32: 'worst[height<=480]',
            64: 'worst[height<=720]',
            80: 'worst[height<=1080]',
            112: 'best[height<=1080]',
            116: 'best[height<=2160]',
        }

        # 编码映射
        codec_map = {
            'avc': 'avc1',
            'hevc': 'hevc',
            'av1': 'av01',
            'vp9': 'vp9',
        }

        # 音频码率映射
        bitrate_map = {
            64: '64k',
            128: '128k',
            132: '132k',
            192: '192k',
            30232: '320k',
            30251: 'lossless',
            30250: 'lossless',
        }

        # 构建格式字符串
        video_format = quality_map.get(quality, 'best')
        audio_format = bitrate_map.get(audio_bitrate, 'best')

        return f'{video_format}[vcodec~={codec_map.get(codec, "avc1")}]+{audio_format}'

    async def _generate_nfo_file(self, output_dir: Path, video_info: dict):
        """生成NFO元数据文件"""
        nfo_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>{video_info.get('title', '')}</title>
  <plot>{video_info.get('description', '')}</plot>
  <thumb>{video_info.get('cover', '')}</thumb>
  <premiered>{video_info.get('pubdate', '')}</premiered>
  <studio>{video_info.get('uploader', '')}</studio>
  <director>{video_info.get('uploader', '')}</director>
  <playcount>{video_info.get('view', 0)}</playcount>
  <rating>{video_info.get('like', 0)}</rating>
</movie>
'''

        nfo_file = output_dir / 'movie.nfo'
        nfo_file.write_text(nfo_content, encoding='utf-8')
```

### 阶段5：扩展API端点

#### 5.1 修改`apps/api/src/routers/download.py`

```python
@router.post("/start")
async def start_download(
    request: DownloadRequest,
    db: Session = Depends(get_db)
):
    """创建下载任务"""
    # 解析下载参数
    download_data = {
        'bvid': request.bvid,
        'title': request.title,
        'cid': request.cid,
        'aid': request.aid,
        'quality': request.quality or 64,
        'output_format': request.output_format or 'mp4',
        'audio_bitrate': request.audio_bitrate or 192,  # 新增
        'codec': request.codec or 'avc',  # 新增
        'enable_nfo': request.enable_nfo if request.enable_nfo is not None else True,  # 新增
        'enable_subtitle': request.enable_subtitle if request.enable_subtitle is not None else True,  # 新增
        'enable_danmaku': request.enable_danmaku if request.enable_danmaku is not None else False,  # 新增
        'danmaku_format': request.danmaku_format or 'xml',  # 新增
        'enable_cover': request.enable_cover if request.enable_cover is not None else True,  # 新增
        'enable_avatar': request.enable_avatar if request.enable_avatar is not None else False,  # 新增
        'block_pcdn': request.block_pcdn if request.block_pcdn is not None else True,  # 新增
        'thumbnail_url': request.thumbnail_url,
        'duration': request.duration,
        'uploader': request.uploader,
        'uploader_mid': request.uploader_mid,
        'sessdata': request.sessdata,
    }

    # 创建下载任务
    download_id = download_service.create_download_task(**download_data)

    return {
        "success": True,
        "data": {
            "download_id": download_id,
            "message": "下载任务已创建"
        }
    }
```

#### 5.2 更新`apps/api/src/schemas/download.py`

```python
class DownloadRequest(BaseModel):
    """Download request model"""
    bvid: str
    title: str
    cid: int
    aid: int
    quality: Optional[int] = None
    output_format: Optional[str] = None
    audio_bitrate: Optional[int] = None  # 新增
    codec: Optional[str] = None  # 新增
    enable_nfo: Optional[bool] = None  # 新增
    enable_subtitle: Optional[bool] = None  # 新增
    enable_danmaku: Optional[bool] = None  # 新增
    danmaku_format: Optional[str] = None  # 新增
    enable_cover: Optional[bool] = None  # 新增
    enable_avatar: Optional[bool] = None  # 新增
    block_pcdn: Optional[bool] = None  # 新增
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    uploader: Optional[str] = None
    uploader_mid: Optional[int] = None
    sessdata: Optional[str] = None
```

### 阶段6：更新前端设置页面

#### 6.1 修改`apps/web/src/pages/settings/DownloadSettings.tsx`

添加新的设置项：

```tsx
export default function DownloadSettings() {
  // ... 现有代码 ...

  return (
    <div className="download-settings-new">
      {/* 现有设置 */}

      {/* 新增：音频码率 */}
      <div className="download-form-item">
        <label className="download-form-label" htmlFor="audio-bitrate-select">
          <Music className="download-form-icon" />
          <span className="download-form-text">音频码率</span>
        </label>
        <select
          id="audio-bitrate-select"
          className="download-form-select"
          value={settings.download.video.audio_bitrate}
          onChange={(e) => handleUpdate('audio_bitrate', parseInt(e.target.value))}
          disabled={loading}
        >
          <option value={64}>64K - 低音质</option>
          <option value={128}>128K - 标准音质</option>
          <option value={132}>132K - 中音质</option>
          <option value={192}>192K - 高音质</option>
          <option value={30232}>320K - 高品质</option>
        </select>
      </div>

      {/* 新增：视频编码 */}
      <div className="download-form-item">
        <label className="download-form-label" htmlFor="codec-select">
          <Settings className="download-form-icon" />
          <span className="download-form-text">视频编码</span>
        </label>
        <select
          id="codec-select"
          className="download-form-select"
          value={settings.download.video.codec}
          onChange={(e) => handleUpdate('codec', e.target.value)}
          disabled={loading}
        >
          <option value="avc">AVC (H.264) - 兼容性好</option>
          <option value="hevc">HEVC (H.265) - 体积小</option>
          <option value="av1">AV1 - 新一代编码</option>
          <option value="vp9">VP9 - Google开源</option>
        </select>
      </div>

      {/* 新增：元数据设置 */}
      <div className="download-form-group">
        <h3 className="download-form-group-title">元数据设置</h3>

        <div className="download-checkbox-item">
          <label className="download-checkbox-label">
            <input
              type="checkbox"
              className="download-checkbox-input"
              checked={settings.download.metadata.enable_nfo}
              onChange={(e) => handleUpdate('enable_nfo', e.target.checked)}
              disabled={loading}
            />
            <span className="download-checkbox-text">下载NFO元数据文件</span>
          </label>
        </div>

        <div className="download-checkbox-item">
          <label className="download-checkbox-label">
            <input
              type="checkbox"
              className="download-checkbox-input"
              checked={settings.download.metadata.enable_subtitle}
              onChange={(e) => handleUpdate('enable_subtitle', e.target.checked)}
              disabled={loading}
            />
            <span className="download-checkbox-text">下载字幕</span>
          </label>
        </div>

        <div className="download-checkbox-item">
          <label className="download-checkbox-label">
            <input
              type="checkbox"
              className="download-checkbox-input"
              checked={settings.download.metadata.enable_danmaku}
              onChange={(e) => handleUpdate('enable_danmaku', e.target.checked)}
              disabled={loading}
            />
            <span className="download-checkbox-text">下载弹幕</span>
          </label>
        </div>

        {settings.download.metadata.enable_danmaku && (
          <div className="download-form-item">
            <label className="download-form-label" htmlFor="danmaku-format-select">
              <MessageSquare className="download-form-icon" />
              <span className="download-form-text">弹幕格式</span>
            </label>
            <select
              id="danmaku-format-select"
              className="download-form-select"
              value={settings.download.metadata.danmaku_format}
              onChange={(e) => handleUpdate('danmaku_format', e.target.value)}
              disabled={loading}
            >
              <option value="xml">XML - B站原始格式</option>
              <option value="ass">ASS - 字幕格式</option>
              <option value="srt">SRT - 通用字幕</option>
            </select>
          </div>
        )}

        <div className="download-checkbox-item">
          <label className="download-checkbox-label">
            <input
              type="checkbox"
              className="download-checkbox-input"
              checked={settings.download.metadata.enable_cover}
              onChange={(e) => handleUpdate('enable_cover', e.target.checked)}
              disabled={loading}
            />
            <span className="download-checkbox-text">下载封面图片</span>
          </label>
        </div>

        <div className="download-checkbox-item">
          <label className="download-checkbox-label">
            <input
              type="checkbox"
              className="download-checkbox-input"
              checked={settings.download.metadata.enable_avatar}
              onChange={(e) => handleUpdate('enable_avatar', e.target.checked)}
              disabled={loading}
            />
            <span className="download-checkbox-text">下载UP主头像</span>
          </label>
        </div>

        <div className="download-checkbox-item">
          <label className="download-checkbox-label">
            <input
              type="checkbox"
              className="download-checkbox-input"
              checked={settings.download.metadata.block_pcdn}
              onChange={(e) => handleUpdate('block_pcdn', e.target.checked)}
              disabled={loading}
            />
            <span className="download-checkbox-text">阻止PCDN</span>
          </label>
        </div>
      </div>
    </div>
  )
}
```

## 实施优先级

### 高优先级（核心功能）
1. ✅ 分辨率选择（已有）
2. ✅ 输出格式选择（已有）
3. 🔄 创建下载配置面板UI
4. 🔄 音频码率选择
5. 🔄 视频编码选择
6. 🔄 集成到VideoDetailPage

### 中优先级（增强功能）
7. 🔄 NFO元数据文件生成
8. 🔄 弹幕下载和格式转换
9. 🔄 图像下载（封面、头像）
10. 🔄 字幕下载

### 低优先级（优化功能）
11. 🔄 阻止PCDN
12. 🔄 自定义命名格式
13. 🔄 保存配置为默认
14. 🔄 配置导入导出

## UI设计建议

### 设计风格
- 采用**Material Design 3**风格
- 与现有设置页面保持一致
- 移动端优先，响应式设计

### 组件结构
```
DownloadConfigPanel
├── Overlay（遮罩层）
└── Panel（面板）
    ├── Header（头部）
    │   ├── 标题
    │   └── 关闭按钮
    ├── Preview（视频信息预览）
    │   ├── 封面图
    │   └── 视频信息
    ├── Tabs（8个标签页）
    │   ├── 分辨率
    │   ├── 编码格式
    │   ├── 比特率
    │   ├── 流媒体格式
    │   ├── NFO
    │   ├── 弹幕
    │   ├── 图像
    │   └── 杂项
    ├── Content（内容区域）
    │   └── 根据Tab显示对应配置
    └── Footer（底部按钮）
        ├── 取消
        └── 确认下载
```

### 交互流程
1. 用户点击"添加到列表"按钮
2. 显示下载配置面板
3. 用户配置各项参数
4. 点击"确认下载"
5. 关闭面板，创建下载任务

### 响应式设计
- 移动端（< 640px）：全屏显示，底部按钮固定
- 平板（640-1024px）：居中显示，宽度90%
- 桌面（> 1024px）：居中显示，最大宽度800px

## 技术要点

### 1. 数据同步
- 配置面板使用本地状态管理
- 确认后将配置传递给下载API
- 支持保存为默认配置

### 2. 性能优化
- 使用React.memo优化组件渲染
- 防抖处理频繁更新
- 延迟加载配置选项

### 3. 用户体验
- 实时预览配置变化
- 提供配置说明
- 支持快速选择预设

### 4. 错误处理
- 配置验证
- 友好的错误提示
- 配置恢复机制

## 测试计划

### 功能测试
1. 配置面板打开/关闭
2. 8个Tab切换
3. 各配置项修改
4. 配置确认和取消
5. 下载任务创建

### 集成测试
1. 与VideoDetailPage集成
2. 与DownloadEngine集成
3. 与Settings集成
4. 数据库存储

### UI测试
1. 响应式布局
2. 移动端适配
3. 动画效果
4. 无障碍支持

## 依赖关系

### 前端依赖
- React 18+
- TypeScript 5+
- Lucide React（图标库）
- Tailwind CSS（样式）

### 后端依赖
- FastAPI 0.104+
- SQLAlchemy 2.0+
- yt-dlp（最新版）
- FFmpeg（视频处理）
- danmakufactory（弹幕处理）

### 新增npm包
无需新增npm包，使用现有依赖即可

## 风险评估

### 技术风险
- **低风险**：UI组件开发
- **中风险**：弹幕格式转换
- **高风险**：PCDN阻止机制

### 兼容性风险
- **低风险**：现代浏览器
- **中风险**：旧版浏览器
- **低风险**：移动端

### 性能风险
- **低风险**：配置面板渲染
- **中风险**：大量下载任务
- **低风险**：数据库查询

## 后续优化

### 短期优化
1. 添加配置预设
2. 支持配置模板
3. 批量下载配置

### 长期优化
1. 智能配置推荐
2. 配置历史记录
3. 云端配置同步

## 参考资源

### BiliTools参考
- B站API：https://github.com/SocialSisterYi/bilibili-API-collect
- 下载引擎：yt-dlp
- 弹幕处理：danmakufactory

### PiliNote参考
- 现有设置系统
- DownloadService
- VideoDetailPage

## 总结

本升级方案通过参考BiliTools项目，为PiliNote实现完整的下载配置面板，包含8个配置分类，全面提升下载功能的灵活性和用户体验。

**关键特性**：
- 8个配置分类，涵盖所有下载参数
- Material Design 3风格，现代化UI
- 响应式设计，移动端优先
- 完整的配置管理机制

**实施步骤**：
1. 扩展后端设置结构
2. 创建配置面板组件
3. 集成到VideoDetailPage
4. 扩展DownloadEngine功能
5. 更新API端点
6. 更新设置页面

**预期效果**：
- 用户可以灵活配置下载参数
- 支持各种视频质量和格式
- 自动下载元数据和附件
- 提升整体用户体验