from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import logging

from src.llm.factory import LLMClientFactory
from src.llm.providers import LLMProvider

router = APIRouter(prefix="/api/ai", tags=["ai"])
logger = logging.getLogger(__name__)


class TestModelRequest(BaseModel):
    """模型测试请求"""

    provider: str = Field(..., description="LLM 提供商 ID")
    model: str = Field(..., description="模型名称")
    baseUrl: Optional[str] = Field(None, description="自定义 Base URL")
    apiKey: Optional[str] = Field(None, description="API Key")


class TestModelResponse(BaseModel):
    """模型测试响应"""

    success: bool = True
    message: str = "测试通过"
    model: str
    provider: str


@router.post("/test-model", response_model=TestModelResponse)
async def test_model(request: TestModelRequest):
    """测试模型连通性"""
    try:
        provider_id = request.provider.lower()

        # 映射 provider 字符串到枚举
        provider_map = {
            "openai": LLMProvider.OPENAI,
            "claude": LLMProvider.CLAUDE,
            "deepseek": LLMProvider.DEEPSEEK,
            "qwen": LLMProvider.QWEN,
            "ollama": LLMProvider.OLLAMA,
        }

        provider_enum = provider_map.get(provider_id)
        if not provider_enum:
            raise HTTPException(
                status_code=400, detail=f"不支持的提供商: {request.provider}"
            )

        # 创建客户端
        client = LLMClientFactory.create_client(
            provider_enum,
            api_key=request.apiKey,
            base_url=request.baseUrl,
        )

        # 简单的测试消息
        from src.llm.providers import LLMMessage

        test_messages = [
            LLMMessage(role="user", content="Say 'OK' if you receive this message."),
        ]

        # 尝试调用
        response = client.chat(
            messages=test_messages,
            model=request.model,
            temperature=0.1,
            max_tokens=10,
        )

        logger.info(f"模型测试成功: {request.provider}/{request.model}")

        return TestModelResponse(
            success=True,
            message="测试通过",
            model=request.model,
            provider=request.provider,
        )

    except Exception as e:
        logger.error(f"模型测试失败: {request.provider}/{request.model} - {str(e)}")
        raise HTTPException(status_code=400, detail=f"测试失败: {str(e)}")


@router.get("/models/{provider}")
async def get_provider_models(provider: str):
    """获取提供商模型列表（主要是 Ollama）"""
    try:
        provider_id = provider.lower()

        if provider_id == "ollama":
            import httpx

            base_url = "http://localhost:11434"
            try:
                response = httpx.get(f"{base_url}/api/tags", timeout=10.0)
                response.raise_for_status()
                data = response.json()
                models = [m.get("name") for m in data.get("models", [])]
                return {"success": True, "models": models}
            except Exception as e:
                raise HTTPException(
                    status_code=400, detail=f"无法连接 Ollama: {str(e)}"
                )

        raise HTTPException(status_code=400, detail=f"不支持的提供商: {provider}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模型列表失败: {provider} - {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
