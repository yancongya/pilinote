from __future__ import annotations

import json
import logging
import shutil
import threading
import tempfile
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from huggingface_hub import snapshot_download

from src.schemas.local_asr_models import (
    LocalASRModelInfo,
    LocalASRModelListResponse,
    LocalASRModelProgressResponse,
    LocalASRModelActionResponse,
    LocalASRReadinessResponse,
)

logger = logging.getLogger(__name__)

API_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = API_ROOT / "data"
CACHE_DIR = DATA_DIR / "asr_models"
STATE_FILE = DATA_DIR / "local_asr_models.json"


LOCAL_ASR_REGISTRY: List[Dict[str, Any]] = [
    {
        "model_id": "tiny",
        "name": "Tiny",
        "repo_id": "Systran/faster-whisper-tiny",
        "description": "体积最小，下载最快，适合先验证链路。",
        "size_bytes": 75 * 1024 * 1024,
        "size_label": "~75 MB",
        "device": "auto",
        "compute_type": "auto",
    },
    {
        "model_id": "base",
        "name": "Base",
        "repo_id": "Systran/faster-whisper-base",
        "description": "默认平衡方案，体积和效果折中。",
        "size_bytes": 142 * 1024 * 1024,
        "size_label": "~142 MB",
        "device": "auto",
        "compute_type": "auto",
    },
    {
        "model_id": "small",
        "name": "Small",
        "repo_id": "Systran/faster-whisper-small",
        "description": "更好的识别质量，仍然适合多数机器。",
        "size_bytes": 466 * 1024 * 1024,
        "size_label": "~466 MB",
        "device": "auto",
        "compute_type": "auto",
    },
    {
        "model_id": "medium",
        "name": "Medium",
        "repo_id": "Systran/faster-whisper-medium",
        "description": "更高质量，但占用更大。",
        "size_bytes": 1530 * 1024 * 1024,
        "size_label": "~1.5 GB",
        "device": "auto",
        "compute_type": "auto",
    },
    {
        "model_id": "large-v3",
        "name": "Large v3",
        "repo_id": "Systran/faster-whisper-large-v3",
        "description": "最高精度，适合资源充足环境。",
        "size_bytes": 3090 * 1024 * 1024,
        "size_label": "~3.1 GB",
        "device": "auto",
        "compute_type": "auto",
    },
]


@dataclass
class ASRModelRuntimeState:
    download_state: str = "not_downloaded"
    progress: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    ready: bool = False
    active: bool = False
    updated_at: str = ""
    error: Optional[str] = None


class LocalASRModelNotReadyError(RuntimeError):
    def __init__(self, model: LocalASRModelInfo, message: str):
        self.model = model
        self.message = message
        super().__init__(message)


class LocalASRModelService:
    """本地 faster-whisper 模型管理服务。"""

    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="asr-model")
        self._download_futures: Dict[str, Future] = {}
        self._state = self._load_state()
        self._ensure_state_defaults()
        self._sync_disk_state()
        self._save_state()
        self._resume_pending_downloads()

    def _load_state(self) -> Dict[str, Any]:
        if not STATE_FILE.exists():
            return {"active_model_id": "base", "models": {}}
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("state file must be a JSON object")
            return data
        except Exception as exc:
            logger.warning("加载本地 ASR 状态失败，使用默认状态: %s", exc)
            return {"active_model_id": "base", "models": {}}

    def _ensure_state_defaults(self) -> None:
        self._state.setdefault("active_model_id", "base")
        self._state.setdefault("models", {})
        for item in LOCAL_ASR_REGISTRY:
            self._state["models"].setdefault(item["model_id"], ASRModelRuntimeState().__dict__.copy())

    def _sync_disk_state(self) -> None:
        for item in LOCAL_ASR_REGISTRY:
            model_id = item["model_id"]
            state = self._state["models"].setdefault(model_id, ASRModelRuntimeState().__dict__.copy())
            cache_path = self.get_cache_path(model_id)
            state["active"] = model_id == self._state.get("active_model_id", "base")
            state["updated_at"] = state.get("updated_at") or self._now()
            if cache_path.exists() and any(cache_path.iterdir()):
                if state.get("download_state") in {"not_downloaded", "failed"}:
                    state["download_state"] = "ready"
                state["ready"] = True
                state["progress"] = 100.0
            else:
                if state.get("download_state") == "ready":
                    state["download_state"] = "not_downloaded"
                state["ready"] = False
                if state.get("download_state") != "downloading":
                    state["progress"] = 0.0

    def _save_state(self) -> None:
        tmp_path = STATE_FILE.with_suffix(".json.tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(self._state, f, ensure_ascii=False, indent=2)
        tmp_path.replace(STATE_FILE)

    def _resume_pending_downloads(self) -> None:
        with self._lock:
            pending_model_ids = [
                item["model_id"]
                for item in LOCAL_ASR_REGISTRY
                if self._state["models"].get(item["model_id"], {}).get("download_state") == "downloading"
                and not self._state["models"].get(item["model_id"], {}).get("ready", False)
                and not self._download_futures.get(item["model_id"])
            ]
            for model_id in pending_model_ids:
                self._download_futures[model_id] = self._executor.submit(self._download_worker, model_id)
                logger.info("恢复本地 ASR 模型下载任务: %s", model_id)

    def _now(self) -> str:
        return datetime.utcnow().isoformat()

    def _get_registry_item(self, model_id: str) -> Dict[str, Any]:
        for item in LOCAL_ASR_REGISTRY:
            if item["model_id"] == model_id:
                return item
        raise ValueError(f"未知的本地 ASR 模型: {model_id}")

    def get_cache_path(self, model_id: str) -> Path:
        return CACHE_DIR / model_id

    def _build_model_info(self, model_id: str) -> LocalASRModelInfo:
        item = self._get_registry_item(model_id)
        state = self._state["models"].setdefault(model_id, ASRModelRuntimeState().__dict__.copy())
        cache_path = self.get_cache_path(model_id)
        ready = bool(state.get("ready")) and cache_path.exists() and any(cache_path.iterdir())
        if ready != bool(state.get("ready")):
            state["ready"] = ready
            if ready:
                state["download_state"] = "ready"
                state["progress"] = 100.0
            elif state.get("download_state") == "ready":
                state["download_state"] = "not_downloaded"
                state["progress"] = 0.0
            state["updated_at"] = self._now()
        active = model_id == self._state.get("active_model_id", "base")
        state["active"] = active
        if not ready and state.get("download_state") == "ready":
            state["download_state"] = "not_downloaded"
        return LocalASRModelInfo(
            model_id=model_id,
            name=item["name"],
            repo_id=item["repo_id"],
            description=item["description"],
            size_bytes=item["size_bytes"],
            size_label=item["size_label"],
            cache_path=str(cache_path),
            download_state=state.get("download_state", "not_downloaded"),
            progress=float(state.get("progress", 0.0) or 0.0),
            downloaded_bytes=int(state.get("downloaded_bytes", 0) or 0),
            total_bytes=int(state.get("total_bytes", 0) or 0),
            ready=bool(state.get("ready", False)),
            active=active,
            error=state.get("error"),
            updated_at=state.get("updated_at"),
        )

    def _update_state(
        self,
        model_id: str,
        **updates: Any,
    ) -> LocalASRModelInfo:
        with self._lock:
            state = self._state["models"].setdefault(model_id, ASRModelRuntimeState().__dict__.copy())
            state.update(updates)
            state["updated_at"] = self._now()
            self._save_state()
            return self._build_model_info(model_id)

    def list_models(self) -> List[LocalASRModelInfo]:
        with self._lock:
            self._sync_disk_state()
            self._save_state()
            return [self._build_model_info(item["model_id"]) for item in LOCAL_ASR_REGISTRY]

    def get_active_model(self) -> LocalASRModelInfo:
        with self._lock:
            self._sync_disk_state()
            self._save_state()
            active_model_id = self._state.get("active_model_id", "base")
            if active_model_id not in {item["model_id"] for item in LOCAL_ASR_REGISTRY}:
                active_model_id = "base"
                self._state["active_model_id"] = active_model_id
            active_model = self._build_model_info(active_model_id)
            if active_model.ready:
                return active_model

            fallback_model_id = next(
                (
                    item["model_id"]
                    for item in LOCAL_ASR_REGISTRY
                    if self._state["models"].get(item["model_id"], {}).get("ready", False)
                ),
                None,
            )
            if fallback_model_id and fallback_model_id != active_model_id:
                self._state["active_model_id"] = fallback_model_id
                for item in LOCAL_ASR_REGISTRY:
                    model_state = self._state["models"].setdefault(
                        item["model_id"], ASRModelRuntimeState().__dict__.copy()
                    )
                    model_state["active"] = item["model_id"] == fallback_model_id
                self._save_state()
                return self._build_model_info(fallback_model_id)

            return active_model

    def set_active_model(self, model_id: str) -> LocalASRModelInfo:
        with self._lock:
            self._get_registry_item(model_id)
            self._state["active_model_id"] = model_id
            for item in LOCAL_ASR_REGISTRY:
                self._state["models"].setdefault(item["model_id"], ASRModelRuntimeState().__dict__.copy())
                self._state["models"][item["model_id"]]["active"] = item["model_id"] == model_id
            self._save_state()
            return self._build_model_info(model_id)

    def get_model(self, model_id: str) -> LocalASRModelInfo:
        with self._lock:
            self._get_registry_item(model_id)
            self._sync_disk_state()
            self._save_state()
            return self._build_model_info(model_id)

    def get_progress(self, model_id: str) -> LocalASRModelInfo:
        return self.get_model(model_id)

    def ensure_active_model_ready(self) -> LocalASRModelInfo:
        active_model = self.get_active_model()
        if not active_model.ready:
            message = (
                f"本地 ASR 模型未就绪: {active_model.name} "
                f"({active_model.model_id})，请先下载模型后再进行 AI 分析"
            )
            raise LocalASRModelNotReadyError(active_model, message)
        return active_model

    def download_model(self, model_id: str) -> LocalASRModelInfo:
        with self._lock:
            self._get_registry_item(model_id)
            current = self._build_model_info(model_id)
            if current.ready:
                return current
            future = self._download_futures.get(model_id)
            if future and not future.done():
                return self._update_state(model_id, download_state="downloading")

            self._update_state(
                model_id,
                download_state="downloading",
                progress=0.0,
                downloaded_bytes=0,
                total_bytes=0,
                error=None,
                ready=False,
            )
            self._download_futures[model_id] = self._executor.submit(self._download_worker, model_id)
            return self._build_model_info(model_id)

    def _download_worker(self, model_id: str) -> None:
        item = self._get_registry_item(model_id)
        repo_id = item["repo_id"]
        cache_path = self.get_cache_path(model_id)
        cache_path.mkdir(parents=True, exist_ok=True)

        try:
            self._update_state(
                model_id,
                download_state="downloading",
                progress=0.0,
                downloaded_bytes=0,
                total_bytes=item["size_bytes"],
                error=None,
                ready=False,
            )

            with tempfile.TemporaryDirectory(prefix=f"{model_id}-", dir=str(CACHE_DIR)) as tmp_dir:
                snapshot_path = snapshot_download(
                    repo_id=repo_id,
                    repo_type="model",
                    local_dir=tmp_dir,
                    local_dir_use_symlinks=False,
                    resume_download=True,
                    allow_patterns=["*.bin", "*.safetensors", "*.json", "*.txt", "*.model", "*.tok", "*.vocab", "*.merges"],
                )

                snapshot_source = Path(snapshot_path)
                for item_path in snapshot_source.rglob("*"):
                    if not item_path.is_file():
                        continue
                    relative_path = item_path.relative_to(snapshot_source)
                    target_path = cache_path / relative_path
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    if target_path.exists():
                        if target_path.is_dir():
                            shutil.rmtree(target_path)
                        else:
                            target_path.unlink()
                    shutil.move(str(item_path), str(target_path))

            downloaded_bytes = item["size_bytes"]
            self._update_state(
                model_id,
                download_state="ready",
                progress=100.0,
                downloaded_bytes=downloaded_bytes,
                total_bytes=downloaded_bytes,
                error=None,
                ready=True,
            )
            logger.info("本地 ASR 模型下载完成: %s", model_id)
        except Exception as exc:
            logger.error("本地 ASR 模型下载失败: %s - %s", model_id, exc, exc_info=True)
            self._update_state(
                model_id,
                download_state="failed",
                progress=0.0,
                error=str(exc),
                ready=False,
            )

    def delete_cached_model(self, model_id: str) -> LocalASRModelInfo:
        with self._lock:
            self._get_registry_item(model_id)
            cache_path = self.get_cache_path(model_id)
            if cache_path.exists():
                shutil.rmtree(cache_path)
            self._update_state(
                model_id,
                download_state="not_downloaded",
                progress=0.0,
                downloaded_bytes=0,
                total_bytes=0,
                ready=False,
                error=None,
            )
            return self._build_model_info(model_id)

    def to_list_response(self) -> LocalASRModelListResponse:
        models = self.list_models()
        active_model = self.get_active_model()
        return LocalASRModelListResponse(
            active_model_id=active_model.model_id,
            active_model=active_model,
            ready=active_model.ready,
            models=models,
        )

    def to_readiness_response(self) -> LocalASRReadinessResponse:
        try:
            model = self.get_active_model()
            return LocalASRReadinessResponse(
                ready=model.ready,
                active_model_id=model.model_id,
                model=model,
            )
        except Exception as exc:
            return LocalASRReadinessResponse(
                ready=False,
                message=str(exc),
            )


_local_asr_model_service = LocalASRModelService()


def get_local_asr_model_service() -> LocalASRModelService:
    return _local_asr_model_service
