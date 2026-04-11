# 下载系统重构升级指导文档

## 📋 升级概述

**目标**: 实现混合方案C，将下载列表和视频库分离管理
- **下载列表**: 使用数据库管理队列状态（backlog/pending/active/paused）
- **视频库**: 实时读取文件系统（downloads/ 目录）
- **状态转换**: 下载完成 → 从数据库删除 → 文件系统显示

**核心原则**:
1. 下载中用数据库管理，保证性能
2. 下载完成用文件系统管理，保证准确性
3. 避免数据库与文件系统不同步问题

---

## 🎯 实现步骤

### Phase 1: 数据库模型调整

#### 1.1 修改 Task 状态枚举

**文件**: `apps/api/src/models/task.py`

**修改内容**:
```python
class TaskState(int, enum.Enum):
    """任务状态枚举 - 简化版"""
    BACKLOG = 0      # 待下载（未添加到队列）
    PENDING = 1      # 已添加到队列（等待下载）
    ACTIVE = 2       # 正在下载
    PAUSED = 4       # 已暂停
    # 移除 COMPLETED、FAILED、CANCELLED 状态
```

#### 1.2 修改 Scheduler 状态枚举

**文件**: `apps/api/src/models/task.py`

**修改内容**:
```python
class SchedulerState(int, enum.Enum):
    """调度器状态枚举 - 简化版"""
    BACKLOG = 0      # 待下载
    PENDING = 1      # 已添加到队列
    ACTIVE = 2       # 正在下载
    PAUSED = 3       # 已暂停
    # 移除 COMPLETED、FAILED、CANCELLED 状态
```

#### 1.3 添加文件索引表

**文件**: `apps/api/src/models/file_index.py` (新建)

**创建内容**:
```python
from sqlalchemy import Column, String, Integer, JSON
from datetime import datetime
import uuid

from src.database import Base

class FileIndex(Base):
    """文件索引表 - 用于快速查找"""
    __tablename__ = 'file_index'
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    path = Column(String(500), unique=True, index=True)  # 文件路径
    type = Column(String(20), nullable=False)  # 'video' 或 'collection'
    title = Column(String(500), nullable=False)  # 视频标题
    bvid = Column(String(50))  # B站视频ID
    video_count = Column(Integer, default=0, nullable=False)  # 合集的视频数量
    total_size = Column(Integer, default=0, nullable=False)  # 总大小（字节）
    video_size = Column(Integer, default=0, nullable=False)  # 视频文件大小
    metadata_size = Column(Integer, default=0, nullable=False)  # 元数据文件大小
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    meta = Column(JSON, nullable=False, default=lambda: {})  # 额外元数据
    
    def to_dict(self):
        return {
            'id': self.id,
            'path': self.path,
            'type': self.type,
            'title': self.title,
            'bvid': self.bvid,
            'video_count': self.video_count,
            'total_size': self.total_size,
            'video_size': self.video_size,
            'metadata_size': self.metadata_size,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'meta': self.meta
        }
```

---

### Phase 2: 创建文件系统服务

#### 2.1 创建 FileSystemService

**文件**: `apps/api/src/services/filesystem_service.py` (新建)

**创建内容**:
```python
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import logging
import uuid

from src.models.file_index import FileIndex
from src.database import SessionLocal

logger = logging.getLogger(__name__)

class FileSystemService:
    """文件系统服务 - 实时读取 downloads/ 目录"""
    
    def __init__(self, download_path: str = './downloads'):
        self.download_path = Path(download_path)
    
    def scan_library(self) -> Dict[str, any]:
        """扫描视频库，返回合集和视频列表"""
        results = {
            'collections': [],
            'videos': []
        }
        
        if not self.download_path.exists():
            return results
        
        # 遍历下载目录
        for item in self.download_path.iterdir():
            if item.is_dir():
                # 检查是否是合集目录（包含子目录）
                subdirs = [d for d in item.iterdir() if d.is_dir()]
                if subdirs:
                    # 这是合集目录
                    collection = self._scan_collection(item)
                    if collection:
                        results['collections'].append(collection)
                else:
                    # 可能是单个视频的目录
                    video = self._scan_video_directory(item)
                    if video:
                        results['videos'].append(video)
            elif item.is_file() and item.suffix in ['.mp4', '.mkv', '.flv', '.webm']:
                # 根目录的视频文件
                video = self._scan_video_file(item)
                if video:
                    results['videos'].append(video)
        
        return results
    
    def _scan_collection(self, collection_dir: Path) -> Optional[Dict]:
        """扫描合集目录"""
        videos = []
        total_size = 0
        total_video_size = 0
        total_metadata_size = 0
        
        # 遍历子目录（每个子目录是一个视频）
        for video_dir in collection_dir.iterdir():
            if video_dir.is_dir():
                video = self._scan_video_directory(video_dir, collection_dir.name)
                if video:
                    videos.append(video)
                    total_size += video.get('total_size', 0)
                    total_video_size += video.get('video_size', 0)
                    total_metadata_size += video.get('metadata_size', 0)
        
        if not videos:
            return None
        
        # 获取封面（使用第一个视频的封面）
        cover = None
        if videos and videos[0].get('cover'):
            cover = videos[0]['cover']
        
        return {
            'type': 'collection',
            'id': f"collection_{collection_dir.name}",  # 生成临时ID
            'title': collection_dir.name,
            'path': str(collection_dir),
            'cover': cover,
            'video_count': len(videos),
            'total_size': total_size,
            'video_size': total_video_size,
            'metadata_size': total_metadata_size,
            'videos': videos,
            'created_at': int(min(v.get('created_at', 0) for v in videos)),
            'updated_at': int(datetime.now().timestamp())
        }
    
    def _scan_video_directory(self, video_dir: Path, collection_name: Optional[str] = None) -> Optional[Dict]:
        """扫描视频目录"""
        # 查找视频文件
        video_files = list(video_dir.glob('*.mp4')) + list(video_dir.glob('*.mkv')) + list(video_dir.glob('*.flv')) + list(video_dir.glob('*.webm'))
        
        if not video_files:
            return None
        
        # 查找封面（jpg/png/webp）
        cover = None
        for ext in ['.jpg', '.png', '.webp', '.jpeg']:
            cover_files = list(video_dir.glob(f'*{ext}'))
            if cover_files and cover_files[0].stat().st_size > 1000:
                cover = str(cover_files[0])
                break
        
        # 查找 NFO 文件解析元数据
        nfo_files = list(video_dir.glob('*.nfo'))
        title = video_dir.name
        bvid = None
        video_size = 0
        metadata_size = 0
        
        if nfo_files:
            try:
                import xml.etree.ElementTree as ET
                nfo_file = nfo_files[0]
                tree = ET.parse(str(nfo_file))
                title_elem = tree.find('.//title')
                if title_elem is not None:
                    title = title_elem.text
            except Exception as e:
                logger.warning(f"Failed to parse NFO file: {e}")
        
        # 计算文件大小
        for file_path in video_dir.rglob('*'):
            if file_path.is_file():
                file_size = file_path.stat().st_size
                if file_path.suffix in ['.mp4', '.mkv', '.flv', '.webm']:
                    video_size += file_size
                else:
                    metadata_size += file_size
        
        return {
            'type': 'video',
            'id': f"video_{video_dir.name}",
            'title': title,
            'path': str(video_dir),
            'cover': cover,
            'bvid': bvid,
            'video_size': video_size,
            'metadata_size': metadata_size,
            'total_size': video_size + metadata_size,
            'created_at': int(datetime.fromtimestamp(video_dir.stat().st_ctime).timestamp()),
            'updated_at': int(datetime.fromtimestamp(video_dir.st_mtime).timestamp())
        }
    
    def _scan_video_file(self, video_file: Path) -> Optional[Dict]:
        """扫描根目录下的视频文件"""
        # 查找同名封面（jpg/png/webp/jpeg）
        cover = None
        for ext in ['.jpg', '.png', '.webp', '.jpeg']:
            cover_file = video_file.with_suffix(ext)
            if cover_file.exists() and cover_file.stat().st_size > 1000:
                cover = str(cover_file)
                break
        
        # 计算文件大小
        video_size = video_file.stat().st_size
        metadata_size = 0
        
        return {
            'type': 'video',
            'id': f"video_{video_file.stem}",
            'title': video_file.stem,
            'path': str(video_file.parent),
            'cover': cover,
            'bvid': None,
            'video_size': video_size,
            'metadata_size': metadata_size,
            'total_size': video_size + metadata_size,
            'created_at': int(datetime.fromtimestamp(video_file.stat().st_ctime).timestamp()),
            'updated_at': int(datetime.fromtimestamp(video_file.st_mtime).timestamp())
        }
    
    def check_duplicate(self, title: str, media_id: Optional[str] = None) -> Optional[Dict]:
        """检查重复"""
        from src.models.task import Task
        
        db = SessionLocal()
        try:
            # 检查数据库中是否有同名任务（在队列中的任务）
            existing_task = db.query(Task).filter(
                Task.title == title,
                Task.state.in_([TaskState.BACKLOG, TaskState.PENDING, TaskState.ACTIVE, TaskState.PAUSED])
            ).first()
            
            if existing_task:
                return {
                    'type': 'database',
                    'task_id': existing_task.id,
                    'state': existing_task.state,
                    'state_label': ['backlog', 'pending', 'active', 'paused'][existing_task.state.value]
                }
            
            # 检查文件系统中是否存在（视频库）
            for collection_dir in self.download_path.iterdir():
                if collection_dir.is_dir():
                    # 检查合集中的视频
                    for video_dir in collection_dir.iterdir():
                        if video_dir.is_dir() and video_dir.name == title:
                            return {
                                'type': 'filesystem',
                                'is_collection': True,
                                'collection_title': collection_dir.name,
                                'path': str(video_dir),
                                'exists': True
                            }
            
            # 检查根目录下的视频文件
            for video_file in self.download_path.glob('*.mp4'):
                if video_file.stem == title:
                    return {
                        'type': 'filesystem',
                        'is_collection': False,
                        'path': str(video_file),
                        'exists': True
                    }
            
            return None
        finally:
            db.close()
    
    def delete_from_filesystem(self, path: str) -> bool:
        """从文件系统删除"""
        target_path = Path(path)
        
        if not target_path.exists():
            logger.warning(f"路径不存在: {path}")
            return False
        
        try:
            if target_path.is_file():
                target_path.unlink()
                logger.info(f"已删除文件: {path}")
            elif target_path.is_dir():
                import shutil
                shutil.rmtree(target_path)
                logger.info(f"已删除目录: {path}")
            
            return True
        except Exception as e:
            logger.error(f"删除失败: {e}")
            return False
```

---

### Phase 3: 修改下载逻辑

#### 3.1 修改任务完成逻辑

**文件**: `apps/api/src/services/queue/task.py`

**修改 `execute` 方法中的完成部分**:
```python
# 4. 标记任务为完成
self.task.state = TaskState.COMPLETED  # 临时标记
self.task.status['stage'] = 'completed'
self.task.status['progress'] = 100

# 保存到文件索引表
self._save_to_file_index(final_output_dir)

# 从数据库删除任务
self._delete_from_database()

# 广播任务删除事件（前端会刷新视频库）
from src.routers.websocket import broadcast_task_updated, broadcast_queue_updated
broadcast_task_updated(self.task.id, 'deleted', cancelled=False)
broadcast_queue_updated()

logger.info(f"✓ 任务 {self.task.id} 执行完成并从数据库删除")
```

**添加辅助方法**:
```python
def _save_to_file_index(self, output_dir: Path):
    """保存到文件索引表"""
    from src.models.file_index import FileIndex
    from src.database import SessionLocal
    
    # 计算文件大小
    video_size = 0
    metadata_size = 0
    for file_path in output_dir.rglob('*'):
        if file_path.is_file():
            file_size = file_path.stat().st_size
            if file_path.suffix in ['.mp4', '.mkv', '.flv', '.webm']:
                video_size += file_size
            else:
                metadata_size += file_size
    
    # 判断是合集还是单个视频
    db = SessionLocal()
    try:
        # 重新获取任务对象（避免分离实例问题）
        fresh_task = db.query(Task).filter(Task.id == self.task.id).first()
        if not fresh_task:
            logger.warning(f"任务不存在，跳过保存到索引: {self.task.id}")
            return
        
        # 检查是否是合集任务（有分P信息）
        is_collection = (
            fresh_task.meta and 
            isinstance(fresh_task.meta, dict) and
            ('page' in fresh_task.meta or 'part_title' in fresh_task.meta)
        )
        
        type_ = 'collection' if is_collection else 'video'
        title = fresh_task.title
        
        # 查找封面
        cover_files = list(output_dir.glob('*.jpg')) + list(output_dir.glob('*.png')) + list(output_dir.glob('*.webp'))
        cover = str(cover_files[0]) if cover_files and cover_files[0].stat().st_size > 1000 else None
        
        # 创建或更新索引
        file_index = db.query(FileIndex).filter(
            FileIndex.path == str(output_dir)
        ).first()
        
        if not file_index:
            file_index = FileIndex(
                id=str(uuid.uuid4()),
                path=str(output_dir),
                type=type_,
                title=title,
                bvid=fresh_task.media_id,
                video_count=1 if not is_collection else self._get_video_count(output_dir),
                total_size=video_size + metadata_size,
                video_size=video_size,
                metadata_size=metadata_size,
                meta={
                    'videoSize': video_size,
                    'metadataSize': metadata_size
                }
            )
            db.add(file_index)
        else:
            # 更新现有索引
            file_index.total_size = video_size + metadata_size
            file_index.video_size = video_size
            file_index.metadata_size = metadata_size
            file_index.meta = {
                'videoSize': video_size,
                'metadataSize': metadata_size
            }
            file_index.updated_at = int(datetime.now().timestamp())
        
        db.commit()
        logger.info(f"✓ 文件索引已保存: {output_dir}")
    finally:
        db.close()

def _get_video_count(self, output_dir: Path) -> int:
    """获取目录中的视频数量"""
    count = 0
    for file_path in output_dir.glob('*.mp4'):
        count += 1
    return count

def _delete_from_database(self):
    """从数据库删除任务"""
    from src.database import SessionLocal
    
    db = SessionLocal()
    try:
        # 删除任务
        task = db.query(Task).filter(Task.id == self.task.id).first()
        if task:
            db.delete(task)
            db.commit()
            logger.info(f"✓ 任务已从数据库删除: {self.task.id}")
    finally:
        db.close()
```

#### 3.2 修改调度器完成逻辑

**文件**: `apps/api/src/services/queue/scheduler.py`

**添加辅助方法**:
```python
def _save_to_file_index(self):
    """保存到文件索引表"""
    from src.models.file_index import FileIndex
    from src.database import SessionLocal
    
    db = SessionLocal()
    try:
        # 重新获取调度器对象
        fresh_scheduler = db.query(Scheduler).filter(Scheduler.id == self.id).first()
        if not fresh_scheduler:
            logger.warning(f"调度器不存在，跳过保存到索引: {self.id}")
            return
        
        # 获取输出目录
        from src.services.settings_service import SettingsService
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        output_dir = Path(settings.storage.download_path) / fresh_scheduler.title
        
        # 统计视频和大小
        videos = []
        total_size = 0
        total_video_size = 0
        total_metadata_size = 0
        
        if output_dir.exists():
            for video_dir in output_dir.iterdir():
                if video_dir.is_dir():
                    video_count = 0
                    video_size = 0
                    metadata_size = 0
                    
                    for file_path in video_dir.rglob('*'):
                        if file_path.is_file():
                            file_size = file_path.stat().st_size
                            if file_path.suffix in ['.mp4', '.mkv', '.flv', '.webm']:
                                video_count += 1
                                video_size += file_size
                            else:
                                metadata_size += file_size
                    
                    if video_count > 0:
                        # 获取封面
                        cover_files = list(video_dir.glob('*.jpg')) + list(video_dir.glob('*.png')) + list(video_dir.glob('*.webp'))
                        cover = str(cover_files[0]) if cover_files and cover_files[0].stat().st_size > 1000 else None
                        
                        videos.append({
                            'title': video_dir.name,
                            'path': str(video_dir),
                            'video_count': video_count,
                            'video_size': video_size,
                            'metadata_size': metadata_size,
                            'total_size': video_size + metadata_size,
                            'cover': cover
                        })
                        total_video_size += video_size
                        total_metadata_size += metadata_size
                        total_size += (video_size + metadata_size)
        
        if not videos:
            logger.warning(f"没有找到视频文件: {output_dir}")
            return
        
        # 获取合集封面（第一个视频的封面）
        cover = videos[0].get('cover') if videos else None
        
        # 创建或更新索引
        file_index = db.query(FileIndex).filter(
            FileIndex.path == str(output_dir)
        ).first()
        
        if not file_index:
            file_index = FileIndex(
                id=str(uuid.uuid4()),
                path=str(output_dir),
                type='collection',
                title=fresh_scheduler.title,
                bvid=None,
                video_count=len(videos),
                total_size=total_size,
                video_size=total_video_size,
                metadata_size=total_metadata_size,
                meta={
                    'videoSize': total_video_size,
                    'metadataSize': total_metadata_size,
                    'videos': videos
                }
            )
            db.add(file_index)
        else:
            # 更新现有索引
            file_index.total_size = total_size
            file_index.video_size = total_video_size
            file_index.metadata_size = total_metadata_size
            file_index.updated_at = int(datetime.now().timestamp())
        
        db.commit()
        logger.info(f"✓ 文件索引已保存: {output_dir}")
    finally:
        db.close()

def _delete_from_database(self):
    """从数据库删除调度器和所有任务"""
    from src.database import SessionLocal
    
    db = SessionLocal()
    try:
        # 删除所有任务
        for task_id in self.list:
            task = db.query(Task).filter(Task.id == task_id).first()
            if task:
                db.delete(task)
                logger.info(f"✓ 已删除任务: {task_id}")
        
        # 删除调度器
        scheduler = db.query(Scheduler).filter(Scheduler.id == self.id).first()
        if scheduler:
            db.delete(scheduler)
            logger.info(f"✓ 已删除调度器: {self.id}")
        
        db.commit()
        logger.info(f"✓ 调度器已从数据库删除: {self.id}")
    finally:
        db.close()
```

---

### Phase 4: 创建视频库 API

**文件**: `apps/api/src/routers/library.py` (新建)

**创建内容**:
```python
import logging
from fastapi import APIRouter, HTTPException
from pathlib import Path

from src.schemas.queue import ApiResponse
from src.services.filesystem_service import FileSystemService
from src.services.settings_service import SettingsService
from src.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/library", tags=["library"])

@router.get("/", response_model=ApiResponse)
async def get_library():
    """获取视频库内容（实时扫描文件系统）"""
    try:
        # 获取下载路径
        db = SessionLocal()
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        download_path = Path(settings.storage.download_path)
        db.close()
        
        # 扫描文件系统
        fs_service = FileSystemService(download_path=str(download_path))
        results = fs_service.scan_library()
        
        # 计算统计信息
        total_videos = len(results['videos']) + sum(c['video_count'] for c in results['collections'])
        total_collections = len(results['collections'])
        total_size = sum(v.get('total_size', 0) for v in results['videos']) + sum(c.get('total_size', 0) for c in results['collections'])
        
        return ApiResponse(
            success=True,
            data={
                'videos': results['videos'],
                'collections': results['collections'],
                'stats': {
                    'total_videos': total_videos,
                    'total_collections': total_collections,
                    'total_size': total_size
                }
            }
        )
    except Exception as e:
        logger.error(f"Failed to scan library: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/check-duplicate", response_model=ApiResponse)
async def check_duplicate(title: str, media_id: str = None):
    """检查重复（数据库队列 + 文件系统）"""
    try:
        # 获取下载路径
        db = SessionLocal()
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        download_path = Path(settings.storage.download_path)
        db.close()
        
        # 检查重复
        fs_service = FileSystemService(download_path=str(download_path))
        duplicate = fs_service.check_duplicate(title, media_id)
        
        if duplicate:
            if duplicate['type'] == 'database':
                # 数据库中存在（队列中）
                return ApiResponse(
                    success=True,
                    data={
                        'duplicate': True,
                        'type': 'database',
                        'task_id': duplicate['task_id'],
                        'state': duplicate['state'],
                        'state_label': duplicate['state_label'],
                        'message': f'该视频已添加到下载列表中（状态：{duplicate['state_label']}）'
                    }
                )
            elif duplicate['type'] == 'filesystem':
                # 文件系统中存在（已下载）
                is_collection = duplicate.get('is_collection', False)
                collection_title = duplicate.get('collection_title', '')
                path = duplicate['path']
                
                message = f'该视频已下载完成'
                if is_collection:
                    message = f'该合集已下载完成（{collection_title}）'
                
                return ApiResponse(
                    success=True,
                    data={
                        'duplicate': True,
                        'type': 'filesystem',
                        'is_collection': is_collection,
                        'collection_title': collection_title,
                        'path': path,
                        'message': message,
                        'options': ['cover', 'delete']
                    }
                )
        
        return ApiResponse(
            success=True,
            data={
                'duplicate': False,
                'message': '可以添加'
            }
        )
    except Exception as e:
        logger.error(f"Failed to check duplicate: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete", response_model=ApiResponse)
async def delete_from_library(path: str):
    """从视频库删除（带确认）"""
    try:
        # 获取下载路径
        db = SessionLocal()
        settings_service = Settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        download_path = Path(settings.storage.download_path)
        db.close()
        
        # 删除文件或目录
        fs_service = FileSystemService(download_path=str(download_path))
        success = fs_service.delete_from_filesystem(path)
        
        if success:
            return ApiResponse(
                success=True,
                message: '删除成功'
            )
        else:
            return ApiResponse(
                success=False,
                message: '删除失败，路径不存在'
            )
    except Exception as e:
        logger.error(f"Failed to delete from library: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Phase 5: 调整任务提交逻辑

**文件**: `apps/api/src/routers/queue.py`

**修改 `submit_task` 端点**，添加重复检查:
```python
@router.post("/tasks", response_model=ApiResponse)
async def submit_task(task_create: TaskCreate):
    """Submit task to backlog queue"""
    try:
        # 先检查重复
        fs_service = FileSystemService(str(settings.storage.download_path))
        duplicate = fs_service.check_duplicate(task_create.title, task_create.media_id)
        
        if duplicate and duplicate['type'] == 'filesystem':
            return ApiResponse(
                success=False,
                message=f'该视频已下载完成，请到视频库查看'
            )
        
        task = await queue_manager.submit_backlog(task_create)
        return ApiResponse(
            success=True,
            message="任务提交成功",
            data=task
        )
    except Exception as e:
        logger.error(f"Failed to submit task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Phase 6: 修改数据库模型导入

**文件**: `apps/api/src/models/__init__.py`

**添加导入**:
```python
from src.models.file_index import FileIndex
```

**文件**: `apps/api/src/database.py`

**更新 `create_tables` 方法**:
```python
def create_tables():
    """创建所有数据库表"""
    from src.models.user import User
    from src.models.cookie import Cookie
    from src.models.download import Download
    from src.models.setting import Setting
    from src.models.task import Task
    from src.models.scheduler import Scheduler
    from src.models.file_index import FileIndex  # 新增
    
    # 导入所有模型确保表定义被注册
    Base.metadata.create_all(bind=engine)
```

**更新 `create_missing_tables` 方法**:
```python
def create_missing_tables():
    """创建缺失的数据库表"""
    from src.models.cookie import Cookie
    from src.models.download import Download
    from src.models.setting import Setting
    from src.models.task import Task
    from src.models.scheduler import Scheduler
    from src.models.file_index import FileIndex  # 新增
    
    # 创建file_index表
    if not table_exists('file_index'):
        FileIndex.__table__.create(bind=engine)
        print("✅ Created 'file_index' table")
    else:
        print("ℹ️  'file_index' table already exists")
    
    # ... 其他表的创建逻辑
```

---

### Phase 7: 前端修改

#### 7.1 创建视频库 API 服务

**文件**: `apps/web/src/services/libraryService.ts` (新建)

**创建内容**:
```typescript
interface LibraryStats {
  total_videos: number
  total_collections: number
  total_size: number
}

interface VideoItem {
  type: 'video'
  id: string
  title: string
  path: string
  cover: string | null
  bvid: string | null
  video_size: number
  metadata_size: number
  total_size: number
  created_at: number
  updated_at: number
}

interface CollectionItem {
  type: 'collection'
  id: string
  title: string
  path: string
  cover: string | null
  video_count: number
  total_size: number
  video_size: number
  metadata_size: number
  videos: VideoItem[]
  created_at: number
  updated_at: number
}

interface LibraryData {
  videos: VideoItem[]
  collections: CollectionItem[]
  stats: LibraryStats
}

export class LibraryService {
  private static baseUrl = 'http://localhost:8000/api/library'

  static async getLibrary(): Promise<LibraryData> {
    const response = await fetch(this.baseUrl)
    const result = await response.json()
    
    if (result.success && result.data) {
      return result.data
    }
    throw new Error('Failed to fetch library')
  }

  static async checkDuplicate(title: string, media_id?: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, media_id })
    })
    const result = await response.json()
    
    if (result.success && result.data) {
      return result.data
    }
    throw new Error('Failed to check duplicate')
  }

  static async deleteItem(path: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    const result = await response.json()
    
    return result.success && result.success === true
  }
}
```

#### 7.2 创建 VideoLibrary 组件

**文件**: `apps/web/src/components/NewDownload/VideoLibrary.tsx`

**完全重写组件，实时读取视频库**:
```typescript
import { useState, useEffect } from 'react'
import { Inbox as EmptyIcon } from 'lucide-react'
import { useNewQueueStore } from '../../stores/newQueue'
import LibraryService from '../../services/libraryService'
import TaskCard from './TaskCard'
import SchedulerCard from './SchedulerCard'

export default function VideoLibrary() {
  const { connected } = useNewQueueStore()
  const [library, setLibrary] = useState<LibraryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<{
    show: boolean
    item: any
    itemType: 'video' | 'collection'
  }>({ show: false, item: null, itemType: 'video' })

  // 实时读取视频库
  const fetchLibrary = async () => {
    setLoading(true)
    try {
      const data = await LibraryService.getLibrary()
      setLibrary(data)
    } catch (error) {
      console.error('Failed to fetch library:', error)
    } finally {
      setLoading(false)
    }
  }

  // 删除确认处理
  const handleDelete = async () => {
    if (!showDeleteModal.item) return

    const confirmed = window.confirm(
      `确定要删除${showDeleteModal.itemType === 'collection' ? '合集' : '视频'}"${showDeleteModal.item.title}"吗？此操作不可恢复。`
    )

    if (confirmed) {
      try {
        const success = await LibraryService.deleteItem(showDeleteModal.item.path)
        if (success) {
          // 重新加载视频库
          await fetchLibrary()
          setShowDeleteModal({ show: false, item: null, itemType: 'video' })
        } else {
          alert('删除失败')
        }
      } catch (error) {
        console.error('Delete failed:', error)
        alert('删除失败')
      }
    }

  // 打开删除确认弹窗
  const openDeleteModal = (item: any, itemType: 'video' | 'collection') => {
    setShowDeleteModal({ show: true, item, itemType })
  }

  // 取消删除
  const closeDeleteModal = () => {
    setShowDeleteModal({ show: false, item: null, itemType: 'video' })
  }

  // 组件加载时获取视频库
  useEffect(() => {
    if (connected) {
      fetchLibrary()
    }
  }, [connected])

  if (!connected) {
    return (
      <div className="video-library">
        <div className="connection-status disconnected">
          <EmptyIcon size={16} />
          <span>WebSocket 未连接，请检查后端服务</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="video-library">
        <div className="loading-state">
          <EmptyIcon size={48} color="#94a3b8" />
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  const totalVideos = library?.stats?.total_videos || 0
  const totalSize = library?.stats?.total_size || 0
  const totalCollections = library?.stats?.total_collections || 0
  const hasContent = totalVideos > 0 || totalCollections > 0

  if (!hasContent) {
    return (
      <div className="video-library">
        <div className="empty-state">
          <EmptyIcon size={48} color="#94a3b8" />
          <p>暂无已下载的视频</p>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
            已下载完成的视频将在此显示
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="video-library">
      {/* 头部信息 */}
      <div className="library-header">
        <h3>已下载的视频</h3>
        <div className="library-actions">
          <button
            className="refresh-btn"
            onClick={fetchLibrary}
            disabled={loading}
          >
            刷新
          </button>
          <span className="library-stats">
            <span>{totalVideos} 个视频</span>
            {totalSize > 0 && (
              <>
                <span className="stats-divider">·</span>
                <span>{formatFileSize(totalSize)}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* 已完成的项目列表 */}
      <div className="scheduler-list">
        {/* 先显示合集 */}
        {library?.collections.map(collection => (
          <SchedulerCard
            key={collection.id}
            scheduler={{
              id: collection.id,
              title: collection.title,
              ts: 0,
              list: collection.videos.map(v => v.id),
              count: collection.video_count,
              queueType: 'playlist',
              state: 'completed',
              folder: collection.path,
              created_at: collection.created_at,
              updated_at: collection.updated_at
            }}
          />
        ))}

        {/* 再显示单个视频 */}
        {library?.videos.map(video => (
          <TaskCard
            key={video.id}
            task={{
              id: video.id,
              ts: 0,
              seq: 0,
              title: video.title,
              cover: video.cover,
              desc: '',
              duration: 0,
              pubtime: 0,
              media_type: 'video',
              url: '',
              media_id: video.bvid || '',
              schedulerId: undefined,
              state: 'completed',
              status: {
                progress: 100,
                speed: 0,
                eta: 0,
                stage: 'completed',
                downloaded: video.total_size,
                total: video.total_size
              },
              meta: {
                fileSize: video.total_size,
                videoSize: video.video_size,
                metadataSize: video.metadata_size,
                totalSize: video.total_size
              },
              prepare: {},
              subtasks: [],
              subtaskStatus: {},
              created_at: video.created_at,
              updated_at: video.updated_at
            }}
          />
        ))}
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteModal.show && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3>确认删除</h3>
            <p>
              确定要删除{showDeleteModal.itemType === 'collection' ? '合集' : '视频'}"
              <strong>{showDeleteModal.item.title}</strong> 吗？
              此操作不可恢复。
            </p>
            <div className="delete-modal-actions">
              <button
                className="cancel-btn"
                onClick={closeDeleteModal}
              >
                取消
              </button>
              <button
                className="confirm-btn"
                onClick={handleDelete}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
```

#### 7.3 修改详情页添加逻辑

**文件**: `apps/web/src/pages/VideoDetailPage.tsx` (需要找到)

**修改添加到队列的逻辑**:
```typescript
const handleAddToQueue = async (title: string, media_id: string, media_type: string) => {
  // 先检查重复
  try {
    const result = await LibraryService.checkDuplicate(title, media_id)
    
    if (result.duplicate) {
      // 重复处理
      if (result.type === 'database') {
        alert(result.message)
      } else if (result.type === 'filesystem') {
        // 已下载，询问用户
        const isCollection = result.is_collection
        const collectionTitle = result.collection_title || ''
        
        let message = result.message
        if (isCollection) {
          message += `（${collectionTitle}）`
        }
        
        const action = confirm(
          `${message}\n\n选项：\n1. 点击"确定"删除本地文件后重新下载\n2. 点击"取消"取消操作\n3. 手动修改文件名后再添加`
        )
        
        if (action) {
          // 删除文件
          const success = await LibraryService.deleteItem(result.path)
          if (success) {
            // 删除成功，重新添加
            await addTaskToQueue(title, media_id, media_type)
          } else {
            alert('删除失败，请手动删除')
          }
        }
      }
      return
    }
    
    // 不重复，直接添加
    await addTaskToQueue(title, media_id, media_type)
  } catch (error) {
    console.error('Failed to add to queue:', error)
    alert('添加失败')
  }
}
```

---

### Phase 8: CSS 样式调整

**文件**: `apps/web/src/components/NewDownload/index.css`

**添加样式**:
```css
/* 删除确认弹窗 */
.delete-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.delete-modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.delete-modal h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 12px 0;
}

.delete-modal p {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.delete-modal strong {
  color: #1e293b;
  font-weight: 600;
}

.delete-modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.delete-modal .cancel-btn {
  padding: 10px 20px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.delete-modal .cancel-btn:hover {
  background: #f8fafc;
  color: #1e293b;
}

.delete-modal .confirm-btn {
  padding: 10px 20px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.delete-modal .confirm-btn:hover {
  background: #dc2626;
}

/* 刷新按钮样式优化 */
.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
}

.library-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease-out;
  min-height: 44px;
}

.refresh-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #1e293b;
  border-color: #cbd5e1;
}

.refresh-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: #64748b;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

---

## ⚠️ 注意事项和难点

### 1. 目录结构识别

**规则**:
```
downloads/
├── collection1/           # 合集（包含子目录）
│   ├── video1/         # 视频目录
│   │   ├── video.mp4
│   │   ├── cover.jpg
│   │   └── video.nfo
│   └── video2/
│       └── ...
├── single-video/         # 单个视频（不包含子目录）
│   ├── video.mp4
│   ├── cover.jpg
│   └── video.nfo
└── root-video.mp4         # 根目录视频
```

**避免错误**:
- 不要假设目录结构是固定的
- 先检查子目录，再检查视频文件
- 处理空目录和损坏的结构

### 2. 文件大小计算

**方法**:
```python
for file_path in output_dir.rglob('*'):
    if file_path.is_file():
        file_size = file_path.stat().st_size
        if file_path.suffix in ['.mp4', '.mkv', '.flv', '.webm']:
            video_size += file_size
        else:
            metadata_size += file_size
```

**避免错误**:
- 使用 `file_path.stat().st_size` 获取实际大小
- 区分视频文件和元数据文件
- 处理特殊文件（隐藏文件、符号链接）

### 3. 数据库事务处理

**原则**:
- 任务完成后，在同一个事务中：
  1. 保存到 file_index 表
  2. 从 tasks 表删除
  3. 从 schedulers 表删除（如果是合集）

**避免错误**:
- 使用 `db.merge()` 而不是 `db.add()`
- 确保所有操作在同一个事务中
- 使用 `try/finally` 确保连接关闭

### 4. 并发控制

**问题**: 同时下载完成时可能冲突

**解决方案**:
- 使用数据库事务的隔离级别
- 使用 `fcntl.flock` 文件锁
- WebSocket 广播顺序：先更新数据库，再广播事件

### 5. 性能优化

**视频库扫描优化**:
- 使用 `os.scandir()` 而不是 `os.listdir()`
- 限制扫描深度（不超过 2 层）
- 缓存扫描结果，只有文件系统变化时才重新扫描

**下载列表优化**:
- 使用数据库索引
- 只查询必要字段
- 避免 JOIN 查询

### 6. 错误处理

**数据库错误**:
- 捕获所有异常，记录详细日志
- 使用 HTTPException 返回用户友好的错误信息
- 使用事务确保数据一致性

**文件系统错误**:
- 捕获文件操作异常
- 处理权限问题
- 处理磁盘空间不足

**网络错误**:
- 超时处理
- 重试机制
- 优雅降级

### 7. 向后兼容性

**迁移策略**:
- 保留 COMPLETED 状态在代码中，但不再使用
- 逐步迁移现有数据到 file_index 表
- 提供数据清理脚本

**注意事项**:
- 不删除旧的 COMPLETED 任务数据
- 在迁移过程中保持服务可用
- 记录所有迁移操作

---

## 📊 数据流图

```
用户添加视频
    ↓
检查重复（数据库 + 文件系统）
    ↓
如果重复 → 提示用户选择
    ↓
如果不重复 → 添加到数据库（backlog）
    ↓
下载开始 → 更新状态为 active
    ↓
下载完成 → 保存到 file_index → 从数据库删除
    ↓
广播删除事件 → 前端刷新视频库
    ↓
视频库实时读取文件系统 → 显示
```

---

## 🎯 实现检查清单

### 后端

- [ ] 修改 Task 状态枚举（移除 COMPLETED 等）
- [ ] 修改 Scheduler 状态枚举（移除 COMPLETED 等）
- [ ] 创建 FileIndex 模型
- [ ] 创建 FileSystemService 服务
- ] 修改任务完成逻辑（保存索引、删除任务）
- ] 修改调度器完成逻辑（保存索引、删除任务）
- ] 创建视频库 API 端点
- ] 修改任务提交逻辑（添加重复检查）
- ] 更新数据库模型导入

### 前端

- [ ] 创建 LibraryService
- [ ] 重写 VideoLibrary 组件（实时读取）
- ] 添加删除确认弹窗
- ] 添加刷新按钮
- ] 修改详情页添加逻辑（重复检查）
- ] 添加 CSS 样式
- ] 移除状态标签显示（已完成任务）

### 测试

- [ ] 添加新视频 → 保存到数据库
- [ ] 下载中 → 显示实时进度
- [ ] 下载完成 → 从数据库删除，文件系统显示
- [ ] 添加已下载视频 → 提示重复
- [ ] 删除视频 → 需要确认
- ] 删除合集 → 删除所有子视频
- ] 刷新视频库 → 重新扫描文件系统
- ] 根目录视频 → 正确识别和显示
-   合集视频 → 正确识别和显示

---

## 📝 实施顺序建议

1. **第1步**: 数据库模型调整（Phase 1）
   - 优先级：高
   - 风险：低（只修改枚举，不破坏数据）

2. **第2步**: 创建文件系统服务（Phase 2）
   - 优先级：高
   - 风险：低（新建服务，不影响现有功能）

3. **第3步**: 修改下载逻辑（Phase 3）
   - 优先级：高
   - 风险：高（影响核心逻辑，需要仔细测试）

4. **第4步**: 创建视频库 API（Phase 4）
   - 优先级：高
   - 风险：低（新建API）

5. **第5步**: 修改前端（Phase 5）
   - 优先级：中
   - 风险：中（涉及组件重写）

6. **第6步**: 添加样式和交互（Phase 6）
   - 优先级：低
   - 风险：低

7. **第7步**: 测试和调优
   - 优先级：高
   - 风险：低（发现问题后可以修复）

---

## 🚀 升级命令

```bash
# 1. 备份数据库
cd apps/api
cp pilinote.db pilinote.db.backup

# 2. 重启后端（会自动创建新表）
source venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 3. 测试前端
cd apps/web
pnpm dev
```

---

## 🔄 回滚方案

如果出现问题，可以快速回滚：

```bash
# 回滚数据库
cd apps/api
mv pilinote.db.backup pilinnote.db

# 恢复代码
git checkout main
```

---

## 📞 联系与支持

如遇到问题，请查看：
- 后端日志：`apps/api/logs/`
- 前端控制台错误
- GitHub Issues

---

**最后更新**: 2026-04-04
**版本**: v0.1.0