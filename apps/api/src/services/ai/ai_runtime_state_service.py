from __future__ import annotations

import json
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

API_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = API_ROOT / "data"
RUNTIME_STATE_FILE = DATA_DIR / "ai_runtime_state.json"
RUNTIME_STATE_VERSION = 1


def _now() -> str:
    return datetime.utcnow().isoformat()


def _normalize_tested_models(value: Any) -> Dict[str, list[str]]:
    if not isinstance(value, dict):
        return {}

    normalized: Dict[str, list[str]] = {}
    for provider, models in value.items():
        if not isinstance(provider, str) or not provider:
            continue
        if isinstance(models, list):
            normalized[provider] = [str(model) for model in models if str(model).strip()]
    return normalized


class AiRuntimeStateService:
    """AI 运行态缓存服务。"""

    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._state = self._load_state()

    def _default_state(self) -> Dict[str, Any]:
        return {
            "version": RUNTIME_STATE_VERSION,
            "updated_at": _now(),
            "tested_models": {},
        }

    def _load_state(self) -> Dict[str, Any]:
        if not RUNTIME_STATE_FILE.exists():
            return self._default_state()

        try:
            with open(RUNTIME_STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("runtime state must be a JSON object")
        except Exception as exc:
            logger.warning("加载 AI runtime state 失败，使用默认状态: %s", exc)
            return self._default_state()

        state = self._default_state()
        state.update(data)
        state["version"] = int(state.get("version") or RUNTIME_STATE_VERSION)
        state["updated_at"] = str(state.get("updated_at") or _now())
        state["tested_models"] = _normalize_tested_models(state.get("tested_models", {}))
        return state

    def _save_state(self) -> None:
        tmp_path = RUNTIME_STATE_FILE.with_suffix(".json.tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(self._state, f, ensure_ascii=False, indent=2)
        tmp_path.replace(RUNTIME_STATE_FILE)

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "version": int(self._state.get("version", RUNTIME_STATE_VERSION)),
                "updated_at": self._state.get("updated_at", ""),
                "tested_models": self.get_tested_models(),
            }

    def get_tested_models(self) -> Dict[str, list[str]]:
        with self._lock:
            return {
                provider: list(models)
                for provider, models in _normalize_tested_models(self._state.get("tested_models", {})).items()
            }

    def set_tested_models(self, tested_models: Dict[str, list[str]]) -> Dict[str, list[str]]:
        with self._lock:
            self._state["tested_models"] = _normalize_tested_models(tested_models)
            self._state["version"] = RUNTIME_STATE_VERSION
            self._state["updated_at"] = _now()
            self._save_state()
            return self.get_tested_models()

    def merge_tested_model(self, provider: str, model: str) -> Dict[str, list[str]]:
        with self._lock:
            tested_models = self.get_tested_models()
            provider_key = str(provider).strip()
            model_name = str(model).strip()
            if provider_key and model_name:
                tested_models.setdefault(provider_key, [])
                if model_name not in tested_models[provider_key]:
                    tested_models[provider_key].append(model_name)
            return self.set_tested_models(tested_models)

    def clear_tested_models(self) -> Dict[str, list[str]]:
        return self.set_tested_models({})


_ai_runtime_state_service = AiRuntimeStateService()


def get_ai_runtime_state_service() -> AiRuntimeStateService:
    return _ai_runtime_state_service
