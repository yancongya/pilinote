# LLM Config Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify AI provider API key, base URL, model, and temperature into one database-backed configuration source shared by AI 服务商 and AI 笔记 UI.

**Architecture:** The backend settings API becomes the single source of truth for provider identity and credentials. The frontend stops persisting provider configs in localStorage and instead edits the same database-backed settings object that AI 笔记 already uses. The runtime tested-model cache remains separate, but it only stores readiness/test results and no longer stores provider credentials or model identity.

**Tech Stack:** FastAPI, SQLAlchemy settings table, Pydantic schemas, React + TypeScript + Zustand, localStorage only for UI state.

---

### Task 1: Expand the settings schema to carry unified LLM provider fields

**Files:**
- Modify: `apps/api/src/schemas/settings.py:152-198`
- Modify: `apps/web/src/stores/settings.ts:70-110`
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx:20-140`

- [ ] **Step 1: Write the failing test**

Add a small backend round-trip check that serializes and deserializes `ai_note.llm` with `provider`, `base_url`, `api_key`, `model`, and `temperature`, and assert the shape survives `SettingsService.get_settings()`.

```python
def test_ai_llm_settings_round_trip(tmp_path):
    # Arrange a settings row set containing provider, base_url, api_key, model, temperature.
    # Act: call SettingsService.get_settings().
    # Assert: ai_note.llm contains all five fields and values match.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && source venv/bin/activate && python -m pytest -q`
Expected: failure because `base_url` is not yet part of `LLMSettings` and frontend types still omit it.

- [ ] **Step 3: Write minimal implementation**

Update `LLMSettings` to include `base_url: str = Field(default="", description="LLM Base URL")`. Update `SettingsService.get_settings()` to read `ai_note.llm.base_url` from the database, and `SettingsService.update_settings()` to persist it. Update the frontend `Settings` type and local settings form so AI settings can store and display the same field.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && source venv/bin/activate && python -m pytest -q`
Expected: the round-trip check passes, and `ai_note.llm.base_url` is returned with the rest of `ai_note.llm`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/schemas/settings.py apps/api/src/services/settings_service.py apps/web/src/stores/settings.ts apps/web/src/pages/settings/AiNoteSettings.tsx
git commit -m "feat: unify llm provider fields in settings schema"
```

### Task 2: Move AI 服务商 storage from localStorage into database-backed settings

**Files:**
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx:66-340`
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx:480-820`
- Modify: `apps/web/src/services/aiRuntimeState.ts:1-120`
- Modify: `apps/api/src/services/ai/ai_runtime_state_service.py:1-140`
- Modify: `apps/api/src/services/settings_service.py:399-420`

- [ ] **Step 1: Write the failing test**

Add a frontend state expectation test around the AiNote settings loader: when `settings.ai_note.llm` is present, provider tabs should initialize from DB state and not from `localStorage`. Verify `localStorage` is only used for UI-only values such as the active tab index.

```typescript
test('AiNoteSettings loads providers from database settings, not localStorage', async () => {
  // mock useSettingsStore state with ai_note.llm.provider/base_url/api_key/model/temperature
  // mock localStorage with a conflicting provider list
  // assert the rendered provider list matches settings, not localStorage
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec tsc --noEmit --pretty false`
Expected: current component logic still reads and merges `pilinote_llm_providers`, so the new test expectation fails.

- [ ] **Step 3: Write minimal implementation**

Remove `STORAGE_KEY_PROVIDERS` as the source of truth. On load, build provider cards from `settings.ai_note.llm` plus the built-in defaults, and persist edits by calling `updateSettings({ ai_note: { llm: ... } })`. Keep `localStorage` only for the selected provider tab index if needed, not for provider data.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec tsc --noEmit --pretty false`
Expected: provider cards initialize from settings and no code path treats localStorage as authoritative.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/settings/AiNoteSettings.tsx apps/web/src/services/aiRuntimeState.ts apps/api/src/services/ai/ai_runtime_state_service.py apps/api/src/services/settings_service.py
git commit -m "feat: source ai providers from settings"
```

### Task 3: Make the AI 笔记 modal read the unified provider config only

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx:200-420`
- Modify: `apps/web/src/hooks/useAiNoteLookup.ts:1-60`
- Modify: `apps/web/src/components/NewDownload/VideoLibrary.tsx:1-220`
- Modify: `apps/web/src/components/ai/AiNotePanel.tsx:1-260`

- [ ] **Step 1: Write the failing test**

Add a UI unit test or explicit assertion around `AiNoteModal` setup: the provider dropdown should list the provider entries from `settings.ai_note.llm` and should preserve the selected model from the unified config after a remount.

```typescript
test('AiNoteModal restores provider and model from unified settings', () => {
  // render modal with settings.ai_note.llm populated
  // unmount and remount
  // assert provider and selected model are restored from settings, not from ai_note.style or localStorage
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec tsc --noEmit --pretty false`
Expected: current modal still mixes old provider runtime state and settings-derived fields.

- [ ] **Step 3: Write minimal implementation**

Make `AiNoteModal` read `settings.ai_note.llm.provider`, `settings.ai_note.llm.base_url`, `settings.ai_note.llm.api_key`, `settings.ai_note.llm.model`, and `settings.ai_note.llm.temperature` only. Remove any fallback to the old local provider cache for the authoritative config. Keep runtime tested-model cache only for model readiness hints.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec tsc --noEmit --pretty false`
Expected: the modal initializes from the unified database-backed config and no longer depends on the old split source.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/hooks/useAiNoteLookup.ts apps/web/src/components/NewDownload/VideoLibrary.tsx apps/web/src/components/ai/AiNotePanel.tsx
git commit -m "feat: make ai modal use unified llm config"
```

### Task 4: Clean old fields and document the migration

**Files:**
- Modify: `apps/api/src/services/settings_service.py:600-640`
- Modify: `apps/api/src/schemas/settings.py:152-198`
- Modify: `docs/ai-note/README.md`
- Modify: `CHANGELOG.md`
- Create: `apps/api/scripts/migrate_unified_llm_config.py`

- [ ] **Step 1: Write the failing test**

Add a migration-script smoke test that loads a database fixture with legacy `ai_note.llm.api_key` and local provider cache, runs the migration script, and asserts the unified `ai_note.llm` row contains the key while the legacy only-read path is no longer used.

```python
def test_migrate_unified_llm_config_keeps_api_key(tmp_path):
    # seed legacy ai_note.llm.api_key and a local provider cache fixture
    # run migrate_unified_llm_config.py
    # assert ai_note.llm.api_key survives in the unified settings payload
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && source venv/bin/activate && python -m pytest -q`
Expected: the migration script does not yet exist, so the test fails.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/scripts/migrate_unified_llm_config.py` to copy legacy provider/base URL/API key/model values into the unified `ai_note.llm` settings, leaving runtime tested models untouched. Update docs so the new single-source-of-truth path is documented for future maintainers.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && source venv/bin/activate && python -m pytest -q`
Expected: migration script runs, unified settings contain the credentials, and legacy readers are no longer required for correctness.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/migrate_unified_llm_config.py apps/api/src/services/settings_service.py apps/api/src/schemas/settings.py docs/ai-note/README.md CHANGELOG.md
git commit -m "feat: migrate ai llm config to unified settings"
```

## Self-check

- Spec coverage: provider/base_url/api_key/model/temperature are covered in Task 1.
- Provider storage unification: covered in Task 2.
- Modal reading the unified config: covered in Task 3.
- Legacy cleanup and docs: covered in Task 4.
- Placeholder scan: no TBD/TODO placeholders included.
- Type consistency: field names are consistent across tasks (`base_url`, `api_key`, `model`, `temperature`).
