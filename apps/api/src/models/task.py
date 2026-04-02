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
    status = Column(JSON, nullable=False, default=lambda: {})  # 进度状态
    state = Column(Integer, nullable=False, default=TaskState.BACKLOG, index=True)  # TaskState

    # 调度器关联
    scheduler_id = Column(String(50), nullable=True, index=True)  # 所属调度器ID

    # 时间戳
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.utcnow().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.utcnow().timestamp()))

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