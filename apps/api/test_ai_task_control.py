import importlib.util
import sys
import types
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
MODULE_PATH = BASE_DIR / "src" / "services" / "ai" / "task_control.py"

src_pkg = types.ModuleType("src")
src_pkg.__path__ = [str(BASE_DIR / "src")]
sys.modules.setdefault("src", src_pkg)

services_pkg = types.ModuleType("src.services")
services_pkg.__path__ = [str(BASE_DIR / "src" / "services")]
sys.modules.setdefault("src.services", services_pkg)

ai_pkg = types.ModuleType("src.services.ai")
ai_pkg.__path__ = [str(BASE_DIR / "src" / "services" / "ai")]
sys.modules.setdefault("src.services.ai", ai_pkg)


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块: {path}")
    module = importlib.util.module_from_spec(spec)
    module.__package__ = name.rsplit(".", 1)[0]
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


task_control = load_module("src.services.ai.task_control", MODULE_PATH)
task_control_registry = task_control.task_control_registry


def test_task_control_register_cancel_remove():
    task_id = "task-001"
    task_control_registry.register(task_id, "subtitle_analysis", state="running")

    record = task_control_registry.get(task_id)
    assert record is not None
    assert record.task_id == task_id
    assert record.kind == "subtitle_analysis"
    assert record.state == "running"

    assert task_control_registry.is_cancelled(task_id) is False
    assert task_control_registry.cancel(task_id) is True
    assert task_control_registry.is_cancelled(task_id) is True

    task_control_registry.remove(task_id)
    assert task_control_registry.get(task_id) is None


if __name__ == "__main__":
    test_task_control_register_cancel_remove()
    print("✓ task control registry works")
