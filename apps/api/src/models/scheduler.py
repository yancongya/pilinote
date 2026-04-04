from datetime import datetime
from sqlalchemy import Column, String, Integer, JSON
from src.database import Base
import enum
import uuid


class SchedulerState(int, enum.Enum):
    """调度器状态枚举"""
    PENDING = 0      # 待处理
    ACTIVE = 1       # 活跃
    COMPLETED = 2    # 已完成
    PAUSED = 3       # 已暂停
    FAILED = 4       # 失败
    CANCELLED = 5    # 已取消


class QueueType(int, enum.Enum):
    """队列类型枚举"""
    BACKLOG = 0      # 待办队列
    PENDING = 1      # 待处理队列
    DOING = 2        # 执行中队列
    COMPLETE = 3     # 完成队列


class Scheduler(Base):
    """调度器模型"""
    __tablename__ = 'schedulers'

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)

    # 任务列表
    list = Column(JSON, nullable=False, default=lambda: [])  # 任务ID列表
    count = Column(Integer, nullable=False, default=0)  # 任务数量

    # 队列和状态
    queue_type = Column(Integer, nullable=False, default=QueueType.PENDING)  # QueueType
    state = Column(Integer, nullable=False, default=SchedulerState.PENDING, index=True)  # SchedulerState

    # 输出目录
    folder = Column(String(500), nullable=False)

    # 时间戳
    created_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.now().timestamp()))

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'title': self.title,
            'list': self.list,
            'count': self.count,
            'queue_type': self.queue_type,
            'state': self.state,
            'folder': self.folder,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    def __repr__(self):
        return f"<Scheduler(id={self.id}, title={self.title}, state={self.state}, count={self.count})>"