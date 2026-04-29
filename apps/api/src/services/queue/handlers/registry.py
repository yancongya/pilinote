"""
子任务处理器注册表

管理所有子任务处理器的注册和获取
"""

from typing import Dict, Type, Optional
import logging

from .base import BaseHandler
from .video import VideoHandler, AudioHandler
from .subtitle import SubtitleHandler
from src.models.task import SubTaskType

logger = logging.getLogger(__name__)


class HandlerRegistry:
    """处理器注册表"""
    
    def __init__(self):
        self._handlers: Dict[SubTaskType, BaseHandler] = {}
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """注册默认处理器"""
        self.register(SubTaskType.VIDEO, VideoHandler())
        self.register(SubTaskType.SUBTITLE, SubtitleHandler())
        
        # TODO: 其他处理器将在后续实现
        # self.register(SubTaskType.DANMAKU, DanmakuHandler())
        # self.register(SubTaskType.COVER, CoverHandler())
        # self.register(SubTaskType.NFO, NfoHandler())
        
        logger.info(f"✅ 注册了 {len(self._handlers)} 个子任务处理器")
    
    def register(self, subtask_type: SubTaskType, handler: BaseHandler):
        """注册处理器"""
        self._handlers[subtask_type] = handler
        logger.info(f"📝 注册处理器: {subtask_type.value} -> {handler.__class__.__name__}")
    
    def get_handler(self, subtask_type: SubTaskType) -> Optional[BaseHandler]:
        """获取处理器"""
        return self._handlers.get(subtask_type)
    
    def get_all_handlers(self) -> Dict[SubTaskType, BaseHandler]:
        """获取所有处理器"""
        return self._handlers.copy()
    
    def is_supported(self, subtask_type: SubTaskType) -> bool:
        """检查是否支持某种子任务类型"""
        return subtask_type in self._handlers


# 全局处理器注册表实例
handler_registry = HandlerRegistry()