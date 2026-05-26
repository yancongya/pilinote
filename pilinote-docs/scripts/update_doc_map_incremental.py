#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


MD_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


def is_external_link(link: str) -> bool:
    if link.startswith(("http://", "https://", "mailto:", "tel:")):
        return True
    parsed = urlparse(link)
    return bool(parsed.scheme and parsed.scheme not in ("file",))


def normalize_rel_path(base: Path, link: str, repo_root: Path) -> str | None:
    clean = link.strip()
    if not clean or clean.startswith("#"):
        return None
    clean = clean.split("#", 1)[0].split("?", 1)[0]
    if not clean:
        return None
    if is_external_link(clean):
        return None

    if clean.startswith("/"):
        target = (repo_root / clean.lstrip("/")).resolve()
    else:
        target = (base / clean).resolve()

    try:
        return str(target.relative_to(repo_root)).replace("\\", "/")
    except ValueError:
        return None


def extract_dependencies(md_file: Path, docs_root: Path) -> list[str]:
    try:
        content = md_file.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []
    deps: set[str] = set()
    for match in MD_LINK_RE.finditer(content):
        rel = normalize_rel_path(md_file.parent, match.group(1), docs_root)
        if rel:
            deps.add(rel)
    return sorted(deps)


def normalize_doc_rel(doc_rel: str) -> str:
    # Legacy roots before docs app migration.
    prefixes = (
        "apps/docs/",
        "pilinote-docs/",
    )
    out = doc_rel.replace("\\", "/").lstrip("./")
    for p in prefixes:
        if out.startswith(p):
            out = out[len(p) :]
            break
    return out


def _read_description_from_readme(readme_path: Path) -> str:
    try:
        text = readme_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""
    # Heuristic: first non-empty line that is not a markdown heading marker only.
    for line in (ln.strip() for ln in text.splitlines()):
        if not line:
            continue
        if line.startswith("#"):
            continue
        return line[:200]
    return ""


def _discover_directories(docs_root: Path, existing: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for child in sorted(docs_root.iterdir()):
        if not child.is_dir():
            continue
        if child.name.startswith((".", "_")):
            continue

        readme = child / "README.md"
        md_files = list(child.rglob("*.md"))
        if not md_files:
            continue

        key = child.name
        prev = existing.get(key) if isinstance(existing.get(key), dict) else {}
        readme_rel = str(readme.relative_to(docs_root)).replace("\\", "/") if readme.exists() else ""

        description = str(prev.get("description") or "").strip()
        if not description and readme.exists():
            description = _read_description_from_readme(readme)

        out[key] = {
            "path": str(child.relative_to(docs_root)).replace("\\", "/"),
            "description": description,
            "readme": readme_rel,
            # Filled in later:
            "documents": [],
            "dependencies": [],
        }
    return out


def update_doc_map(map_path: Path, *, full: bool) -> None:
    repo_root = map_path.parent.resolve()
    docs_root = repo_root / "docs-dev"
    if not docs_root.exists():
        docs_root = repo_root
    data: dict[str, Any] = json.loads(map_path.read_text(encoding="utf-8"))
    directories = data.get("directories", {})
    if not isinstance(directories, dict):
        raise ValueError("Invalid doc-map format: 'directories' must be object")

    if full:
        directories = _discover_directories(docs_root, directories)
        data["directories"] = directories

    for _, info in directories.items():
        if not isinstance(info, dict):
            continue
        docs = info.get("documents", [])
        if not isinstance(docs, list):
            info["documents"] = []
            info["dependencies"] = []
            continue

        valid_docs: list[str] = []
        deps: set[str] = set()
        for doc_rel in docs:
            if not isinstance(doc_rel, str):
                continue
            normalized_rel = normalize_doc_rel(doc_rel)
            doc_path = (docs_root / normalized_rel).resolve()
            if not doc_path.exists() or not doc_path.is_file():
                continue
            valid_docs.append(normalized_rel)
            for d in extract_dependencies(doc_path, docs_root):
                deps.add(d)

        # If legacy list is empty or invalid after migration, rebuild by directory path.
        if not valid_docs:
            dir_path = str(info.get("path", "")).strip()
            target_dir = (docs_root / dir_path).resolve() if dir_path and dir_path != "." else docs_root
            rebuilt_docs: list[str] = []
            rebuilt_deps: set[str] = set()
            if target_dir.exists() and target_dir.is_dir():
                for md in sorted(target_dir.rglob("*.md")):
                    rel = str(md.relative_to(docs_root)).replace("\\", "/")
                    rebuilt_docs.append(rel)
                    for d in extract_dependencies(md, docs_root):
                        rebuilt_deps.add(d)
            info["documents"] = rebuilt_docs
            info["dependencies"] = sorted(rebuilt_deps)
            continue

        info["documents"] = valid_docs
        info["dependencies"] = sorted(deps)

    data["lastUpdated"] = datetime.now(timezone.utc).isoformat()
    data["root"] = "docs-dev" if docs_root.name == "docs-dev" else "."
    map_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Update .doc-map.json (incremental or full scan).")
    parser.add_argument("--full", action="store_true", help="Re-discover directories from docs root and rebuild docs/deps.")
    default_map = Path(__file__).resolve().parents[1] / ".doc-map.json"
    map_path = default_map
    if not map_path.exists():
        raise FileNotFoundError(f"doc-map not found: {map_path}")
    args = parser.parse_args()
    update_doc_map(map_path, full=bool(args.full))
    print(f"[doc-map] updated: {map_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
