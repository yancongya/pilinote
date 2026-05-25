# PiliNote Docs Landing Upgrade Design

## Goal

Upgrade the `apps/docs` landing page into a professional SaaS-style product page with a realistic product interface hero, advanced GSAP-driven motion, and stronger Bilibili-inspired visual identity.

The page should communicate three product stories in priority order:

1. AI note timestamp jump-back as the strongest differentiator.
2. Favorites, watch-later, history, and subscription sync as the "favorites killer" workflow.
3. Local media library and sidecar files as proof that PiliNote is a durable local knowledge base, not a one-off downloader.

## Design Direction

The visual system blends three traits:

- Professional product site: clear hierarchy, restrained layout, predictable sections, credible documentation entry points.
- Advanced dynamic demo: SVG and GSAP animations explain product behavior instead of acting as decoration.
- Bilibili youthfulness: Bilibili pink and fresh blue accents, lightweight badges, approachable wording, and active task/status details.

The first viewport should feel like a polished SaaS homepage, not a marketing-only splash page. After review, the hero must avoid a dense three-panel control-console layout. The primary visual is one calm product screen focused on "video detail + AI note jump-back"; sync, downloads, and local media management move into supporting sections.

## Page Structure

### Hero

Hero copy:

- Headline: "把 B 站收藏夹变成可复习的本地知识库"
- Supporting copy: "同步收藏夹/稍后再看/历史/订阅文件夹，自动下载落盘，生成可回跳的 AI 笔记。"
- Primary CTA: "立即开始"
- Secondary CTA: "查看工作流"

Hero visual:

- A single realistic browser/app window mockup.
- Main canvas: one video detail screen with a large video preview, playback progress, and a clean AI note panel.
- Supporting context appears as small floating chips around the product screen: "来自收藏夹", "已生成 .ai-note.md", "时间戳可回跳".
- Avoid showing full navigation, full queue, and sidecar lists in the hero at the same time.

Hero animation:

- AI note lines reveal progressively.
- A timestamp chip highlights.
- The playback progress marker jumps to the matching video moment.
- Three lightweight context chips appear in sequence to imply sync, sidecar generation, and local library without visual clutter.

### Workflow Section

Explain the complete chain:

1. 同步列表
2. 下载落盘
3. 生成 sidecar
4. AI 分析
5. 回跳复习

Use a horizontal SVG pipeline on desktop and a vertical stacked flow on mobile. ScrollTrigger advances the active step as the section enters the viewport.

### Capabilities Section

Use compact product cards:

- 收藏夹/稍后再看/历史/订阅同步
- 队列调度与失败重试
- 本地媒体库
- sidecar 归档
- AI 笔记与时间戳
- 可配置模型和提示词

Cards should use restrained surfaces and small animated status markers, not oversized decorative cards.

### Gallery Section

Replace current placeholder skeletons with realistic SVG or image-backed mock screens:

- 媒体库/下载列表
- 视频详情/AI 笔记
- 设置/AI 配置

Tabs switch between screens. GSAP crossfades and slightly shifts interface layers. The default active tab should be "视频详情/AI 笔记".

### Docs Section

Keep two clear cards:

- 开发文档
- 使用指南

This section should remain simple and trustworthy.

## Component Plan

Current files live under:

- `apps/docs/.vitepress/theme/pages/landing/`

Recommended structure:

- `LandingPage.vue`: page orchestration, section active state, ScrollTrigger setup.
- `content.ts`: copy, navigation, feature data, workflow steps, gallery tabs.
- `components/HeroSection.vue`: hero copy and CTA layout.
- `components/ProductDemo.vue`: realistic app screen container.
- `components/ProductDemoSvg.vue`: SVG interface artwork and animatable groups.
- `components/WorkflowSection.vue`: scroll-driven pipeline.
- `components/FeaturesSection.vue`: compact capability cards.
- `components/GallerySection.vue`: realistic tabbed mock screens.
- `components/DownloadSection.vue`: startup modes and command snippets.
- `components/FaqSection.vue`: current FAQ pattern.
- `components/LandingTopbar.vue`: navigation, theme toggle, CTA.

The SVG demo should be data-attribute friendly, for example:

- `[data-demo-card]`
- `[data-demo-progress]`
- `[data-demo-note-line]`
- `[data-demo-timestamp]`
- `[data-demo-sidecar]`
- `[data-demo-task-count]`

This keeps animation logic stable even if class names change.

## GSAP Motion Design

Use a single hero timeline with labels:

- `intro`: app window, nav, panels fade/slide in.
- `sync`: cards appear from source list.
- `queue`: cards enter queue and status chips update.
- `download`: progress bars and sidecar icons animate.
- `note`: AI note lines reveal.
- `jump`: timestamp chip pulses and progress indicator jumps.

Use `ScrollTrigger` for section-level reveals and workflow step activation.

Use `gsap.matchMedia()` to tune desktop and mobile behavior. Respect reduced motion through the existing `useReducedMotionGuard()` helper and CSS `prefers-reduced-motion`.

Performance rules:

- Animate transforms and opacity.
- Avoid animating layout properties such as width, height, top, and left.
- Use SVG stroke dash offsets for path progress.
- Kill timelines on component unmount.
- Avoid permanent infinite motion except subtle status pulses.

## Interaction Design

Hero app demo:

- Hovering or clicking a timestamp chip replays the jump-back animation.
- Context chips are informational only; they should not compete with the main AI note scene.

Gallery:

- Tabs are keyboard-operable with `role="tablist"` and clear selected states.
- Screens crossfade without changing the page layout.

Topbar:

- Keep section nav on desktop.
- On mobile, keep brand, theme toggle, and primary CTA. Avoid cramming all section nav items into the top bar.

## Visual System

Light mode:

- Primary: Bilibili pink.
- Secondary: clean electric blue.
- Background: white to very light cool gray.
- Surfaces: subtle borders and low-opacity tinted panels.

Dark mode:

- Keep current blue-cyan accents, but allow pink highlights for Bilibili identity.
- Avoid a one-note blue/slate page.

Typography:

- Keep VitePress/system fonts for reliability.
- Use tight hierarchy: large hero title, compact section headings, readable 14-16px body copy.

UI shape:

- Cards and app panels should be 8-16px radius depending on scale.
- Avoid nesting decorative cards inside decorative cards.
- Use badges, progress strips, tabs, and command snippets as functional UI elements.

## Accessibility

- Preserve meaningful text outside SVG where possible.
- SVG demo should have a concise accessible label and hide purely decorative layers.
- Buttons need visible focus states.
- Tabs must expose selected state.
- The page must remain usable when reduced motion is enabled.
- Avoid emoji icons in functional controls; use text or SVG icons.

## Verification

Run:

```bash
pnpm -C apps/docs build
pnpm -C apps/docs dev
```

Browser checks:

- `/` loads without VitePress overlay or console errors.
- Hero renders meaningful content above the fold on desktop and mobile.
- No horizontal scrolling at mobile widths.
- Theme toggle works.
- Gallery tab switching works.
- Reduced-motion mode does not leave hidden content invisible.
- Build does not introduce unresolved asset paths.

Use screenshots for:

- desktop hero
- mobile hero
- gallery tab state
- dark mode

## Out of Scope

- Changing backend or frontend app behavior.
- Building real product telemetry.
- Adding downloadable release packaging.
- Rewriting the documentation information architecture beyond landing links.

## Open Implementation Notes

- Existing `public/landing/mock-*.svg` assets can be reused or replaced with generated SVG mockups.
- The current `GallerySection.vue` still uses placeholder skeletons and should be the first visible section to replace after the hero.
- The existing `useReducedMotionGuard()` helper is suitable for the first implementation pass.
