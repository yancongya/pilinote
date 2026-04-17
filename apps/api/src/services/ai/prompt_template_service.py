import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)


class PromptTemplateService:
    """本地 AI Prompt 模板存储服务。

    读取顺序：
    1. 默认模板文件
    2. 本地覆盖文件
    3. 深度合并后作为当前生效模板
    """

    BASE_DIR = Path(__file__).resolve().parents[3] / "data"
    DEFAULT_PATH = BASE_DIR / "ai_prompt_templates.default.json"
    OVERRIDE_PATH = BASE_DIR / "ai_prompt_templates.json"

    def get_templates(self) -> Dict[str, Any]:
        default_templates = self._read_json(self.DEFAULT_PATH)
        override_templates = self._read_json(self.OVERRIDE_PATH)
        return self._deep_merge(default_templates, override_templates)

    def get_default_templates(self) -> Dict[str, Any]:
        return self._read_json(self.DEFAULT_PATH)

    def get_override_templates(self) -> Dict[str, Any]:
        return self._read_json(self.OVERRIDE_PATH)

    def save_templates(self, templates: Dict[str, Any]) -> None:
        self.OVERRIDE_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.OVERRIDE_PATH.write_text(
            json.dumps(templates, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def reset_templates(self) -> None:
        if self.OVERRIDE_PATH.exists():
            self.OVERRIDE_PATH.unlink()

    def _read_json(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                return {}
            data = json.loads(raw)
            if isinstance(data, dict):
                return data
            logger.warning("Prompt template file is not a JSON object: %s", path)
            return {}
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse prompt template file %s: %s", path, exc)
            return {}

    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        merged = deepcopy(base)
        for key, value in override.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._deep_merge(merged[key], value)
            else:
                merged[key] = deepcopy(value)
        return merged


_prompt_template_service = PromptTemplateService()


def get_prompt_template_service() -> PromptTemplateService:
    return _prompt_template_service
