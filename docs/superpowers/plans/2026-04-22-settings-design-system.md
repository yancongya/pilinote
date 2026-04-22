# Settings Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every settings tab onto one shared design system so the page shell, sections, fields, actions, and status states can be styled and upgraded from a single source of truth.

**Architecture:** Introduce a small settings-only component layer under `apps/web/src/pages/settings/shared/` that owns the page shell, section containers, field rows, action rows, and state badges. Then move each tab to those primitives and delete the legacy `stg-*` layout contract once all consumers are migrated.

**Tech Stack:** React + TypeScript, existing app CSS variables, Vite, `pnpm`, TypeScript strict mode.

---

### Task 1: Create the shared settings design system primitives

**Files:**
- Create: `apps/web/src/pages/settings/shared/SettingsSystem.tsx`
- Create: `apps/web/src/pages/settings/shared/settings-system.css`
- Create: `apps/web/src/pages/settings/shared/index.ts`

- [ ] **Step 1: Define the shared component API**

Create a settings-only primitive layer with these exports:

```tsx
export function SettingsPageShell(props: {
  header: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}): JSX.Element

export function SettingsSection(props: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  compact?: boolean
}): JSX.Element

export function SettingsField(props: {
  label: string
  hint?: string
  icon?: React.ReactNode
  children: React.ReactNode
  align?: 'stacked' | 'inline'
}): JSX.Element

export function SettingsToggleRow(props: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}): JSX.Element

export function SettingsActionRow(props: {
  children: React.ReactNode
  dangerZone?: boolean
}): JSX.Element

export function SettingsStatusBadge(props: {
  state: 'idle' | 'saving' | 'saved' | 'error' | 'warning'
  children: React.ReactNode
}): JSX.Element

export function SettingsLoadingState(props: {
  label?: string
}): JSX.Element

export function SettingsEmptyState(props: {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}): JSX.Element
```

The CSS file should define the shared visual contract: `settings-page-shell`, `settings-section`, `settings-field`, `settings-toggle-row`, `settings-action-row`, `settings-status-badge`, and the responsive spacing rules that replace the current `stg-*` layout assumptions.

- [ ] **Step 2: Make the primitives match the existing app theme**

Use the existing CSS variable set from `apps/web/src/design-tokens.css` and the current dark mode conventions already used in `settings-page.css`. Keep the shell neutral and make the sections do the visual work: border, radius, background, internal padding, and focus treatment. Do not introduce a second color system or a separate theme source.

- [ ] **Step 3: Export the primitives from a single entry point**

Re-export the shared components from `apps/web/src/pages/settings/shared/index.ts` so the tab files can import from one local module path instead of pulling class names from the page stylesheet.

- [ ] **Step 4: Verify the new module compiles in isolation**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit
```

Expected: exit code `0`, with no new TypeScript errors from the shared settings module.

- [ ] **Step 5: Commit the shared primitives**

```bash
git add apps/web/src/pages/settings/shared/SettingsSystem.tsx apps/web/src/pages/settings/shared/settings-system.css apps/web/src/pages/settings/shared/index.ts
git commit -m "feat(settings): add shared design system primitives"
```

### Task 2: Move the settings page shell onto the shared system

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/settings-page.css`

- [ ] **Step 1: Replace the inline shell styling with the shared page shell**

Move the header, tab bar, content area, and floating save button layout into `SettingsPageShell`. Keep the current hash-based tab switching, unsaved-dot logic, and save action routing intact, but remove the inline `<style>` block from `SettingsPage.tsx`.

The page file should end up reading like this:

```tsx
return (
  <SettingsPageShell
    header={...}
    footer={...}
  >
    {activeTab === 'accounts' && <AccountsSettings />}
    {activeTab === 'download' && <DownloadSettings ref={downloadSettingsRef} />}
    ...
  </SettingsPageShell>
)
```

- [ ] **Step 2: Convert the tab bar to a reusable shell element**

Give the tab bar a shared class contract for active state, indicator positioning, and unsaved dots. Preserve the current scrolling/indicator behavior, but move the visual rules into `settings-system.css` instead of keeping them in the page component.

- [ ] **Step 3: Retain route behavior and save behavior without layout coupling**

Keep the `location.hash` sync, back button, and `handleSave` logic in `SettingsPage.tsx`. The change here is visual and structural, not a routing or state rewrite.

- [ ] **Step 4: Validate the page shell still renders correctly**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm build
```

Expected: both commands succeed. `pnpm build` should complete without CSS or import errors after the shell move.

- [ ] **Step 5: Commit the shell migration**

```bash
git add apps/web/src/pages/SettingsPage.tsx apps/web/src/settings-page.css
git commit -m "feat(settings): move page shell onto shared system"
```

### Task 3: Migrate the standard settings tabs to shared section and field primitives

**Files:**
- Modify: `apps/web/src/pages/settings/DownloadSettings.tsx`
- Modify: `apps/web/src/pages/settings/StorageSettings.tsx`
- Modify: `apps/web/src/pages/settings/BackupSettings.tsx`
- Modify: `apps/web/src/pages/settings/AutoDownloadSettings.tsx`
- Modify: `apps/web/src/pages/settings/VideoLibrarySettings.tsx`

- [ ] **Step 1: Replace `stg-panel`, `stg-group`, and `stg-item` with shared primitives**

Each of these tabs should be rewritten to compose `SettingsSection`, `SettingsField`, `SettingsToggleRow`, and `SettingsActionRow` instead of depending on raw `stg-*` class names. Preserve the existing business logic, refs, save APIs, and API calls exactly as they are.

The target structure is:

```tsx
<SettingsSection title="..." subtitle="...">
  <SettingsField label="..." hint="...">
    <select ... />
  </SettingsField>
  <SettingsToggleRow ... />
</SettingsSection>
```

- [ ] **Step 2: Normalize label, hint, and action spacing**

Use the same spacing model for:
- stacked controls such as selects and text inputs
- toggle rows
- inline action buttons
- empty/loading states
- card-like data rows that show counts or status

This is the main pass that removes the visual differences between tabs.

- [ ] **Step 3: Move the tab-specific one-off styles into local semantic wrappers**

If a tab still needs a special row shape, give it a semantic local wrapper such as `settings-cache-summary` or `settings-backup-actions`, not another generic `stg-*` escape hatch.

- [ ] **Step 4: Run type and build validation after the tab migration**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm build
```

Expected: both commands succeed after the shared primitives replace the old layout contract.

- [ ] **Step 5: Commit the standard tab migration**

```bash
git add apps/web/src/pages/settings/DownloadSettings.tsx apps/web/src/pages/settings/StorageSettings.tsx apps/web/src/pages/settings/BackupSettings.tsx apps/web/src/pages/settings/AutoDownloadSettings.tsx apps/web/src/pages/settings/VideoLibrarySettings.tsx
git commit -m "feat(settings): migrate standard tabs to shared primitives"
```

### Task 4: Migrate the account and AI note tabs, including nested AI panels

**Files:**
- Modify: `apps/web/src/pages/settings/AccountsSettings.tsx`
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx`
- Modify: `apps/web/src/pages/settings/AiPromptTemplates.tsx`
- Modify: `apps/web/src/components/ai/LocalAsrModelPanel.tsx`

- [ ] **Step 1: Rebuild the account tab with the shared section language**

Refactor the account tab so the account list, empty state, loading state, and destructive actions all use the shared section, row, badge, and status primitives. Keep the modal flows and account-switch behavior unchanged.

- [ ] **Step 2: Rebuild the AI note tab around the same primitives**

Refactor the provider editor, prompt template groups, style controls, and model status panels to use the same section and field system as the rest of settings. The nested AI panels should no longer depend on `stg-*` classes for layout.

- [ ] **Step 3: Push the same contract down into the nested AI components**

Update `LocalAsrModelPanel.tsx` and `AiPromptTemplates.tsx` so their headers, grouped controls, and action rows use the shared settings components instead of introducing a parallel micro-system.

- [ ] **Step 4: Validate the complex tabs with a full project build**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm build
```

Expected: both commands succeed, with the AI note and account tabs compiling against the shared settings primitives.

- [ ] **Step 5: Commit the complex tab migration**

```bash
git add apps/web/src/pages/settings/AccountsSettings.tsx apps/web/src/pages/settings/AiNoteSettings.tsx apps/web/src/pages/settings/AiPromptTemplates.tsx apps/web/src/components/ai/LocalAsrModelPanel.tsx
git commit -m "feat(settings): unify account and ai note tabs"
```

### Task 5: Remove legacy settings styling and lock the new naming contract

**Files:**
- Modify: `apps/web/src/settings-page.css`
- Modify: `apps/web/src/pages/styles/SettingsPage.styles.ts`
- Modify: `apps/web/src/pages/settings/shared/settings-system.css`

- [ ] **Step 1: Delete the legacy `stg-*` layout contract once all consumers are migrated**

Remove the old `stg-panel`, `stg-group`, `stg-item`, `stg-input`, `stg-select`, `stg-toggle`, `stg-btn`, and related compatibility rules from `settings-page.css` after the tab files no longer reference them. Keep only the page-shell styles that are still needed, and move the remaining settings-specific layout into the shared settings stylesheet.

- [ ] **Step 2: Delete the unused legacy styled-components file if it is still unreferenced**

If `rg -n "SettingsPage.styles|SettingsPageContainer|SettingsGroup|SettingsItem|SettingsInput|SettingsSelect|SettingsTextarea|SettingsButton|DangerButton|InfoBox" apps/web/src` still returns no imports, delete `apps/web/src/pages/styles/SettingsPage.styles.ts`. Do not keep dead style APIs around as a second maintenance surface.

- [ ] **Step 3: Finalize the naming rules in the shared stylesheet**

Lock the final naming scheme to these semantic families:
- `settings-page-*` for page shell and navigation
- `settings-section-*` for grouped content
- `settings-field-*` for inputs and helper text
- `settings-action-*` for button rows and destructive zones
- `settings-state-*` for loading, empty, status, and badges

Avoid reintroducing generic `stg-*` names in new code.

- [ ] **Step 4: Run the final verification pass**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm build
```

Then open the settings page in the browser and inspect at least these states:
- `accounts`
- `download`
- `storage`
- `backup`
- `auto-download`
- `video-library`
- `ai-note`

Expected: all tabs use the same visual language, section spacing, form spacing, and action affordances, with no broken imports or layout regressions.

- [ ] **Step 5: Commit the cleanup**

```bash
git add apps/web/src/settings-page.css apps/web/src/pages/styles/SettingsPage.styles.ts apps/web/src/pages/settings/shared/settings-system.css
git commit -m "refactor(settings): remove legacy styling contract"
```

