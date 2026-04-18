#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from src.services.ai.ai_runtime_state_service import get_ai_runtime_state_service
from src.services.ai.local_asr_model_service import get_local_asr_model_service


def main() -> int:
    runtime_service = get_ai_runtime_state_service()
    asr_service = get_local_asr_model_service()

    runtime_state = runtime_service.get_state()
    local_asr_state = asr_service.to_list_response()

    print(json.dumps({
        "ai_runtime_state": runtime_state,
        "local_asr_active_model": local_asr_state.active_model.model_id,
        "local_asr_ready": local_asr_state.ready,
        "local_asr_models": {
            model.model_id: {
                "download_state": model.download_state,
                "ready": model.ready,
                "active": model.active,
            }
            for model in local_asr_state.models
        },
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
