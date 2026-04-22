# Media List Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Favorites, Watch Later, and History into one shared list shell, skeleton, and interaction model while keeping each page's data adapter and business actions separate.

**Architecture:** Build a small shared UI layer for list state, loading, empty, and error presentation, then migrate the three pages to use it through thin adapters. Favorites keeps its lazy cache path, Watch Later and History keep their current API flows, and all three pages converge on the same list behaviors and visual rhythm.

**Tech Stack:** React + TypeScript, Zustand cache store, existing `useVideoList` hook, existing `VideoListContainer` and `VideoCardSkeleton`, FastAPI backend for Favorites lazy detail mode.

---

### Task 1: Define the shared media-list contract

**Files:**
- Create: `apps/web/src/components/media-list/MediaListShell.tsx`
- Create: `apps/web/src/components/media-list/MediaListState.tsx`
- Modify: `apps/web/src/components/VideoCardSkeleton.tsx`
- Modify: `apps/web/src/components/VideoListContainer.tsx`

- [ ] **Step 1: Write the failing type usage**

```ts
// apps/web/src/components/media-list/MediaListShell.tsx
export interface MediaListShellProps {
  title: string
  countLabel: string
  controls?: React.ReactNode
  children: React.ReactNode
  loading: boolean
  error: string
  hasItems: boolean
  emptyText: string
  refreshingHint?: string
}
```

- [ ] **Step 2: Run typecheck to verify the shared contract does not exist yet**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: FAIL with missing module/export errors for `MediaListShell` and `MediaListState`.

- [ ] **Step 3: Write the minimal shared component implementation**

```tsx
export default function MediaListShell({
  title,
  countLabel,
  controls,
  children,
  loading,
  error,
  hasItems,
  emptyText,
  refreshingHint
}: MediaListShellProps) {
  return (
    <section className="content-section">
      <div className="section-header">
        <div className="section-title">
          <h2>{title}</h2>
          <span className="video-count">{countLabel}</span>
        </div>
      </div>
      {controls}
      {refreshingHint && !loading && hasItems && (
        <div className="media-list-refresh-hint">{refreshingHint}</div>
      )}
      {children}
      {!loading && !error && !hasItems && (
        <div className="media-list-empty">{emptyText}</div>
      )}
    </section>
  )
}
```

```tsx
// apps/web/src/components/media-list/MediaListState.tsx
import VideoCardSkeleton from '../VideoCardSkeleton'

export interface MediaListStateProps {
  kind: 'loading' | 'loadingMore' | 'empty' | 'error'
  message?: string
}

export function MediaListState({ kind, message }: MediaListStateProps) {
  if (kind === 'loading') return <VideoCardSkeleton count={6} showHeader dense={false} />
  if (kind === 'loadingMore') return <VideoCardSkeleton count={3} dense showHeader={false} />
  if (kind === 'error') return <div className="media-list-error">{message}</div>
  return <div className="media-list-empty">{message}</div>
}
```

- [ ] **Step 4: Run typecheck to verify the new shared files compile**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS for the new component files once the rest of the migration is wired.

- [ ] **Step 5: Commit the shared contract**

```bash
git add apps/web/src/components/media-list/MediaListShell.tsx apps/web/src/components/media-list/MediaListState.tsx apps/web/src/components/VideoCardSkeleton.tsx apps/web/src/components/VideoListContainer.tsx
git commit -m "feat: add shared media list shell"
```

### Task 2: Make the shared skeleton and list container support both full-load and append-load states

**Files:**
- Modify: `apps/web/src/components/VideoCardSkeleton.tsx`
- Modify: `apps/web/src/components/VideoListContainer.tsx`
- Modify: `apps/web/src/components/VideoListControls.tsx`

- [ ] **Step 1: Add first-load and append-load skeleton modes**

```tsx
<VideoCardSkeleton count={6} showHeader dense={false} />
<VideoCardSkeleton count={3} showHeader={false} dense />
```

- [ ] **Step 2: Make `VideoListContainer` delegate empty/loading/error rendering to the shared state component**

```tsx
{loading && <MediaListState kind="loading" />}
{error && <MediaListState kind="error" message={error} />}
{!loading && !error && videos.length === 0 && (
  <MediaListState kind="empty" message={emptyText} />
)}
```

- [ ] **Step 3: Keep the card rendering path unchanged so the migration stays low risk**

```tsx
{videos.map((video) => (
  <VideoListCard
    key={video.bvid || video.id}
    {...video}
    onDownloadToggle={onDownloadToggle}
    downloadStatus={getDownloadStatus?.(video.bvid)}
    batchMode={batchMode}
    selected={selectedVideos.has(video.bvid || video.id)}
    onToggleSelect={onToggleSelect ? () => onToggleSelect(video.bvid || video.id) : undefined}
    clickable={!batchMode && cardClickable}
  />
))}
```

- [ ] **Step 4: Run the frontend typecheck**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS after the container and skeleton prop changes are wired.

- [ ] **Step 5: Commit the container and skeleton update**

```bash
git add apps/web/src/components/VideoCardSkeleton.tsx apps/web/src/components/VideoListContainer.tsx apps/web/src/components/VideoListControls.tsx
git commit -m "feat: standardize media list states"
```

### Task 3: Migrate Favorites to the shared shell without losing lazy cache behavior

**Files:**
- Modify: `apps/web/src/pages/components/FavoritesContent.tsx`
- Modify: `apps/web/src/services/api.ts`
- Modify: `apps/web/src/stores/cache.ts`

- [ ] **Step 1: Keep the current lazy cache key and background refresh flow**

```ts
const cacheKey = [
  selectedFolder.id,
  page,
  pageSize,
  keyword.trim() || '__all__',
  order,
  sortDirection
].join(':')
```

- [ ] **Step 2: Render Favorites through `MediaListShell` and `VideoListContainer`**

```tsx
<MediaListShell
  title={selectedFolder ? selectedFolder.title : '我的收藏'}
  countLabel={selectedFolder ? `共${selectedFolder.media_count}条视频` : `${folders.length}个收藏夹`}
  controls={selectedFolder ? (
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
        { value: 'favorite', label: '按收藏时间' }
      ]}
      loadedCount={loadedCount}
      totalCount={totalCount}
      canLoadMore={hasMore}
      onLoadMore={handleLoadMore}
      isLoading={loadingMore}
    />
  ) : null}
  loading={loading}
  loadingMore={loadingMore}
  error={error || videosError}
  hasItems={selectedFolder ? videos.length > 0 : folders.length > 0}
  emptyText={selectedFolder ? '暂无视频' : '暂无收藏夹'}
  refreshingHint={videosLoading && videos.length > 0 ? '正在刷新收藏视频...' : undefined}
>
  <VideoListContainer
    videos={videos}
    loading={false}
    loadingMore={loadingMore}
    error={videosError}
    onDownloadToggle={toggleDownload}
    getDownloadStatus={getDownloadStatus}
    loadMoreRef={loadMoreRef}
    hasMore={hasMore}
    emptyText="暂无视频"
    cardClickable={true}
  />
</MediaListShell>
```

- [ ] **Step 3: Preserve the backend lazy mode call and cache write**

```ts
const response = await apiService.getFolderDetail(
  selectedFolder.id,
  page,
  pageSize,
  keyword,
  order,
  sortDirection,
  true
)
```

- [ ] **Step 4: Verify Favorites still uses the cached page response when available**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS and no regressions in `FavoritesContent.tsx`.

- [ ] **Step 5: Commit the Favorites migration**

```bash
git add apps/web/src/pages/components/FavoritesContent.tsx apps/web/src/services/api.ts apps/web/src/stores/cache.ts
git commit -m "feat: migrate favorites to shared media list shell"
```

### Task 4: Migrate Watch Later and History to the same shell and interaction contract

**Files:**
- Modify: `apps/web/src/pages/components/WatchLaterContent.tsx`
- Modify: `apps/web/src/pages/components/HistoryContent.tsx`
- Modify: `apps/web/src/components/VideoListControls.tsx`
- Modify: `apps/web/src/components/VideoListContainer.tsx`

- [ ] **Step 1: Make both pages render title, count, controls, and list through the shared shell**

```tsx
<MediaListShell
  title="稍后再看"
  countLabel={`共${totalCount || videos.length}个视频`}
  controls={(
    <VideoListControls
      keyword={keyword}
      order={order}
      sortDirection={sortDirection}
      onKeywordChange={setKeyword}
      onOrderChange={setOrder}
      onSortDirectionChange={setSortDirection}
      sortOptions={watchLaterSortOptions}
    />
  )}
  loading={videosLoading}
  loadingMore={loadingMore}
  error={videosError}
  hasItems={videos.length > 0}
  emptyText="暂无视频"
>
  <VideoListContainer
    videos={videos}
    loading={false}
    loadingMore={loadingMore}
    error={videosError}
    onDownloadToggle={toggleDownload}
    getDownloadStatus={getDownloadStatus}
    loadMoreRef={loadMoreRef}
    hasMore={hasMore}
    emptyText="暂无视频"
    cardClickable={true}
  />
</MediaListShell>
```

- [ ] **Step 2: Keep the page-specific sort options but make the behavior consistent**

```ts
const watchLaterSortOptions = [
  { value: 'default', label: '默认' },
  { value: 'view', label: '按播放量' },
  { value: 'pubtime', label: '按发布时间' },
  { value: 'add_time', label: '按添加时间' }
]

const historySortOptions = [
  { value: 'default', label: '默认' },
  { value: 'view', label: '按播放量' },
  { value: 'pubtime', label: '按发布时间' },
  { value: 'view_time', label: '按观看时间' }
]
```

- [ ] **Step 3: Verify loading more and empty states look identical across both pages**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS and no page-specific layout regressions.

- [ ] **Step 4: Commit the Watch Later and History migration**

```bash
git add apps/web/src/pages/components/WatchLaterContent.tsx apps/web/src/pages/components/HistoryContent.tsx apps/web/src/components/VideoListControls.tsx apps/web/src/components/VideoListContainer.tsx
git commit -m "feat: unify watch later and history list shell"
```

### Task 5: Verify the unified list behavior in the browser and clean up the plan artifacts

**Files:**
- Modify: `docs/superpowers/specs/2026-04-22-media-list-shell-design.md`
- Modify: any migrated UI files from Tasks 1-4

- [ ] **Step 1: Run the frontend typecheck after all three pages are migrated**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS.

- [ ] **Step 2: Open the three pages in a browser and verify the shared states**

Check:
- Favorites first-load skeleton appears before any content flash.
- Favorites cache hit renders immediately and then refreshes quietly.
- Watch Later and History share the same top spacing, skeleton density, and empty-state layout.
- Load-more skeleton appears at the bottom without clearing existing items.

- [ ] **Step 3: Confirm the backend lazy mode still passes the focused test**

Run: `PYTHONPATH=apps/api apps/api/venv/bin/pytest apps/api/tests/test_favorites_lazy_loading.py -q`

Expected: PASS.

- [ ] **Step 4: Commit the implementation**

```bash
git add docs/superpowers/specs/2026-04-22-media-list-shell-design.md apps/web/src/components apps/web/src/pages/components apps/web/src/services/api.ts apps/web/src/stores/cache.ts apps/api/src/routers/favorites.py apps/api/tests/test_favorites_lazy_loading.py
git commit -m "feat: unify media list shell across history pages"
```

## Validation Checklist

- Three pages use the same shell, state, and skeleton language.
- Favorites still respects lazy loading and cache reuse.
- Watch Later and History still keep their own sort defaults and download actions.
- `tsc --noEmit` passes for the frontend.
- The focused favorites lazy-loading test passes for the backend.
