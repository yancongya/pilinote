from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class MediaType(str, Enum):
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


class TaskState(int, Enum):
    """任务状态枚举"""
    BACKLOG = 0
    PENDING = 1
    ACTIVE = 2
    COMPLETED = 3
    PAUSED = 4
    FAILED = 5
    CANCELLED = 6


class SubTaskType(str, Enum):
    """子任务类型枚举"""
    VIDEO = "video"
    AUDIO = "audio"
    AUDIO_VIDEO = "audio_video"
    SUBTITLES = "subtitles"
    DANMAKU = "danmaku"
    THUMB = "thumb"
    SINGLE_NFO = "single_nfo"
    ALBUM_NFO = "album_nfo"
    AI_SUMMARY = "ai_summary"
    OPUS_CONTENT = "opus_content"
    OPUS_IMAGES = "opus_images"


class SubTask(BaseModel):
    """子任务"""
    id: str
    type: SubTaskType
    state: TaskState
    progress: int = 0
    error_message: Optional[str] = None
    params: Dict[str, Any] = {}


class TaskCreate(BaseModel):
    """创建任务请求"""
    media_type: MediaType
    media_id: str
    title: Optional[str] = None
    cover: Optional[str] = None
    desc: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class TaskUpdate(BaseModel):
    """更新任务请求"""
    state: Optional[TaskState] = None
    status: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    prepare: Optional[Dict[str, Any]] = None


class TaskResponse(BaseModel):
    """任务响应"""
    id: str
    media_type: MediaType
    media_id: str
    title: Optional[str]
    cover: Optional[str]
    desc: Optional[str]
    meta: Dict[str, Any]
    prepare: Dict[str, Any]
    status: Dict[str, Any]
    state: TaskState
    scheduler_id: Optional[str] = None
    subtasks: List[SubTask] = []
    created_at: int
    updated_at: int


class TaskListResponse(BaseModel):
    """任务列表响应"""
    total: int
    items: List[TaskResponse]