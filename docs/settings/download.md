# 下载设置

下载设置模块负责管理系统下载相关的配置，包括视频质量、音频编码、下载并发控制、元数据下载等。

## 配置项

### 视频质量

| 键 | 说明 | 默认值 | 可选值 |
|----|------|-------|--------|
| video.default_quality | 默认视频质量 | 64 | 16(360P), 32(480P), 64(720P), 80(1080P), 112(1080P+), 116(4K) |
| video.audio_bitrate | 音频码率 | 192 | 64, 128, 132, 192, 30232, 30251, 30250 |
| video.codec | 视频编码 | avc | avc, hevc, av1, vp9 |
| video.output_format | 输出格式 | mp4 | mp4, flv, mkv, webm |

### 下载控制

| 键 | 说明 | 默认值 | 范围 |
|----|------|-------|-------|
| max_concurrent | 最大并发数 | 3 | 1-5 |
| speed_limit | 速度限制(KB/s) | 0 | 0表示无限制 |

### 元数据

| 键 | 说明 | 默认值 |
|----|------|-------|
| metadata.enable_nfo | 生成 NFO 信息文件 | true |
| metadata.enable_subtitle | 下载字幕 | true |
| metadata.enable_cover | 下载封面 | true |
| metadata.enable_avatar | 下载UP主头像 | false |

---

## 数据流

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          前端 (DownloadSettings.tsx)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  视频参数   │  │  下载性能  │  │  元数据   │  │  重置按钮  │         │
│  │ - 分辨率   │  │ - 并发数   │  │ - 字幕    │  │  - 重置   │         │
│  │ - 音频码率 │  │ - 速度限制│  │ - NFO     │  │           │         │
│  │ - 编码格式 │  │           │  │ - 封面   │  │           │         │
│  │           │  │           │  │ - 头像   │  │           │         │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘         │
│        │             │             │             │               │
│        └─────────────┴─────┬──────┴─────────────┘               │
│                      ┌─────▼─────┐                              │
│                      │ SettingsStore │                             │
│                      └─────┬─────┘                              │
└──────────────────────────│──────────────────────────────────────────
                    ┌──────▼──────┐
                    │ GET/PUT /api/settings
                    └──────┬──────┘
                          │
┌─────────────────────────▼──────────────────────────────────────────────┐
│                      后端 (FastAPI)                                  │
│                                                                    │
│  ┌──────────────┐  ���────────────────────────────────┐               │
│  │settings.py │─▶│ SettingsService                  │               │
│  │/api/settings│  │  get_settings()                 │               │
│  └────────────┘  │  update_settings()              │               │
│                   └────────────┬───────────────────┘               │
│                                │                                   │
│                   ┌────────────▼────────────┐                       │
│                   │   Setting 模型         │                       │
│                   │   settings 表          │                       │
│                   └───────────────────────┘                       │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ DownloadService (下载服务)                                   │   │
│  │ - 根据 settings 配置创建下载任务                                 │   │
│  │ - 应用质量、编码、并发配置                                     │   │
│  │ - 应用元数据设置                                             │   │
│  └───────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────
```

---

## 前端实现

### 组件结构 (DownloadSettings.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│                  DownloadSettings                         │
├─────────────────────────────────────────────────────────────┤
│ 状态管理                                               │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ localSettings: {                                     │  │
│ │   video: { default_quality, audio_bitrate, codec },  │  │
│ │   metadata: { enable_nfo, enable_subtitle, ... },    │  │
│ │   max_concurrent: number,                            │  │
│ │   speed_limit: number                               │  │
│ │ }                                                  │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                         │
│ 本地修改暂存流程：                                        │
│ 1. 用户修改设置 → handleLocalUpdate()                  │
│ 2. 保存到 localSettings                             │
│ 3. 点击"保存设置" → saveSettings()                  │
│ 4. 调用 updateSettings API                          │
│ 5. 重新获取设置确认保存成功                          │
└───────────────────────���─��───────────────────────────┘
```

### 功能模块

| 模块 | UI 组件 | 功能 |
|------|--------|------|
| 视频参数 | `<select>` 组件 | 分辨率、音频码率、编码格式选择 |
| 下载性能 | `<select>` + `<input>` | 并发数、速度限制 |
| 元数据 | 开关组件 | 字幕/NFO/封面/头像下载开关 |
| 重置 | 按钮+确认弹窗 | 恢复默认设置 |

### 质量选择逻辑

```typescript
// 分辨率选项
const qualityOptions = [
  { value: 16, label: '360P' },
  { value: 32, label: '480P' },
  { value: 64, label: '720P' },
  { value: 80, label: '1080P' },
  { value: 112, label: '1080P+' },
  { value: 116, label: '4K' }
]

// 音频码率选项
const audioOptions = [
  { value: 64, label: '64K' },
  { value: 128, label: '128K' },
  { value: 192, label: '192K' },
  { value: 30232, label: '杜比全景声320K' },
  { value: 30251, label: 'Hi-Res 无损' },
  { value: 30250, label: '无损FLAC' }
]
```

---

## 后端实现

### Schema 定义 (schemas/settings.py)

```python
class VideoSettings(BaseModel):
    """视频质量设置"""
    default_quality: int = Field(
        default=64,
        description="Default video quality (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)"
    )
    audio_bitrate: int = Field(default=192)
    codec: str = Field(default="avc")  # avc/hevc/av1/vp9
    output_format: str = Field(default="mp4")  # mp4/flv/mkv/webm

class MetadataSettings(BaseModel):
    """元数据设置"""
    enable_nfo: bool = Field(default=True)
    enable_subtitle: bool = Field(default=True)
    enable_cover: bool = Field(default=True)
    enable_avatar: bool = Field(default=False)

class DownloadSettings(BaseModel):
    """下载设置"""
    video: VideoSettings
    max_concurrent: int = Field(default=3, ge=1, le=5)
    speed_limit: int = Field(default=0, ge=0)
    metadata: MetadataSettings
```

### 服务层 (services/settings_service.py)

```python
def get_settings(self) -> Settings:
    """获取所有设置"""
    # 提取 video 设置
    video_settings = {
        'default_quality': int(self._get_setting_value(all_settings, 'download.video.default_quality', 64)),
        'audio_bitrate': int(self._get_setting_value(all_settings, 'download.video.audio_bitrate', 192)),
        'codec': self._get_setting_value(all_settings, 'download.video.codec', 'avc'),
        'output_format': self._get_setting_value(all_settings, 'download.video.output_format', 'mp4')
    }
    
    # 提取 metadata 设置
    metadata_settings = {
        'enable_nfo': self._get_setting_value(all_settings, 'download.metadata.enable_nfo', True),
        'enable_subtitle': self._get_setting_value(all_settings, 'download.metadata.enable_subtitle', True),
        'enable_cover': self._get_setting_value(all_settings, 'download.metadata.enable_cover', True),
        'enable_avatar': self._get_setting_value(all_settings, 'download.metadata.enable_avatar', False)
    }
    
    # 构建 download 设置
    download_settings = DownloadSettings(
        video=video_settings,
        max_concurrent=int(self._get_setting_value(all_settings, 'download.max_concurrent', 3)),
        speed_limit=int(self._get_setting_value(all_settings, 'download.speed_limit', 0)),
        metadata=metadata_settings
    )
```

---

## 视频质量说明

### 分辨率对照表

| 质量代码 | 分辨率 | 说明 | 适用场景 |
|---------|-------|------|---------|
| 16 | 360P | 流畅 | 网络差、省流量 |
| 32 | 480P | 标清 | 一般网络 |
| 64 | 720P | 高清 | 推荐日常 |
| 80 | 1080P | 1080P高清 | 高画质 |
| 112 | 1080P+ | 超清 | 更高画质 |
| 116 | 4K | 4K超清 | 最高画质 |

> **注意**: 下载时会优先使用设置的参数。若目标资源不支持所选参数，则使用其支持的最高参数。

### 音频码率说明

| 码率 | 说明 | 格式 |
|------|------|------|
| 64 | 低音质 | mp4 |
| 128 | 标准 | mp4 |
| 192 | 高音质 | mp4 |
| 30232 | 杜比全景声320K | flv |
| 30251 | Hi-Res 无损 | flv |
| 30250 | 无损FLAC | flv |

### 编码格式说明

| 编码 | 名称 | 兼容性 | 推荐场景 |
|------|------|-------|---------|
| avc | H.264 | 最好 | 通用 |
| hevc | H.265 | 较好 | 省空间 |
| av1 | AV1 | 一般 | 新格式 |
| vp9 | VP9 | 较好 | Google生态 |

### 输出格式说明

| 格式 | 说明 | 特点 |
|------|------|------|
| mp4 | MPEG-4 | 兼容性最好 |
| flv | Flash Video | 支持高音质 |
| mkv | Matroska | 封装灵活 |
| webm | WebM | Web专用 |

---

## 元数据文件说明

### NFO 文件

启用后生成 `.nfo` 文件，包含视频信息：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>视频标题</title>
  <plot>视频简介</plot>
  <studio>Bilibili</studio>
  <actor>
    <name>UP主名称</name>
    <role>UP主</role>
  </actor>
</movie>
```

### 其他元数据

| 类型 | 文件格式 | 下载条件 |
|------|---------|---------|
| 字幕 | .ass, .srt | enable_subtitle=true |
| 封面 | .jpg/.png | enable_cover=true |
| 头像 | .jpg | enable_avatar=true |

---

## API 详情

### 获取设置

```
GET /api/settings
```

响应：
```json
{
    "download": {
        "video": {
            "default_quality": 64,
            "audio_bitrate": 192,
            "codec": "avc",
            "output_format": "mp4"
        },
        "max_concurrent": 3,
        "speed_limit": 0,
        "metadata": {
            "enable_nfo": true,
            "enable_subtitle": true,
            "enable_cover": true,
            "enable_avatar": false
        }
    }
}
```

### 更新设置

```
PUT /api/settings
Content-Type: application/json

Body: {
    "download": {
        "video": {
            "default_quality": 80,
            "audio_bitrate": 192,
            "codec": "hevc",
            "output_format": "mp4"
        },
        "max_concurrent": 3,
        "speed_limit": 5000,
        "metadata": {
            "enable_nfo": true,
            "enable_subtitle": true,
            "enable_cover": true,
            "enable_avatar": true
        }
    }
}
```

### 重置设置

```
POST /api/settings/reset?category=download
```

响应：返回默认下载设置

### 导出设置

```
GET /api/settings/export
```

---

## 交互流程

### 修改设置流程

```
1. 用户选择分辨率/码率/编码
   ↓
2. handleLocalUpdate() 暂存到 localSettings
   ↓
3. 点击"保存设置"
   ↓
4. saveSettings() 合并设置
   ↓
5. 调用 updateSettings API
   ↓
6. 后端更新数据库
   ↓
7. 重新获取设置确认
   ↓
8. 显示保存成功提示
```

### 重置设置流程

```
1. 用户点击"重置下载设置"
   ↓
2. 弹出确认对话框
   ↓
3. 用户确认
   ↓
4. POST /api/settings/reset?category=download
   ↓
5. 清空本地 localSettings
   ↓
6. 重新获取设置
   ↓
7. 显示重置成功
```

---

## 关键文件

### 前端

| 文件 | 说明 |
|------|------|
| `apps/web/src/stores/settings.ts` | 状态管理 |
| `apps/web/src/pages/settings/DownloadSettings.tsx` | 下载设置页面 |

### 后端

| 文件 | 说明 |
|------|------|
| `apps/api/src/routers/settings.py` | API 路由 |
| `apps/api/src/services/settings_service.py` | 设置服务 |
| `apps/api/src/schemas/settings.py` | 数据模型 |
| `apps/api/src/models/setting.py` | 数据库模型 |

---

## 关联文档

- [storage.md](storage.md) - 存储设置
- [general.md](general.md) - 通用设置
- [auto-download.md](auto-download.md) - 自动下载设置
- [API 端点](../api/endpoints.md) - 完整 API 列表

---

[返回上级](./README.md)