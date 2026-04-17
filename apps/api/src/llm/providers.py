from enum import Enum
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional


class LLMProvider(str, Enum):
    """LLM 提供商枚举"""

    OPENAI = "openai"
    CLAUDE = "claude"
    DEEPSEEK = "deepseek"
    QWEN = "qwen"
    OLLAMA = "ollama"
    CUSTOM = "custom"


@dataclass
class LLMMessage:
    """LLM 消息"""

    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMResponse:
    """LLM 响应"""

    content: str
    model: str
    usage: Optional[Dict[str, int]] = None
    finish_reason: Optional[str] = None


class BaseLLMClient(ABC):
    """LLM 客户端抽象基类"""

    @abstractmethod
    def chat(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """发送聊天请求"""
        pass

    @abstractmethod
    def chat_stream(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ):
        """流式聊天请求"""
        pass
