from typing import Dict, Type, Optional
from .base import BaseHandler
from .video import VideoHandler, AudioHandler
from .subtitle import SubtitleHandler

# 暂时注释掉未实现的处理器
# from .danmaku import DanmakuHandler
# from .thumb import ThumbHandler, UploaderAvatarHandler
# from .nfo import SingleNfoHandler, AlbumNfoHandler


class SubTaskHandlerRegistry:
    """子任务处理器注册表"""

    _handlers: Dict[str, Type[BaseHandler]] = {}

    @classmethod
    def register(cls, task_type: str):
        """注册处理器"""
        def decorator(handler_class: Type[BaseHandler]):
            cls._handlers[task_type] = handler_class
            return handler_class
        return decorator

    @classmethod
    def get_handler(cls, task_type: str) -> Optional[BaseHandler]:
        """获取处理器实例"""
        handler_class = cls._handlers.get(task_type)
        if handler_class:
            return handler_class()
        return None

    @classmethod
    def list_handlers(cls) -> Dict[str, str]:
        """列出所有已注册的处理器"""
        return {
            task_type: handler_class.__name__
            for task_type, handler_class in cls._handlers.items()
        }


# 注册已实现的处理器
SubTaskHandlerRegistry.register("video")(VideoHandler)
SubTaskHandlerRegistry.register("audio")(AudioHandler)
SubTaskHandlerRegistry.register("subtitle")(SubtitleHandler)

# TODO: 注册其他处理器
# SubTaskHandlerRegistry.register("danmaku")(DanmakuHandler)
# SubTaskHandlerRegistry.register("cover")(ThumbHandler)
# SubTaskHandlerRegistry.register("nfo")(SingleNfoHandler)

# 向后兼容的别名
SubTaskHandler = SubTaskHandlerRegistry
