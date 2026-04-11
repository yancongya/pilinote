# 临时路径下载功能实施指南

## 概述

本文档详细说明了如何实现临时路径下载功能，这是自动清理和保留失败任务功能的基础。

## 功能描述

### 当前问题
- 下载直接保存到最终目录（`downloads/`）
- 下载失败时文件会残留在下载目录
- 无法区分下载中的文件和已完成的文件
- 无法实现自动清理和保留失败任务功能

### 解决方案
- 下载到临时目录（`temp/`）
- 下载完成后移动文件到最终目录
- 下载失败时根据设置决定是否保留临时文件

## 实施步骤

### 步骤1：修改DownloadService初始化

**文件**：`apps/api/src/services/download_service.py`

**修改内容**：

```python
class DownloadService:
    """下载服务类 - 管理下载任务"""
    
    def __init__(self):
        # 存储活跃的下载任务
        self.active_downloads: Dict[str, asyncio.Task] = {}
        
        # 从设置中读取路径配置
        try:
            from src.services.settings_service import SettingsService
            from src.database import SessionLocal
            
            with SessionLocal() as db:
                settings_service = SettingsService(db)
                settings = settings_service.get_settings()
                self.download_dir = Path(settings.storage.download_path)
                self.temp_dir = Path(settings.storage.temp_path)
        except Exception as e:
            logger.warning(f"Failed to load settings, using default paths: {e}")
            self.download_dir = Path("downloads")
            self.temp_dir = Path("temp")
        
        # 创建目录
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        # 最大并发下载数
        self.max_concurrent = 3
        # 下载队列
        self.download_queue = []
        # 下载引擎实例（从设置中初始化）
        self.download_engine = self._create_download_engine()
```

**关键点**：
- 从设置中读取 `storage.download_path` 和 `storage.temp_path`
- 创建目录时使用 `parents=True` 确保父目录存在
- 读取失败时使用默认值降级处理

### 步骤2：创建临时下载目录

**文件**：`apps/api/src/services/download_service.py`

**新增方法**：

```python
def _create_temp_download_dir(self, download_id: str) -> Path:
    """创建临时下载目录"""
    temp_download_dir = self.temp_dir / download_id
    temp_download_dir.mkdir(parents=True, exist_ok=True)
    return temp_download_dir
```

### 步骤3：修改下载流程使用临时路径

**文件**：`apps/api/src/services/download_service.py`

**修改 `_download_video` 方法**：

```python
async def _download_video(self, download_id: str):
    """执行视频下载"""
    download = self.get_download(download_id)
    if not download:
        return
    
    # 获取当前设置
    try:
        from src.services.settings_service import SettingsService
        from src.database import SessionLocal
        
        with SessionLocal() as db:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            storage_settings = settings.storage
    except Exception as e:
        logger.warning(f"Failed to load settings: {e}")
        storage_settings = None
    
    # 创建临时下载目录
    temp_download_dir = self._create_temp_download_dir(download_id)
    
    try:
        # 确定输出目录名称
        import re
        if download.aid:
            # 系列视频：使用合集名称作为目录名
            series_name = re.sub(r'【Part \d+】', '', download.title).strip()
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', series_name).strip()
            if not safe_title:
                safe_title = f"series_{download.aid}"
        else:
            # 单个视频：使用完整标题
            safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', download.title).strip()
            if not safe_title:
                safe_title = "video"
        
        # 创建视频专属目录（在临时目录中）
        video_dir = temp_download_dir / safe_title
        video_dir.mkdir(exist_ok=True)
        
        # 使用下载引擎下载视频到临时目录
        await self.download_engine.download_video(
            bvid=download.bvid,
            quality=download.quality,
            output_format=download.output_format,
            output_path=str(video_dir),  # 下载到临时目录
            sessdata=download.sessdata,
            progress_callback=lambda bvid, progress, downloaded_bytes, total_bytes, download_speed, eta: 
                self.update_download_progress(
                    download_id,
                    progress,
                    downloaded_bytes,
                    total_bytes,
                    download_speed,
                    eta
                ),
            cid=download.cid,
            audio_bitrate=download.audio_bitrate,
            codec=download.codec
        )
        
        # 获取下载的文件路径
        video_files = [f for f in video_dir.glob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
        if video_files:
            # 此时文件还在临时目录，暂时保存临时路径
            download.temp_file_path = str(video_files[0])
            download.file_size = video_files[0].stat().st_size
        
        # 处理已完成的下载（移动文件到最终目录）
        await self._process_completed_download(
            download_id=download_id,
            temp_dir=temp_download_dir,
            final_dir=self.download_dir,
            storage_settings=storage_settings
        )
        
        self.update_download_status(download_id, "completed")
        
    except asyncio.CancelledError:
        # 下载被取消
        await self._handle_failed_or_cancelled_download(
            download_id=download_id,
            temp_dir=temp_download_dir,
            storage_settings=storage_settings,
            status="cancelled"
        )
        self.update_download_status(download_id, "cancelled")
        
    except Exception as e:
        # 下载失败
        await self._handle_failed_or_cancelled_download(
            download_id=download_id,
            temp_dir=temp_download_dir,
            storage_settings=storage_settings,
            status="failed"
        )
        self.update_download_status(download_id, "failed", str(e))
        raise
```

### 步骤4：实现文件移动逻辑

**文件**：`apps/api/src/services/download_service.py`

**新增方法**：

```python
async def _process_completed_download(
    self,
    download_id: str,
    temp_dir: Path,
    final_dir: Path,
    storage_settings
):
    """
    处理已完成的下载 - 移动文件并清理
    
    Args:
        download_id: 下载任务ID
        temp_dir: 临时目录
        final_dir: 最终目录
        storage_settings: 存储设置
    """
    try:
        # 确保最终目录存在
        final_dir.mkdir(parents=True, exist_ok=True)
        
        # 移动临时目录中的所有内容到最终目录
        for item in temp_dir.iterdir():
            dest = final_dir / item.name
            
            # 处理文件名冲突
            if dest.exists():
                # 如果目标文件已存在，添加时间戳后缀
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                if dest.is_file():
                    stem = dest.stem
                    suffix = dest.suffix
                    dest = final_dir / f"{stem}_{timestamp}{suffix}"
                else:
                    dest = final_dir / f"{item.name}_{timestamp}"
            
            # 移动文件或目录
            shutil.move(str(item), str(dest))
            logger.info(f"Moved {item.name} to {dest}")
        
        # 更新数据库中的文件路径
        with SessionLocal() as db:
            download = db.query(Download).filter(Download.id == download_id).first()
            if download and download.temp_file_path:
                # 更新文件路径为最终路径
                temp_file = Path(download.temp_file_path)
                final_file = final_dir / temp_file.name
                download.file_path = str(final_file)
                download.temp_file_path = None  # 清除临时路径
                db.commit()
        
        # 根据设置清理临时目录
        if storage_settings and storage_settings.auto_cleanup:
            await self._cleanup_temp_dir(temp_dir)
        else:
            # 保留临时目录，但重命名为 .temp 后缀
            backup_dir = temp_dir.parent / (temp_dir.name + '.temp')
            if backup_dir.exists():
                shutil.rmtree(str(backup_dir))
            shutil.move(str(temp_dir), str(backup_dir))
            logger.info(f"Kept temp directory at: {backup_dir}")
            
    except Exception as e:
        logger.error(f"Failed to process completed download: {e}")
        raise
```

### 步骤5：实现失败/取消任务处理

**文件**：`apps/api/src/services/download_service.py`

**新增方法**：

```python
async def _handle_failed_or_cancelled_download(
    self,
    download_id: str,
    temp_dir: Path,
    storage_settings,
    status: str
):
    """
    处理失败或取消的下载
    
    Args:
        download_id: 下载任务ID
        temp_dir: 临时目录
        storage_settings: 存储设置
        status: 任务状态（"failed" 或 "cancelled"）
    """
    try:
        # 根据设置决定是否保留临时文件
        if storage_settings and storage_settings.keep_failed:
            # 保留临时文件，重命名以便识别
            suffix = '.failed' if status == 'failed' else '.cancelled'
            backup_dir = temp_dir.parent / (temp_dir.name + suffix)
            
            if backup_dir.exists():
                shutil.rmtree(str(backup_dir))
            
            shutil.move(str(temp_dir), str(backup_dir))
            logger.info(f"Kept {status} download files at: {backup_dir}")
        else:
            # 清理临时文件
            await self._cleanup_temp_dir(temp_dir)
            logger.info(f"Cleaned up {status} download files")
            
    except Exception as e:
        logger.error(f"Failed to handle {status} download: {e}")
```

### 步骤6：实现清理临时目录方法

**文件**：`apps/api/src/services/download_service.py`

**新增方法**：

```python
async def _cleanup_temp_dir(self, temp_dir: Path):
    """
    清理临时目录
    
    Args:
        temp_dir: 要清理的临时目录
    """
    try:
        if temp_dir.exists():
            shutil.rmtree(str(temp_dir))
            logger.info(f"Cleaned up temp directory: {temp_dir}")
    except Exception as e:
        logger.error(f"Failed to clean up temp directory {temp_dir}: {e}")
```

### 步骤7：更新Download模型

**文件**：`apps/api/src/models/download.py`

**添加字段**：

```python
class Download(Base):
    # ... 现有字段 ...
    
    # 临时文件路径（下载完成前使用）
    temp_file_path = Column(String, nullable=True)
```

## 测试计划

### 测试1：正常下载流程

```python
# 1. 创建下载任务
download_id = download_service.create_download_task(
    bvid="BV1xx411c7mD",
    title="测试视频",
    quality=64
)

# 2. 等待下载完成
# 3. 验证文件在 downloads/ 目录中
# 4. 验证 temp/ 目录中的临时文件已清理
```

### 测试2：下载失败流程

```python
# 1. 设置 keep_failed=True
# 2. 创建一个会失败的下载任务
# 3. 等待下载失败
# 4. 验证文件保留在 temp/ 目录中，重命名为 .failed
```

### 测试3：下载取消流程

```python
# 1. 创建下载任务
# 2. 立即取消下载
# 3. 验证临时文件已清理
```

### 测试4：文件名冲突

```python
# 1. 创建同名文件在 downloads/ 目录
# 2. 创建新的下载任务
# 3. 等待下载完成
# 4. 验证文件名添加了时间戳后缀
```

## 注意事项

1. **文件移动失败**：如果移动文件失败，临时文件会保留，需要手动清理
2. **路径权限**：确保 temp/ 和 downloads/ 目录有读写权限
3. **并发下载**：多个下载任务使用不同的临时目录，避免冲突
4. **错误处理**：所有文件操作都要有错误处理，避免影响主流程

## 依赖关系

- 依赖 `apps/api/src/services/settings_service.py` - 读取设置
- 依赖 `apps/api/src/schemas/settings.py` - 存储设置数据结构
- 依赖 `apps/api/src/models/download.py` - 添加 temp_file_path 字段

## 后续步骤

完成临时路径下载功能后，可以继续实施：
1. 自动清理定时任务
2. 保留失败任务功能
3. 存储空间监控

## 回归测试

修改后需要确保：
- 下载功能仍然正常工作
- 下载进度更新正常
- 下载状态更新正常
- 数据库记录正确