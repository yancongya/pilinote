import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.database import Base
from src.models.task import Task, TaskState
from src.schemas.task import TaskCreate
from src.services.queue.manager import QueueManager
from src.services.queue.scheduler import SchedulerService
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


@pytest.mark.asyncio
async def test_submit_backlog_deduplicates_video_tasks_by_page_identity(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'queue.db'}")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    QueueManager._instance = None
    manager = QueueManager()
    manager._save_queue_to_db = AsyncMock()

    def session_factory():
        return TestingSessionLocal()

    with patch("src.services.queue.manager.SessionLocal", side_effect=session_factory), \
         patch("src.routers.websocket.broadcast_task_created"):
        first = await manager.submit_backlog(TaskCreate(
            media_type="video",
            media_id="BV1multi",
            title="P1",
            meta={"cid": 101, "page": 1}
        ))
        second = await manager.submit_backlog(TaskCreate(
            media_type="video",
            media_id="BV1multi",
            title="P2",
            meta={"cid": 202, "page": 2}
        ))
        duplicate_first = await manager.submit_backlog(TaskCreate(
            media_type="video",
            media_id="BV1multi",
            title="P1 duplicate",
            meta={"cid": 101, "page": 1}
        ))

    assert first.id != second.id
    assert duplicate_first.id == first.id
    assert len(manager.tasks) == 2


def test_scheduler_subtasks_use_episode_filenames_and_include_avatar():
    task = Task(
        id=str(uuid.uuid4()),
        media_type="video",
        media_id="BV1multi",
        title="P1",
        meta={"cid": 101, "page": 1, "part_title": "第一话/开始"},
        prepare={},
        status={},
        state=TaskState.PENDING,
    )
    service = SchedulerService(MagicMock())

    subtasks = service._create_subtasks(task, {
        "title": "合集标题",
        "pic": "https://example.com/cover.jpg",
        "owner": {
            "mid": 123,
            "name": "作者",
            "face": "http://example.com/avatar.jpg",
        },
    })

    filenames = {subtask["type"]: subtask.get("filename") for subtask in subtasks}
    assert filenames["video"] == "P01 - 第一话_开始.mp4"
    assert filenames["subtitles"] == "P01 - 第一话_开始.srt"
    assert filenames["single_nfo"] == "P01 - 第一话_开始.nfo"
    assert any(subtask["type"] == "AVATAR" for subtask in subtasks)


def test_scheduler_writes_series_nfo(tmp_path):
    scheduler = MagicMock()
    scheduler.title = "合集标题"
    scheduler.folder = str(tmp_path / "series")
    task = Task(
        id=str(uuid.uuid4()),
        media_type="video",
        media_id="BV1multi",
        title="P1",
        meta={
            "title": "合集标题",
            "desc": "合集简介",
            "pic": "https://example.com/cover.jpg",
            "owner": {"name": "作者"},
            "pubdate": 1710000000,
        },
        prepare={},
        status={},
        state=TaskState.PENDING,
    )
    service = SchedulerService(scheduler)
    service.tasks = {task.id: task}

    service._write_series_nfo()

    nfo_path = tmp_path / "series" / "tvshow.nfo"
    assert nfo_path.exists()
    content = nfo_path.read_text(encoding="utf-8")
    assert "<title>合集标题</title>" in content
    assert "<studio>作者</studio>" in content


@pytest.mark.asyncio
async def test_scheduler_runs_episode_tasks_in_shared_series_folder(tmp_path):
    scheduler = MagicMock()
    scheduler.folder = str(tmp_path / "series")
    task = Task(
        id=str(uuid.uuid4()),
        media_type="video",
        media_id="BV1multi",
        title="P1",
        meta={"cid": 101, "page": 1, "part_title": "第一话"},
        prepare={},
        status={},
        state=TaskState.PENDING,
    )

    class FakeStorage:
        temp_path = str(tmp_path / "temp")

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
            self.execute_args = None
            FakeTaskService.instances.append(self)

        async def execute(self, temp_dir, output_dir):
            self.execute_args = (Path(temp_dir), Path(output_dir))
            self.task.state = TaskState.COMPLETED
            return True

    service = SchedulerService(scheduler)
    service.concurrency_control = MagicMock()
    service.concurrency_control.acquire = AsyncMock(return_value=True)
    service.concurrency_control.release = AsyncMock()

    with patch("src.services.settings_service.SettingsService", FakeSettingsService), \
         patch("src.services.queue.task.TaskService", FakeTaskService), \
         patch("src.services.queue.scheduler.SessionLocal", return_value=MagicMock()):
        await service._run_task(task)

    assert FakeTaskService.instances[0].execute_args == (
        tmp_path / "temp" / task.id,
        tmp_path / "series",
    )


@pytest.mark.asyncio
async def test_scheduler_runs_collection_tasks_in_episode_subfolder(tmp_path):
    scheduler = MagicMock()
    scheduler.folder = str(tmp_path / "collection")
    task = Task(
        id=str(uuid.uuid4()),
        media_type="video",
        media_id="BV1episode",
        title="合集投稿",
        meta={"output_subdir": "P01 - 合集投稿/标题"},
        prepare={},
        status={},
        state=TaskState.PENDING,
    )

    class FakeStorage:
        temp_path = str(tmp_path / "temp")

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
            self.execute_args = None
            FakeTaskService.instances.append(self)

        async def execute(self, temp_dir, output_dir):
            self.execute_args = (Path(temp_dir), Path(output_dir))
            self.task.state = TaskState.COMPLETED
            return True

    service = SchedulerService(scheduler)
    service.concurrency_control = MagicMock()
    service.concurrency_control.acquire = AsyncMock(return_value=True)
    service.concurrency_control.release = AsyncMock()

    with patch("src.services.settings_service.SettingsService", FakeSettingsService), \
         patch("src.services.queue.task.TaskService", FakeTaskService), \
         patch("src.services.queue.scheduler.SessionLocal", return_value=MagicMock()):
        await service._run_task(task)

    assert FakeTaskService.instances[0].execute_args == (
        tmp_path / "temp" / task.id,
        tmp_path / "collection" / "P01 - 合集投稿_标题",
    )
