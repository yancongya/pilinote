import os
import httpx
from typing import List, Optional
from .providers import BaseLLMClient, LLMMessage, LLMResponse, LLMProvider


class OllamaClient(BaseLLMClient):
    """Ollama 客户端"""

    def __init__(
        self, api_key: Optional[str] = None, base_url: Optional[str] = None, **kwargs
    ):
        self.base_url = base_url or os.getenv(
            "OLLAMA_BASE_URL", "http://localhost:11434"
        )
        self.api_key = api_key  # Ollama 通常不需要 api_key

    def chat(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        model = model or "llama2"

        ollama_messages = [{"role": m.role, "content": m.content} for m in messages]

        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": ollama_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens or 256,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()

        return LLMResponse(
            content=data.get("message", {}).get("content", ""),
            model=model,
            usage=data.get("usage"),
            finish_reason=data.get("done_reason"),
        )

    def chat_stream(
        self,
        messages: List[LLMMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ):
        model = model or "llama2"

        ollama_messages = [{"role": m.role, "content": m.content} for m in messages]

        with httpx.Client(timeout=120.0) as client:
            with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": ollama_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens or 256,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                for chunk in response.iter_text():
                    if chunk:
                        for line in chunk.strip().split("\n"):
                            if line:
                                try:
                                    data = eval(line)
                                    if (
                                        "message" in data
                                        and "content" in data["message"]
                                    ):
                                        yield data["message"]["content"]
                                except:
                                    pass
