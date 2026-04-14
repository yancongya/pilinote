from pydantic import BaseModel, Field, field_validator
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
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="调度器标题（用于合集下载时的文件夹名称）",
        examples=["我的视频合集"]
    )
    task_ids: Optional[List[str]] = Field(
        default=None,
        description="任务ID列表（可选，如果不提供则从backlog队列获取）"
    )
    folder: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="输出文件夹路径（绝对路径或相对路径）",
        examples=["/downloads/my_videos"]
    )

    @field_validator('task_ids')
    @classmethod
    def validate_task_ids(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """验证任务ID列表"""
        if v is None:
            return None

        if not isinstance(v, list):
            raise ValueError('task_ids must be a list')

        if len(v) == 0:
            raise ValueError('task_ids cannot be an empty list')

        # 验证每个ID的格式（UUID格式）
        import re
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            re.IGNORECASE
        )

        for task_id in v:
            if not task_id or not isinstance(task_id, str):
                raise ValueError(f'Invalid task_id: {task_id}')
            if not uuid_pattern.match(task_id):
                raise ValueError(f'task_id must be a valid UUID format: {task_id}')

        return v

    class Config:
        json_schema_extra = {
            "example": {
                "title": "我的视频合集",
                "task_ids": ["550e8400-e29b-41d4-a716-446655440000"],
                "folder": "/downloads/my_videos"
            }
        }


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