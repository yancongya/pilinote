# AI Trace Dot Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress AI note trace dots to main stages only, keep a single fixed modal for all states, and surface NFO-missing as a T0 stage issue instead of a generic transcription failure.

**Architecture:** Keep the existing AI note modal as the single entry point. Preserve backend trace events, but group them into a small set of canonical UI stages in the frontend: `T0`, `T1`, `T2`, `T3`, `PROMPT`, `LLM`, `DONE`, and `ERROR`. The stage detail modal continues to show a single selected stage's log, while the bottom dot bar is always visible and derived from grouped trace data.

**Tech Stack:** React + TypeScript frontend, FastAPI backend trace payloads, existing AI note modal and trace detail modal.

---

### Task 1: Group trace steps into canonical UI stages

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`

- [ ] **Step 1: Write the grouping logic**

```typescript
type UiTraceStage = 'T0' | 'T1' | 'T2' | 'T3' | 'PROMPT' | 'LLM' | 'DONE' | 'ERROR'

const TRACE_STAGE_ORDER: Array<{ stage: UiTraceStage; title: string }> = [
  { stage: 'T0', title: 'NFO 读取' },
  { stage: 'T1', title: '语音转写' },
  { stage: 'T2', title: '详细程度' },
  { stage: 'T3', title: '风格选择' },
  { stage: 'PROMPT', title: 'Prompt 构建' },
  { stage: 'LLM', title: '模型调用' },
  { stage: 'DONE', title: '完成' },
  { stage: 'ERROR', title: '错误' },
]

const normalizeStage = (stage: string): UiTraceStage => {
  const root = stage.toUpperCase().split('.')[0]
  if (root === 'PREP') {
    if (stage.startsWith('PREP.T0')) return 'T0'
    if (stage.startsWith('PREP.T1')) return 'T1'
    if (stage.startsWith('PREP.T2')) return 'T2'
    if (stage.startsWith('PREP.T3')) return 'T3'
  }
  if (root === 'PROMPT') return 'PROMPT'
  if (root === 'LLM') return 'LLM'
  if (root === 'DONE') return 'DONE'
  if (root === 'ERROR') return 'ERROR'
  return 'ERROR'
}
```

- [ ] **Step 2: Add stage aggregation**

```typescript
const buildGroupedTraceDots = (trace: AiTraceStep[]): TraceDotItem[] => {
  const grouped = new Map<UiTraceStage, AiTraceStep[]>()
  TRACE_STAGE_ORDER.forEach(item => grouped.set(item.stage, []))

  trace.forEach(step => {
    const stage = normalizeStage(step.stage)
    const list = grouped.get(stage)
    if (list) list.push(step)
  })

  return TRACE_STAGE_ORDER
    .map((item, index) => {
      const steps = grouped.get(item.stage) || []
      if (!steps.length) {
        return {
          id: `${item.stage}-${index}`,
          stage: item.stage,
          title: item.title,
          summary: '等待执行',
          status: 'pending',
          statusLabel: '等待中',
          detailText: `阶段: ${item.stage}\n\n标题: ${item.title}\n\n状态: 等待执行`,
          progress: 0,
        }
      }

      const lastStep = steps[steps.length - 1]
      const summary = steps.map(step => step.summary?.trim()).filter(Boolean).join('\n')
      const detailText = steps
        .map(step => [
          `阶段: ${step.stage}`,
          `标题: ${step.title || step.stage}`,
          step.summary ? `摘要: ${step.summary}` : '',
          step.detail ? `原始详情 JSON:\n${JSON.stringify(step.detail, null, 2)}` : '',
        ].filter(Boolean).join('\n\n'))
        .join('\n\n---\n\n')

      return {
        id: `${item.stage}-${index}`,
        stage: item.stage,
        title: item.title,
        summary: summary || '暂无摘要',
        status: getTraceStatus(lastStep),
        statusLabel: TRACE_STATUS_META[getTraceStatus(lastStep)].label,
        detailText: detailText || '暂无原始详情',
        progress: lastStep.progress,
      }
    })
}
```

- [ ] **Step 3: Replace raw dot building with grouped dots**

```typescript
const traceDots = useMemo(
  () => (currentTrace.length ? buildGroupedTraceDots(currentTrace) : buildDefaultTraceDotItems()),
  [currentTrace]
)
```

- [ ] **Step 4: Verify the grouped trace modal still opens and copies logs**

Run:
```bash
cd apps/web && pnpm exec tsc --noEmit --pretty false
```
Expected: no new errors from `AiNoteModal.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/AiNoteModal.tsx docs/superpowers/plans/2026-04-18-ai-note-trace-dot-compression.md
git commit -m "feat: compress ai note trace dots into main stages"
```

### Task 2: Keep NFO missing as a stage-level issue

**Files:**
- Modify: `apps/api/src/services/ai/note_service.py`

- [ ] **Step 1: Make the T0 trace explicit when NFO is missing**

```python
self._add_trace(
    "PREP.T0",
    "NFO 解析完成",
    "当前视频没有找到 NFO 文件。",
    20.0,
    {"found": False, "nfo_path": None},
    note=note,
)
```

- [ ] **Step 2: Ensure the transcription failure remains a separate T1 failure**

```python
if not result or not result.strip():
    raise ValueError("转写失败，未获取到文本内容")
```

- [ ] **Step 3: Verify the backend still emits one ERROR trace entry**

Run:
```bash
cd apps/api && python3 -m py_compile src/services/ai/note_service.py
```
Expected: compilation succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/ai/note_service.py
git commit -m "fix: keep nfo missing as prep stage trace"
```

