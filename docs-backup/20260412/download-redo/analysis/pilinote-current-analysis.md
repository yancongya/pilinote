# PiliNote 当前下载管理完整链路分析

本文档分析当前 PiliNote 项目的下载管理实现，包括前后端代码、下载流程、状态管理等。

## 目录
1. [项目结构概览](#1-项目结构概览)
2. [后端下载服务层](#2-后端下载服务层)
3. [前端下载管理](#3-前端下载管理)
4. [下载完整链路流程](#4-下载完整链路流程)
5. [数据模型和数据库](#5-数据模型和数据库)
6. [并发控制机制](#6-并发控制机制)
7. [进度同步机制](#7-进度同步机制)
8. [当前实现的问题和改进空间](#8-当前实现的问题和改进空间)

---

## 1. 项目结构概览

### 1.1 后端结构
```
apps/api/src/
├── routers/
│   └── download.py          # 下载路由，处理HTTP请求
├── services/
│   ├── download_service.py  # 下载服务，任务创建和管理
│   ├── download_manager.py  # 下载管理器，队列和并发控制
│   └── download_engine.py   # 下载引擎，yt-dlp集成
├── models/
│   └── download.py          # 下载任务数据模型
└── schemas/
    └── download.py          # 下载请求/响应模式
```

### 1.2 前端结构
```
apps/web/src/
├── services/
│   └── api.ts               # API服务，与后端通信
├── stores/
│   └── download.ts          # Zustand状态管理
├── pages/
│   └── components/
│       └── DownloadsContent.tsx  # 下载页面组件
└── components/
    └── VideoListCard.tsx    # 视频卡片组件（含下载按钮）
```

---

## 2. 后端下载服务层

### 2.1 下载路由 (`routers/download.py`)

**主要端点**:
```python
# 创建并启动下载任务
@router.post("/start", response_model=StartDownloadResponse)
async def start_download(request: StartDownloadRequest, background_tasks: BackgroundTasks):
    # 1. 创建下载任务
    download_id = download_service.create_download_task(...)
    
    # 2. 在后台启动下载任务
    background_tasks.add_task(download_service._process_download, download_id)
    
    return StartDownloadResponse(success=True, download_id=download_id)

# 添加到下载队列（不立即开始）
@router.post("/add", response_model=StartDownloadResponse)
async def add_to_download_queue(request: StartDownloadRequest):
    # 只创建任务，状态为pending
    download_id = download_service.create_download_task(...)
    return StartDownloadResponse(success=True, download_id=download_id)

# 获取下载列表
@router.get("/list", response_model=DownloadListResponse)
async def get_download_list(status: Optional[str] = None):
    downloads = download_service.get_all_downloads(status)
    return DownloadListResponse(downloads=downloads, total=len(downloads))
```

### 2.2 下载服务 (`services/download_service.py`)

**核心方法**:
```python
class DownloadService:
    def create_download_task(self, bvid, title, quality=64, output_format="mp4", ...) -> str:
        """创建下载任务"""
        download_id = str(uuid.uuid4())
        
        with SessionLocal() as db:
            download = Download(
                id=download_id,
                bvid=bvid,
                title=title,
                quality=quality,
                output_format=output_format,
                status="pending",  # 初始状态
                # ... 其他字段
            )
            db.add(download)
            db.commit()
        
        return download_id
    
    async def _process_download(self, download_id: str):
        """处理下载任务"""
        download = self.get_download(download_id)
        
        # 检查并发限制
        active_count = len([d for d in self.active_downloads.values() if not d.done()])
        if active_count >= self.max_concurrent:
            # 加入队列
            self.download_queue.append(download_id)
            self.update_download_status(download_id, "queued")
            return
        
        # 开始下载
        try:
            self.update_download_status(download_id, "downloading")
            
            # 创建下载任务
            task = asyncio.create_task(self._download_video(download_id))
            self.active_downloads[download_id] = task
            
            await task
        except Exception as e:
            self.update_download_status(download_id, "failed", str(e))
    
    async def _download_video(self, download_id: str):
        """执行视频下载"""
        download = self.get_download(download_id)
        
        # 创建临时下载目录
        temp_download_dir = self._create_temp_download_dir(download_id)
        
        try:
            # 使用下载引擎下载视频
            await self.download_engine.download_video(
                bvid=download.bvid,
                quality=download.quality,
                output_format=download.output_format,
                output_path=str(video_dir),
                progress_callback=lambda ...: self.update_download_progress(...),
                cid=download.cid,
                audio_bitrate=download.audio_bitrate,
                codec=download.codec
            )
            
            # 处理已完成的下载（移动文件到最终目录）
            await self._process_completed_download(
                download_id=download_id,
                temp_dir=temp_download_dir,
                final_dir=Path(storage_settings.download_path),
            )
            
            self.update_download_status(download_id, "completed")
        except Exception as e:
            self.update_download_status(download_id, "failed", str(e))
```

### 2.3 下载管理器 (`services/download_manager.py`)

**队列和并发控制**:
```python
class DownloadManager:
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self.active_downloads: Dict[str, asyncio.Task] = {}
        self.paused_downloads: Dict[str, asyncio.Event] = {}
        self.download_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._processor_task: Optional[asyncio.Task] = None
    
    async def start(self):
        """启动下载管理器"""
        self._running = True
        self._processor_task = asyncio.create_task(self._process_queue())
    
    async def add_task(self, download_id: str) -> bool:
        """添加下载任务到队列"""
        self._update_status(download_id, DownloadStatus.QUEUED.value)
        await self.download_queue.put(download_id)
        return True
    
    async def _process_queue(self):
        """处理下载队列"""
        while self._running:
            try:
                download_id = await asyncio.wait_for(
                    self.download_queue.get(),
                    timeout=1.0
                )
                
                # 检查并发限制
                active_count = len([t for t in self.active_downloads.values() if not t.done()])
                if active_count >= self.max_concurrent:
                    # 重新放回队列
                    await self.download_queue.put(download_id)
                    await asyncio.sleep(1.0)
                    continue
                
                # 创建下载任务
                task = asyncio.create_task(self._execute_download(download_id))
                self.active_downloads[download_id] = task
                
            except asyncio.TimeoutError:
                continue
    
    async def _execute_download(self, download_id: str):
        """执行下载任务"""
        self._update_status(download_id, DownloadStatus.DOWNLOADING.value)
        
        # 导入下载引擎
        from src.services.download_engine import DownloadEngine
        engine = DownloadEngine()
        
        # 执行下载
        await engine.download_video(
            bvid=download.bvid,
            quality=download.quality,
            output_format=download.output_format,
            output_path=output_path,
            sessdata=download.sessdata,
            progress_callback=lambda d, p, db, tb, ds, eta: self._update_progress(...),
            pause_event=self.paused_downloads.get(download_id),
            cid=download.cid,
            download_id=download_id
        )
        
        self._update_status(download_id, DownloadStatus.COMPLETED.value)
```

### 2.4 下载引擎 (`services/download_engine.py`)

**yt-dlp 集成**:
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
        audio_bitrate: Optional[int] = 192,
        codec: Optional[str] = 'avc',
        download_id: Optional[str] = None
    ):
        # 根据质量、编码和音频码率构建格式选择
        format_str = self._build_format_string(quality, codec, audio_bitrate)
        
        # 构建yt-dlp配置
        ydl_opts = {
            'format': format_str,
            'outtmpl': str(output_dir / '%(title)s.%(ext)s'),
            'quiet': False,
            'no_warnings': True,
            'merge_output_format': output_format,
            'postprocessors': postprocessors,
            'progress_hooks': [],
        }
        
        # 添加Aria2c配置（如果可用）
        if self._check_aria2c_available():
            ydl_opts['external_downloader'] = self.aria2c_path
            ydl_opts['external_downloader_args'] = [
                '-x', '8',                    # 8个连接
                '-k', '1M',                    # 每个连接分块1MB
                '--max-tries=5',             # 最多重试5次
                '--continue=true',           # 启用断点续传
            ]
        
        # 添加进度回调
        if progress_callback:
            def progress_hook(d):
                if pause_event:
                    pause_event.wait()
                
                status = d.get('status')
                if status == 'downloading':
                    total_bytes = d.get('total_bytes', 0) or d.get('total_bytes_estimate', 0) or 0
                    downloaded_bytes = d.get('downloaded_bytes', 0) or 0
                    
                    if total_bytes > 0:
                        progress = (downloaded_bytes / total_bytes) * 100
                    
                    progress_callback(download_id or bvid, progress, downloaded_bytes, total_bytes, download_speed, eta)
                elif status == 'finished':
                    progress_callback(download_id or bvid, 100.0, total_bytes, total_bytes, 0.0, 0.0)
            
            ydl_opts['progress_hooks'].append(progress_hook)
        
        # 添加SESSDATA
        if sessdata:
            cookie_file = output_dir / 'cookies.txt'
            with open(cookie_file, 'w') as f:
                f.write(f".bilibili.com\tTRUE\t/\tFALSE\t0\tSESSDATA\t{sessdata}\n")
            ydl_opts['cookiefile'] = str(cookie_file)
        
        # 执行下载
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            await asyncio.to_thread(ydl.download, [f'https://www.bilibili.com/video/{bvid}'])
    
    def _build_format_string(self, quality: int, codec: str = 'avc', audio_bitrate: Optional[int] = 192) -> str:
        """构建yt-dlp格式字符串"""
        quality_map = {16: 360, 32: 480, 64: 720, 80: 1080, 112: 1080, 116: 2160}
        codec_map = {'avc': 'avc1', 'hevc': 'hevc', 'av1': 'av01', 'vp9': 'vp09'}
        
        height = quality_map.get(quality, 720)
        video_codec = codec_map.get(codec, 'avc1')
        
        format_str = (f'bestvideo[ext=mp4][height<={height}][vcodec~={video_codec}]+bestaudio[ext=m4a]/'
                     f'bestvideo[height<={height}][vcodec~={video_codec}]+bestaudio/'
                     f'bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/'
                     f'bestvideo[height<={height}]+bestaudio/best[ext=mp4]/best')
        
        return format_str
```

---

## 3. 前端下载管理

### 3.1 API服务 (`services/api.ts`)

**下载相关API**:
```typescript
class ApiService {
  async startDownload(downloadData: {
    bvid: string;
    title: string;
    cid?: number;
    aid?: number;
    quality?: number;
    output_format?: string;
    // ... 其他参数
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/api/download/start', {
      method: 'POST',
      body: JSON.stringify(downloadData),
    });
  }
  
  async getDownloadList(status?: string): Promise<ApiResponse<any>> {
    const params = status ? `?status=${status}` : '';
    return this.request<any>(`/api/download/list${params}`, { method: 'GET' });
  }
  
  async cancelDownload(downloadId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/download/${downloadId}/cancel`, { method: 'POST' });
  }
  
  async retryDownload(downloadId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/download/${downloadId}/retry`, { method: 'POST' });
  }
}
```

### 3.2 状态管理 (`stores/download.ts`)

**Zustand Store**:
```typescript
interface DownloadState {
  downloads: Map<string, DownloadItem>
  downloadIds: string[]
  
  // 方法
  setDownloads: (downloads: DownloadItem[]) => void
  addDownload: (item: DownloadItem) => void
  removeDownload: (downloadId: string) => void
  updateDownloadStatus: (downloadId: string, status: string, progress?: number) => void
  
  // 服务器同步
  syncFromServer: () => Promise<void>
  
  // 任务控制
  addToDownloadList: (downloadData: any) => Promise<boolean>
  startDownload: (downloadId: string) => Promise<boolean>
  pauseDownload: (downloadId: string) => Promise<boolean>
  resumeDownload: (downloadId: string) => Promise<boolean>
  cancelDownload: (downloadId: string) => Promise<boolean>
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      downloads: new Map(),
      downloadIds: [],
      
      addToDownloadList: async (downloadData: any) => {
        const response = await apiService.addToDownloadQueue(downloadData)
        
        if (response.success && response.download_id) {
          // 立即添加到本地状态
          const newItem: DownloadItem = {
            id: response.download_id,
            bvid: downloadData.bvid,
            title: downloadData.title,
            status: 'pending',
            progress: 0,
            // ... 其他字段
          }
          get().addDownload(newItem)
          
          // 异步同步服务器状态
          get().syncFromServer()
          return true
        }
        return false
      },
      
      syncFromServer: async () => {
        const response = await apiService.getDownloadList()
        
        if (response.success && response.data?.downloads) {
          // 只保留未完成的任务
          const pendingDownloads = response.data.downloads.filter((item: DownloadItem) => 
            item.status !== 'completed'
          )
          get().setDownloads(pendingDownloads)
        }
      },
    }),
    { name: 'download-storage' }
  )
)
```

### 3.3 下载页面组件 (`pages/components/DownloadsContent.tsx`)

**主要功能**:
- 显示下载任务列表（进行中、已完成）
- 批量操作（开始、暂停、取消）
- 进度显示
- 错误处理

```typescript
export default function DownloadsContent() {
  const downloadStore = useDownloadStore()
  const [downloads, setDownloads] = useState<DownloadTask[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('downloading')
  
  // 定期刷新downloads数据
  useEffect(() => {
    const hasDownloading = downloads.some(d =>
      d.status === 'downloading' || d.status === 'queued' || d.status === 'pending'
    )
    
    if (hasDownloading) {
      const interval = setInterval(async () => {
        const response = await apiService.getDownloadList('downloading,queued,pending,processing,paused')
        if (response.success) {
          setDownloads(response.data.downloads)
        }
      }, 2000) // 每2秒刷新一次
      
      return () => clearInterval(interval)
    }
  }, [downloads])
  
  // 批量开始下载
  const handleBatchStart = async (seriesId: string) => {
    const series = groupedDownloads[seriesId]
    const success = await downloadStore.startBatchDownloads(series.tasks.map(task => task.id))
    if (success) {
      await fetchDownloads()
    }
  }
  
  // 暂停下载
  const handlePause = async (taskId: string) => {
    const success = await downloadStore.pauseDownload(taskId)
    if (success) {
      await fetchDownloads()
    }
  }
}
```

---

## 4. 下载完整链路流程

### 4.1 用户添加下载任务

```
用户点击"添加到下载" 
    ↓
前端调用 apiService.addToDownloadQueue(downloadData)
    ↓
后端路由 POST /api/download/add
    ↓
download_service.create_download_task() 创建任务（状态：pending）
    ↓
返回 download_id 给前端
    ↓
前端立即更新本地状态（status: pending）
    ↓
异步调用 syncFromServer() 同步服务器状态
```

### 4.2 用户开始下载

```
用户点击"开始下载"
    ↓
前端调用 apiService.startBatchDownloads([downloadId])
    ↓
后端路由 POST /api/download/start/batch
    ↓
遍历 download_ids，调用 download_manager.add_task()
    ↓
download_manager 将任务添加到 asyncio.Queue
    ↓
_process_queue() 循环处理队列
    ↓
检查并发限制（最多3个）
    ↓
创建 asyncio.Task 执行 _execute_download()
    ↓
execute_download() 调用 download_engine.download_video()
    ↓
download_engine 使用 yt-dlp 下载视频
    ↓
progress_hook() 每秒更新进度到数据库
    ↓
前端每2秒轮询 /api/download/list 获取最新状态
    ↓
更新UI显示进度
```

### 4.3 下载状态转换

```
pending (创建)
    ↓ (用户开始下载)
queued (加入队列)
    ↓ (开始执行)
downloading (下载中)
    ↓ (下载完成)
processing (处理中：移动文件、生成NFO等)
    ↓ (处理完成)
completed (完成)

可选状态：
paused (暂停)
failed (失败)
cancelled (取消)
```

---

## 5. 数据模型和数据库

### 5.1 下载任务模型 (`models/download.py`)

```python
class Download(Base):
    __tablename__ = "downloads"
    
    id = Column(String, primary_key=True)
    bvid = Column(String, nullable=False)
    title = Column(String, nullable=False)
    cid = Column(Integer, nullable=True)
    aid = Column(Integer, nullable=True)
    
    # 下载参数
    quality = Column(Integer, default=64)
    output_format = Column(String, default="mp4")
    audio_bitrate = Column(Integer, default=192)
    codec = Column(String, default="avc")
    
    # 元数据
    thumbnail_url = Column(String, nullable=True)
    duration = Column(Integer, nullable=True)
    uploader = Column(String, nullable=True)
    uploader_mid = Column(Integer, nullable=True)
    
    # 状态和进度
    status = Column(String, default="pending")
    progress = Column(Float, default=0.0)
    downloaded_bytes = Column(Integer, default=0)
    total_bytes = Column(Integer, default=0)
    download_speed = Column(Float, default=0.0)
    eta = Column(Float, default=0.0)
    
    # 文件信息
    file_path = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    temp_file_path = Column(String, nullable=True)
    
    # 其他字段
    error_message = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 下载选项
    enable_subtitle = Column(Integer, default=1)
    enable_danmaku = Column(Integer, default=0)
    danmaku_format = Column(String, default="xml")
    enable_nfo = Column(Integer, default=1)
    enable_cover = Column(Integer, default=1)
    enable_avatar = Column(Integer, default=1)
    block_pcdn = Column(Integer, default=1)
```

### 5.2 数据库操作

**主要操作**:
```python
# 创建任务
with SessionLocal() as db:
    download = Download(id=download_id, bvid=bvid, title=title, ...)
    db.add(download)
    db.commit()

# 更新状态
with SessionLocal() as db:
    download = db.query(Download).filter(Download.id == download_id).first()
    download.status = status
    download.updated_at = datetime.utcnow()
    db.commit()

# 更新进度
with SessionLocal() as db:
    download = db.query(Download).filter(Download.id == download_id).first()
    download.progress = progress
    download.downloaded_bytes = downloaded_bytes
    download.total_bytes = total_bytes
    download.download_speed = download_speed
    download.eta = eta
    db.commit()
```

---

## 6. 并发控制机制

### 6.1 DownloadManager 并发控制

```python
class DownloadManager:
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self.active_downloads: Dict[str, asyncio.Task] = {}
        self.download_queue: asyncio.Queue = asyncio.Queue()
    
    async def _process_queue(self):
        while self._running:
            download_id = await asyncio.wait_for(
                self.download_queue.get(),
                timeout=1.0
            )
            
            # 检查并发限制
            active_count = len([t for t in self.active_downloads.values() if not t.done()])
            if active_count >= self.max_concurrent:
                # 重新放回队列
                await self.download_queue.put(download_id)
                await asyncio.sleep(1.0)
                continue
            
            # 创建下载任务
            task = asyncio.create_task(self._execute_download(download_id))
            self.active_downloads[download_id] = task
```

### 6.2 暂停/恢复机制

```python
class DownloadManager:
    async def pause_task(self, download_id: str) -> bool:
        if download_id not in self.paused_downloads:
            self.paused_downloads[download_id] = asyncio.Event()
        
        self.paused_downloads[download_id].clear()
        self._update_status(download_id, DownloadStatus.PAUSED.value)
        return True
    
    async def resume_task(self, download_id: str) -> bool:
        if download_id in self.paused_downloads:
            self.paused_downloads[download_id].set()
            del self.paused_downloads[download_id]
        
        self._update_status(download_id, DownloadStatus.DOWNLOADING.value)
        return True
```

**在 yt-dlp 中使用暂停事件**:
```python
def progress_hook(d):
    if pause_event:
        pause_event.wait()  # 如果暂停，等待事件
    # ... 处理进度
```

---

## 7. 进度同步机制

### 7.1 进度更新流程

```
yt-dlp progress_hook()
    ↓ (每秒)
调用 progress_callback(download_id, progress, downloaded_bytes, total_bytes, speed, eta)
    ↓
download_service.update_download_progress()
    ↓
更新数据库
    ↓
前端每2秒轮询 /api/download/list
    ↓
更新UI显示
```

### 7.2 进度更新代码

**后端进度更新**:
```python
def update_download_progress(
    self,
    download_id: str,
    progress: float,
    downloaded_bytes: int = 0,
    total_bytes: int = 0,
    download_speed: float = 0.0,
    eta: float = 0.0
):
    with SessionLocal() as db:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download:
            download.progress = progress
            download.downloaded_bytes = downloaded_bytes
            download.total_bytes = total_bytes
            download.download_speed = download_speed
            download.eta = eta
            download.updated_at = datetime.utcnow()
            db.commit()
```

**前端轮询更新**:
```typescript
useEffect(() => {
  const hasDownloading = downloads.some(d =>
    d.status === 'downloading' || d.status === 'queued' || d.status === 'pending'
  )
  
  if (hasDownloading) {
    const interval = setInterval(async () => {
      const response = await apiService.getDownloadList('downloading,queued,pending,processing,paused')
      if (response.success) {
        setDownloads(response.data.downloads)
      }
    }, 2000)  // 每2秒轮询一次
    
    return () => clearInterval(interval)
  }
}, [downloads])
```

---

## 8. 当前实现的问题和改进空间

### 8.1 当前实现的问题

1. **进度同步依赖轮询**
   - 前端每2秒轮询一次服务器获取最新状态
   - 无法实时推送进度更新
   - 浪费服务器资源

2. **没有WebSocket实时通信**
   - 后端没有WebSocket端点
   - 前端没有WebSocket客户端
   - 进度更新有延迟（最多2秒）

3. **并发控制相对简单**
   - 只检查活跃任务数量
   - 没有优先级队列
   - 没有带宽限制

4. **错误处理和重试机制简单**
   - 只有基本的重试功能
   - 没有自动重试
   - 没有错误分类

5. **文件组织功能有限**
   - 只支持基本的文件重命名
   - 没有模板化命名
   - 没有NFO刮削功能

### 8.2 改进建议

#### 8.2.1 添加WebSocket实时通信

**后端WebSocket端点**:
```python
from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/ws/progress/{download_id}")
async def websocket_progress(websocket: WebSocket, download_id: str):
    await websocket.accept()
    
    while True:
        try:
            # 获取最新进度
            download = download_service.get_download(download_id)
            if download:
                await websocket.send_json({
                    "download_id": download_id,
                    "progress": download.progress,
                    "downloaded_bytes": download.downloaded_bytes,
                    "total_bytes": download.total_bytes,
                    "download_speed": download.download_speed,
                    "eta": download.eta,
                    "status": download.status
                })
            
            await asyncio.sleep(1)  # 每秒推送一次
        except Exception:
            break
```

**前端WebSocket客户端**:
```typescript
const useWebSocketProgress = (downloadId: string) => {
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/api/download/ws/progress/${downloadId}`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setProgress(data)
    }
    
    return () => ws.close()
  }, [downloadId])
  
  return progress
}
```

#### 8.2.2 改进并发控制

**优先级队列**:
```python
class PriorityDownloadManager:
    def __init__(self):
        self.queues: Dict[int, asyncio.Queue] = {
            0: asyncio.Queue(),  # 高优先级
            1: asyncio.Queue(),  # 中优先级
            2: asyncio.Queue(),  # 低优先级
        }
    
    async def add_task(self, download_id: str, priority: int = 1):
        await self.queues[priority].put(download_id)
    
    async def _process_queues(self):
        while self._running:
            # 按优先级顺序处理
            for priority in [0, 1, 2]:
                if not self.queues[priority].empty():
                    download_id = await self.queues[priority].get()
                    # 检查并发限制
                    # 执行下载
                    break
            await asyncio.sleep(0.1)
```

#### 8.2.3 改进文件组织

**模板化命名**:
```python
def generate_file_path(self, download: Download, template: str = None) -> str:
    """生成文件路径"""
    if template is None:
        template = "{uploader}/{series_title}/p{index} - {title}"
    
    context = {
        "title": download.title,
        "uploader": download.uploader or "unknown",
        "series_title": self._get_series_title(download),
        "index": self._get_series_index(download),
        "bvid": download.bvid,
        "aid": download.aid,
        "cid": download.cid,
        "quality": download.quality,
        "format": download.output_format,
    }
    
    # 替换模板变量
    path = template
    for key, value in context.items():
        path = path.replace(f"{{{key}}}", str(value))
    
    # 清理非法字符
    path = re.sub(r'[<>:"/\\|?*]', '_', path)
    
    return path
```

#### 8.2.4 改进错误处理和重试

**自动重试机制**:
```python
class RetryManager:
    def __init__(self, max_retries: int = 3, retry_delay: int = 5):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
    
    async def execute_with_retry(self, download_id: str, func):
        for attempt in range(self.max_retries):
            try:
                await func()
                return True
            except Exception as e:
                logger.error(f"Download {download_id} failed (attempt {attempt + 1}): {e}")
                
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)
                    # 检查是否被取消
                    download = self.get_download(download_id)
                    if download.status == "cancelled":
                        return False
                else:
                    self.update_download_status(download_id, "failed", str(e))
                    return False
        
        return False
```

---

## 总结

PiliNote 当前的下载管理实现具有以下特点：

### 优点
1. **分层清晰**：路由层、服务层、管理层、引擎层分离
2. **队列管理**：使用 asyncio.Queue 实现任务队列
3. **并发控制**：支持最大并发数限制
4. **暂停/恢复**：支持下载暂停和恢复
5. **数据库持久化**：下载任务和状态持久化到数据库

### 不足
1. **无WebSocket实时通信**：依赖前端轮询获取进度
2. **并发控制简单**：没有优先级队列
3. **错误处理简单**：没有自动重试机制
4. **文件组织有限**：没有模板化命名系统

### 改进方向
1. **添加WebSocket**：实现真正的实时进度推送
2. **优化并发控制**：添加优先级队列和带宽限制
3. **增强错误处理**：添加自动重试和错误分类
4. **改进文件组织**：实现模板化命名和NFO刮削
5. **向BiliTools学习**：借鉴其队列系统和任务生命周期管理