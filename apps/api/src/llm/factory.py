import os
from typing import Optional, Dict, Any
from .providers import LLMProvider, BaseLLMClient
from .openai_client import OpenAIClient
from .claude_client import ClaudeClient
from .deepseek_client import DeepSeekClient
from .ollama_client import OllamaClient


class LLMClientFactory:
    """LLM 客户端工厂"""

    _clients: Dict[LLMProvider, type] = {
        LLMProvider.OPENAI: OpenAIClient,
        LLMProvider.CLAUDE: ClaudeClient,
        LLMProvider.DEEPSEEK: DeepSeekClient,
        LLMProvider.OLLAMA: OllamaClient,
    }

    @staticmethod
    def create_client(
        provider: LLMProvider,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs,
    ) -> BaseLLMClient:
        """创建 LLM 客户端"""
        client_class = LLMClientFactory._clients.get(provider)
        if not client_class:
            raise ValueError(f"Unsupported provider: {provider}")

        # 根据 provider 获取对应的环境变量（只有没有传入api_key时才从环境变量获取）
        if not api_key:
            if provider == LLMProvider.OPENAI:
                api_key = os.getenv("OPENAI_API_KEY")
            elif provider == LLMProvider.CLAUDE:
                api_key = os.getenv("ANTHROPIC_API_KEY")
            elif provider == LLMProvider.DEEPSEEK:
                api_key = os.getenv("DEEPSEEK_API_KEY")
        # Ollama 不需要 api_key

        return client_class(api_key=api_key, base_url=base_url, **kwargs)
