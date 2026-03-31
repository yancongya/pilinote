from datetime import datetime
from sqlalchemy import Column, Integer, JSON
from src.database import Base
import enum


class QueueType(int, enum.Enum):
    """队列类型枚举"""
    BACKLOG = 0      # 待办队列
    PENDING = 1      # 待处理队列
    DOING = 2        # 执行中队列
    COMPLETE = 3     # 完成队列


class Queue(Base):
    """队列模型"""
    __tablename__ = 'queues'

    queue_type = Column(Integer, primary_key=True)  # QueueType (0=BACKLOG, 1=PENDING, 2=DOING, 3=COMPLETE)
    value = Column(JSON, nullable=False, default=lambda: [])  # 任务ID列表（JSON数组）
    updated_at = Column(Integer, nullable=False, default=lambda: int(datetime.utcnow().timestamp()))

    def to_dict(self):
        """转换为字典"""
        return {
            'queue_type': self.queue_type,
            'value': self.value,
            'updated_at': self.updated_at
        }

    def __repr__(self):
        return f"<Queue(queue_type={self.queue_type}, count={len(self.value) if self.value else 0})>"