import os
from typing import List, Optional, Generator
from anthropic import Anthropic
from .providers import BaseLLMClient, LLMMessage, LLMResponse


class ClaudeClient(BaseLLMClient):
    """Claude 客户端"""

    def __init__(self, api_key: Optional[str] = None, **kwargs):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is required")
        self.timeout = kwargs.get("timeout", 120.0)
        self.client = Anthropic(api_key=self.api_key, timeout=self.timeout)

    def chat(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        model = model or "claude-3-haiku-20240307"

        # 将 messages 转换为 Anthropic 格式
        # system 消息需要特殊处理
        system_content = None
        anthropic_messages = []

        for msg in messages:
            if msg.role == "system":
                system_content = msg.content
            else:
                anthropic_messages.append({"role": msg.role, "content": msg.content})

        response = self.client.messages.create(
            model=model,
            messages=anthropic_messages,
            system=system_content,
            temperature=temperature,
            max_tokens=max_tokens or 4096,
            timeout=self.timeout,
            **kwargs,
        )

        return LLMResponse(
            content=response.content[0].text,
            model=model,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens
                + response.usage.output_tokens,
            },
            finish_reason=response.stop_reason,
        )

    def chat_stream(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Generator[str, None, None]:
        model = model or "claude-3-haiku-20240307"

        system_content = None
        anthropic_messages = []

        for msg in messages:
            if msg.role == "system":
                system_content = msg.content
            else:
                anthropic_messages.append({"role": msg.role, "content": msg.content})

        with self.client.messages.stream(
            model=model,
            messages=anthropic_messages,
            system=system_content,
            temperature=temperature,
            max_tokens=max_tokens or 4096,
            timeout=self.timeout,
            **kwargs,
        ) as stream:
            for text in stream.text_stream:
                yield text
