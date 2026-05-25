# Docs Landing GSAP Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the docs landing page into a professional SaaS-style product page with a realistic animated product demo, GSAP motion, and Bilibili-inspired visual identity.

**Architecture:** Keep the existing VitePress custom landing layout. Add a focused `ProductDemo.vue` component for the hero app screen, wire GSAP animation through existing Vue lifecycle patterns, refresh gallery mock screens, and update shared landing tokens in `theme.css`.

**Tech Stack:** VitePress 1.6, Vue 3 SFCs, TypeScript, GSAP + ScrollTrigger, CSS variables, SVG.

---

### Task 1: Landing Visual Tokens

**Files:**
- Modify: `apps/docs/.vitepress/theme/styles/theme.css`

- [ ] **Step 1: Add product-style tokens**

Add landing-specific tokens for app-window surfaces, pink/blue accents, status colors, and shadows. Keep existing VitePress variables intact.

- [ ] **Step 2: Verify CSS compiles**

Run: `pnpm -C apps/docs build`
Expected: build completes without CSS syntax errors.

### Task 2: Hero Product Demo

**Files:**
- Create: `apps/docs/.vitepress/theme/pages/landing/components/ProductDemo.vue`
- Modify: `apps/docs/.vitepress/theme/pages/landing/components/HeroSection.vue`

- [ ] **Step 1: Build the static product demo**

Create a realistic app-window component with left navigation, video queue, AI note panel, timestamp chips, sidecar file strip, and task summary.

- [ ] **Step 2: Add GSAP timeline**

Use Vue `onMounted`/`onBeforeUnmount`, dynamic GSAP imports, and data attributes for animatable targets. Animate intro, sync, download, sidecar generation, note reveal, and timestamp jump.

- [ ] **Step 3: Replace the old hero animation**

Import and render `ProductDemo.vue` from `HeroSection.vue`. Update hero copy and CTA labels to match the design spec.

- [ ] **Step 4: Verify build**

Run: `pnpm -C apps/docs build`
Expected: build completes.

### Task 3: Workflow and Feature Refresh

**Files:**
- Modify: `apps/docs/.vitepress/theme/pages/landing/content.ts`
- Modify: `apps/docs/.vitepress/theme/pages/landing/components/WorkflowSection.vue`
- Modify: `apps/docs/.vitepress/theme/pages/landing/components/FeaturesSection.vue`

- [ ] **Step 1: Update copy and data**

Prioritize AI jump-back, sync/download, and local media library in the content arrays.

- [ ] **Step 2: Improve workflow visuals**

Use a five-step pipeline with active status styling and better desktop/mobile flow.

- [ ] **Step 3: Improve feature card hierarchy**

Make cards compact, product-focused, and aligned to the new visual system.

- [ ] **Step 4: Verify build**

Run: `pnpm -C apps/docs build`
Expected: build completes.

### Task 4: Gallery Upgrade

**Files:**
- Modify: `apps/docs/.vitepress/theme/pages/landing/components/GallerySection.vue`

- [ ] **Step 1: Replace placeholder skeletons**

Use realistic product mock panels for media library, AI note detail, and settings. Use existing `/landing/mock-*.svg` assets or inline UI blocks.

- [ ] **Step 2: Add tab transition**

Use GSAP or CSS transitions to crossfade tab content without layout shift.

- [ ] **Step 3: Verify keyboard and build**

Ensure tabs expose `role="tab"` and `aria-selected`. Run `pnpm -C apps/docs build`.

### Task 5: Browser Verification

**Files:**
- No code files unless verification finds issues.

- [ ] **Step 1: Start docs dev server**

Run: `pnpm -C apps/docs dev`.

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5174/`. Check desktop hero, mobile hero, gallery tabs, dark mode, and console errors.

- [ ] **Step 3: Final build**

Run: `pnpm -C apps/docs build`.

Expected: build completes and no visual blockers remain.
