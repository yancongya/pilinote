import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models.task import Task, TaskState
from src.services.queue.manager import QueueManager
from src.services.queue.task import TaskService


@pytest.mark.asyncio
async def test_queue_manager_executes_task_with_temp_and_output_dirs(tmp_path):
    task_id = str(uuid.uuid4())
    task = Task(
        id=task_id,
        media_type="video",
        media_id="BV1xx411c7mD",
        title="测试视频标题",
        meta={},
        prepare={},
        status={},
        state=TaskState.ACTIVE,
    )

    class FakeStorage:
        temp_path = str(tmp_path / "temp")
        download_path = str(tmp_path / "downloads")

    class FakeSettings:
        storage = FakeStorage()

    class FakeSettingsService:
        def __init__(self, db):
            self.db = db

        def get_settings(self):
            return FakeSettings()

    class FakeTaskService:
        instances = []

        def __init__(self, task):
            self.task = task
            self.prepared = False
            self.execute_args = None
            FakeTaskService.instances.append(self)

        async def prepare(self):
            self.prepared = True

        async def execute(self, temp_dir, output_dir):
            self.execute_args = (Path(temp_dir), Path(output_dir))
            return True

    QueueManager._instance = None
    manager = QueueManager()
    manager.tasks[task_id] = task
    manager._complete_task = AsyncMock()

    with patch("src.services.queue.task.TaskService", FakeTaskService), \
         patch("src.services.settings_service.SettingsService", FakeSettingsService), \
         patch("src.services.queue.manager.SessionLocal", return_value=MagicMock()):
        await manager._execute_task(task_id)

    service = FakeTaskService.instances[0]
    assert service.prepared is True
    assert service.execute_args == (
        tmp_path / "temp" / task_id,
        tmp_path / "downloads",
    )
    assert service.execute_args[0].is_dir()
    assert service.execute_args[1].is_dir()
    manager._complete_task.assert_awaited_once_with(task_id, "completed")


@pytest.mark.asyncio
async def test_task_service_execute_returns_true_after_success(tmp_path):
    task = Task(
        id=str(uuid.uuid4()),
        media_type="video",
        media_id="BV1xx411c7mD",
        title="测试视频标题",
        meta={},
        prepare={"subtasks": []},
        status={},
        state=TaskState.ACTIVE,
    )
    service = TaskService(task)

    async def noop_progress_broadcaster():
        return None

    with patch.object(service, "_progress_broadcaster", noop_progress_broadcaster), \
         patch.object(service, "_check_task_status", AsyncMock()), \
         patch.object(service, "_cleanup_temp_dir", AsyncMock()), \
         patch("src.services.queue.task.SessionLocal", return_value=MagicMock()), \
         patch("src.routers.websocket.broadcast_task_updated"), \
         patch("src.routers.websocket.broadcast_queue_updated"):
        result = await service.execute(tmp_path / "temp", tmp_path / "downloads")

    assert result is True
