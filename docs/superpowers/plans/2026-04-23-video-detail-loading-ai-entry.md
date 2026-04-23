# Video Detail Loading And AI Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the video detail page feel faster and more polished on entry by showing a lightweight skeleton first, hydrating from cache without flashing, and replacing the top-right text action with the existing AI icon that opens the AI sub-route.

**Architecture:** Keep the change localized to the detail page shell. Add a small detail-page cache layer that reads in-memory data first, then `sessionStorage`, then network. Render a compact skeleton while the page resolves. Replace the current top-right text action with the reusable AI icon button pattern and navigate to the existing AI route for the current video.

**Tech Stack:** React, TypeScript, React Router, CSS, existing `apiService`, existing `AiNoteButton` icon styling.

---

### Task 1: Add detail-page cache helpers and skeleton state

**Files:**
- Modify: `apps/web/src/pages/VideoDetailPage.tsx`
- Modify: `apps/web/src/pages/VideoDetailPage.css`

- [ ] **Step 1: Write the failing test**

No automated test harness exists for this page. Verify manually by loading a video detail page in the browser and confirming the current behavior is a direct loading state with no dedicated skeleton phase.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm dev`

Expected: the page still opens without a first-class skeleton and still waits on the existing loading flow.

- [ ] **Step 3: Write minimal implementation**

Add a local detail cache pipeline inside `VideoDetailPage.tsx` with this resolution order:

```ts
type DetailCacheEntry = {
  video: VideoDetailData
  timestamp: number
}

const DETAIL_CACHE_PREFIX = 'video-detail-cache'
const DETAIL_CACHE_VERSION = 1
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000

const detailPageMemoryCache = new Map<string, DetailCacheEntry>()

const buildDetailCacheKey = (type: 'video' | 'opus', mediaId: string) =>
  `${DETAIL_CACHE_PREFIX}:v${DETAIL_CACHE_VERSION}:${type}:${mediaId}`

const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
```

Then:

```ts
const [detailReady, setDetailReady] = useState(false)
const [cachedVideo, setCachedVideo] = useState<VideoDetailData | null>(null)

const resolveCachedVideo = (key: string) => {
  const memory = detailPageMemoryCache.get(key)
  if (memory && Date.now() - memory.timestamp <= DETAIL_CACHE_TTL_MS) {
    return memory.video
  }
  if (canUseSessionStorage()) {
    const raw = window.sessionStorage.getItem(key)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DetailCacheEntry
        if (parsed.video && Date.now() - parsed.timestamp <= DETAIL_CACHE_TTL_MS) {
          detailPageMemoryCache.set(key, parsed)
          return parsed.video
        }
      } catch {
        window.sessionStorage.removeItem(key)
      }
    }
  }
  return null
}
```

On mount, resolve cached data first, set `cachedVideo`, and set `detailReady` when either cache or network data becomes usable. Keep the existing `video` state as the final source of truth, but seed it from cache before the network request finishes.

Add a compact loading skeleton layout in CSS for:

```tsx
{!detailReady && (
  <div className="video-detail-skeleton" aria-hidden="true">
    <div className="video-detail-skeleton-header" />
    <div className="video-detail-skeleton-media" />
    <div className="video-detail-skeleton-card" />
    <div className="video-detail-skeleton-card" />
  </div>
)}
```

The skeleton should visually align with the existing single-column detail cards and use the same rounded geometry.

- [ ] **Step 4: Run test to verify it passes**

Manual browser check:

```bash
cd apps/web && pnpm dev
```

Expected:

- the detail page shows a lightweight skeleton immediately
- cached content hydrates into the page without a white flash
- network refresh updates the page without resetting to a full-page loading blank

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/VideoDetailPage.tsx apps/web/src/pages/VideoDetailPage.css
git commit -m "feat(video-detail): add skeleton and cache hydration"
```

### Task 2: Replace top-right text action with AI icon navigation

**Files:**
- Modify: `apps/web/src/pages/VideoDetailPage.tsx`
- Modify: `apps/web/src/pages/VideoDetailPage.css`
- Reuse: `apps/web/src/components/ai/AiNoteButton.tsx`

- [ ] **Step 1: Write the failing test**

Manual verification in the browser should currently show the text-based top-right action still present on the detail page.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm dev`

Expected: the top-right control still says "原网页" and does not match the AI icon treatment.

- [ ] **Step 3: Write minimal implementation**

In `VideoDetailPage.tsx`, replace the current right-side `<a>` with a compact button that visually matches `AiNoteButton` styling and navigates to the existing AI panel route for the current video.

Use the current video route family:

```ts
const handleOpenAiPanel = () => {
  if (!videoId) return
  navigate(`/video/${videoId}/ai`)
}
```

Render the icon-only control with the existing sparkle icon treatment, and keep the accessible label:

```tsx
<button
  type="button"
  className="video-detail-header-action video-detail-header-action-ai"
  onClick={handleOpenAiPanel}
  aria-label="打开 AI 面板"
  title="打开 AI 面板"
>
  <Sparkles size={16} className="video-detail-header-action-icon" />
</button>
```

Use the same visual rules as the existing AI button pattern:

- circular or pill-shaped icon button
- subtle border/background in light and dark mode
- no text label on narrow screens

Keep the header grid unchanged so the button does not push the title out of center.

- [ ] **Step 4: Run test to verify it passes**

Manual browser check:

```bash
cd apps/web && pnpm dev
```

Expected:

- the top-right action is an AI icon instead of "原网页"
- clicking it opens the AI sub-route for the current video
- the back button and centered title remain visually stable

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/VideoDetailPage.tsx apps/web/src/pages/VideoDetailPage.css
git commit -m "feat(video-detail): replace external link with ai entry"
```

### Task 3: Verify layout, cache behavior, and docs

**Files:**
- Modify: `docs/web/implementation.md`
- Modify: `docs/web/recent-updates.md`
- Modify: `docs/components/video-detail-page.md`

- [ ] **Step 1: Write the failing test**

No automated docs test exists. The current documentation does not yet describe the skeleton-first detail load or the AI icon entry.

- [ ] **Step 2: Run test to verify it fails**

Inspect the docs and confirm the new behavior is not documented yet.

- [ ] **Step 3: Write minimal implementation**

Add a short note that the video detail page now:

- hydrates from cache before network completion
- uses a lightweight skeleton on entry
- routes the top-right AI icon into the current video AI panel sub-route

Keep the docs short and specific. Do not rewrite unrelated sections.

- [ ] **Step 4: Run test to verify it passes**

Check the updated docs render correctly in the `docs/` tree and that the summary matches the implementation.

- [ ] **Step 5: Commit**

```bash
git add docs/web/implementation.md docs/web/recent-updates.md docs/components/video-detail-page.md
git commit -m "docs: record video detail skeleton and ai entry"
```

## Verification Checklist

- [ ] Detail page opens with a lightweight skeleton before content is ready
- [ ] Cached detail data appears faster than a cold network load
- [ ] Cached content does not flash or reset layout when fresh data arrives
- [ ] The top-right control uses the AI icon treatment
- [ ] Clicking the icon routes to the AI panel for the current video
- [ ] The header still keeps back button, centered title, and right action on one row
- [ ] Mobile width preserves the same behavior

