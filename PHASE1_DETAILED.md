# 第一阶段详细实施计划

## 1. 数据模型对比分析

### 当前 Download 模型问题
```python
# 问题1：职责混乱
class Download(Base):
    # 下载相关字段
    bvid, status, progress, downloaded_bytes...
    
    # AI笔记相关字段（应该分离）
    ai_note_id, ai_summary, ai_markdown...
    
    # 元数据开关（应该用子任务管理）
    enable_nfo, enable_subtitle, enable_cover...
```

### 新 Task 模型优势
```python
# 职责清晰，只管下载任务
class Task(Base):
    # 核心字段
    media_type, media_id, title, state
    
    # JSON字段存储灵活数据
    meta = Column(JSON)      # 元数据
    prepare = Column(JSON)   # 准备数据
    status = Column(JSON)    # 进度状态
    
    # 关联调度器
    scheduler_id = Column(String)
```

## 2. 数据迁移脚本

### 2.1 创建新表结构
```python
# 新增 SubTask 模型
class SubTask(Base):
    __tablename__ = 'subtasks'
    
    id = Column(String(50), primary_key=True)
    task_id = Column(String(50), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # video, subtitle, danmaku, cover, avatar, nfo
    state = Column(Integer, nullable=False, default=0)  # TaskState
    progress = Column(Integer, default=0)  # 0-100
    
    # 处理参数
    params = Column(JSON, default={})
    
    # 输出信息
    output_path = Column(String(500))
    file_size = Column(Integer)
    error_detail = Column(JSON)
    
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

### 2.2 数据迁移逻辑
```python
def migrate_downloads_to_tasks():
    """将 downloads 表数据迁移到 tasks 表"""
    
    with SessionLocal() as db:
        # 获取所有下载记录
        downloads = db.query(Download).all()
        
        for download in downloads:
            # 创建新的 Task
            task = Task(
                id=download.id,
                media_type="video",  # 旧系统都是视频
                media_id=download.bvid,
                title=download.title,
                cover=download.thumbnail_url,
                
                # 迁移元数据
                meta={
                    "aid": download.aid,
                    "cid": download.cid,
                    "duration": download.duration,
                    "uploader": download.uploader,
                    "uploader_mid": download.uploader_mid,
                    "quality": download.quality,
                    "codec": download.codec,
                    "audio_bitrate": download.audio_bitrate
                },
                
                # 迁移进度状态
                status={
                    "progress": download.progress,
                    "speed": download.download_speed * 1024,  # KB/s -> bytes/s
                    "eta": download.eta,
                    "downloaded": download.downloaded_bytes,
                    "total": download.total_bytes,
                    "stage": map_download_stage(download.status)
                },
                
                # 映射任务状态
                state=map_task_state(download.status),
                
                created_at=int(download.created_at.timestamp()),
                updated_at=int(download.updated_at.timestamp())
            )
            
            db.add(task)
            
            # 创建子任务
            subtasks = create_subtasks_from_download(download, task.id)
            for subtask in subtasks:
                db.add(subtask)
        
        db.commit()

def map_task_state(download_status: str) -> int:
    """映射下载状态到任务状态"""
    mapping = {
        "pending": TaskState.BACKLOG,
        "queued": TaskState.PENDING,
        "downloading": TaskState.ACTIVE,
        "paused": TaskState.PAUSED,
        "completed": TaskState.COMPLETED,
        "failed": TaskState.FAILED,
        "cancelled": TaskState.CANCELLED
    }
    return mapping.get(download_status, TaskState.BACKLOG)

def create_subtasks_from_download(download: Download, task_id: str) -> List[SubTask]:
    """从下载记录创建子任务"""
    subtasks = []
    
    # 视频子任务（必须）
    video_subtask = SubTask(
        task_id=task_id,
        type="video",
        state=map_task_state(download.status),
        progress=int(download.progress),
        params={
            "quality": download.quality,
            "codec": download.codec,
            "audio_bitrate": download.audio_bitrate
        },
        output_path=download.file_path,
        file_size=download.file_size
    )
    subtasks.append(video_subtask)
    
    # 根据开关创建其他子任务
    if download.enable_subtitle:
        subtasks.append(SubTask(
            task_id=task_id,
            type="subtitle",
            state=TaskState.BACKLOG,
            params={}
        ))
    
    if download.enable_cover:
        subtasks.append(SubTask(
            task_id=task_id,
            type="cover",
            state=TaskState.BACKLOG,
            params={}
        ))
    
    if download.enable_avatar:
        subtasks.append(SubTask(
            task_id=task_id,
            type="avatar",
            state=TaskState.BACKLOG,
            params={}
        ))
    
    if download.enable_nfo:
        subtasks.append(SubTask(
            task_id=task_id,
            type="nfo",
            state=TaskState.BACKLOG,
            params={}
        ))
    
    return subtasks
```

## 3. 数据库迁移步骤

### 3.1 创建 Alembic 迁移
```bash
cd apps/api
alembic revision --autogenerate -m "unified_download_system_phase1"
```

### 3.2 手动调整迁移脚本
```python
# 在生成的迁移文件中添加数据迁移逻辑
def upgrade():
    # 1. 创建新表
    op.create_table('subtasks', ...)
    
    # 2. 执行数据迁移
    migrate_downloads_to_tasks()
    
    # 3. 备份旧表
    op.rename_table('downloads', 'downloads_backup')

def downgrade():
    # 回滚逻辑
    op.rename_table('downloads_backup', 'downloads')
    op.drop_table('subtasks')
```

## 4. 验证脚本

### 4.1 数据完整性验证
```python
def verify_migration():
    """验证数据迁移的完整性"""
    with SessionLocal() as db:
        # 检查任务数量
        download_count = db.query(Download).count()
        task_count = db.query(Task).count()
        assert task_count == download_count, f"任务数量不匹配: {task_count} != {download_count}"
        
        # 检查子任务
        subtask_count = db.query(SubTask).count()
        assert subtask_count >= task_count, "子任务数量不足"
        
        # 检查数据完整性
        for task in db.query(Task).all():
            # 验证必要字段
            assert task.media_id, f"Task {task.id} 缺少 media_id"
            assert task.title, f"Task {task.id} 缺少 title"
            
            # 验证子任务
            subtasks = db.query(SubTask).filter(SubTask.task_id == task.id).all()
            assert len(subtasks) > 0, f"Task {task.id} 没有子任务"
            
            # 验证至少有一个视频子任务
            video_subtasks = [st for st in subtasks if st.type == "video"]
            assert len(video_subtasks) == 1, f"Task {task.id} 视频子任务数量错误"
        
        print("✅ 数据迁移验证通过")
```

## 5. AI 笔记数据分离

### 5.1 创建独立的 AI 笔记表
```python
class AINote(Base):
    """AI 笔记模型 - 从 Download 中分离出来"""
    __tablename__ = 'ai_notes'
    
    id = Column(String(50), primary_key=True)
    task_id = Column(String(50), nullable=False, index=True)  # 关联到 tasks
    
    # AI 分析内容
    summary = Column(Text)
    markdown = Column(Text)
    style = Column(String(50))
    
    # 状态和错误
    status = Column(String(20), default="pending")
    error_message = Column(Text)
    
    # 转写相关
    transcript = Column(Text)
    transcript_lang = Column(String(10))
    
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

### 5.2 迁移 AI 笔记数据
```python
def migrate_ai_notes():
    """迁移 AI 笔记数据"""
    with SessionLocal() as db:
        downloads_with_ai = db.query(Download).filter(
            Download.ai_note_id.isnot(None)
        ).all()
        
        for download in downloads_with_ai:
            ai_note = AINote(
                id=download.ai_note_id,
                task_id=download.id,  # 关联到对应的 task
                summary=download.ai_summary,
                markdown=download.ai_markdown,
                style=download.ai_style,
                status=download.ai_status,
                error_message=download.ai_error,
                transcript=download.transcript,
                transcript_lang=download.transcript_lang,
                created_at=int(download.created_at.timestamp()),
                updated_at=int(download.updated_at.timestamp())
            )
            db.add(ai_note)
        
        db.commit()
```