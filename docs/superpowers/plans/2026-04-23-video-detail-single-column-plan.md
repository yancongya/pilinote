# Video Detail Bilibili-Style Single-Column Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the video detail page as a PC-and-mobile unified single-column flow that feels closer to the Bilibili app while preserving every existing feature and content block, and make the top navigation behave like a Bilibili content page with a dark-mode-safe back button and a title that opens the original Bilibili page.

**Architecture:** Keep `VideoDetailPage.tsx` as the data/orchestration layer, but move all layout responsibilities into a single-column page shell and a dedicated CSS file. Reorder the existing sections into a vertical reading flow: sticky header, hero cover, metadata, actions, description/body, playlist, comments, and the AI outlet. The sticky header should look more like the Bilibili app: compact, dark-mode safe, and with a clickable title that opens the original Bilibili URL in a new tab. Do not alter API contracts or feature behavior; only reshape presentation and section ordering.

**Tech Stack:** React + TypeScript + Vite frontend, existing `VideoDetailPage.tsx`, existing API services, existing download/local playback helpers, CSS/inline style refactor, manual browser verification.

---

## File Map

### Core implementation

- Modify: `apps/web/src/pages/VideoDetailPage.tsx`
  - Keep data fetching, local playback, download logic, comments, opus rendering, and `Outlet`.
  - Replace the current two-column / responsive branching layout with a single-column page structure.
  - Reorder existing sections into a Bilibili-style vertical flow.
  - Add a Bilibili-style sticky header treatment, make the back button legible in dark mode, and make the title clickable to the original Bilibili page.

- Create: `apps/web/src/pages/VideoDetailPage.css`
  - Hold the new page shell, spacing, sticky header, card surfaces, and responsive width rules.
  - Define the header chrome, dark-mode-safe back button, title link affordance, and subtle Bilibili-like top-bar styling.
  - Remove the current layout dependence on inline width/flex branching.

### Documentation

- Modify: `docs/components/video-detail-page.md`
  - Update the documented page layout and section order.
- Modify: `docs/web/implementation.md`
  - Update the frontend implementation summary for the new single-column detail page.
- Modify: `docs/web/recent-updates.md`
  - Record the detail-page redesign once implemented.

---

## Task 1: Replace the detail page shell with a single-column layout

**Files:**
- Modify: `apps/web/src/pages/VideoDetailPage.tsx`
- Create: `apps/web/src/pages/VideoDetailPage.css`

- [ ] **Step 1: Write the structural shell that every detail variant will use**

```tsx
return (
  <div className="video-detail-page">
    <header className="video-detail-header">
      <button className="video-detail-back-button">...</button>
      <h1 className="video-detail-title">{video.title}</h1>
      <div className="video-detail-header-actions" />
    </header>

    <main className="video-detail-content">
      {/* hero, meta, actions, body, playlist, comments */}
    </main>

    <Outlet />
  </div>
)
```

- [ ] **Step 2: Move the page width, spacing, sticky header, and scroll container rules into CSS**

```css
.video-detail-page {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  background: var(--color-bg-primary);
}

.video-detail-content {
  width: min(100%, 960px);
  margin: 0 auto;
  padding: 0 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.video-detail-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 12px;
}
```

- [ ] **Step 3: Verify the shell no longer branches into a desktop two-column container**

Run:

```bash
cd apps/web
pnpm dev
```

Expected:
- The page loads at `http://localhost:5173`.
- The detail page uses one centered vertical content column on both desktop and mobile.
- No desktop-only right column is visible.

- [ ] **Step 4: Commit the shell refactor**

```bash
git add apps/web/src/pages/VideoDetailPage.tsx apps/web/src/pages/VideoDetailPage.css
git commit -m "feat(video-detail): switch to single-column shell"
```

## Task 1.5: Make the top navigation Bilibili-like and add original-page title links

**Files:**
- Modify: `apps/web/src/pages/VideoDetailPage.tsx`
- Modify: `apps/web/src/pages/VideoDetailPage.css`

- [ ] **Step 1: Make the back button and top bar visually closer to the Bilibili app**

```tsx
<header className="video-detail-header">
  <button className="video-detail-back-button" aria-label="返回">
    <ArrowLeft size={20} />
  </button>
  <a className="video-detail-title-link" href={originalBilibiliUrl} target="_blank" rel="noreferrer" title="打开原始 B 站网页">
    <h1 className="video-detail-title">{video.title}</h1>
  </a>
  <a className="video-detail-header-action" href={originalBilibiliUrl} target="_blank" rel="noreferrer">
    原网页
  </a>
</header>
```

- [ ] **Step 2: Add a small URL helper so title clicks open the original Bilibili page**

```ts
const getOriginalBilibiliUrl = () => {
  if (video?.isOpus) {
    return `https://www.bilibili.com/read/cv${String(video.aid || mediaId || '').replace(/^cv/i, '')}`
  }
  return video?.bvid ? `https://www.bilibili.com/video/${video.bvid}` : 'https://www.bilibili.com'
}
```

- [ ] **Step 3: Make the navigation affordance work in dark mode and on mobile**

Run:

```bash
cd apps/web
pnpm dev
```

Expected:
- The back button remains visible against dark backgrounds.
- Clicking the title opens the original Bilibili page in a new tab.
- The header still consumes only a compact amount of vertical space.

- [ ] **Step 4: Commit the navigation polish**

```bash
git add apps/web/src/pages/VideoDetailPage.tsx apps/web/src/pages/VideoDetailPage.css
git commit -m "feat(video-detail): polish app-style navigation"
```

---

## Task 2: Reorder the video and opus content into Bilibili-style cards

**Files:**
- Modify: `apps/web/src/pages/VideoDetailPage.tsx`
- Modify: `apps/web/src/pages/VideoDetailPage.css`

- [ ] **Step 1: Rebuild the render order into a vertical reading flow**

```tsx
<main className="video-detail-content">
  <section className="video-detail-hero">...</section>
  <section className="video-detail-meta">...</section>
  <section className="video-detail-actions">...</section>
  <section className="video-detail-body">...</section>
  <section className="video-detail-playlist">...</section>
  <section className="video-detail-comments">...</section>
</main>
```

- [ ] **Step 2: Keep the existing data and event handlers attached to the new card order**

```tsx
const handleCoverPlay = () => { /* keep local playback behavior */ }
const handleAddToDownload = async (e: React.MouseEvent) => { /* keep download behavior */ }
const performDownload = async (video: any, e: React.MouseEvent) => { /* keep queue behavior */ }
```

- [ ] **Step 3: Give the hero card Bilibili-app-like emphasis without changing the media**

```tsx
<section className="video-detail-hero">
  {video.isOpus ? <img ... /> : <img ... />}
  <div className="video-detail-hero-badge">...</div>
  {!video.isOpus && hasLocalPlayback && mediaMode === 'poster' && (
    <button className="video-detail-play-overlay">...</button>
  )}
</section>
```

- [ ] **Step 4: Verify the top-to-bottom reading order on both media types**

Run:

```bash
cd apps/web
pnpm dev
```

Expected:
- `/video/:videoId` shows cover -> metadata -> actions -> description -> playlist -> comments.
- `/opus/:opusId` shows cover -> metadata -> actions -> article body in one vertical stream.
- No section jumps to the side on desktop.

- [ ] **Step 5: Commit the content reflow**

```bash
git add apps/web/src/pages/VideoDetailPage.tsx apps/web/src/pages/VideoDetailPage.css
git commit -m "feat(video-detail): reflow content into vertical cards"
```

---

## Task 3: Preserve all special behaviors in the new layout

**Files:**
- Modify: `apps/web/src/pages/VideoDetailPage.tsx`
- Modify: `apps/web/src/pages/VideoDetailPage.css`

- [ ] **Step 1: Keep local playback, download, and re-download states visible in the new action card**

```tsx
<section className="video-detail-actions">
  <button onClick={handleAddToDownload} disabled={downloading}>
    {getButtonText()}
  </button>
  {!video.isOpus && hasLocalPlayback && (
    <button onClick={handleCoverPlay}>本地播放</button>
  )}
</section>
```

- [ ] **Step 2: Keep the playlist card for multi-P videos and preserve per-cid playback state**

```tsx
{video.pages && video.pages.length > 1 && (
  <section className="video-detail-playlist">
    {playablePages.map((page: any) => (
      <button key={page.cid} onClick={() => startLocalPlayback(...)} />
    ))}
  </section>
)}
```

- [ ] **Step 3: Keep the comments card and opus body in the same page flow without changing data shape**

```tsx
{!video.isOpus && video.comments && video.comments.length > 0 && (
  <section className="video-detail-comments">...</section>
)}

{video.isOpus && localOpusBlocks.length > 0 && (
  <section className="video-detail-opus-body">...</section>
)}
```

- [ ] **Step 4: Keep the AI child route mounted at the bottom of the detail page**

```tsx
<Outlet />
```

- [ ] **Step 5: Run a focused browser regression pass on the preserved behaviors**

Run:

```bash
cd apps/web
pnpm dev
```

Manual checks:
- Click the cover on a video with local playback and confirm it swaps to the local `<video>` player.
- Verify the download button still changes label and behavior for single and multi-P videos.
- Verify multi-P pages still show per-part status chips and playback entry points.
- Verify opus pages still prefer local Markdown when available.
- Verify the AI outlet still renders below the main detail content.

- [ ] **Step 6: Commit the behavior-preservation pass**

```bash
git add apps/web/src/pages/VideoDetailPage.tsx apps/web/src/pages/VideoDetailPage.css
git commit -m "feat(video-detail): preserve playback and download flows"
```

---

## Task 4: Update documentation and record the redesign

**Files:**
- Modify: `docs/components/video-detail-page.md`
- Modify: `docs/web/implementation.md`
- Modify: `docs/web/recent-updates.md`

- [ ] **Step 1: Update the component doc to describe the new single-column section order**

```md
- Sticky header
- Hero cover card
- Metadata card
- Action card
- Description / body
- Playlist card
- Comments card
- AI outlet
```

- [ ] **Step 2: Update the web implementation doc to note that the detail page now shares one layout language across desktop and mobile**

```md
- VideoDetailPage now uses a single-column flow on PC and mobile.
- Desktop only increases width and spacing; it no longer reintroduces a side column.
```

- [ ] **Step 3: Add a short recent-update entry once the redesign is implemented**

```md
### 2026-04-23 - 视频详情页单列流式重设计
- PC 和手机统一为单列流式详情页
- 保留封面、下载、本地播放、分P、评论、图文正文和 AI 子路由
- 视觉更接近 B 站 App
```

- [ ] **Step 4: Verify the docs are consistent with the implemented layout**

Run:

```bash
git diff -- docs/components/video-detail-page.md docs/web/implementation.md docs/web/recent-updates.md
```

Expected:
- The docs mention the single-column flow explicitly.
- No old two-column detail-page description remains.

- [ ] **Step 5: Commit the documentation update**

```bash
git add docs/components/video-detail-page.md docs/web/implementation.md docs/web/recent-updates.md
git commit -m "docs(video-detail): document single-column redesign"
```

---

## Verification Summary

Before merge, confirm:

- The detail page uses one vertical reading flow on desktop and mobile.
- No feature was dropped while moving to the single-column layout.
- Video and opus branches still render correctly.
- Local playback, download, comments, playlist, and AI outlet still work.
- Documentation matches the final layout language.

## Out of Scope

- Rewriting the video detail data model.
- Changing API payloads.
- Introducing a new design system.
- Moving AI outlet behavior out of `VideoDetailPage`.
