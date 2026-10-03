import importlib.util
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "check_refactor_boundaries.py"
SPEC = importlib.util.spec_from_file_location("check_refactor_boundaries", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"无法加载边界检查脚本: {SCRIPT_PATH}")
BOUNDARY_CHECK = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BOUNDARY_CHECK
SPEC.loader.exec_module(BOUNDARY_CHECK)


def test_python_checker_allows_typing_import_and_pure_source():
    source = "from typing import Any, Optional\n\ndef convert(value: Any) -> Optional[str]:\n    return str(value) if value is not None else None\n"
    assert BOUNDARY_CHECK.check_python_source(
        source, "apps/api/src/services/ai/note_pipeline.py"
    ) == []


def test_python_checker_rejects_non_allowlisted_import_and_file_io():
    source = "import requests\nfrom pathlib import Path\n\ndef load(path):\n    return open(path).read()\n"
    findings = BOUNDARY_CHECK.check_python_source(
        source, "apps/api/src/services/ai/note_pipeline.py"
    )
    messages = "\n".join(str(finding) for finding in findings)
    assert "disallowed import: requests" in messages
    assert "forbidden IO/network import: pathlib" in messages
    assert "forbidden file/process/network operation: open" in messages


def test_typescript_checker_rejects_react_store_and_network_dependencies():
    source = "import { useState } from 'react'\nimport { useAuthStore } from '../stores/auth'\nfetch('/api/tasks')\n"
    findings = BOUNDARY_CHECK.check_typescript_source(
        source, "apps/web/src/pages/videoDetailPlayback.ts"
    )
    messages = "\n".join(str(finding) for finding in findings)
    assert "disallowed dependency import: react" in messages
    assert "disallowed dependency import: ../stores/auth" in messages
    assert "disallowed runtime/network dependency: fetch" in messages


def test_typescript_checker_rejects_dynamic_import_and_require_service_dependencies():
    source = "const service = import('../services/video')\nconst store = require('../stores/auth')\n"
    findings = BOUNDARY_CHECK.check_typescript_source(
        source, "apps/web/src/pages/videoDetailKeypoints.ts"
    )
    messages = "\n".join(str(finding) for finding in findings)
    assert "disallowed dependency import: ../services/video" in messages
    assert "disallowed dependency import: ../stores/auth" in messages


def test_typescript_checker_rejects_page_back_dependencies_and_allows_type_imports():
    source = (
        "import type { Video } from '../types/video'\n"
        "import type { Props } from './types'\n"
        "import Page from './VideoDetailPage'\n"
        "import('../pages/VideoDetailPage')\n"
        "require('../pages/components/DetailPanel')\n"
    )
    findings = BOUNDARY_CHECK.check_typescript_source(
        source, "apps/web/src/pages/videoDetailKeypoints.ts"
    )
    messages = "\n".join(str(finding) for finding in findings)
    assert "disallowed dependency import: ./VideoDetailPage" in messages
    assert "disallowed dependency import: ../pages/VideoDetailPage" in messages
    assert "disallowed dependency import: ../pages/components/DetailPanel" in messages
    assert len(findings) == 3


def test_real_repository_sources_pass_and_root_is_independent_of_cwd():
    original_cwd = Path.cwd()
    with tempfile.TemporaryDirectory() as temporary_directory:
        temporary_root = Path(temporary_directory)
        for relative_path in (*BOUNDARY_CHECK.PYTHON_MODULES, *BOUNDARY_CHECK.TS_MODULES):
            destination = temporary_root / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text("", encoding="utf-8")
        assert BOUNDARY_CHECK.check_sources(temporary_root) == []
        missing_root_findings = BOUNDARY_CHECK.check_sources(temporary_root / "missing")
        assert len(missing_root_findings) == len(
            BOUNDARY_CHECK.PYTHON_MODULES + BOUNDARY_CHECK.TS_MODULES
        )
        assert Path.cwd() == original_cwd

    assert BOUNDARY_CHECK.ROOT == SCRIPT_PATH.parents[1]
    findings = BOUNDARY_CHECK.check_sources(BOUNDARY_CHECK.ROOT)
    assert findings == [], "\n".join(str(finding) for finding in findings)


def test_read_failure_returns_finding():
    with tempfile.TemporaryDirectory() as temporary_directory:
        root = Path(temporary_directory)
        for relative_path in (*BOUNDARY_CHECK.PYTHON_MODULES, *BOUNDARY_CHECK.TS_MODULES):
            target = root / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("", encoding="utf-8")
        source_path = root / BOUNDARY_CHECK.PYTHON_MODULES[0]
        original_read_text = Path.read_text

        def fail_for_target(path, *args, **kwargs):
            if path == source_path:
                raise OSError("simulated read failure")
            return original_read_text(path, *args, **kwargs)

        with patch.object(Path, "read_text", fail_for_target):
            findings = BOUNDARY_CHECK.check_sources(root)
        assert any("unable to read required module" in finding.message for finding in findings)
