import os
from typing import List, Optional, Generator
from openai import OpenAI
from .providers import BaseLLMClient, LLMMessage, LLMResponse, LLMProvider


class OpenAIClient(BaseLLMClient):
    """OpenAI 客户端"""

    def __init__(
        self, api_key: Optional[str] = None, base_url: Optional[str] = None, **kwargs
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.timeout = kwargs.get("timeout", 120.0)
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=base_url
            or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            timeout=self.timeout,
        )

    def chat(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        model = model or "gpt-4o-mini"

        openai_messages = [{"role": m.role, "content": m.content} for m in messages]

        response = self.client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=self.timeout,
            **kwargs,
        )

        return LLMResponse(
            content=response.choices[0].message.content,
            model=response.model,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
            if response.usage
            else None,
            finish_reason=response.choices[0].finish_reason,
        )

    def chat_stream(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> Generator[str, None, None]:
        model = model or "gpt-4o-mini"

        openai_messages = [{"role": m.role, "content": m.content} for m in messages]

        response = self.client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            timeout=self.timeout,
            **kwargs,
        )

        for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
