# 文件处理器

## 处理器类型

### 1. 视频处理器

**文件**: `handlers/video.py`

处理视频下载。

### 2. 字幕处理器

**文件**: `handlers/subtitle.py`

- SRT 字幕
- ASS 字幕
- 字幕合并

### 3. 弹幕处理器

**文件**: `handlers/danmaku.py`

- XML 弹幕
- ASS 弹幕

### 4. 封面处理器

**文件**: `handlers/thumb.py`

下载视频封面。

### 5. NFO 处理器

**文件**: `handlers/nfo.py`

生成 NFO 元数据文件。

## 实现

```python
class BaseHandler:
    async def download(self, task: Task) -> None
    async def post_process(self, task: Task) -> None
```

**关键文件**：
- `apps/api/src/services/queue/handlers/base.py`
- `apps/api/src/services/queue/handlers/*.py`

---

[返回上级](./README.md)