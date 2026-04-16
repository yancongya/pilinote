# 任务系统

## 任务定义

### Task 模型

```python
class Task(Base):
    """任务模型（新系统）"""
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    media_type = Column(String(20))    # media_type
    media_id = Column(String(50))     # 视频 ID
    title = Column(String(500))        # 标题
    quality = Column(Integer)         # 清晰度
    state = Column(Integer, default=0)  # 队列状态: 0=BACKLOG, 1=PENDING, 2=DOING, 3=COMPLETE
    status = Column(String(20))       # 状态: pending, downloading, completed, failed, paused, cancelled
    progress = Column(Float, default=0.0)  # 进度 0-100
    stage = Column(String(50))       # 下载阶段: preparing, downloading, moving, post_processing, completed
    downloaded_bytes = Column(BigInteger, default=0)
    total_bytes = Column(BigInteger, default=0)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    meta = Column(Text)  # JSON格式的元数据
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
```

### Download 模型

```python
class Download(Base):
    """下载记录模型（新系统）"""
    __tablename__ = "downloads"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bvid = Column(String(20), index=True)
    title = Column(String(500))
    status = Column(String(20), default="pending")  # pending, downloading, completed, failed, paused, cancelled
    progress = Column(Float, default=0.0)
    download_speed = Column(Float, default=0.0)
    eta = Column(Integer, default=0)
    stage = Column(String(50), default="preparing")
    downloaded_bytes = Column(BigInteger, default=0)
    total_bytes = Column(BigInteger, default=0)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text, nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    duration = Column(Integer, nullable=True)
    uploader = Column(String(200), nullable=True)
    file_path = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    aid = Column(Integer, nullable=True)
    cid = Column(Integer, nullable=True)
    quality = Column(Integer, nullable=True)
    audio_bitrate = Column(Integer, nullable=True)
    codec = Column(String(50), nullable=True)
```

## 执行流程

### 任务生命周期

```
1. 任务创建
   ↓
   BACKLOG (待处理队列)
   ↓
2. 任务调度
   ↓
   PENDING (等待队列)
   ↓
3. 任务执行
   ↓
   DOING (执行队列)
   ↓
4. 任务完成
   ↓
   COMPLETE (完成队列)
```

### 下载阶段

```
1. preparing (准备中)
   - 解析媒体信息
   - 获取下载链接
   - 创建下载目录
   ↓
2. downloading (下载中)
   - 下载视频文件
   - 下载音频文件
   - 实时更新进度
   ↓
3. moving (文件移动中)
   - 合并音视频文件
   - 移动到目标目录
   ↓
4. post_processing (后处理中)
   - 生成NFO文件
   - 下载封面图片
   - 下载字幕文件
   ↓
5. completed (已完成)
   - 更新历史记录
   - 清理临时文件
   - 发送完成通知
```

## 任务处理器

### 视频处理器

**文件**: `apps/api/src/services/queue/handlers/video.py`

```python
class VideoHandler(BaseHandler):
    """视频下载处理器"""
    
    async def process(self, task: Task) -> bool:
        # 1. 准备阶段
        await self._prepare(task)
        
        # 2. 下载阶段
        await self._download(task)
        
        # 3. 后处理阶段
        await self._post_process(task)
        
        return True
```

### 图文处理器

**文件**: `apps/api/src/services/queue/handlers/opus.py`

```python
class OpusHandler(BaseHandler):
    """图文下载处理器"""
    
    async def process(self, task: Task) -> bool:
        # 1. 解析图文内容
        await self._parse_content(task)
        
        # 2. 下载图片
        await self._download_images(task)
        
        # 3. 生成NFO文件
        await self._generate_nfo(task)
        
        return True
```

### NFO生成器

**文件**: `apps/api/src/services/queue/handlers/nfo.py`

```python
class NFOGenerator:
    """NFO文件生成器"""
    
    def generate(self, download: Download, video_info: dict) -> str:
        """生成NFO文件内容"""
        root = ET.Element("movie")
        
        # 基本信息
        ET.SubElement(root, "title").text = download.title
        ET.SubElement(root, "plot").text = video_info.get("desc", "")
        ET.SubElement(root, "thumb").text = download.thumbnail_url or ""
        
        # UP主信息
        ET.SubElement(root, "studio").text = download.uploader or ""
        
        # 统计信息
        stats = ET.SubElement(root, "bilibili_stat")
        ET.SubElement(stats, "play").text = str(video_info.get("view", 0))
        ET.SubElement(stats, "like").text = str(video_info.get("like", 0))
        ET.SubElement(stats, "coin").text = str(video_info.get("coin", 0))
        
        # 评论数据
        comments = ET.SubElement(root, "comments")
        for comment in video_info.get("comments", []):
            comment_elem = ET.SubElement(comments, "comment")
            comment_elem.set("type", comment.get("type"))
            comment_elem.set("like", str(comment.get("like")))
            ET.SubElement(comment_elem, "content").text = comment.get("content")
        
        return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")
```

## 错误处理

### 错误分类

```python
class ErrorType(Enum):
    NETWORK = "network"           # 网络错误
    AUTHENTICATION = "authentication"  # 认证错误
    FILE_SYSTEM = "file_system"   # 文件系统错误
    SERVER = "server"            # 服务器错误
    UNKNOWN = "unknown"          # 未知错误
```

### 重试机制

```python
async def process_with_retry(task: Task):
    """带重试的任务处理"""
    max_retries = task.max_retries or 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            result = await handler.process(task)
            if result:
                return True
        except Exception as e:
            retry_count += 1
            task.retry_count = retry_count
            
            if retry_count >= max_retries:
                # 标记为失败
                task.status = "failed"
                task.error_message = str(e)
                break
            
            # 等待后重试
            await asyncio.sleep(2 ** retry_count)
    
    return False
```

## 并发控制

### 信号量控制

```python
# 最大并发下载任务数
MAX_CONCURRENT_DOWNLOADS = 3

# 信号量控制并发
semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

async def process_task(task_id: str):
    async with semaphore:
        # 执行下载任务
        await download_service.process(task_id)
```

### 动态并发调整

```python
async def adjust_concurrency():
    """根据系统负载动态调整并发数"""
    cpu_percent = psutil.cpu_percent()
    memory_percent = psutil.virtual_memory().percent
    
    if cpu_percent > 80 or memory_percent > 80:
        # 系统负载高，减少并发数
        global MAX_CONCURRENT_DOWNLOADS
        MAX_CONCURRENT_DOWNLOADS = max(1, MAX_CONCURRENT_DOWNLOADS - 1)
    elif cpu_percent < 50 and memory_percent < 50:
        # 系统负载低，增加并发数
        MAX_CONCURRENT_DOWNLOADS = min(5, MAX_CONCURRENT_DOWNLOADS + 1)
```

## WebSocket事件推送

### 进度更新

```python
async def broadcast_progress(download_id: str, progress: float, speed: float, eta: int):
    """广播下载进度"""
    message = {
        "type": "download_progress",
        "download_id": download_id,
        "progress": progress,
        "speed": speed,
        "eta": eta
    }
    await websocket_manager.broadcast(message)
```

### 状态更新

```python
async def broadcast_status(download_id: str, status: str):
    """广播下载状态"""
    message = {
        "type": "download_status",
        "download_id": download_id,
        "status": status
    }
    await websocket_manager.broadcast(message)
```

### 错误推送

```python
async def broadcast_error(download_id: str, error: str, error_type: str):
    """广播下载错误"""
    message = {
        "type": "download_error",
        "download_id": download_id,
        "error": error,
        "error_type": error_type
    }
    await websocket_manager.broadcast(message)
```

## 关键文件

- **后端**:
  - `apps/api/src/models/task.py` - 任务模型
  - `apps/api/src/models/download.py` - 下载记录模型
  - `apps/api/src/services/queue/manager.py` - 队列管理器
  - `apps/api/src/services/queue/handlers/base.py` - 基础处理器
  - `apps/api/src/services/queue/handlers/video.py` - 视频处理器
  - `apps/api/src/services/queue/handlers/opus.py` - 图文处理器
  - `apps/api/src/services/queue/handlers/nfo.py` - NFO生成器

- **前端**:
  - `apps/web/src/stores/download.ts` - 下载状态管理
  - `apps/web/src/stores/downloadHistory.ts` - 下载历史记录
  - `apps/web/src/services/api.ts` - API服务

---

[返回上级](./README.md)