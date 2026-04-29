from datetime import datetime
from sqlalchemy import Column, String, Integer, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from src.database import Base
import enum
import uuid


class TaskState(int, enum.Enum):
    """任务状态枚举"""
    BACKLOG = 0      # 待办
    PENDING = 1      # 待处理
    ACTIVE = 2       # 活跃
    COMPLETED = 3    # 已完成
    PAUSED = 4       # 已暂停
    FAILED = 5       # 失败
    CANCELLED = 6    # 已取消


class DownloadStage(str, enum.Enum):
    """下载阶段枚举"""
    PREPARING = "preparing"        # 准备中（获取元数据）
    DOWNLOADING = "downloading"    # 下载视频/音频
    MOVING = "moving"              # 移动文件
    POST_PROCESSING = "post_processing"  # 后处理（封面、头像、字幕、NFO）
    COMPLETED = "completed"        # 完成


class MediaType(str, enum.Enum):
    """媒体类型枚举"""
    VIDEO = "video"
    BANGUMI = "bangumi"
    MUSIC = "music"
    MUSIC_LIST = "music_list"
    LESSON = "lesson"
    WATCH_LATER = "watch_later"
    FAVORITE = "favorite"
    OPUS = "opus"
    OPUS_LIST = "opus_list"
    USER_VIDEO = "user_video"
    USER_OPUS = "user_opus"
    USER_AUDIO = "user_audio"


class Task(Base):
    """任务模型"""
    __tablename__ = 'tasks'

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    media_type = Column(String(20), nullable=False, index=True)  # MediaType
    media_id = Column(String(50), nullable=False, index=True)  # bvid/epid/ssid等
    title = Column(String(500))
    cover = Column(String(500))
    desc = Column(String(2000))

    # 元数据
    meta = Column(JSON, nullable=False, default=lambda: {})  # 完整元数据（视频信息、UP主信息等）
    prepare = Column(JSON, nullable=False, default=lambda: {})  # 准备数据（视频URL、字幕URL等）
    # status 结构:
    # {
    #   "progress": float,      # 总体进度 0-100
    #   "speed": float,         # 下载速度 bytes/s
    #   "eta": float,           # 预计剩余时间 seconds
    #   "stage": str,           # 当前阶段 (DownloadStage)
    #   "downloaded": int,      # 已下载字节数
    #   "total": int            # 总字节数
    # }
    status = Column(JSON, nullable=False, default=lambda: {})  # 进度状态
    state = Column(Integer, nullable=False, default=TaskState.BACKLOG, index=True)  # TaskState

    # 错误详情（细粒度错误分类）
    error_detail = Column(JSON, nullable=True)  # ErrorDetail JSON

    # 调度器关联
    scheduler_id = Column(String(50), nullable=True, index=True)  # 所属调度器ID

    # 时间戳
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'media_type': self.media_type,
            'media_id': self.media_id,
            'title': self.title,
            'cover': self.cover,
            'desc': self.desc,
            'meta': self.meta,
            'prepare': self.prepare,
            'status': self.status,
            'state': self.state,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    def __repr__(self):
        return f"<Task(id={self.id}, media_type={self.media_type}, media_id={self.media_id}, state={self.state})>"


class SubTaskType(str, enum.Enum):
    """子任务类型枚举"""
    VIDEO = "video"          # 视频下载
    SUBTITLE = "subtitle"    # 字幕下载
    DANMAKU = "danmaku"      # 弹幕下载
    COVER = "cover"          # 封面下载
    AVATAR = "avatar"        # 头像下载
    NFO = "nfo"              # NFO元数据文件


class SubTask(Base):
    """子任务模型 - 处理视频、字幕、弹幕、封面等具体下载任务"""
    __tablename__ = 'subtasks'

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(50), nullable=False, index=True)  # 关联的主任务ID
    type = Column(String(20), nullable=False, index=True)     # SubTaskType
    state = Column(Integer, nullable=False, default=TaskState.BACKLOG, index=True)  # TaskState
    progress = Column(Integer, default=0)  # 进度 0-100

    # 处理参数
    params = Column(JSON, nullable=False, default=lambda: {})  # 子任务特定参数

    # 输出信息
    output_path = Column(String(500))  # 输出文件路径
    file_size = Column(Integer)        # 文件大小（字节）

    # 错误详情
    error_detail = Column(JSON, nullable=True)  # 错误详情

    # 时间戳
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'task_id': self.task_id,
            'type': self.type,
            'state': self.state,
            'progress': self.progress,
            'params': self.params,
            'output_path': self.output_path,
            'file_size': self.file_size,
            'error_detail': self.error_detail,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    def __repr__(self):
        return f"<SubTask(id={self.id}, task_id={self.task_id}, type={self.type}, state={self.state})>"