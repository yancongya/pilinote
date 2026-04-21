from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from threading import RLock
from typing import Any, Dict, Optional


@dataclass
class TaskControlRecord:
    task_id: str
    kind: str
    state: str = "running"
    current_stage: Optional[str] = None
    resume_from_stage: Optional[str] = None
    cancelled: bool = False
    created_at: str = ""
    updated_at: str = ""
    extra: Optional[Dict[str, Any]] = None

    def snapshot(self) -> Dict[str, Any]:
        return asdict(self)


class TaskControlRegistry:
    def __init__(self) -> None:
        self._lock = RLock()
        self._records: Dict[str, TaskControlRecord] = {}

    def register(self, task_id: str, kind: str, **kwargs: Any) -> TaskControlRecord:
        now = datetime.utcnow().isoformat()
        with self._lock:
            record = self._records.get(task_id)
            if record is None:
                record = TaskControlRecord(
                    task_id=task_id,
                    kind=kind,
                    created_at=now,
                    updated_at=now,
                )
                self._records[task_id] = record
            record.kind = kind
            record.state = kwargs.get("state", record.state)
            record.current_stage = kwargs.get("current_stage", record.current_stage)
            record.resume_from_stage = kwargs.get(
                "resume_from_stage", record.resume_from_stage
            )
            record.cancelled = kwargs.get("cancelled", record.cancelled)
            record.extra = kwargs.get("extra", record.extra)
            record.updated_at = now
            return record

    def update(self, task_id: str, **kwargs: Any) -> Optional[TaskControlRecord]:
        now = datetime.utcnow().isoformat()
        with self._lock:
            record = self._records.get(task_id)
            if not record:
                return None
            for key, value in kwargs.items():
                if hasattr(record, key) and value is not None:
                    setattr(record, key, value)
            record.updated_at = now
            return record

    def cancel(self, task_id: str) -> bool:
        with self._lock:
            record = self._records.get(task_id)
            if not record:
                return False
            record.state = "cancelled"
            record.cancelled = True
            record.updated_at = datetime.utcnow().isoformat()
            return True

    def get(self, task_id: str) -> Optional[TaskControlRecord]:
        with self._lock:
            return self._records.get(task_id)

    def is_cancelled(self, task_id: Optional[str]) -> bool:
        if not task_id:
            return False
        with self._lock:
            record = self._records.get(task_id)
            return bool(record and (record.cancelled or record.state == "cancelled"))

    def remove(self, task_id: str) -> None:
        with self._lock:
            self._records.pop(task_id, None)


task_control_registry = TaskControlRegistry()
