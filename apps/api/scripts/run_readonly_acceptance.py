import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
from typing import Sequence
from urllib.parse import quote


API_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DATA_DIR = API_ROOT / "data"
SOURCE_DATABASE = SOURCE_DATA_DIR / "pilinote.db"
RUNTIME_PREFIX = "pilinote-readonly-"
SECRET_FIELDS = {
    "api_key",
    "password",
    "token",
    "secret",
    "access_token",
    "refresh_token",
}


def _is_secret_field(value: object) -> bool:
    normalized = "".join(character for character in str(value).lower() if character.isalnum())
    return any(part in normalized for part in ("apikey", "password", "token", "secret", "credential", "cookie", "authorization"))


def _port(value: str) -> int:
    port = int(value)
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run PiliNote's isolated read-only acceptance server."
    )
    parser.add_argument("--port", type=_port, default=8000)
    return parser.parse_args(argv)


def _sqlite_uri(path: Path) -> str:
    return f"file:{quote(path.resolve().as_posix(), safe='/')}?mode=ro"


def _sanitize_json(value):
    if isinstance(value, dict):
        return {
            key: "" if _is_secret_field(key) else _sanitize_json(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_json(item) for item in value]
    return value


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    return {
        row[1]
        for row in connection.execute(f'pragma table_info("{table_name}")').fetchall()
    }


def _sanitize_settings(connection: sqlite3.Connection, runtime_dir: Path) -> None:
    columns = _table_columns(connection, "settings")
    if not {"key", "value"}.issubset(columns):
        return
    rows = connection.execute('select id, "key", value from settings').fetchall()
    for setting_id, setting_key, raw_value in rows:
        replacement = raw_value
        if _is_secret_field(str(setting_key).split(".")[-1]):
            replacement = ""
        else:
            try:
                replacement = json.dumps(
                    _sanitize_json(json.loads(raw_value)),
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            except (json.JSONDecodeError, TypeError):
                pass
        if replacement != raw_value:
            connection.execute(
                "update settings set value = ? where id = ?", (replacement, setting_id)
            )
    path_values = {
        "storage.download_path": str(runtime_dir / "downloads"),
        "storage.temp_path": str(runtime_dir / "temp"),
    }
    for setting_key, path_value in path_values.items():
        existing = connection.execute(
            'select id from settings where "key" = ?', (setting_key,)
        ).fetchone()
        if existing:
            connection.execute(
                "update settings set value = ? where id = ?", (path_value, existing[0])
            )
            continue
        insert_columns = ["key", "value"]
        insert_values = [setting_key, path_value]
        if "type" in columns:
            insert_columns.append("type")
            insert_values.append("string")
        if "category" in columns:
            insert_columns.append("category")
            insert_values.append("storage")
        placeholders = ", ".join("?" for _ in insert_columns)
        quoted_columns = ", ".join(f'"{column}"' for column in insert_columns)
        connection.execute(
            f"insert into settings ({quoted_columns}) values ({placeholders})",
            insert_values,
        )


def _sanitize_snapshot(connection: sqlite3.Connection, runtime_dir: Path) -> None:
    _sanitize_settings(connection, runtime_dir)
    download_columns = _table_columns(connection, "downloads")
    if "file_path" in download_columns:
        connection.execute("update downloads set file_path = null")
    connection.commit()


def _snapshot_database(destination: Path, runtime_dir: Path) -> None:
    if not SOURCE_DATABASE.is_file():
        raise FileNotFoundError("PiliNote database source is unavailable")
    source = sqlite3.connect(_sqlite_uri(SOURCE_DATABASE), uri=True)
    try:
        target = sqlite3.connect(destination)
        try:
            source.backup(target)
            _sanitize_snapshot(target, runtime_dir)
        finally:
            target.close()
    finally:
        source.close()
    destination.chmod(0o600)


def _seed_existing_note(snapshot: Path, runtime_dir: Path) -> None:
    connection = sqlite3.connect(_sqlite_uri(snapshot), uri=True)
    try:
        row = connection.execute(
            "select video_id, content from ai_notes "
            "where status = 'completed' and content is not null and content != '' "
            "and video_id glob 'BV??????????' order by updated_at desc limit 1"
        ).fetchone()
    finally:
        connection.close()
    if not row:
        return
    video_id, content = row
    if not video_id.isalnum() or not video_id.startswith("BV"):
        return
    note_dir = runtime_dir / "downloads" / video_id
    note_dir.mkdir(mode=0o700)
    (note_dir / f"{video_id}.ai-note.md").write_text(content, encoding="utf-8")


def _prepare_runtime(runtime_dir: Path) -> Path:
    runtime_dir.chmod(0o700)
    data_dir = runtime_dir / "data"
    for directory_name in ("data", "logs", "downloads", "temp"):
        (runtime_dir / directory_name).mkdir(mode=0o700)
    snapshot = data_dir / "pilinote.db"
    _snapshot_database(snapshot, runtime_dir)
    _seed_existing_note(snapshot, runtime_dir)
    runtime_state = SOURCE_DATA_DIR / "ai_runtime_state.json"
    if runtime_state.is_file():
        shutil.copyfile(runtime_state, data_dir / runtime_state.name)
    return snapshot


def _file_digest(path: Path) -> tuple[bool, str | None]:
    if not path.exists():
        return False, None
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return True, digest.hexdigest()


def _source_files() -> tuple[Path, ...]:
    return (
        SOURCE_DATABASE,
        Path(f"{SOURCE_DATABASE}-wal"),
        Path(f"{SOURCE_DATABASE}-shm"),
        SOURCE_DATA_DIR / "local_asr_models.json",
        SOURCE_DATA_DIR / "ai_runtime_state.json",
    )


def _source_fingerprints() -> dict[Path, tuple[bool, str | None]]:
    return {path: _file_digest(path) for path in _source_files()}


def _verify_source_unchanged(
    before: dict[Path, tuple[bool, str | None]],
) -> None:
    changed = [path.name for path, digest in before.items() if _file_digest(path) != digest]
    if changed:
        raise RuntimeError(
            "Read-only acceptance source files changed during launch: "
            + ", ".join(changed)
        )


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    source_fingerprints = _source_fingerprints()
    original_cwd = Path.cwd()
    original_path = list(sys.path)
    environment_names = (
        "PILINOTE_RUNTIME_DIR",
        "PILINOTE_LOG_DIR",
        "PILINOTE_DOWNLOAD_PATH",
        "PILINOTE_TEMP_PATH",
        "DATABASE_URL",
        "PILINOTE_ACCEPTANCE_MODE",
    )
    original_environment = {name: os.environ.get(name) for name in environment_names}
    try:
        with tempfile.TemporaryDirectory(prefix=RUNTIME_PREFIX) as temporary_path:
            runtime_dir = Path(temporary_path).resolve()
            snapshot = _prepare_runtime(runtime_dir)
            os.environ.update(
                {
                    "PILINOTE_RUNTIME_DIR": str(runtime_dir),
                    "PILINOTE_LOG_DIR": str(runtime_dir / "logs"),
                    "PILINOTE_DOWNLOAD_PATH": str(runtime_dir / "downloads"),
                    "PILINOTE_TEMP_PATH": str(runtime_dir / "temp"),
                    "DATABASE_URL": f"sqlite:///file:{snapshot.as_posix()}?mode=ro&uri=true",
                    "PILINOTE_ACCEPTANCE_MODE": "1",
                }
            )
            os.chdir(runtime_dir)
            sys.path.insert(0, str(API_ROOT))
            import uvicorn

            uvicorn.run(
                "readonly_acceptance:create_app",
                factory=True,
                host="127.0.0.1",
                port=args.port,
                access_log=False,
            )
    finally:
        os.chdir(original_cwd)
        sys.path[:] = original_path
        for name, value in original_environment.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        _verify_source_unchanged(source_fingerprints)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
