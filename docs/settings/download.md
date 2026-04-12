# 下载设置

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

## 详细说明

### 视频质量说明

| 质量代码 | 分辨率 | 说明 |
|---------|-------|------|
| 16 | 360P | 流畅 |
| 32 | 480P | 标清 |
| 64 | 720P | 高清 |
| 80 | 1080P | 1080P高清 |
| 112 | 1080P+ | 超清 |
| 116 | 4K | 4K超清 |

### 音频码率说明

| 码率 | 说明 |
|------|------|
| 64 | 低音质 |
| 128 | 标准 |
| 192 | 高音质 |
| 30232+ | 320K高品质（flv格式） |

### 元数据文件

启用后会在下载目录生成：
- `.nfo` 文件：视频信息（标题、简介、UP主等）
- 字幕文件：ass/srt 格式
- 封面文件：jpg 格式
- 头像文件：UP主头像

## API

### 获取设置

```
GET /api/settings
```

响应：
```json
{
    "download": {
        "video": { "default_quality": 64, "audio_bitrate": 192, "codec": "avc", "output_format": "mp4" },
        "max_concurrent": 3,
        "speed_limit": 0,
        "metadata": { "enable_nfo": true, "enable_subtitle": true, "enable_cover": true, "enable_avatar": false }
    },
    "storage": { ... },
    "general": { ... },
    "auto_download": { ... }
}
```

### 更新设置

```
PUT /api/settings
Content-Type: application/json
Body: {
    "download": {
        "video": { "default_quality": 80, "audio_bitrate": 192, "codec": "hevc", "output_format": "mp4" },
        "max_concurrent": 3,
        "speed_limit": 5000,
        "metadata": { "enable_nfo": true, "enable_subtitle": true, "enable_cover": true, "enable_avatar": true }
    }
}
```

响应：返回完整设置对象（同获取设置）

错误响应（400）：
```json
{ "detail": "Failed to update settings: ..." }
```

### 重置设置

```
POST /api/settings/reset?category=download
```

响应：
```json
{
    "download": {
        "video": { "default_quality": 64, "audio_bitrate": 192, "codec": "avc", "output_format": "mp4" },
        "max_concurrent": 3,
        "speed_limit": 0,
        "metadata": { "enable_nfo": true, "enable_subtitle": true, "enable_cover": true, "enable_avatar": false }
    },
    ...
}
```

### 导出设置

```
GET /api/settings/export
```

响应：
```json
{
    "export_time": "2026-04-12T10:00:00",
    "version": "1.0.0",
    "settings": { "download": { ... }, "storage": { ... }, "general": { ... }, "auto_download": { ... } }
}
```

---

## 关键文件

- 前端: `apps/web/src/pages/settings/DownloadSettings.tsx`
- 后端: `apps/api/src/schemas/settings.py` (DownloadSettings, VideoSettings, MetadataSettings)
- 服务: `apps/api/src/services/download_service.py`

---

[返回上级](./README.md)