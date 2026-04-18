# AI Note Trace Dot Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI note modal's bottom trace debug block with a compact dot-based stage bar, where each dot opens a centered modal showing only that stage's own log text and a copy action.

**Architecture:** Keep the existing `AiTraceStep` data model and trace collection flow intact. The frontend will add a small trace-stage adapter that groups stage metadata for display, then render a single horizontal dot bar at the bottom of `AiNoteModal`. Clicking a dot opens a centered detail modal that shows one stage's summary, detail text, status, and copy controls. The existing bottom debug panel will be removed entirely so the new bar becomes the only debug entry point.

**Tech Stack:** React + TypeScript + Vite frontend, existing `AiNoteModal`, `AiTraceStep`, `Modal`, `Toast`, and clipboard APIs.

---

### Task 1: Add a stage summary adapter for trace dots

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/components/ai/AiNotePanel.tsx` (if it reuses the same trace grouping helpers)
- Test: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`

- [ ] **Step 1: Define a stage grouping helper**

```ts
type TraceStageState = 'idle' | 'running' | 'success' | 'error'

interface TraceDotItem {
  stage: string
  title: string
  state: TraceStageState
  summary: string
  detailText: string
  rawDetail: Record<string, any> | undefined
}

function buildTraceDotItems(trace: AiTraceStep[]): TraceDotItem[] {
  ...
}
```

- [ ] **Step 2: Write a regression test for single-stage selection**

```ts
import { buildTraceDotItems } from '../components/ai/AiNoteModal'

test('buildTraceDotItems keeps one item per stage and preserves detail text', () => {
  const items = buildTraceDotItems([
    { stage: 'PREP.T1.2', title: 'ASR 请求', summary: 'Whisper 请求中', detail: { provider: 'local' } },
    { stage: 'LLM.CALL', title: 'LLM 调用', summary: '调用模型', detail: { model: 'gpt-4o-mini' } },
  ] as any)

  expect(items).toHaveLength(2)
  expect(items[0].stage).toBe('PREP.T1.2')
  expect(items[0].detailText).toContain('Whisper 请求中')
  expect(items[1].detailText).toContain('调用模型')
})
```

- [ ] **Step 3: Run the test to verify it fails before implementation**

Run:
```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false 2>&1 | rg -n "aiNoteModalLookup.test|AiNoteModal.tsx"
```

Expected: the new helper import or test reference is unresolved before implementation.

- [ ] **Step 4: Implement the helper and export it for tests**

```ts
export function buildTraceDotItems(trace: AiTraceStep[]): TraceDotItem[] {
  return trace.map(step => ({
    stage: step.stage,
    title: step.title,
    state: step.stage.startsWith('ERROR') ? 'error' : step.stage.startsWith('DONE') ? 'success' : 'running',
    summary: step.summary,
    detailText: [step.summary, step.detail ? JSON.stringify(step.detail, null, 2) : ''].filter(Boolean).join('\n\n'),
    rawDetail: step.detail,
  }))
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false 2>&1 | rg -n "AiNoteModal.tsx|aiNoteModalLookup.test.ts"
```

Expected: no errors from the touched AI note trace files.

---

### Task 2: Replace the bottom debug block with the dot bar and detail modal

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/components/Modal.tsx` if reuse requires a small prop tweak
- Modify: `apps/web/src/components/Toast.tsx` if copy feedback needs a shared pattern

- [ ] **Step 1: Add the bottom dot bar UI**

```tsx
<div className="ai-note-trace-bar">
  {traceDots.map(item => (
    <button
      key={item.stage}
      type="button"
      className={`ai-note-trace-dot state-${item.state}`}
      onClick={() => setSelectedTraceItem(item)}
      aria-label={`查看 ${item.title} 日志`}
      title={`${item.title}: ${item.summary}`}
    />
  ))}
</div>
```

- [ ] **Step 2: Remove the old bottom debug panel entirely**

```tsx
// Delete the previous expandable trace debug block and any traceExpanded-only rendering.
// Keep only the new bottom trace bar and the selectedTraceItem modal.
```

- [ ] **Step 3: Add a centered stage detail modal**

```tsx
<Modal
  isOpen={selectedTraceItem !== null}
  onClose={() => setSelectedTraceItem(null)}
  title={selectedTraceItem?.title || '链路详情'}
  size="md"
  closeOnOverlayClick={true}
>
  ...
</Modal>
```

- [ ] **Step 4: Add copy controls for the current stage**

```ts
const copyStageLog = async (item: TraceDotItem) => {
  const text = [item.title, item.summary, item.detailText].filter(Boolean).join('\n\n')
  await navigator.clipboard.writeText(text)
  showToast('已复制阶段日志', 'success')
}
```

- [ ] **Step 5: Verify there is no remaining bottom trace expander**

Run:
```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false 2>&1 | rg -n "traceExpanded|ai-note-trace-bar|selectedTraceItem|AiNoteModal.tsx"
```

Expected: only the new dot bar and stage modal remain in `AiNoteModal`.

---

### Task 3: Validate error handling and the “copy” workflow

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Test: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`

- [ ] **Step 1: Surface stage-level failure states**

```ts
const stateFromStage = (stage: string, summary: string): TraceStageState => {
  if (stage.startsWith('ERROR')) return 'error'
  if (stage.startsWith('DONE')) return 'success'
  return summary.includes('失败') || summary.includes('错误') ? 'error' : 'running'
}
```

- [ ] **Step 2: Ensure empty or missing detail still shows a useful fallback**

```tsx
<pre className="whitespace-pre-wrap text-sm">
  {selectedTraceItem?.detailText || selectedTraceItem?.summary || '暂无该阶段日志'}
</pre>
```

- [ ] **Step 3: Verify the “转写失败，未获取到文本内容” case is readable**

Run:
```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false 2>&1 | rg -n "AiNoteModal.tsx"
```

Expected: the T1 failure stage can be opened and copied from the dot bar.

---

### Task 4: Synchronize docs after the UI change

**Files:**
- Modify: `docs/ai-note/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a short changelog note**

```md
- AI 笔记弹窗的底部调试区改为圆点阶段条，点击阶段可查看单阶段日志并复制
```

- [ ] **Step 2: Update the AI note README trace behavior note**

```md
AI 笔记弹窗底部使用圆点阶段条展示链路状态；点击圆点打开阶段日志弹窗，可复制单阶段日志文本。
```

- [ ] **Step 3: Verify docs mention the new interaction and no longer describe the old bottom debug block**

Run:
```bash
rg -n "traceExpanded|底部调试|圆点阶段条|阶段日志弹窗" CHANGELOG.md docs/ai-note/README.md
```

Expected: docs mention the new dot-bar interaction and do not describe the deleted expandable debug block.

---

### Task 5: Final verification and commit

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `docs/ai-note/README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run frontend type checking on the touched AI files**

Run:
```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false 2>&1 | rg -n "AiNoteModal.tsx|AiNotePanel.tsx|StyleSelector.tsx|AiNoteSettings.tsx|promptCatalog.ts|aiRuntimeState.ts"
```

Expected: no errors from the touched AI files.

- [ ] **Step 2: Run backend sanity checks only if any backend files were touched**

No backend changes are required for this feature; skip backend compilation unless a follow-up edit introduces one.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/components/ai/AiNotePanel.tsx apps/web/src/components/ai/StyleSelector.tsx apps/web/src/pages/settings/AiNoteSettings.tsx apps/web/src/services/promptCatalog.ts apps/web/src/services/aiRuntimeState.ts docs/ai-note/README.md CHANGELOG.md
git commit -m "feat: replace ai note trace panel with dot bar"
```

