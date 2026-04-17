# TranscriberService 转写服务

## 概述

视频转写服务，支持 B站字幕优先 + Whisper API 备选策略。

## 文件位置

`apps/api/src/services/ai/transcriber.py`

## 转写器类型

### 1. BiliSubtitleTranscriber

B站字幕提取器 - 优先使用

- 自动查找 `data/downloads/{bvid}/` 下的 .srt/.json 字幕文件
- 解析 JSON 和 SRT 格式
- 返回纯文本

### 2. WhisperTranscriber

Whisper API 转写器

- 使用 FFmpeg 提取音频
- 调用 OpenAI Whisper API
- 需要配置 `OPENAI_API_KEY`

### 3. AutoTranscriber

自动转写器（默认）

- 优先尝试 B站字幕
- 无字幕时降级到 Whisper
- 都失败返回 None

## 使用方式

```python
from src.services.ai.transcriber import get_transcriber

# 自动模式
transcriber = get_transcriber("auto")
result = transcriber.transcribe("/path/to/video.mp4", "BVxxxxx")

# 指定模式
transcriber = get_transcriber("bilibili")  # 仅字幕
transcriber = get_transcriber("whisper")   # 仅 Whisper
```

## API 接口

### POST /api/note/analyze

触发 AI 分析

```json
{
  "video_id": "视频ID",
  "style": "detailed",
  "formats": ["summary"],
  "model_provider": "openai",
  "model_name": "gpt-4o-mini"
}
```

### GET /api/note/status/{note_id}

查询状态

### GET /api/note/{note_id}

获取笔记内容

### GET /api/note/by-video/{video_id}

根据视频获取笔记