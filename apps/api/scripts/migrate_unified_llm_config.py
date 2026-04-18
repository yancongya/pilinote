#!/usr/bin/env python3
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from src.database import SessionLocal
from src.services.ai.ai_runtime_state_service import get_ai_runtime_state_service
from src.services.settings_service import SettingsService

DATA_DIR = API_ROOT / "data"
MIGRATION_MARKER_FILE = DATA_DIR / "llm_config.migration.json"
MIGRATION_VERSION = 1
LLM_KEYS = ("provider", "base_url", "model", "api_key", "temperature")


def load_marker() -> Dict[str, Any]:
    if not MIGRATION_MARKER_FILE.exists():
        return {}
    try:
        return json.loads(MIGRATION_MARKER_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("读取统一 LLM 迁移 marker 失败，继续执行: %s", exc)
        return {}


def write_marker(payload: Dict[str, Any]) -> None:
    tmp_path = MIGRATION_MARKER_FILE.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(MIGRATION_MARKER_FILE)


def _get_value(settings_service: SettingsService, key: str, default: Any = "") -> Any:
    setting = settings_service.get_setting(key)
    if not setting or setting.value is None:
        return default
    return setting.value


def _parse_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _collect_llm_payload(settings_service: SettingsService) -> Dict[str, Any]:
    unified_payload = {
        "provider": _get_value(settings_service, "llm.provider", "").strip(),
        "base_url": _get_value(settings_service, "llm.base_url", "").strip(),
        "model": _get_value(settings_service, "llm.model", "").strip(),
        "api_key": _get_value(settings_service, "llm.api_key", "").strip(),
        "temperature": _parse_float(_get_value(settings_service, "llm.temperature", ""), 0.7),
    }

    legacy_payload = {
        "provider": _get_value(settings_service, "ai_note.llm.provider", "").strip(),
        "base_url": _get_value(settings_service, "ai_note.llm.base_url", "").strip(),
        "model": _get_value(settings_service, "ai_note.llm.model", "").strip(),
        "api_key": _get_value(settings_service, "ai_note.llm.api_key", "").strip(),
        "temperature": _parse_float(_get_value(settings_service, "ai_note.llm.temperature", ""), 0.7),
    }

    final_payload: Dict[str, Any] = {}
    for key in LLM_KEYS:
        value = unified_payload.get(key)
        if value not in ("", None):
            final_payload[key] = value
            continue

        legacy_value = legacy_payload.get(key)
        if legacy_value not in ("", None):
            final_payload[key] = legacy_value
            continue

        if key == "provider":
            final_payload[key] = "openai"
        elif key == "model":
            final_payload[key] = "gpt-4o-mini"
        elif key == "temperature":
            final_payload[key] = 0.7
        else:
            final_payload[key] = ""

    return final_payload


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    marker = load_marker()
    if marker.get("version") == MIGRATION_VERSION and marker.get("completed_at"):
        logger.info(
            "统一 LLM 配置迁移已完成于 %s", marker.get("completed_at")
        )
        return 0

    db = SessionLocal()
    try:
        settings_service = SettingsService(db)
        runtime_service = get_ai_runtime_state_service()

        llm_payload = _collect_llm_payload(settings_service)
        logger.info("Migrating unified LLM config: %s", llm_payload)
        settings_service.update_settings(
            {
                "llm": dict(llm_payload),
                "ai_note": {
                    "llm": dict(llm_payload),
                },
            }
        )

        legacy_tested = settings_service.get_setting("ai_note.llm.tested_models")
        if legacy_tested and legacy_tested.value:
            try:
                tested_models = json.loads(legacy_tested.value)
            except json.JSONDecodeError:
                tested_models = {}
            if tested_models:
                runtime_service.set_tested_models(tested_models)
        if legacy_tested:
            db.delete(legacy_tested)
            db.commit()

        marker_payload = {
            "version": MIGRATION_VERSION,
            "completed_at": runtime_service.get_state().get("updated_at"),
            "source": "db.ai_note.llm.*,db.ai_note.llm.tested_models",
            "payload": llm_payload,
        }
        write_marker(marker_payload)
        logger.info("统一 LLM 配置迁移完成")
        return 0
    except Exception as exc:
        db.rollback()
        logger.error("统一 LLM 配置迁移失败: %s", exc, exc_info=True)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
