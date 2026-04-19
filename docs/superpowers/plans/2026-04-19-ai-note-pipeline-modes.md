# AI Note Pipeline Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split AI note analysis into video, series, and image-text pipeline modes, and make the AI note modal render the matching stage timeline for each mode.

**Architecture:** Keep the existing AI note entry point, but add an explicit pipeline mode to note metadata and trace payloads. The backend will classify the content path into one of three modes and emit mode-specific stage labels. The frontend will read the note mode and choose a matching stage template set for the bottom timeline while still showing the same trace detail drawer.

**Tech Stack:** FastAPI + SQLAlchemy backend, React + TypeScript + Vite frontend, existing `AiNoteService` / `AiNoteModal` / note status APIs.

---

### Task 1: Add explicit AI note pipeline mode to backend note records and status payloads

**Files:**
- Modify: `apps/api/src/models/ai_note.py`
- Modify: `apps/api/src/schemas/ai_note.py`
- Modify: `apps/api/src/services/ai/note_service.py`
- Modify: `apps/api/src/routers/ai.py`

- [ ] **Step 1: Add the mode field to the ORM and response schema**

```python
class AiNote(Base):
    pipeline_mode = Column(String(20), nullable=True, index=True)
```

```python
class AiNoteResponse(BaseModel):
    pipeline_mode: Optional[str] = None
```

- [ ] **Step 2: Derive the mode in note creation and analysis**

```python
def _resolve_pipeline_mode(self, file_path: Optional[str], download: Optional[Download]) -> str:
    # return "video", "series", or "image_text"
```

```python
note = AiNote(..., pipeline_mode=pipeline_mode)
```

- [ ] **Step 3: Normalize trace stage prefixes by mode**

```python
def _stage_prefix(self, pipeline_mode: str) -> str:
    return {"video": "V", "series": "S", "image_text": "G"}.get(pipeline_mode, "V")
```

```python
self._add_trace(f"{prefix}0", "目录识别", "正在识别输入目录类型", 5.0, note=note)
```

- [ ] **Step 4: Include the mode in API responses**

```python
return {
    "success": True,
    "note": note,
    "pipeline_mode": note.pipeline_mode,
}
```

- [ ] **Step 5: Verify the backend still serializes and returns existing notes**

Run:
```bash
cd apps/api && python3 -m py_compile src/models/ai_note.py src/schemas/ai_note.py src/services/ai/note_service.py src/routers/ai.py
```
Expected: all files compile.

### Task 2: Render mode-specific stage timelines in AiNoteModal

**Files:**
- Modify: `apps/web/src/services/aiNote.ts`
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`

- [ ] **Step 1: Extend note types with pipeline mode**

```typescript
export interface NoteResponse {
  pipeline_mode?: 'video' | 'series' | 'image_text'
}
```

- [ ] **Step 2: Define three stage templates and mode resolution**

```typescript
const PIPELINE_STAGE_TEMPLATES = {
  video: [
    { stage: 'V0', title: '输入识别', shortLabel: 'V0' },
    { stage: 'V1', title: '音频提取', shortLabel: 'V1' },
    { stage: 'V2', title: 'ASR 字幕生成', shortLabel: 'V2' },
    { stage: 'V3', title: '合并输入', shortLabel: 'V3' },
    { stage: 'V4', title: 'AI 总结', shortLabel: 'V4' },
    { stage: 'V5', title: 'md 输出', shortLabel: 'V5' },
  ],
  series: [
    { stage: 'S0', title: '系列识别', shortLabel: 'S0' },
    { stage: 'S1', title: '分集扫描', shortLabel: 'S1' },
    { stage: 'S2', title: '单集处理', shortLabel: 'S2' },
    { stage: 'S3', title: '系列汇总', shortLabel: 'S3' },
    { stage: 'S4', title: 'md 输出', shortLabel: 'S4' },
  ],
  image_text: [
    { stage: 'G0', title: '目录识别', shortLabel: 'G0' },
    { stage: 'G1', title: '读取已有 md', shortLabel: 'G1' },
    { stage: 'G2', title: '合并输入', shortLabel: 'G2' },
    { stage: 'G3', title: 'AI 总结', shortLabel: 'G3' },
    { stage: 'G4', title: 'md 输出', shortLabel: 'G4' },
  ],
} as const
```

- [ ] **Step 3: Use the mode-specific templates when building trace dots**

```typescript
const mode = note?.pipeline_mode || 'video'
const traceDots = useMemo(
  () => buildTraceDotItems(currentTrace, PIPELINE_STAGE_TEMPLATES[mode]),
  [currentTrace, mode]
)
```

- [ ] **Step 4: Keep lookup and result-state behavior unchanged**

```typescript
expect(deriveAiNoteModalStateFromLookup(lookup)).toEqual({
  viewState: 'loading',
  note: lookup.note,
  errorMessage: null,
  shouldPoll: true,
})
```

- [ ] **Step 5: Verify frontend typecheck and lookup tests**

Run:
```bash
cd apps/web && pnpm exec tsc --noEmit --pretty false
cd apps/web && pnpm exec vitest run src/__tests__/aiNoteModalLookup.test.ts
```
Expected: no new TypeScript errors and tests pass.

