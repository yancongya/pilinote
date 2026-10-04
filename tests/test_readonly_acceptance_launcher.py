import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import stat
import sys
import types

import pytest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
LAUNCHER_PATH = REPOSITORY_ROOT / "apps" / "api" / "scripts" / "run_readonly_acceptance.py"


def load_launcher():
    module_name = "pilinote_readonly_acceptance_launcher_test"
    spec = importlib.util.spec_from_file_location(module_name, LAUNCHER_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def create_source_data(tmp_path: Path) -> Path:
    data_dir = tmp_path / "api" / "data"
    data_dir.mkdir(parents=True)
    database = data_dir / "pilinote.db"
    connection = sqlite3.connect(database)
    connection.execute("create table credentials (name text, value text)")
    connection.execute("insert into credentials values (?, ?)", ("SESSDATA", "private"))
    connection.execute(
        "create table settings (id integer primary key, key text unique not null, "
        "value text not null, type text not null, category text)"
    )
    connection.execute(
        "insert into settings (key, value, type, category) values (?, ?, ?, ?)",
        (
            "ai.providers",
            '{"api_key":"top-secret","nested":{"password":"hidden",'
            '"label":"keep"},"items":[{"refresh_token":"refresh"}]}',
            "json",
            "ai",
        ),
    )
    connection.execute(
        "insert into settings (key, value, type, category) values (?, ?, ?, ?)",
        ("provider.access_token", "plain-secret", "string", "ai"),
    )
    connection.execute(
        "insert into settings (key, value, type, category) values (?, ?, ?, ?)",
        ("storage.download_path", "/real/downloads", "string", "storage"),
    )
    connection.execute(
        "create table downloads (id text primary key, file_path text, title text)"
    )
    connection.execute(
        "insert into downloads values (?, ?, ?)",
        ("download-1", "/real/downloads/video.mp4", "video"),
    )
    connection.execute(
        "create table ai_notes (video_id text, content text, status text, updated_at text)"
    )
    connection.execute(
        "insert into ai_notes values (?, ?, ?, ?)",
        ("BV1234567890", "# private existing note", "completed", "2026-10-04"),
    )
    connection.commit()
    connection.close()
    (data_dir / "ai_runtime_state.json").write_text('{"enabled": false}', encoding="utf-8")
    (data_dir / "local_asr_models.json").write_text('{"partial": true}', encoding="utf-8")
    return data_dir


def test_launcher_builds_isolated_snapshot_and_invokes_factory(tmp_path, monkeypatch):
    launcher = load_launcher()
    source_data = create_source_data(tmp_path)
    launcher.SOURCE_DATA_DIR = source_data
    launcher.SOURCE_DATABASE = source_data / "pilinote.db"
    source_before = {
        path.name: path.read_bytes()
        for path in source_data.iterdir()
        if path.is_file()
    }
    observed = {}

    def fake_run(target, **options):
        runtime_dir = Path(os.environ["PILINOTE_RUNTIME_DIR"])
        snapshot = runtime_dir / "data" / "pilinote.db"
        observed.update(
            target=target,
            options=options,
            runtime_dir=runtime_dir,
            cwd=Path.cwd(),
            database_url=os.environ["DATABASE_URL"],
            acceptance_mode=os.environ["PILINOTE_ACCEPTANCE_MODE"],
            api_path=sys.path[0],
            root_mode=stat.S_IMODE(runtime_dir.stat().st_mode),
            snapshot_mode=stat.S_IMODE(snapshot.stat().st_mode),
            runtime_state=(runtime_dir / "data" / "ai_runtime_state.json").read_text(
                encoding="utf-8"
            ),
            registry_exists=(runtime_dir / "data" / "local_asr_models.json").exists(),
        )
        connection = sqlite3.connect(snapshot)
        observed["snapshot_row"] = connection.execute(
            "select name, value from credentials"
        ).fetchone()
        observed["settings"] = dict(
            connection.execute('select "key", value from settings').fetchall()
        )
        observed["download_file_path"] = connection.execute(
            "select file_path from downloads where id = ?", ("download-1",)
        ).fetchone()[0]
        connection.close()
        observed["seeded_note"] = (
            runtime_dir / "downloads" / "BV1234567890" / "BV1234567890.ai-note.md"
        ).read_text(encoding="utf-8")

    monkeypatch.setitem(sys.modules, "uvicorn", types.SimpleNamespace(run=fake_run))
    original_cwd = Path.cwd()
    original_path = list(sys.path)

    assert launcher.main(["--port", "8123"]) == 0

    assert observed["target"] == "readonly_acceptance:create_app"
    assert observed["options"] == {
        "factory": True,
        "host": "127.0.0.1",
        "port": 8123,
        "access_log": False,
    }
    assert observed["cwd"] == observed["runtime_dir"]
    assert observed["database_url"].endswith("/data/pilinote.db?mode=ro&uri=true")
    assert observed["acceptance_mode"] == "1"
    assert observed["api_path"] == str(launcher.API_ROOT)
    assert observed["root_mode"] == 0o700
    assert observed["snapshot_mode"] == 0o600
    assert observed["runtime_state"] == '{"enabled": false}'
    assert observed["registry_exists"] is False
    assert observed["snapshot_row"] == ("SESSDATA", "private")
    assert json.loads(observed["settings"]["ai.providers"]) == {
        "api_key": "",
        "nested": {"password": "", "label": "keep"},
        "items": [{"refresh_token": ""}],
    }
    assert observed["settings"]["provider.access_token"] == ""
    assert observed["settings"]["storage.download_path"] == str(
        observed["runtime_dir"] / "downloads"
    )
    assert observed["settings"]["storage.temp_path"] == str(
        observed["runtime_dir"] / "temp"
    )
    assert observed["download_file_path"] is None
    assert observed["seeded_note"] == "# private existing note"
    assert observed["runtime_dir"].exists() is False
    assert Path.cwd() == original_cwd
    assert sys.path == original_path
    assert "PILINOTE_ACCEPTANCE_MODE" not in os.environ
    assert {
        path.name: path.read_bytes()
        for path in source_data.iterdir()
        if path.is_file()
    } == source_before


def test_launcher_defaults_to_port_8000():
    launcher = load_launcher()

    assert launcher.parse_args([]).port == 8000


@pytest.mark.parametrize("value", ["0", "65536", "not-a-port"])
def test_launcher_rejects_invalid_ports(value):
    launcher = load_launcher()

    with pytest.raises(SystemExit):
        launcher.parse_args(["--port", value])


def test_launcher_fails_without_source_database(tmp_path):
    launcher = load_launcher()
    launcher.SOURCE_DATABASE = tmp_path / "missing.db"

    with pytest.raises(FileNotFoundError, match="database source is unavailable"):
        launcher.main([])


def test_launcher_reports_source_change_after_server_failure(tmp_path, monkeypatch):
    launcher = load_launcher()
    source_data = create_source_data(tmp_path)
    launcher.SOURCE_DATA_DIR = source_data
    launcher.SOURCE_DATABASE = source_data / "pilinote.db"
    observed = {}

    def fake_run(*args, **kwargs):
        observed["runtime_dir"] = Path(os.environ["PILINOTE_RUNTIME_DIR"])
        (source_data / "ai_runtime_state.json").write_text(
            '{"changed": true}', encoding="utf-8"
        )
        raise ValueError("server failed")

    monkeypatch.setitem(sys.modules, "uvicorn", types.SimpleNamespace(run=fake_run))

    with pytest.raises(RuntimeError, match="ai_runtime_state.json") as error:
        launcher.main([])

    assert isinstance(error.value.__context__, ValueError)
    assert observed["runtime_dir"].exists() is False
