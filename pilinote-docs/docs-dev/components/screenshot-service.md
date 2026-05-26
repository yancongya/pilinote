# ScreenshotService 截图服务

## 概述

使用 FFmpeg 从视频中提取关键帧截图。

## 文件位置

`apps/api/src/services/ai/screenshot.py`

## 功能

### extract_frames()

```python
def extract_frames(
    video_path: str,
    output_dir: str,
    count: int = 9,
    interval: Optional[int] = None,
) -> List[str]
```

**参数**:
- `video_path`: 视频文件路径
- `output_dir`: 输出目录
- `count`: 提取帧数量（默认 9）
- `interval`: 固定间隔秒数（可选，不设置则自动检测场景）

**返回**: 截图文件路径列表

## 使用方式

```python
from src.services.ai.screenshot import ScreenshotService

svc = ScreenshotService()
screenshots = svc.extract_frames(
    video_path="/path/to/video.mp4",
    output_dir="/path/to/screenshots",
    count=9
)
```

## API 接口

### GET /api/note/recommend-style

获取风格推荐

### GET /api/note/export/{note_id}

导出笔记为 Markdown 文件