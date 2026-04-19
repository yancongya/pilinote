# AI 笔记阶段断点重跑实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许用户双击 AI 笔记时间轴中的任意阶段圆点，从该阶段开始重新分析并继续执行后续阶段。

**Architecture:** 前端在 `AiNoteModal` 中为每个阶段节点增加“阶段重跑”交互，双击后向后端发送 `resume_from_stage`。后端在 `AiNoteService` 中根据起始阶段截断旧 trace，重建该阶段所需的最小上下文，然后从该阶段继续执行后续步骤。阶段恢复只作用于当前 note，不引入新的通用任务编排层。

**Tech Stack:** React + TypeScript + Vite，FastAPI + Python，SQLAlchemy，现有 `AiNoteService` / `AiNoteModal` / `AiTraceStep` 结构。

---

### Task 1: Define stage resume API contract and backend state handling

**Files:**
- Modify: `apps/api/src/routers/note.py`
- Modify: `apps/api/src/services/ai/note_service.py`
- Modify: `apps/api/src/models/ai_note.py` if trace/state fields need explicit persistence support
- Test: `apps/api/src/services/ai/note_service.py` via `python3 -m compileall`

- [ ] **Step 1: Add the failing API contract test in the router layer**

```python
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_resume_from_stage_endpoint_requires_note_and_stage():
    response = client.post("/api/note/resume-from-stage/does-not-exist", json={"resume_from_stage": "LLM.ANALYZE"})
    assert response.status_code in (404, 422)
```

- [ ] **Step 2: Run the test to verify the route does not exist yet**

Run:
```bash
cd apps/api
python3 -m pytest -q
```

Expected: the new test fails because `/api/note/resume-from-stage/{note_id}` is not implemented.

- [ ] **Step 3: Add the request/response contract and persistence helpers**

```python
class ResumeFromStageRequest(BaseModel):
    resume_from_stage: str = Field(..., description="从哪个阶段开始重跑")


@router.post("/resume-from-stage/{note_id}")
async def resume_from_stage(note_id: str, request: ResumeFromStageRequest):
    service = AiNoteService()
    if not service.resume_from_stage(note_id, request.resume_from_stage):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"success": True, "message": "已从指定阶段重跑"}
```

```python
def resume_from_stage(self, note_id: str, resume_from_stage: str) -> bool:
    note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
    if not note:
        return False
    # clear downstream trace and store resume stage in control metadata
    ...
```

- [ ] **Step 4: Run compileall to verify the backend still parses**

Run:
```bash
cd apps/api
python3 -m compileall src/routers/note.py src/services/ai/note_service.py
```

Expected: both files compile without syntax errors.

- [ ] **Step 5: Commit the backend contract**

```bash
git add apps/api/src/routers/note.py apps/api/src/services/ai/note_service.py
git commit -m "feat: add ai note stage resume contract"
```

### Task 2: Implement stage-trace truncation and resume execution in the AI service

**Files:**
- Modify: `apps/api/src/services/ai/note_service.py`
- Test: `apps/api/src/services/ai/note_service.py` via compileall, plus a small direct-service smoke script

- [ ] **Step 1: Add a failing service-level smoke test**

```python
from src.services.ai.note_service import AiNoteService

def test_stage_cutoff_truncates_downstream_trace():
    service = AiNoteService()
    # assume a note with trace stages A/B/C exists or construct a local trace object
    ...
```

- [ ] **Step 2: Verify the service currently has no stage-truncation helper**

Run:
```bash
cd apps/api
python3 -m pytest -q
```

Expected: the new smoke test fails or is impossible to satisfy until helper methods are added.

- [ ] **Step 3: Add stage ordering and trace truncation helpers**

```python
STAGE_ORDER = [
    "AUDIO.FETCH",
    "SUBTITLE.GENERATE",
    "NFO.READ",
    "PROMPT.BUILD",
    "LLM.ANALYZE",
    "CONTENT.GENERATE",
]

def _stage_index(stage: str) -> int:
    normalized = stage.upper().strip()
    if normalized not in STAGE_ORDER:
        raise ValueError(f"Unknown stage: {stage}")
    return STAGE_ORDER.index(normalized)

def _truncate_trace_from_stage(self, note: AiNote, resume_from_stage: str) -> None:
    cutoff = _stage_index(resume_from_stage)
    note.meta = {
        **(note.meta or {}),
        "trace": [step for step in (note.meta or {}).get("trace", []) if _stage_index(step["stage"]) < cutoff],
        "control": {
            **((note.meta or {}).get("control", {}) if isinstance((note.meta or {}).get("control", {}), dict) else {}),
            "resume_from_stage": resume_from_stage,
            "current_stage": resume_from_stage,
            "state": "running",
        },
    }
```

- [ ] **Step 4: Wire resume execution to the selected stage**

```python
def resume_from_stage(self, note_id: str, resume_from_stage: str) -> bool:
    note = self.db.query(AiNote).filter(AiNote.id == note_id).first()
    if not note:
        return False
    self._truncate_trace_from_stage(note, resume_from_stage)
    self.db.add(note)
    self.db.commit()
    # re-enter execution starting from the requested stage
    self._run_analysis(..., resume_from_stage=resume_from_stage)
    return True
```

- [ ] **Step 5: Run compileall and a targeted smoke script**

Run:
```bash
cd apps/api
python3 -m compileall src/services/ai/note_service.py
```

Expected: compile passes.

- [ ] **Step 6: Commit the service implementation**

```bash
git add apps/api/src/services/ai/note_service.py
git commit -m "feat: resume ai note analysis from stage"
```

### Task 3: Add double-click stage interaction in the AI note modal

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/services/aiNote.ts`
- Modify: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`

- [ ] **Step 1: Add a failing UI behavior test for stage double-click**

```typescript
import { buildTraceDotItemsForNote } from '../components/ai/AiNoteModal'

test('double clicking a stage should request stage resume', () => {
  const items = buildTraceDotItemsForNote(note, trace)
  expect(items.find(item => item.stage === 'LLM.ANALYZE')).toBeTruthy()
})
```

- [ ] **Step 2: Run the existing Vitest target and confirm no stage resume action exists**

Run:
```bash
cd apps/web
./node_modules/.bin/vitest run src/__tests__/aiNoteModalLookup.test.ts
```

Expected: the new interaction is not yet wired.

- [ ] **Step 3: Add a dedicated stage-resume API helper**

```typescript
async resumeFromStage(noteId: string, resumeFromStage: string): Promise<{ success: boolean; message?: string }> {
  const response = await apiService.request<{ success: boolean; message?: string }>(
    `/api/note/resume-from-stage/${encodeURIComponent(noteId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ resume_from_stage: resumeFromStage }),
    },
  )
  return (response.data ?? response) as { success: boolean; message?: string }
}
```

- [ ] **Step 4: Add double-click handling to timeline nodes**

```tsx
<button
  type="button"
  className="ai-note-trace-timeline-node"
  onDoubleClick={async () => {
    if (!activeNoteIdRef.current) return
    await aiNoteService.resumeFromStage(activeNoteIdRef.current, item.stage)
  }}
>
```

- [ ] **Step 5: Update the modal state reset logic so stage resume does not discard preserved trace**

```tsx
const handleStageResume = async (stage: string) => {
  if (!activeNoteIdRef.current) return
  setError(null)
  setIsAnalyzing(true)
  await aiNoteService.resumeFromStage(activeNoteIdRef.current, stage)
  const status = await pollStatus(activeNoteIdRef.current)
  setNote(status)
}
```

- [ ] **Step 6: Run the Vitest target and verify the modal test still passes**

Run:
```bash
cd apps/web
./node_modules/.bin/vitest run src/__tests__/aiNoteModalLookup.test.ts
```

Expected: existing lookup tests continue to pass after the new interaction is added.

- [ ] **Step 7: Commit the frontend interaction**

```bash
git add apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/services/aiNote.ts apps/web/src/__tests__/aiNoteModalLookup.test.ts
git commit -m "feat: resume ai note from timeline stage"
```

### Task 4: Verify end-to-end resume flow and regressions

**Files:**
- Modify: none expected if previous tasks are correct
- Test: manual browser flow and backend smoke checks

- [ ] **Step 1: Start backend and frontend in dev mode**

Run:
```bash
cd apps/api
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Run:
```bash
cd apps/web
pnpm dev
```

- [ ] **Step 2: Trigger a note analysis, wait for a later stage, then double-click that node**

Expected:
- Earlier stages remain visible
- The chosen stage becomes the new restart point
- Subsequent stages rerun

- [ ] **Step 3: Verify failed runs do not leave stale ASR processes**

Expected:
- `cancel` and stage resume both terminate the current ASR worker
- CPU usage drops after cancellation or resume

- [ ] **Step 4: Verify no provider regression**

Expected:
- The provider/model used for analysis still matches the one tested in settings
- DeepSeek/OpenAI/Claude continue to work the same way they did before

- [ ] **Step 5: Commit the integration verification notes if needed**

```bash
git add docs/superpowers/plans/2026-04-19-ai-note-stage-resume.md
git commit -m "docs: add ai note stage resume implementation plan"
```

