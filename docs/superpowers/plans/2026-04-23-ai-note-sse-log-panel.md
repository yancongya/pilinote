# AI Note SSE Log Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify AI note streaming behind a reusable SSE client and make the media library AI note modal render stage-bound logs in real time.

**Architecture:** Keep the behavior split: subtitles and notes remain separate business flows, but both consume the same SSE transport helper. The media library modal will maintain stage-local log state keyed by SSE `stage`, so each trace node can show live progress text while the task runs, and keep its final detail after completion.

**Tech Stack:** React + TypeScript, Vite, existing `fetch`/`ReadableStream` SSE parsing, Vitest, Testing Library.

---

### Task 1: Extract a reusable SSE client for note streams

**Files:**
- Modify: `apps/web/src/services/aiNote.ts`
- Test: `apps/web/src/__tests__/aiNoteStream.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { aiNoteService } from '../services/aiNote'

describe('aiNoteService.analyzeStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses SSE data lines and forwards events in order', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"stage":"A","status":"processing"}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"stage":"B","status":"completed"}\n\n'))
        controller.close()
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ body }))

    const events: Array<{ stage: string; status: string }> = []
    await aiNoteService.analyzeStream(
      '/api/test/stream',
      { hello: 'world' },
      event => events.push({ stage: event.stage, status: event.status }),
    )

    expect(events).toEqual([
      { stage: 'A', status: 'processing' },
      { stage: 'B', status: 'completed' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/__tests__/aiNoteStream.test.ts -t "parses SSE data lines and forwards events in order"`
Expected: FAIL because `analyzeStream` still has the old note-specific signature.

- [ ] **Step 3: Write minimal implementation**

```ts
async analyzeStream(
  endpoint: string,
  request: unknown,
  onEvent: (event: { stage: string; status: string; data?: any }) => void,
  signal?: AbortSignal,
): Promise<void> {
  // fetch endpoint, stream response body, parse `data:` lines, call onEvent
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/__tests__/aiNoteStream.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/aiNote.ts apps/web/src/__tests__/aiNoteStream.test.ts
git commit -m "feat: extract reusable ai note sse client"
```

### Task 2: Add a stage-log reducer for SSE note events

**Files:**
- Create: `apps/web/src/services/aiNoteStreamState.ts`
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- Test: `apps/web/src/__tests__/aiNoteStreamState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { applyAiNoteStreamEvent } from '../services/aiNoteStreamState'

describe('applyAiNoteStreamEvent', () => {
  it('stores live log text under the matching stage and keeps the last completed snapshot', () => {
    const initial = {
      activeStage: null,
      stages: {},
    }

    const processing = applyAiNoteStreamEvent(initial, {
      stage: 'video.NFO.READ',
      status: 'processing',
      data: { summary: '正在读取 NFO' },
    })

    const completed = applyAiNoteStreamEvent(processing, {
      stage: 'video.NFO.READ',
      status: 'completed',
      data: { summary: 'NFO 读取完成' },
    })

    expect(completed.activeStage).toBe('video.NFO.READ')
    expect(completed.stages['video.NFO.READ'].logs).toEqual([
      '正在读取 NFO',
      'NFO 读取完成',
    ])
    expect(completed.stages['video.NFO.READ'].status).toBe('completed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/__tests__/aiNoteStreamState.test.ts`
Expected: FAIL because `applyAiNoteStreamEvent` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// Implement a pure reducer that:
// - tracks activeStage
// - appends stage logs
// - stores status/data per stage
// - normalizes summary/error text into a displayable log line
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/__tests__/aiNoteStreamState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/aiNoteStreamState.ts apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/components/NewDownload/VideoLibrary.tsx apps/web/src/__tests__/aiNoteStreamState.test.ts
git commit -m "feat: add ai note stream state reducer"
```

### Task 3: Make the media library AI note modal use the shared stream client and reducer

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- Test: `apps/web/src/__tests__/aiNoteModalStream.test.tsx`

- [ ] **Step 1: Run the frontend**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/__tests__/aiNoteModalStream.test.tsx`
Expected: FAIL because the modal still uses poll-based note loading and does not render live stage logs.

- [ ] **Step 3: Write minimal implementation**

```ts
// In AiNoteModal:
// - call analyzeStream('/api/note/pipeline-analyze', request, onEvent)
// - update the reducer on each SSE event
// - keep the stage detail panel pointed at the selected node
// - preserve cancel/complete/error semantics
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/__tests__/aiNoteModalStream.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/components/NewDownload/VideoLibrary.tsx apps/web/src/__tests__/aiNoteModalStream.test.tsx
git commit -m "feat: stream ai note logs in media modal"
```

### Task 4: Verify the end-to-end path in the browser

**Files:**
- No code changes

- [ ] **Step 1: Run the frontend**

Run: `cd apps/web && pnpm dev`

- [ ] **Step 2: Open the media library and start AI note analysis**

Expected: the modal shows stage nodes with live log text for the running node, and completed nodes keep their final logs.

- [ ] **Step 3: Open the AI note detail route and confirm it still works**

Expected: `/video/:videoId/ai` still renders subtitle correction and note generation without regressions.

- [ ] **Step 4: Commit verification notes if needed**

No code commit required unless a follow-up fix is discovered.
