import json
import logging
from typing import Dict, List, Optional

from src.llm import LLMClientFactory, LLMMessage
from src.llm.providers import LLMProvider
from src.services.ai.task_control import task_control_registry
from src.services.settings_service import SettingsService
from src.database import SessionLocal

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """你是一个字幕编辑助手。请分析以下字幕，找出其中的错别字、语法问题和术语错误。

字幕内容：
{content}

请以JSON格式返回分析结果：
{{
  "issues": [
    {{
      "index": 字幕序号,
      "type": "typo" | "grammar" | "term",
      "text": "问题原文",
      "suggestion": "修正后的文本"
    }}
  ],
  "summary": "整体字幕内容的一句话摘要"
}}

注意：
- index 必须对应字幕的序号
- text 必须与原文中该行字幕文本完全一致
- suggestion 为修正后的完整该行文本（不是只写修改的部分）
- 如果字幕没有问题，返回空的issues数组
"""


class SubtitleAnalyzer:
    """字幕AI分析服务"""

    def __init__(self):
        self.llm_factory = LLMClientFactory()

    async def analyze(
        self,
        subtitle_content: str,
        model_provider: str = "openai",
        model_name: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> Dict:
        """调用AI分析字幕

        Args:
            subtitle_content: SRT格式字幕内容
            model_provider: LLM提供商

        Returns:
            分析结果字典
        """
        try:
            # 从settings获取API key
            db = SessionLocal()
            try:
                settings = SettingsService(db).get_settings()
            finally:
                db.close()
            llm_settings = getattr(settings, "llm", None)

            api_key = None
            base_url = None
            if llm_settings:
                # 先获取全局配置
                api_key = getattr(llm_settings, "api_key", None)
                base_url = getattr(llm_settings, "base_url", None)

                # 从providers中查找匹配的provider配置
                providers = getattr(llm_settings, "providers", []) or []
                matched_provider = next(
                    (
                        item
                        for item in providers
                        if isinstance(item, dict)
                        and str(item.get("id", "")).strip().lower()
                        == model_provider.lower()
                    ),
                    None,
                )
                if matched_provider:
                    # 使用provider的配置覆盖全局配置
                    api_key = (
                        matched_provider.get("apiKey")
                        or matched_provider.get("api_key")
                        or api_key
                    ) or None
                    base_url = (
                        matched_provider.get("baseUrl")
                        or matched_provider.get("base_url")
                        or base_url
                    ) or None

            # 转换provider字符串到枚举
            provider_map = {
                "openai": LLMProvider.OPENAI,
                "claude": LLMProvider.CLAUDE,
                "deepseek": LLMProvider.DEEPSEEK,
                "qwen": LLMProvider.QWEN,
                "ollama": LLMProvider.OLLAMA,
            }
            provider_enum = provider_map.get(model_provider.lower())

            client = self.llm_factory.create_client(
                provider_enum, api_key=api_key, base_url=base_url
            )
            if not client:
                return {
                    "success": False,
                    "error": f"无法创建LLM客户端: {model_provider}",
                }

            # 截取部分字幕进行分析（避免过长）
            lines = subtitle_content.split("\n")
            sample_content = "\n".join(lines[:50])  # 只取前50行

            messages = [
                LLMMessage(
                    role="user", content=ANALYSIS_PROMPT.format(content=sample_content)
                )
            ]

            if task_id and task_control_registry.is_cancelled(task_id):
                raise RuntimeError("分析已取消")

            response_content = ""
            if hasattr(client, "chat_stream"):
                stream = client.chat_stream(
                    messages=messages,
                    temperature=0.3,
                    max_tokens=2000,
                    model=model_name,
                )
                try:
                    for chunk in stream:
                        if task_id and task_control_registry.is_cancelled(task_id):
                            raise RuntimeError("分析已取消")
                        if chunk:
                            response_content += chunk
                finally:
                    close_stream = getattr(stream, "close", None)
                    if callable(close_stream):
                        close_stream()
            else:
                response = client.chat(
                    messages=messages, temperature=0.3, max_tokens=2000, model=model_name
                )
                if not response or not response.content:
                    return {"success": False, "error": "LLM返回为空"}
                response_content = response.content

            if not response_content:
                return {"success": False, "error": "LLM返回为空"}

            # 解析JSON响应
            try:
                # 清理可能存在的markdown代码块
                content = response_content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
                
                result = json.loads(content)
                return {
                    "success": True,
                    "issues": result.get("issues", []),
                    "summary": result.get("summary", ""),
                }
            except json.JSONDecodeError:
                return {
                    "success": True,
                    "issues": [],
                    "summary": response_content[:200],
                }

        except Exception as e:
            logger.error(f"字幕分析失败: {e}")
            return {"success": False, "error": str(e)}

    async def check_subtitle_line(
        self, text: str, model_provider: str = "openai"
    ) -> Dict:
        """检查单条字幕文本

        Args:
            text: 字幕文本
            model_provider: LLM提供商

        Returns:
            检查结果
        """
        try:
            client = self.llm_factory.create_client(model_provider)
            if not client:
                return {"success": False, "error": "无法创建LLM客户端"}

            prompt = f"""请检查以下字幕文本是否有错别字或语法问题：

"{text}"

请以JSON格式返回：
{{
  "has_issue": true/false,
  "issue_type": "typo" | "grammar" | null,
  "original": "原文本",
  "corrected": "修正后的文本" (如果没有问题则与原文本相���)
}}
"""

            messages = [LLMMessage(role="user", content=prompt)]

            response = client.chat(messages=messages, temperature=0.1, max_tokens=500)

            if not response or not response.content:
                return {"success": False, "error": "LLM返回为空"}

            try:
                result = json.loads(response.content)
                return {"success": True, **result}
            except json.JSONDecodeError:
                return {"success": False, "error": "无法解析响应"}

        except Exception as e:
            logger.error(f"字幕检查失败: {e}")
            return {"success": False, "error": str(e)}


# 全局实例
subtitle_analyzer = SubtitleAnalyzer()
