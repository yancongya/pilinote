from typing import Dict, Type, Optional
from src.schemas.task import SubTaskType
from .base import BaseHandler
from .video import VideoHandler, AudioHandler, AudioVideoMergeHandler
from .subtitle import SubtitleHandler
from .danmaku import DanmakuHandler
from .thumb import ThumbHandler, UploaderAvatarHandler
from .nfo import SingleNfoHandler, AlbumNfoHandler

class SubTaskHandlerRegistry:
    """子任务处理器注册表"""

    _handlers: Dict[SubTaskType, Type[BaseHandler]] = {}

    @classmethod
    def register(cls, task_type: SubTaskType):
        """注册处理器"""
        def decorator(handler_class: Type[BaseHandler]):
            cls._handlers[task_type] = handler_class
            return handler_class
        return decorator

    @classmethod
    def get_handler(cls, task_type: SubTaskType) -> Optional[BaseHandler]:
        """获取处理器实例"""
        handler_class = cls._handlers.get(task_type)
        if handler_class:
            return handler_class()
        return None

    @classmethod
    def list_handlers(cls) -> Dict[SubTaskType, str]:
        """列出所有已注册的处理器"""
        return {
            task_type: handler_class.__name__
            for task_type, handler_class in cls._handlers.items()
        }

# 注册所有处理器
SubTaskHandlerRegistry.register(SubTaskType.VIDEO)(VideoHandler)
SubTaskHandlerRegistry.register(SubTaskType.AUDIO)(AudioHandler)
SubTaskHandlerRegistry.register(SubTaskType.AUDIO_VIDEO)(AudioVideoMergeHandler)
SubTaskHandlerRegistry.register(SubTaskType.SUBTITLES)(SubtitleHandler)
SubTaskHandlerRegistry.register(SubTaskType.DANMAKU)(DanmakuHandler)
SubTaskHandlerRegistry.register(SubTaskType.THUMB)(ThumbHandler)
SubTaskHandlerRegistry.register(SubTaskType.SINGLE_NFO)(SingleNfoHandler)
SubTaskHandlerRegistry.register(SubTaskType.ALBUM_NFO)(AlbumNfoHandler)

# 向后兼容的别名
SubTaskHandler = SubTaskHandlerRegistry
