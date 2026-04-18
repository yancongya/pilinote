#!/usr/bin/env python3
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from src.database import SessionLocal
from src.services.ai.ai_runtime_state_service import get_ai_runtime_state_service
from src.services.settings_service import SettingsService

DATA_DIR = API_ROOT / "data"
MIGRATION_MARKER_FILE = DATA_DIR / "ai_runtime_state.migration.json"
MIGRATION_VERSION = 2


def load_marker() -> dict:
    if not MIGRATION_MARKER_FILE.exists():
        return {}
    try:
        return json.loads(MIGRATION_MARKER_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("读取迁移 marker 失败，继续执行: %s", exc)
        return {}


def write_marker(payload: dict) -> None:
    tmp_path = MIGRATION_MARKER_FILE.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(MIGRATION_MARKER_FILE)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    marker = load_marker()
    if marker.get("version") == MIGRATION_VERSION and marker.get("completed_at"):
        logger.info("AI config/state migration already completed at %s", marker.get("completed_at"))
        return 0

    db = SessionLocal()
    try:
        settings_service = SettingsService(db)
        runtime_service = get_ai_runtime_state_service()

        legacy_setting = settings_service.get_setting("ai_note.llm.tested_models")
        legacy_value = {}
        if legacy_setting and legacy_setting.value:
            try:
                legacy_value = json.loads(legacy_setting.value)
            except json.JSONDecodeError:
                legacy_value = {}

        if legacy_value:
            logger.info("Migrating tested_models into runtime cache: %s", legacy_value)
            runtime_service.set_tested_models(legacy_value)
        else:
            logger.info("No legacy tested_models found in DB, ensuring runtime cache exists")
            runtime_service.set_tested_models(runtime_service.get_tested_models())

        if legacy_setting and legacy_setting.value != json.dumps({}):
            legacy_setting.value = json.dumps({})
            db.commit()
            db.refresh(legacy_setting)

        legacy_style_setting = settings_service.get_setting("ai_note.style.style")
        if legacy_style_setting and legacy_style_setting.value != "":
            legacy_style_setting.value = ""
            db.commit()
            db.refresh(legacy_style_setting)

        write_marker(
            {
                "version": MIGRATION_VERSION,
                "completed_at": runtime_service.get_state().get("updated_at"),
                "source": "db.ai_note.llm.tested_models,db.ai_note.style.style",
            }
        )
        logger.info("AI config/state migration completed")
        return 0
    except Exception as exc:
        db.rollback()
        logger.error("AI config/state migration failed: %s", exc, exc_info=True)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
