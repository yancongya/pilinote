import json
import logging
import inspect
from typing import Any, Dict, List, Optional

from src.llm import LLMClientFactory, LLMMessage
from src.llm.providers import LLMProvider
from src.services.ai.task_control import task_control_registry
from src.services.settings_service import SettingsService
from src.database import SessionLocal
from src.services.ai.subtitle_context import parse_srt_blocks

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT_TEMPLATE = """你是一个字幕编辑助手。请结合视频背景信息分析字幕中的错别字、语法问题和术语错误。

视频背景信息：
- 标题：{title}
- 剧集/别名：{showtitle}
- UP主/厂牌：{studio}
- 时长：{runtime}
- 简介：{intro}
- 剧情/补充：{plot}
- 标签：{tags}
- NFO文本：{nfo_text}

字幕内容：
{content}

请以 JSON 格式返回分析结果，格式必须是：
{{
  "issues": [
    {{
      "index": 1,
      "type": "typo" | "grammar" | "term",
      "text": "原文字幕文本",
      "suggestion": "修正后的完整字幕文本",
      "original_text": "原文字幕文本",
      "corrected_text": "修正后的完整字幕文本",
      "reason": "为什么要修改",
      "confidence": 0.0
    }}
  ],
  "summary": "一句话总结"
}}

要求：
- index 必须对应字幕序号
- text / original_text 必须与原文中的字幕文本一致
- suggestion / corrected_text 必须是该条字幕修正后的完整文本
- 如果字幕没有问题，返回空 issues 数组
- 只返回 JSON，不要输出解释性文字
"""


class SubtitleAnalyzer:
    """字幕AI分析服务"""

    def __init__(self):
        self.llm_factory = LLMClientFactory()

    def parse_subtitle_blocks(self, content: str) -> List[Dict[str, Any]]:
        return parse_srt_blocks(content)

    def plan_batches(
        self,
        blocks: List[Dict[str, Any]],
        batch_size: int = 24,
        overlap: int = 2,
    ) -> List[Dict[str, Any]]:
        return self.build_subtitle_batches(blocks, batch_size=batch_size, overlap=overlap)

    def build_prompt(
        self,
        video_context: Optional[Dict[str, Any]],
        batch_blocks: List[Dict[str, Any]],
        batch_index: int = 1,
        batch_total: int = 1,
    ) -> str:
        return self.build_analysis_prompt(
            video_context=video_context,
            batch_blocks=batch_blocks,
            batch_index=batch_index,
            total_batches=batch_total,
        )

    def merge_issues(self, batch_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        merged_results: List[Dict[str, Any]] = []
        for result in batch_results:
            issues = result.get("issues", [])
            if not isinstance(issues, list):
                continue
            merged_results.extend(
                self.normalize_issue(issue)
                for issue in issues
                if isinstance(issue, dict)
            )

        merged_issues = self.merge_correction_results(merged_results)
        return {
            "issues": merged_issues,
            "summary": (
                f"共合并 {len(batch_results)} 批结果，发现 {len(merged_issues)} 个问题"
                if merged_results
                else "未发现明显问题"
            ),
        }

    @staticmethod
    def build_subtitle_batches(
        blocks: List[Dict[str, Any]],
        batch_size: int = 24,
        overlap: int = 2,
    ) -> List[Dict[str, Any]]:
        if not blocks:
            return []

        batch_size = max(1, batch_size)
        overlap = max(0, min(overlap, batch_size - 1))
        step = max(1, batch_size - overlap)
        batches: List[Dict[str, Any]] = []

        start = 0
        while start < len(blocks):
            end = min(len(blocks), start + batch_size)
            batch_blocks = blocks[start:end]
            batches.append(
                {
                    "batch_index": len(batches) + 1,
                    "blocks": batch_blocks,
                    "start_index": batch_blocks[0]["index"],
                    "end_index": batch_blocks[-1]["index"],
                }
            )
            if end >= len(blocks):
                break
            start += step

        return batches

    @staticmethod
    def normalize_issue(issue: Dict[str, Any]) -> Dict[str, Any]:
        text = issue.get("text") or issue.get("original_text") or ""
        suggestion = issue.get("suggestion") or issue.get("corrected_text") or ""
        normalized = {
            "index": issue.get("index"),
            "type": issue.get("type", "typo"),
            "text": text,
            "suggestion": suggestion,
            "original_text": issue.get("original_text") or text,
            "corrected_text": issue.get("corrected_text") or suggestion,
            "reason": issue.get("reason", ""),
            "confidence": issue.get("confidence", 0.0),
        }
        return normalized

    @staticmethod
    def merge_correction_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        merged: Dict[int, Dict[str, Any]] = {}
        for issue in results:
            try:
                index = int(issue.get("index"))
            except (TypeError, ValueError):
                continue
            current = merged.get(index)
            current_confidence = float(current.get("confidence", 0.0)) if current else -1.0
            incoming_confidence = float(issue.get("confidence", 0.0) or 0.0)
            if current is None or incoming_confidence >= current_confidence:
                merged[index] = issue
        return [merged[index] for index in sorted(merged)]

    @staticmethod
    def build_analysis_prompt(
        video_context: Optional[Dict[str, Any]],
        batch_blocks: List[Dict[str, Any]],
        batch_index: int,
        total_batches: int,
    ) -> str:
        video_context = video_context or {}
        title = video_context.get("title") or video_context.get("showtitle") or ""
        showtitle = video_context.get("showtitle") or ""
        studio = video_context.get("studio") or ""
        runtime = video_context.get("runtime") or ""
        intro = video_context.get("intro") or ""
        plot = video_context.get("plot") or ""
        tags = "、".join(video_context.get("tags") or [])
        nfo_text = video_context.get("nfo_text") or ""

        subtitle_lines = []
        for block in batch_blocks:
            text = (
                block.get("text")
                or block.get("original_text")
                or block.get("raw_text")
                or ""
            )
            start_time = block.get("start_time", "")
            end_time = block.get("end_time", "")
            if not start_time and not end_time and isinstance(block.get("raw_text"), str):
                raw_lines = block["raw_text"].splitlines()
                if len(raw_lines) >= 3 and "-->" in raw_lines[1]:
                    time_parts = raw_lines[1].split("-->", 1)
                    start_time = time_parts[0].strip()
                    end_time = time_parts[1].strip() if len(time_parts) > 1 else ""
            subtitle_lines.append(
                f'{block["index"]}\n{start_time} --> {end_time}\n{text}'
            )

        return ANALYSIS_PROMPT_TEMPLATE.format(
            title=title,
            showtitle=showtitle,
            studio=studio,
            runtime=runtime,
            intro=intro,
            plot=plot,
            tags=tags,
            nfo_text=nfo_text,
            content="\n\n".join(subtitle_lines),
        ) + f"\n\n当前批次：{batch_index}/{total_batches}"

    @staticmethod
    def parse_response_content(response_content: str) -> Dict[str, Any]:
        content = response_content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        parsed = json.loads(content)
        if isinstance(parsed, list):
            return {"issues": parsed, "summary": ""}
        return parsed

    async def analyze(
        self,
        subtitle_content: str,
        model_provider: str = "openai",
        model_name: Optional[str] = None,
        video_context: Optional[Dict[str, Any]] = None,
        subtitle_blocks: Optional[List[Dict[str, Any]]] = None,
        batch_size: int = 24,
        overlap: int = 2,
        task_id: Optional[str] = None,
        progress_callback: Optional[Any] = None,
    ) -> Dict:
        """调用AI分析字幕

        Args:
            subtitle_content: SRT格式字幕内容
            model_provider: LLM提供商

        Returns:
            分析结果字典
        """
        try:
            async def emit_progress(event: Dict[str, Any]) -> None:
                if not progress_callback:
                    return
                result = progress_callback(event)
                if inspect.isawaitable(result):
                    await result

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

            blocks = subtitle_blocks or parse_srt_blocks(subtitle_content)
            batches = self.build_subtitle_batches(blocks, batch_size=batch_size, overlap=overlap)
            if not batches:
                return {
                    "success": True,
                    "issues": [],
                    "summary": "字幕为空，未发现问题",
                    "total_blocks": 0,
                    "total_batches": 0,
                    "covered_blocks": 0,
                }

            all_issues: List[Dict[str, Any]] = []
            parsed_batches = 0
            for batch in batches:
                if task_id and task_control_registry.is_cancelled(task_id):
                    raise RuntimeError("分析已取消")

                logger.info(
                    "[subtitle-analysis] task=%s batch=%s/%s range=%s-%s size=%s",
                    task_id or "none",
                    batch["batch_index"],
                    len(batches),
                    batch["start_index"],
                    batch["end_index"],
                    len(batch["blocks"]),
                )
                prompt = self.build_analysis_prompt(
                    video_context=video_context,
                    batch_blocks=batch["blocks"],
                    batch_index=batch["batch_index"],
                    total_batches=len(batches),
                )
                await emit_progress(
                    {
                        "stage": "AI_ANALYZE",
                        "status": "processing",
                        "data": {
                            "phase": "batch_started",
                            "batch_index": batch["batch_index"],
                            "total_batches": len(batches),
                            "start_index": batch["start_index"],
                            "end_index": batch["end_index"],
                            "batch_size": len(batch["blocks"]),
                            "parsed_batches": parsed_batches,
                            "issues": len(all_issues),
                        },
                    }
                )
                messages = [LLMMessage(role="user", content=prompt)]

                response = client.chat(
                    messages=messages,
                    temperature=0.3,
                    max_tokens=2000,
                    model=model_name,
                )
                if not response or not response.content:
                    logger.warning(
                        "[subtitle-analysis] task=%s batch=%s empty_response",
                        task_id or "none",
                        batch["batch_index"],
                    )
                    return {"success": False, "error": "LLM返回为空"}
                response_content = response.content

                if not response_content:
                    logger.warning(
                        "[subtitle-analysis] task=%s batch=%s empty_response",
                        task_id or "none",
                        batch["batch_index"],
                    )
                    return {"success": False, "error": "LLM返回为空"}

                try:
                    result = self.parse_response_content(response_content)
                    issues = result.get("issues", []) or []
                    all_issues.extend(
                        self.normalize_issue(issue)
                        for issue in issues
                        if isinstance(issue, dict)
                    )
                    parsed_batches += 1
                    await emit_progress(
                        {
                            "stage": "AI_ANALYZE",
                            "status": "processing",
                            "data": {
                                "phase": "batch_completed",
                                "batch_index": batch["batch_index"],
                                "total_batches": len(batches),
                                "start_index": batch["start_index"],
                                "end_index": batch["end_index"],
                                "batch_size": len(batch["blocks"]),
                                "parsed_batches": parsed_batches,
                                "issues": len(all_issues),
                            },
                        }
                    )
                except json.JSONDecodeError:
                    logger.warning(
                        "[subtitle-analysis] task=%s batch=%s invalid_json",
                        task_id or "none",
                        batch["batch_index"],
                    )
                    await emit_progress(
                        {
                            "stage": "AI_ANALYZE",
                            "status": "processing",
                            "data": {
                                "phase": "batch_invalid_json",
                                "batch_index": batch["batch_index"],
                                "total_batches": len(batches),
                                "start_index": batch["start_index"],
                                "end_index": batch["end_index"],
                                "batch_size": len(batch["blocks"]),
                                "parsed_batches": parsed_batches,
                                "issues": len(all_issues),
                            },
                        }
                    )

            merged_issues = self.merge_correction_results(all_issues)
            covered_blocks = len({block["index"] for batch in batches for block in batch["blocks"]})
            summary = (
                f"共分析 {len(batches)} 批，覆盖 {covered_blocks} 条字幕，发现 {len(merged_issues)} 个问题"
                if merged_issues
                else f"共分析 {len(batches)} 批，覆盖 {covered_blocks} 条字幕，未发现明显问题"
            )
            await emit_progress(
                {
                    "stage": "AI_ANALYZE",
                    "status": "completed",
                    "data": {
                        "phase": "analysis_completed",
                        "total_blocks": len(blocks),
                        "total_batches": len(batches),
                        "covered_blocks": covered_blocks,
                        "parsed_batches": parsed_batches,
                        "issues": len(merged_issues),
                    },
                }
            )
            return {
                "success": True,
                "issues": merged_issues,
                "summary": summary,
                "total_blocks": len(blocks),
                "total_batches": len(batches),
                "covered_blocks": covered_blocks,
                "parsed_batches": parsed_batches,
                "video_context": video_context or {},
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
                "corrected": "修正后的文本" (如果没有问题则与原文本相同)
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
