# AI 笔记与字幕内联控制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 笔记与字幕分析/重生成改为页面内常驻控制区，支持后台执行、阶段性 toast 提示和真正取消当前任务，并移除现有弹窗主入口。

**Architecture:** 前端以 `NoteTab`、`TranscriptTab` 为主入口，把配置、启动、停止和结果展示放到同一页面流中；后端继续复用 AI 笔记的 `note.meta.control` 模式，并为字幕分析引入独立的可取消任务运行时与任务 ID。两条流程都通过状态轮询或 SSE 事件驱动 toast，确保任务执行与 UI 展示解耦。

**Tech Stack:** React + TypeScript + Vite, FastAPI, Python, SSE/轮询, 现有 `AiNoteService` / `subtitle_analyzer` / `apiService` / `aiNoteService`

---

### Task 1: 梳理并固化共享任务控制接口

**Files:**
- Modify: `apps/web/src/services/aiNote.ts`
- Modify: `apps/web/src/services/api.ts`
- Modify: `apps/api/src/routers/note.py`
- Modify: `apps/api/src/routers/ai_subtitle.py`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/aiTaskControls.test.ts
it('maps note and subtitle task cancellation endpoints', async () => {
  expect(aiNoteService.cancelNote('note_1')).resolves.toEqual({ success: true, message: '已取消' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/aiTaskControls.test.ts -v
```

Expected: fail because the new control helpers or endpoint mappings are not yet unified.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/services/aiNote.ts
export interface TaskControlState {
  state: 'running' | 'paused' | 'cancelled' | 'completed'
  current_stage?: string
  resume_from_stage?: string
}

export interface TaskToastEvent {
  task_id: string
  stage: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  message?: string
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/aiTaskControls.test.ts -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/aiNote.ts apps/web/src/services/api.ts apps/api/src/routers/note.py apps/api/src/routers/ai_subtitle.py
git commit -m "feat: unify ai task control endpoints"
```

### Task 2: 后端补齐真正取消能力

**Files:**
- Modify: `apps/api/src/services/ai/note_service.py`
- Modify: `apps/api/src/llm/openai_client.py`
- Modify: `apps/api/src/llm/deepseek_client.py`
- Modify: `apps/api/src/services/ai/subtitle_analyzer.py`
- Create: `apps/api/src/services/ai/task_control.py`
- Create: `apps/api/src/services/ai/subtitle_task_service.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/test_ai_task_cancel.py
def test_note_cancel_sets_control_state_and_stops():
    service = AiNoteService()
    assert service.cancel_analysis(note_id) is True
    note = service.get_note(note_id)
    assert note.meta["control"]["state"] == "cancelled"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest test_ai_task_cancel.py -v
```

Expected: fail because subtitle tasks still have no cancel runtime and LLM calls do not consult a shared cancel token.

- [ ] **Step 3: Write minimal implementation**

```python
# apps/api/src/services/ai/task_control.py
@dataclass
class TaskControl:
    task_id: str
    state: str = "running"
    current_stage: Optional[str] = None
    cancelled: bool = False

    def cancel(self) -> None:
        self.cancelled = True
        self.state = "cancelled"
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api
source venv/bin/activate
python3 -m pytest test_ai_task_cancel.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/ai/task_control.py apps/api/src/services/ai/subtitle_task_service.py apps/api/src/services/ai/note_service.py apps/api/src/llm/openai_client.py apps/api/src/llm/deepseek_client.py apps/api/src/services/ai/subtitle_analyzer.py
git commit -m "feat: add cancellable ai task runtime"
```

### Task 3: 把 AI 笔记页改成常驻控制区

**Files:**
- Modify: `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/components/ai/AiNotePanel.tsx`
- Modify: `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- Create: `apps/web/src/components/ai/AiTaskControlBar.tsx`
- Create: `apps/web/src/hooks/useAiTaskControls.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/__tests__/noteTabInlineControls.test.tsx
it('renders inline controls without opening a modal', async () => {
  render(<NoteTab videoId="x" selectedSubtitleFilename="y.srt" />)
  expect(screen.getByText('模型')).toBeInTheDocument()
  expect(screen.queryByText('AI 笔记')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/noteTabInlineControls.test.tsx -v
```

Expected: fail because the settings are still split between modal and panel.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/ai/AiTaskControlBar.tsx
export function AiTaskControlBar({ model, detailLevel, style, formats, onStart, onStop }: Props) {
  return (
    <section>
      {/* 模型 / 详细程度 / 风格 / 高级设置 / 开始 / 停止 */}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/noteTabInlineControls.test.tsx -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/components/AiNotePanel/NoteTab.tsx apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/components/ai/AiNotePanel.tsx apps/web/src/components/NewDownload/VideoLibrary.tsx apps/web/src/components/ai/AiTaskControlBar.tsx apps/web/src/hooks/useAiTaskControls.ts
git commit -m "feat: inline ai note controls"
```

### Task 4: 把字幕页改成常驻控制区并移除弹窗主入口

**Files:**
- Modify: `apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx`
- Modify: `apps/web/src/components/ai/SubtitleAnalysisModal.tsx`
- Modify: `apps/web/src/services/api.ts`
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/pages/components/AiNotePanel/index.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/__tests__/transcriptInlineControls.test.tsx
it('starts subtitle analysis inline and does not open the modal', () => {
  render(<TranscriptTab videoId="x" />)
  expect(screen.getByText('开始分析')).toBeInTheDocument()
  expect(screen.queryByText('AI 字幕分析')).not.toBeVisible()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/transcriptInlineControls.test.tsx -v
```

Expected: fail because analysis still relies on the modal.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx
const [subtitleModel, setSubtitleModel] = useState(selectedProvider)
const [analysisRunning, setAnalysisRunning] = useState(false)
// 页面内直接渲染分析设置区、开始按钮、停止按钮、结果区
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/transcriptInlineControls.test.tsx -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx apps/web/src/components/ai/SubtitleAnalysisModal.tsx apps/web/src/services/api.ts apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/pages/components/AiNotePanel/index.tsx
git commit -m "feat: inline subtitle analysis controls"
```

### Task 5: 接入 toast 与阶段进度提示

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- Modify: `apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx`
- Create: `apps/web/src/hooks/useAiTaskToast.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/__tests__/aiTaskToast.test.tsx
it('emits one toast per completed stage', () => {
  const events = [{ stage: 'PROMPT.BUILD', status: 'completed' }]
  expect(buildToastMessages(events)).toEqual(['Prompt 构建完成'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/aiTaskToast.test.tsx -v
```

Expected: fail because there is no shared toast mapper yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/hooks/useAiTaskToast.ts
export function useAiTaskToast(taskId: string | null, stages: AiTraceStep[]) {
  // 去重并根据 stage/status 发 toast
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web
pnpm vitest run src/__tests__/aiTaskToast.test.tsx -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/pages/components/AiNotePanel/NoteTab.tsx apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx apps/web/src/hooks/useAiTaskToast.ts
git commit -m "feat: add ai task stage toasts"
```

### Task 6: 验证取消、回归和清理

**Files:**
- Modify: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`
- Modify: `apps/web/src/__tests__/videoDetailOpus.test.ts`
- Modify: `apps/api/test_ai_note_prompts.py`
- Modify: `apps/api/test_ai_task_cancel.py`

- [ ] **Step 1: Write the failing test**

```bash
# 运行前后端现有测试，确保新入口没有破坏旧逻辑
cd apps/api && source venv/bin/activate && python3 -m pytest test_ai_note_prompts.py test_ai_task_cancel.py -v
cd apps/web && pnpm vitest run src/__tests__/aiNoteModalLookup.test.ts src/__tests__/videoDetailOpus.test.ts -v
```

- [ ] **Step 2: Run test to verify it fails**

Expected: fail if any modal-only path or cancel path is still unhandled.

- [ ] **Step 3: Write minimal implementation**

```ts
// 清理旧入口引用，确保页面内联控制成为唯一主入口
// 保留必要的兼容壳，但不再作为默认导航或主交互
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api && source venv/bin/activate && python3 -m pytest test_ai_note_prompts.py test_ai_task_cancel.py -v
cd apps/web && pnpm vitest run src/__tests__/aiNoteModalLookup.test.ts src/__tests__/videoDetailOpus.test.ts -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/__tests__/aiNoteModalLookup.test.ts apps/web/src/__tests__/videoDetailOpus.test.ts apps/api/test_ai_note_prompts.py apps/api/test_ai_task_cancel.py
git commit -m "test: cover ai inline control flow"
```

---

## 风险点

- AI 笔记与字幕的取消边界不同：
  - 笔记有 LLM 流式调用和 ASR 子进程
  - 字幕主要是一次性分析请求
- toast 去重需要基于任务 ID 和阶段状态，否则轮询会刷屏。
- 去掉弹窗后，旧入口按钮必须明确跳转到页面内联控制区，不能再保持双入口并存。
- 如果字幕分析当前没有足够的任务状态字段，必须先补后端 task ID，否则前端无法稳定中断和恢复状态。

---

## 完成标准

- `NoteTab` 与 `TranscriptTab` 都是页面内联控制，不再依赖弹窗作为主入口。
- 点击开始后后台执行，用户可继续浏览当前页面。
- 点击停止后，后台任务会真正进入取消态，并尽快释放资源。
- 每个关键阶段都能触发一次 toast。
- 相关测试通过，且旧入口不会回归为主交互。
