# MediaListTopBar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Favorites, Watch Later, and History pages use one shared sticky top bar that stays fixed at the top of the scrolling content area and stretches edge-to-edge within the content column.

**Architecture:** Add a page-level `MediaListTopBar` that owns the sticky layout, title row, stats row, and filter/action row. Keep `MediaListShell` as the page container for loading, empty, and error states, and migrate the three video-source pages to compose the shared top bar instead of each page rendering its own header and filter stack.

**Tech Stack:** React, TypeScript, Vite, CSS, existing `MediaListShell`, `VideoListControls`, `useVideoList`, FastAPI-backed APIs.

---

### Task 1: Add the shared sticky top bar and wire it into the shell

**Files:**
- Create: `apps/web/src/components/media-list/MediaListTopBar.tsx`
- Create: `apps/web/src/components/media-list/MediaListTopBar.css`
- Modify: `apps/web/src/components/media-list/MediaListShell.tsx`

- [ ] **Step 1: Add the new component contract**

```tsx
import type { ReactNode } from 'react'

export interface MediaListTopBarProps {
  title: ReactNode
  countLabel?: ReactNode
  primaryActions?: ReactNode
  secondaryActions?: ReactNode
  filters?: ReactNode
  className?: string
}
```

- [ ] **Step 2: Implement the minimal sticky layout**

```tsx
export default function MediaListTopBar({
  title,
  countLabel,
  primaryActions,
  secondaryActions,
  filters,
  className = ''
}: MediaListTopBarProps) {
  return (
    <div className={`media-list-topbar ${className}`.trim()}>
      <div className="media-list-topbar__headline">
        <div className="media-list-topbar__title">{title}</div>
        {countLabel !== undefined && (
          <div className="media-list-topbar__count">{countLabel}</div>
        )}
        <div className="media-list-topbar__actions">
          {primaryActions}
          {secondaryActions}
        </div>
      </div>
      {filters && <div className="media-list-topbar__filters">{filters}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Add sticky and full-width styling**

```css
.media-list-topbar {
  position: sticky;
  top: 0;
  z-index: 60;
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  padding: 12px 16px;
}

.media-list-topbar__headline,
.media-list-topbar__filters {
  width: 100%;
}
```

- [ ] **Step 4: Add an insertion slot in the shell**

```tsx
export interface MediaListShellProps {
  topBar?: ReactNode
  title?: ReactNode
  countLabel?: ReactNode
  controls?: ReactNode
}
```

```tsx
{topBar ?? (
  <>
    <div className="section-header media-list-shell-header">
      <div className="section-title media-list-shell-title">
        <h2>{title}</h2>
        {countLabel !== undefined && <span className="video-count">{countLabel}</span>}
      </div>
    </div>
    {controls && <div className="media-list-shell-controls">{controls}</div>}
  </>
)}
```

- [ ] **Step 5: Verify the shell still compiles**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: PASS with no new errors in `MediaListShell` or `MediaListTopBar`.

- [ ] **Step 6: Commit the shell work**

```bash
git add apps/web/src/components/media-list/MediaListTopBar.tsx apps/web/src/components/media-list/MediaListTopBar.css apps/web/src/components/media-list/MediaListShell.tsx
git commit -m "feat: add shared media list top bar"
```

### Task 2: Migrate Favorites, Watch Later, and History to the shared top bar

**Files:**
- Modify: `apps/web/src/pages/components/FavoritesContent.tsx`
- Modify: `apps/web/src/pages/components/WatchLaterContent.tsx`
- Modify: `apps/web/src/pages/components/HistoryContent.tsx`
- Modify: `apps/web/src/components/VideoListControls.tsx`
- Modify: `apps/web/src/components/VideoListControls.css`

- [ ] **Step 1: Move each page's title and filters into `MediaListTopBar`**

```tsx
<MediaListShell
  topBar={
    <MediaListTopBar
      title="稍后再看"
      countLabel={`共${total || videos.length}个视频`}
      filters={(
        <VideoListControls
          keyword={keyword}
          order={order}
          sortDirection={sortDirection}
          onKeywordChange={setKeyword}
          onOrderChange={setOrder}
          onSortDirectionChange={setSortDirection}
          sortOptions={[
            { value: 'default', label: '默认' },
            { value: 'view', label: '按播放量' },
            { value: 'pubtime', label: '按发布时间' },
            { value: 'add_time', label: '按添加时间' }
          ]}
          compact
          sticky={false}
        />
      )}
    />
  }
>
```

- [ ] **Step 2: Keep page-specific actions in the top bar**

```tsx
primaryActions={(
  <>
    <button className="settings-icon-button" onClick={handleBackToFolders}>
      返回
    </button>
    <button className="settings-icon-button" onClick={handleRefresh}>
      刷新
    </button>
  </>
)}
```

- [ ] **Step 3: Make `VideoListControls` behave like a full-width filter row**

```tsx
<div
  className={`video-list-controls ${compact ? 'video-list-controls--compact' : ''} ${sticky ? '' : 'video-list-controls--inline'} ${className}`.trim()}
>
```

```css
.video-list-controls--inline {
  position: relative;
  top: auto;
  z-index: auto;
  border-bottom: 0;
  background: transparent;
  padding: 0;
  width: 100%;
}

.controls-wrapper--compact {
  gap: 10px;
  width: 100%;
}
```

- [ ] **Step 4: Remove old per-page header spacing that fights the sticky bar**

```tsx
// Before
<section className="content-section">
  <MediaListShell />
</section>

// After
<section className="content-section media-list-page">
  <MediaListShell
    topBar={topBar}
    loading={videosLoading}
    loadingMore={loadingMore}
    error={videosError}
    hasItems={videos.length > 0}
    emptyText="暂无视频"
    contentClassName="media-list-shell-content"
  />
</section>
```

```css
.media-list-page {
  display: flex;
  flex-direction: column;
  gap: 0;
}
```

- [ ] **Step 5: Verify topbar layout at desktop and narrow widths**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: PASS, with the three pages still compiling after the prop migration.

Then manually verify in the browser:
- Scroll each page and confirm the top bar stays visible
- Confirm the top bar stretches full width of the content column
- Confirm the filters still wrap correctly on narrow widths

- [ ] **Step 6: Commit the page migration**

```bash
git add apps/web/src/pages/components/FavoritesContent.tsx apps/web/src/pages/components/WatchLaterContent.tsx apps/web/src/pages/components/HistoryContent.tsx apps/web/src/components/VideoListControls.tsx apps/web/src/components/VideoListControls.css
git commit -m "feat: unify media list top bar"
```

### Task 3: Update docs and verify the new layout contract

**Files:**
- Modify: `docs/web/implementation.md`
- Modify: `docs/web/favorites-page.md`
- Modify: `docs/web/watchlater-page.md`
- Modify: `docs/components/media-list-shell.md`
- Modify: `docs/web/recent-updates.md`

- [ ] **Step 1: Record the top bar contract in the implementation docs**

```md
## 历史型视频列表顶部栏

收藏页、稍后再看页、历史记录页共用 `MediaListTopBar`。
顶部栏负责 sticky 布局、标题、统计、筛选和页面级动作。
```

- [ ] **Step 2: Record the sticky behavior and full-width rule in the page docs**

```md
- 顶部导航与筛选条在滚动时始终吸顶
- 顶部区域横向撑满当前内容区
- 收藏页、稍后再看页、历史记录页共用同一套顶部布局
```

- [ ] **Step 3: Update the recent updates log with the final behavior**

```md
### 2026-04-22 - 历史型视频列表顶部栏统一

- 收藏页、稍后再看页、历史记录页接入 `MediaListTopBar`
- 顶部栏支持 sticky 吸顶和 full-width 布局
- 筛选条和页面级动作统一到同一个顶部结构
```

- [ ] **Step 4: Re-run docs map generation**

Run:

```bash
doc-map generate
```

Expected: docs map reflects the new top bar doc and updated page docs.

- [ ] **Step 5: Final verification**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

Then verify in the browser:
- Favorites, Watch Later, and History all keep the top bar fixed while scrolling
- Left and right edges line up with the content column
- Search and sort controls still work in the new layout

- [ ] **Step 6: Commit the documentation update**

```bash
git add docs/web/implementation.md docs/web/favorites-page.md docs/web/watchlater-page.md docs/components/media-list-shell.md docs/web/recent-updates.md
git commit -m "docs: document media list top bar"
```
