from pydantic import BaseModel
from typing import List
from enum import Enum


class QueueType(int, Enum):
    """队列类型枚举"""
    BACKLOG = 0
    PENDING = 1
    DOING = 2
    COMPLETE = 3


class QueueResponse(BaseModel):
    """队列响应"""
    queue_type: QueueType
    value: List[str]
    updated_at: int