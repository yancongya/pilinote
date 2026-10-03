#!/usr/bin/env python3
"""Check dependency boundaries for extracted pure refactor modules."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path
import re
import sys
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
PYTHON_MODULES = (
    Path("apps/api/src/services/ai/note_pipeline.py"),
    Path("apps/api/src/services/ai/note_context.py"),
    Path("apps/api/src/services/subtitle_utils.py"),
)
PYTHON_IMPORT_ALLOWLIST = {
    "apps/api/src/services/ai/note_pipeline.py": {"typing"},
    "apps/api/src/services/ai/note_context.py": {"typing"},
    "apps/api/src/services/subtitle_utils.py": {"json", "datetime", "typing"},
}
PYTHON_FORBIDDEN_ROOTS = {"pathlib", "subprocess", "socket"}
PYTHON_FORBIDDEN_NAMES = {
    "open",
    "Path",
    "PurePath",
    "subprocess",
    "Popen",
    "run",
    "call",
    "check_call",
    "check_output",
    "socket",
    "create_connection",
    "create_server",
}
TS_MODULES = (
    Path("apps/web/src/pages/videoDetailKeypoints.ts"),
    Path("apps/web/src/pages/videoDetailDownloadPayloads.ts"),
    Path("apps/web/src/pages/videoDetailPlayback.ts"),
    Path("apps/web/src/utils/newQueueNormalization.ts"),
)
TS_FORBIDDEN_IMPORTS = re.compile(
    r"(?:^|[/@.])(?:react(?:-dom)?|stores?|services?|api)(?:[/@.]|$)", re.IGNORECASE
)
TS_FORBIDDEN_PAGE_IMPORTS = re.compile(
    r"(?:^|/)(?:pages/|(?:\.\.?/)*VideoDetailPage(?:\.[^/]*)?$)", re.IGNORECASE
)
TS_FORBIDDEN_TOKENS = re.compile(
    r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|axios|apiService|use[A-Z]\w*Store)\b"
)


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    message: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line}: {self.message}"


def _module_name(path: Path) -> str:
    return path.as_posix()


def _python_imports(tree: ast.AST) -> Iterable[tuple[str, int]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name, node.lineno
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                yield "." * node.level + (node.module or ""), node.lineno
            elif node.module:
                yield node.module, node.lineno


def _python_forbidden_usage(tree: ast.AST) -> Iterable[tuple[str, int]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            function = node.func
            if isinstance(function, ast.Name) and function.id in PYTHON_FORBIDDEN_NAMES:
                yield function.id, node.lineno
            elif isinstance(function, ast.Attribute) and function.attr in PYTHON_FORBIDDEN_NAMES:
                yield function.attr, node.lineno
        elif isinstance(node, ast.Name) and node.id in PYTHON_FORBIDDEN_NAMES:
            yield node.id, node.lineno
        elif isinstance(node, ast.Attribute) and node.attr in {"open", "read_text", "write_text", "read_bytes", "write_bytes"}:
            yield node.attr, node.lineno


def check_python_source(source: str, display_path: str) -> list[Finding]:
    try:
        tree = ast.parse(source, filename=display_path)
    except SyntaxError as error:
        return [Finding(display_path, error.lineno or 1, f"Python syntax error: {error.msg}")]

    allowed_imports = PYTHON_IMPORT_ALLOWLIST.get(display_path)
    if allowed_imports is None:
        allowed_imports = set().union(*PYTHON_IMPORT_ALLOWLIST.values())
    findings: list[Finding] = []
    for imported, line in _python_imports(tree):
        root_name = imported.lstrip(".").split(".", 1)[0]
        if imported.startswith(".") or root_name not in allowed_imports:
            findings.append(Finding(display_path, line, f"disallowed import: {imported}"))
        if root_name in PYTHON_FORBIDDEN_ROOTS:
            findings.append(Finding(display_path, line, f"forbidden IO/network import: {imported}"))
    for name, line in _python_forbidden_usage(tree):
        findings.append(Finding(display_path, line, f"forbidden file/process/network operation: {name}"))
    return findings


def check_typescript_source(source: str, display_path: str) -> list[Finding]:
    findings: list[Finding] = []
    for line_number, line in enumerate(source.splitlines(), start=1):
        import_patterns = (
            r"\bfrom\s*[\"']([^\"']+)[\"']",
            r"\bimport\s*[\"']([^\"']+)[\"']",
            r"\bimport\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
            r"\brequire\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
        )
        for pattern in import_patterns:
            for match in re.finditer(pattern, line):
                module = match.group(1)
                if TS_FORBIDDEN_IMPORTS.search(module) or TS_FORBIDDEN_PAGE_IMPORTS.search(module):
                    findings.append(Finding(display_path, line_number, f"disallowed dependency import: {module}"))
        for match in TS_FORBIDDEN_TOKENS.finditer(line):
            findings.append(Finding(display_path, line_number, f"disallowed runtime/network dependency: {match.group(0)}"))
    return findings


def check_sources(root: Path = ROOT) -> list[Finding]:
    findings: list[Finding] = []
    for relative_path in PYTHON_MODULES:
        display_path = _module_name(relative_path)
        source_path = root / relative_path
        if not source_path.is_file():
            findings.append(Finding(display_path, 1, "required pure module not found"))
            continue
        try:
            source = source_path.read_text(encoding="utf-8")
        except OSError as error:
            findings.append(Finding(display_path, 1, f"unable to read required module: {error}"))
            continue
        findings.extend(check_python_source(source, display_path))
    for relative_path in TS_MODULES:
        display_path = _module_name(relative_path)
        source_path = root / relative_path
        if not source_path.is_file():
            findings.append(Finding(display_path, 1, "required pure module not found"))
            continue
        try:
            source = source_path.read_text(encoding="utf-8")
        except OSError as error:
            findings.append(Finding(display_path, 1, f"unable to read required module: {error}"))
            continue
        findings.extend(check_typescript_source(source, display_path))
    return findings


def main() -> int:
    findings = check_sources()
    if findings:
        for finding in findings:
            print(finding, file=sys.stderr)
        print(f"Refactor boundary check failed: {len(findings)} finding(s).", file=sys.stderr)
        return 1
    print("Refactor boundary check passed (direct static/dynamic imports and common dependency patterns only; not a whole-repository safety proof).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
