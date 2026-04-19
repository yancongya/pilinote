# AI Note Pipeline Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace internal `T0/T1/T2/T3` stage labels with user-facing semantic pipeline labels for AI note analysis, while keeping old traces backward compatible.

**Architecture:** Keep the analysis execution order unchanged, but change the trace layer to emit semantic stage names that match the real workflow: audio fetching, audio reading, subtitle generation from NFO/transcript, prompt construction, AI analysis, and content generation. The backend remains the source of truth for trace emission and progress state, and the frontend maps those labels to the timeline dots. Old `T0/T1/T2/T3` traces remain readable through a normalization layer so existing notes do not regress.

**Tech Stack:** FastAPI, SQLAlchemy, React, TypeScript, Vitest.

---

### Task 1: Define semantic stage labels on the backend

**Files:**
- Modify: `apps/api/src/services/ai/note_service.py`
- Test: `apps/api/src/services/ai/note_service.py` via `python3 -m compileall`

- [ ] **Step 1: Update the trace label helper**

```python
def _trace_stage(self, pipeline_mode: str, stage: str) -> str:
    return f"{pipeline_mode}.{stage}"
```

- [ ] **Step 2: Replace `PREP.T0/T1/T2/T3` emissions with semantic labels**

```python
self._trace_stage(pipeline_mode, "AUDIO.FETCH")
self._trace_stage(pipeline_mode, "AUDIO.READ")
self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE")
self._trace_stage(pipeline_mode, "PROMPT.BUILD")
self._trace_stage(pipeline_mode, "LLM.CALL")
self._trace_stage(pipeline_mode, "LLM.RESPONSE")
self._trace_stage(pipeline_mode, "CONTENT.GENERATE")
```

- [ ] **Step 3: Keep error traces mapped to the current semantic stage**

```python
current_stage = self._get_note_control(note.id).get("current_stage") or self._trace_stage(pipeline_mode, "CONTENT.GENERATE")
self._add_trace(current_stage, "分析失败", str(e), 100.0, {"error": str(e)}, note=note)
```

- [ ] **Step 4: Run a backend syntax check**

Run: `python3 -m compileall apps/api/src/services/ai/note_service.py`
Expected: PASS

### Task 2: Make ASR steps explicit and observable

**Files:**
- Modify: `apps/api/src/services/ai/note_service.py`
- Modify: `apps/api/src/services/ai/faster_whisper_backend.py`
- Test: `python3 -m compileall apps/api/src/services/ai/note_service.py apps/api/src/services/ai/faster_whisper_backend.py`

- [ ] **Step 1: Split the T1 black box into model load and ASR execution**

```python
self._add_trace(self._trace_stage(pipeline_mode, "AUDIO.READ"), "音频读取", ...)
self._add_trace(self._trace_stage(pipeline_mode, "SUBTITLE.GENERATE"), "字幕生成", ...)
```

- [ ] **Step 2: Add `load_model()` and `get_runtime_label()` to the backend**

```python
def load_model(self):
    from faster_whisper import WhisperModel
    return WhisperModel(model_source, device=self.device, compute_type=self.compute_type)
```

- [ ] **Step 3: Allow `transcribe_audio()` to reuse a preloaded model**

```python
def transcribe_audio(self, audio_path: str, output_srt_path: Optional[str] = None, model=None) -> str:
    if model is None:
        model = self.load_model()
```

- [ ] **Step 4: Run a backend syntax check**

Run: `python3 -m compileall apps/api/src/services/ai/note_service.py apps/api/src/services/ai/faster_whisper_backend.py`
Expected: PASS

### Task 3: Update frontend timeline labels and normalization

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/services/aiNote.ts`
- Modify: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`

- [ ] **Step 1: Replace the timeline template with semantic labels**

```ts
const AI_NOTE_TRACE_STAGE_TEMPLATES = {
  video: [
    { stage: 'AUDIO.FETCH', title: '音频获取' },
    { stage: 'AUDIO.READ', title: '音频读取' },
    { stage: 'SUBTITLE.GENERATE', title: '字幕生成' },
    { stage: 'PROMPT.BUILD', title: 'Prompt 构建' },
    { stage: 'LLM.CALL', title: 'AI 分析' },
    { stage: 'CONTENT.GENERATE', title: '生成内容' },
  ],
}
```

- [ ] **Step 2: Normalize prefixed legacy stages**

```ts
const normalizeStage = (stage?: string | null) => {
  const segments = (stage || '').split('.').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  if (last === 'T0') return 'AUDIO.FETCH'
  if (last === 'T1') return 'AUDIO.READ'
  if (last === 'T2') return 'SUBTITLE.GENERATE'
  if (last === 'T3') return 'PROMPT.BUILD'
  return stage || ''
}
```

- [ ] **Step 3: Update tests to cover both new and legacy labels**

```ts
expect(normalizeStage('video.PREP.T0')).toBe('AUDIO.FETCH')
expect(normalizeStage('video.AUDIO.FETCH')).toBe('AUDIO.FETCH')
```

- [ ] **Step 4: Run the focused Vitest suite**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/__tests__/aiNoteModalLookup.test.ts`
Expected: PASS

### Task 4: Verify the full flow end to end

**Files:**
- No new files

- [ ] **Step 1: Run the frontend focused tests**

Run: `cd apps/web && ./node_modules/.bin/vitest run src/__tests__/aiNoteModalLookup.test.ts`
Expected: PASS

- [ ] **Step 2: Run a browser sanity check if the dev servers are already running**

Run: `cd apps/web && ./node_modules/.bin/playwright test`
Expected: PASS

- [ ] **Step 3: Confirm the visible timeline shows semantic labels**

Expected:
- `音频获取`
- `音频读取`
- `字幕生成`
- `Prompt 构建`
- `AI 分析`
- `生成内容`

