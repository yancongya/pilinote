from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class SchedulerState(int, Enum):
    """调度器状态枚举"""
    PENDING = 0
    ACTIVE = 1
    COMPLETED = 2
    PAUSED = 3
    FAILED = 4
    CANCELLED = 5


class QueueType(int, Enum):
    """队列类型枚举"""
    BACKLOG = 0
    PENDING = 1
    DOING = 2
    COMPLETE = 3


class SchedulerCreate(BaseModel):
    """创建调度器请求"""
    title: str
    task_ids: Optional[List[str]] = None  # 可选，如果不提供则从backlog队列获取
    folder: str


class SchedulerUpdate(BaseModel):
    """更新调度器请求"""
    state: Optional[SchedulerState] = None
    queue_type: Optional[QueueType] = None


class SchedulerResponse(BaseModel):
    """调度器响应"""
    id: str
    title: str
    list: List[str]
    count: int
    queue_type: QueueType
    state: SchedulerState
    folder: str
    created_at: int
    updated_at: int


class SchedulerListResponse(BaseModel):
    """调度器列表响应"""
    total: int
    items: List[SchedulerResponse]