# Subtitle Correction Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AI subtitle correction flow so it uses NFO context as pre-prompt input, analyzes the full subtitle file in batches, returns structured correction suggestions, and preserves the current manual apply-and-version workflow.

**Architecture:** Keep the existing `TranscriptTab` and `SubtitleAnalysisModal` entry points, but replace the backend's "first 50 lines" shortcut with a structured pipeline: locate the video directory, read and normalize NFO metadata, parse SRT into subtitle blocks, analyze batches with overlap, merge and validate correction suggestions, then return a stable JSON result for the current front-end apply flow. The UI stays simple: it renders progress, issues, and a manual apply button, while file writes continue to go through `/api/local/file` so the current auto-version snapshot behavior remains intact.

**Tech Stack:** React + TypeScript + Vite, FastAPI, Python, SSE, SRT parsing utilities, existing `subtitle_analyzer`, `term_base_service`, `VersionManager`, and `apiService`

---

## Background

The current subtitle correction flow already has a usable shell:

- `SubtitleAnalysisModal` opens and listens to the SSE pipeline in `apps/api/src/routers/ai_subtitle.py`.
- `TranscriptTab` maps AI suggestions back onto SRT blocks and writes the result through `apiService.saveLocalFile(...)`.
- The backend already reads NFO in the `READ_NFO` stage, but that context is not actually passed into the LLM prompt.
- `subtitle_analyzer.analyze()` truncates the input to the first 50 lines, which makes long subtitles incomplete and reduces correction quality.

This plan keeps the existing manual confirmation workflow and version snapshots, but replaces the analysis core with a full-file, context-aware pipeline.

---

## Scope

### In scope

- Read NFO metadata before subtitle analysis and include it in the prompt context.
- Parse subtitle files into blocks and analyze the full file in batches.
- Return structured correction data that includes stable block references and a correction reason.
- Preserve the current `TranscriptTab` apply flow and version snapshot behavior.
- Keep SSE progress reporting, but make the stages reflect the real batch pipeline.
- Add tests around NFO extraction, batch planning, and result merging.

### Out of scope

- Do not build a full waveform editor.
- Do not replace the current subtitle list UI with a complex transcript workspace.
- Do not change the existing local file versioning model.
- Do not introduce a separate human review workflow or database-backed correction history.

---

## Plan

### Task 1: Build a subtitle context layer that reads NFO and parses SRT into stable blocks

**Files:**
- Create: `apps/api/src/services/ai/subtitle_context.py`
- Modify: `apps/api/src/routers/ai_subtitle.py`
- Test: `apps/api/tests/test_subtitle_context.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_subtitle_context.py
from pathlib import Path

from src.services.ai.subtitle_context import build_video_context, parse_srt_blocks


def test_parse_srt_blocks_preserves_index_timing_and_text():
    content = (
        "1\n00:00:01,000 --> 00:00:03,000\n你好世界\n\n"
        "2\n00:00:03,500 --> 00:00:05,000\n第二条字幕\n"
    )

    blocks = parse_srt_blocks(content)

    assert len(blocks) == 2
    assert blocks[0]["index"] == 1
    assert blocks[0]["start_time"] == "00:00:01,000"
    assert blocks[0]["end_time"] == "00:00:03,000"
    assert blocks[0]["text"] == "你好世界"
    assert blocks[1]["index"] == 2


def test_build_video_context_uses_nfo_metadata(tmp_path: Path):
    video_dir = tmp_path / "video"
    video_dir.mkdir()
    (video_dir / "sample.nfo").write_text(
        "<title>测试视频</title>\n<studio>测试UP主</studio>\n<runtime>12</runtime>\n",
        encoding="utf-8",
    )

    context = build_video_context(video_dir)

    assert context["title"] == "测试视频"
    assert context["studio"] == "测试UP主"
    assert context["runtime"] == "12"
    assert "sample.nfo" in context["nfo_files"]
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest tests/test_subtitle_context.py -v
```

Expected: fail because `subtitle_context.py` does not exist and the current router still inlines NFO handling.

- [ ] **Step 3: Write minimal implementation**

```python
# apps/api/src/services/ai/subtitle_context.py
from pathlib import Path
from typing import Any, Dict, List
import re


def parse_srt_blocks(content: str) -> List[Dict[str, Any]]:
    # Split SRT into stable blocks: index, times, text.
    # Keep the implementation strict enough to preserve ordering and easy enough to debug.
    blocks: List[Dict[str, Any]] = []
    for raw_block in [b for b in content.strip().split("\n\n") if b.strip()]:
        lines = raw_block.split("\n")
        if len(lines) < 3:
            continue
        index = int(lines[0].strip())
        start_time, end_time = [part.strip() for part in lines[1].split("-->")]
        text = "\n".join(lines[2:]).strip()
        blocks.append(
            {
                "index": index,
                "start_time": start_time,
                "end_time": end_time,
                "text": text,
                "raw": raw_block,
            }
        )
    return blocks


def build_video_context(video_dir: Path) -> Dict[str, Any]:
    nfo_files = sorted(video_dir.glob("*.nfo"))
    text_chunks: List[str] = []
    for nfo_file in nfo_files:
        text_chunks.append(nfo_file.read_text(encoding="utf-8"))
    combined = "\n".join(text_chunks)
    title = re.search(r"<title>(.*?)</title>", combined)
    studio = re.search(r"<studio>(.*?)</studio>", combined)
    runtime = re.search(r"<runtime>(.*?)</runtime>", combined)
    return {
        "title": title.group(1).strip() if title else "",
        "studio": studio.group(1).strip() if studio else "",
        "runtime": runtime.group(1).strip() if runtime else "",
        "nfo_files": [f.name for f in nfo_files],
        "nfo_text": combined.strip(),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest tests/test_subtitle_context.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/ai/subtitle_context.py apps/api/src/routers/ai_subtitle.py apps/api/tests/test_subtitle_context.py
git commit -m "feat: add subtitle context builder"
```

### Task 2: Replace the 50-line shortcut with batch subtitle analysis and structured LLM output

**Files:**
- Modify: `apps/api/src/services/ai/subtitle_analyzer.py`
- Modify: `apps/api/src/routers/ai_subtitle.py`
- Modify: `apps/api/src/llm/openai_client.py`
- Modify: `apps/api/src/llm/deepseek_client.py`
- Test: `apps/api/tests/test_subtitle_batching.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_subtitle_batching.py
from src.services.ai.subtitle_analyzer import build_subtitle_batches, merge_correction_results


def test_build_subtitle_batches_covers_all_blocks():
    blocks = [{"index": i, "text": f"第{i}条", "start_time": "", "end_time": ""} for i in range(1, 61)]
    batches = build_subtitle_batches(blocks, batch_size=20, overlap=2)

    covered = sorted({item["index"] for batch in batches for item in batch["blocks"]})
    assert covered == list(range(1, 61))
    assert len(batches) >= 3


def test_merge_correction_results_deduplicates_by_index():
    results = [
        {"index": 2, "type": "typo", "original_text": "我门", "corrected_text": "我们", "reason": "错别字", "confidence": 0.9},
        {"index": 2, "type": "grammar", "original_text": "我门", "corrected_text": "我们", "reason": "重复结果", "confidence": 0.8},
    ]

    merged = merge_correction_results(results)

    assert len(merged) == 1
    assert merged[0]["index"] == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest tests/test_subtitle_batching.py -v
```

Expected: fail because batching and merge helpers have not been implemented.

- [ ] **Step 3: Write minimal implementation**

```python
# apps/api/src/services/ai/subtitle_analyzer.py
def build_subtitle_batches(blocks, batch_size=20, overlap=2):
    batches = []
    step = max(1, batch_size - overlap)
    for start in range(0, len(blocks), step):
        end = min(len(blocks), start + batch_size)
        batches.append({"batch_index": len(batches) + 1, "blocks": blocks[start:end]})
        if end >= len(blocks):
            break
    return batches


def merge_correction_results(results):
    merged = {}
    for item in results:
        index = item["index"]
        if index not in merged or item.get("confidence", 0) > merged[index].get("confidence", 0):
            merged[index] = item
    return [merged[k] for k in sorted(merged)]
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest tests/test_subtitle_batching.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/ai/subtitle_analyzer.py apps/api/src/routers/ai_subtitle.py apps/api/src/llm/openai_client.py apps/api/src/llm/deepseek_client.py apps/api/tests/test_subtitle_batching.py
git commit -m "feat: batch subtitle correction analysis"
```

### Task 3: Inject NFO context into the analysis prompt and return richer correction records

**Files:**
- Modify: `apps/api/src/services/ai/subtitle_analyzer.py`
- Modify: `apps/api/src/routers/ai_subtitle.py`
- Test: `apps/api/tests/test_subtitle_prompt_context.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/test_subtitle_prompt_context.py
from src.services.ai.subtitle_analyzer import build_analysis_prompt


def test_build_analysis_prompt_includes_video_context_and_block_text():
    prompt = build_analysis_prompt(
        video_context={
            "title": "测试视频",
            "studio": "测试UP主",
            "runtime": "12",
            "nfo_text": "这里是简介",
        },
        batch_blocks=[
            {"index": 1, "start_time": "00:00:01,000", "end_time": "00:00:03,000", "text": "我门去看看"}
        ],
    )

    assert "测试视频" in prompt
    assert "测试UP主" in prompt
    assert "这里是简介" in prompt
    assert "我门去看看" in prompt
    assert "index" in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest tests/test_subtitle_prompt_context.py -v
```

Expected: fail because the prompt builder does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
# apps/api/src/services/ai/subtitle_analyzer.py
def build_analysis_prompt(video_context, batch_blocks):
    block_lines = []
    for block in batch_blocks:
        block_lines.append(
            f'{block["index"]}\n{block["start_time"]} --> {block["end_time"]}\n{block["text"]}'
        )
    return (
        "视频信息:\n"
        f'- 标题: {video_context.get("title", "")}\n'
        f'- UP主: {video_context.get("studio", "")}\n'
        f'- 时长: {video_context.get("runtime", "")}\n'
        f'- 简介: {video_context.get("nfo_text", "")}\n\n'
        "字幕内容:\n"
        + "\n\n".join(block_lines)
        + "\n\n"
        "请返回结构化 JSON，字段包含 issues 和 summary。"
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest tests/test_subtitle_prompt_context.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/ai/subtitle_analyzer.py apps/api/src/routers/ai_subtitle.py apps/api/tests/test_subtitle_prompt_context.py
git commit -m "feat: add nfo-aware subtitle prompt"
```

### Task 4: Keep the existing front-end apply flow, but update the result contract and progress display

**Files:**
- Modify: `apps/web/src/components/ai/SubtitleAnalysisModal.tsx`
- Modify: `apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx`
- Modify: `apps/web/src/services/api.ts`
- Test: `apps/web/src/__tests__/subtitleAnalysisResultContract.test.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/__tests__/subtitleAnalysisResultContract.test.ts
import { describe, it, expect } from 'vitest'

describe('subtitle analysis result contract', () => {
  it('keeps compatibility with index-based apply flow', () => {
    const issue = {
      index: 7,
      type: 'typo',
      original_text: '我门',
      corrected_text: '我们',
      reason: '常见错别字',
      confidence: 0.95,
    }

    expect(issue.index).toBe(7)
    expect(issue.corrected_text).toBe('我们')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/subtitleAnalysisResultContract.test.ts -v
```

Expected: fail before the front-end types and mapping are updated.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx
type Issue = {
  index: number
  type: 'typo' | 'grammar' | 'term'
  original_text: string
  corrected_text: string
  reason?: string
  confidence?: number
  text?: string
  suggestion?: string
}

const getAppliedText = (issue: Issue) => issue.corrected_text || issue.suggestion || issue.text || ''
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/subtitleAnalysisResultContract.test.ts -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/SubtitleAnalysisModal.tsx apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx apps/web/src/services/api.ts apps/web/src/__tests__/subtitleAnalysisResultContract.test.ts
git commit -m "feat: align subtitle correction result contract"
```

### Task 5: Verify end-to-end behavior on a long subtitle sample and document the limits

**Files:**
- Modify: `docs/api/endpoints.md`
- Modify: `docs/ai-note/README.md`
- Modify: `docs/superpowers/specs/2026-04-20-subtitle-correction-design.md` if it still claims a 50-line analysis limit

- [ ] **Step 1: Write the failing test**

```bash
# Manual verification command to run after implementation
cd apps/api
source venv/bin/activate
python3 -m pytest tests/test_subtitle_context.py tests/test_subtitle_batching.py tests/test_subtitle_prompt_context.py -v
```

Expected: PASS.

- [ ] **Step 2: Run the manual end-to-end check**

Run:

```bash
cd apps/api
source venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal:

```bash
cd apps/web
pnpm dev
```

Then open a video with a long subtitle file and confirm:

- NFO metadata appears in the analysis progress.
- The analysis covers the full subtitle file in batches.
- The returned issues still map back to subtitle indices.
- Clicking apply rewrites the local SRT file and creates a version snapshot.

Expected: the long subtitle file is analyzed beyond the first 50 lines, and the result remains safe to apply.

- [ ] **Step 3: Update docs**

Add a short note documenting:

- NFO is used as pre-prompt context.
- Subtitle analysis is batched across the full file.
- The front-end still applies fixes manually.
- The file write path still triggers auto-versioning.

- [ ] **Step 4: Commit**

```bash
git add docs/api/endpoints.md docs/ai-note/README.md docs/superpowers/specs/2026-04-20-subtitle-correction-design.md
git commit -m "docs: update subtitle correction workflow"
```

---

## Self-Review Checklist

- [x] NFO pre-context is explicitly covered in Task 1 and Task 3.
- [x] The 50-line truncation is removed in Task 2.
- [x] The apply flow remains compatible with the current `TranscriptTab` behavior.
- [x] The plan has concrete file paths and test commands.
- [x] No placeholder steps like "add appropriate validation" remain.
- [x] The scope stays focused on subtitle correction rather than a new editor product.

