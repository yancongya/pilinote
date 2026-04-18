# AI Note Final Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining legacy AI note style path, make the AI note modal consume prompt-card styles as the sole source of truth, and synchronize the docs/state surfaces so the AI note stack is internally consistent.

**Architecture:** Treat prompt templates as the canonical source for T0/T1/T2/T3/formats, treat runtime state as the canonical source for tested ASR models, and treat the database only as persistent configuration for providers, API keys, and prompt overrides. The implementation should eliminate the last direct dependence on `ai_note.style.style` in the runtime path, then verify that the modal, settings page, migration script, and state services all agree on the same shape.

**Tech Stack:** React + TypeScript + Vite frontend, FastAPI + Pydantic + SQLAlchemy backend, local JSON runtime caches, existing prompt template service and AI runtime state service.

---

### Task 1: Remove legacy style field from the runtime path

**Files:**
- Modify: `apps/api/src/services/settings_service.py`
- Modify: `apps/api/src/schemas/settings.py`
- Modify: `apps/api/scripts/migrate_ai_config_state.py`
- Modify: `apps/api/src/services/ai/note_service.py`
- Test: `apps/api/scripts/verify_ai_runtime_state.py`

- [ ] **Step 1: Make the failing expectation explicit**

  Run:
  ```bash
  cd apps/api
  ./venv/bin/python - <<'PY'
  from src.services.settings_service import SettingsService
  from src.database import SessionLocal
  db = SessionLocal()
  try:
      svc = SettingsService(db)
      settings = svc.get_settings()
      print(settings.ai_note.style.style)
  finally:
      db.close()
  PY
  ```

  Expected: the printed value should not be used by any runtime consumer; if it is still non-empty, that is only legacy compatibility data.

- [ ] **Step 2: Remove legacy reads from settings serialization**

  Ensure `SettingsService.get_settings()` no longer uses `ai_note.style.style` to derive runtime style options, and instead returns an empty/compatibility-only field while leaving prompt template loading responsible for the real selectable styles.

- [ ] **Step 3: Make the migration script clear the legacy style field**

  Update `apps/api/scripts/migrate_ai_config_state.py` so it clears `ai_note.style.style` in the database, increments the migration version, and records the cleanup in the migration marker.

- [ ] **Step 4: Stop `note_service` from depending on the legacy field**

  Remove any fallback that reads `settings.ai_note.style.style` when building the AI note request. The request should receive the selected style key from the prompt-card list only.

- [ ] **Step 5: Verify the cleanup path**

  Run:
  ```bash
  cd apps/api
  ./venv/bin/python scripts/migrate_ai_config_state.py
  ./venv/bin/python scripts/verify_ai_runtime_state.py
  ./venv/bin/python -m py_compile src/services/settings_service.py src/schemas/settings.py scripts/migrate_ai_config_state.py src/services/ai/note_service.py
  ```

  Expected:
  - migration completes successfully
  - runtime state still reports the local ASR active model and tested models
  - `ai_note.style.style` no longer influences runtime selection

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/src/services/settings_service.py apps/api/src/schemas/settings.py apps/api/scripts/migrate_ai_config_state.py apps/api/src/services/ai/note_service.py
  git commit -m "feat: remove legacy ai note style runtime path"
  ```

### Task 2: Make prompt-card styles the only modal style source

**Files:**
- Modify: `apps/web/src/services/promptCatalog.ts`
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/pages/settings/AiPromptTemplates.tsx`
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx`
- Modify: `apps/web/src/services/aiPromptTemplates.ts`
- Modify: `apps/web/src/stores/settings.ts`
- Test: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`

- [ ] **Step 1: Make the failing expectation explicit**

  Run:
  ```bash
  cd apps/web
  pnpm exec tsc --noEmit --pretty false 2>&1 | rg -n "AiNoteModal.tsx|AiNoteSettings.tsx|AiPromptTemplates.tsx|promptCatalog.ts|aiRuntimeState.ts|useAiRuntimeState.ts"
  ```

  Expected: no errors from the touched AI note files.

- [ ] **Step 2: Keep prompt-card metadata in a shared module**

  Ensure `apps/web/src/services/promptCatalog.ts` remains the single source of truth for prompt cards, and that both `AiPromptTemplates.tsx` and `AiNoteSettings.tsx` import from it instead of duplicating card definitions.

- [ ] **Step 3: Build the modal style list from prompt cards**

  In `AiNoteModal.tsx`, derive `styleOptions` from the `风格` cards exported by `promptCatalog.ts`, then merge in `settings.ai_note.style.custom_styles` as overrides and additions. Do not use `ai_note.style.style` as a default source.

- [ ] **Step 4: Normalize old style values only as migration aliases**

  Keep the old aliases (`concise`, `bullet`) only as input normalization for already-stored legacy values. After normalization, the active selection must resolve to a current prompt-card value such as `minimal`, `detailed`, or `task_oriented`.

- [ ] **Step 5: Ensure the settings page and modal agree**

  Verify the settings page writes custom styles into the prompt-template override storage and the modal reads the same override data when building the style picker.

- [ ] **Step 6: Add a regression test for legacy style resolution**

  Extend `apps/web/src/__tests__/aiNoteModalLookup.test.ts` with at least one case that maps a legacy style input to a current prompt-card value and one case that falls back to the first prompt-card style when the current value is missing.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/services/promptCatalog.ts apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/pages/settings/AiPromptTemplates.tsx apps/web/src/pages/settings/AiNoteSettings.tsx apps/web/src/services/aiPromptTemplates.ts apps/web/src/stores/settings.ts apps/web/src/__tests__/aiNoteModalLookup.test.ts
  git commit -m "feat: make prompt cards the ai note style source"
  ```

### Task 3: Synchronize documentation and runtime state expectations

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-04-18-ai-config-state-migration.md`
- Modify: `docs/superpowers/plans/2026-04-18-ai-prompt-templates.md`
- Modify: `docs/superpowers/plans/2026-04-18-key-metadata-status-unification.md`
- Modify: `docs/ai-note/README.md`

- [ ] **Step 1: Identify the stale documentation**

  Search for references to:
  - `ai_note.style.style`
  - `tested_models` being stored in the database as the source of truth
  - the old modal/template split

  Run:
  ```bash
  rg -n "ai_note\\.style\\.style|tested_models|提示词模板|风格 tab|prompt管理" CHANGELOG.md docs apps/web/src apps/api/src
  ```

- [ ] **Step 2: Update the changelog entry**

  Add a short follow-up note under `2026-04-18` that records:
  - prompt-card style source is now authoritative
  - legacy `ai_note.style.style` has been migrated/cleared
  - runtime tested models live in the local AI runtime cache

- [ ] **Step 3: Align plan documents with the new source-of-truth split**

  Update the existing plan docs so they reflect:
  - prompt templates are local-file defaults plus DB overrides
  - tested ASR models are runtime cache state
  - AI note style selection comes from prompt cards

- [ ] **Step 4: Verify the docs are internally consistent**

  Run:
  ```bash
  rg -n "ai_note\\.style\\.style|tested_models|prompt管理|runtime cache" CHANGELOG.md docs/superpowers/plans docs/ai-note/README.md
  ```

  Expected: the remaining references should describe the new split, not the old runtime path.

- [ ] **Step 5: Commit**

  ```bash
  git add CHANGELOG.md docs/superpowers/plans/2026-04-18-ai-config-state-migration.md docs/superpowers/plans/2026-04-18-ai-prompt-templates.md docs/superpowers/plans/2026-04-18-key-metadata-status-unification.md docs/ai-note/README.md
  git commit -m "docs: reconcile ai note migration documentation"
  ```

### Task 4: Final verification and cleanup

**Files:**
- Test: `apps/api/scripts/verify_ai_runtime_state.py`
- Test: `apps/api/test_ai_note_prompts.py`
- Test: `apps/web/src/__tests__/aiNoteModalLookup.test.ts`

- [ ] **Step 1: Run backend verification**

  Run:
  ```bash
  cd apps/api
  ./venv/bin/python -m py_compile src/services/settings_service.py src/schemas/settings.py scripts/migrate_ai_config_state.py scripts/verify_ai_runtime_state.py src/services/ai/ai_runtime_state_service.py src/services/ai/local_asr_model_service.py src/routers/ai_runtime_state.py src/routers/ai.py src/services/ai/note_service.py
  ./venv/bin/python scripts/verify_ai_runtime_state.py
  ./venv/bin/python test_ai_note_prompts.py
  ```

  Expected:
  - compile passes
  - runtime state reports the local ASR model as ready
  - prompt tests pass

- [ ] **Step 2: Run frontend verification**

  Run:
  ```bash
  cd apps/web
  pnpm exec tsc --noEmit --pretty false
  ```

  Expected: the AI note, prompt catalog, and settings files compile cleanly. Existing unrelated repository-wide errors may still remain outside this scope.

- [ ] **Step 3: Confirm runtime behavior**

  Manually verify in the browser:
  - `AiNoteModal` shows the prompt-card styles
  - `AiNoteSettings` still edits prompt cards and custom styles
  - `prompt管理` no longer depends on `ai_note.style.style`
  - local ASR state remains available after refresh

- [ ] **Step 4: Final commit if needed**

  If any verification-only changes were made during this task, commit them separately with a message that names the validation or doc synchronization work.

---

## Coverage Check

- Legacy style field cleanup: Task 1
- Modal reads prompt-card styles only: Task 2
- Docs and changelog updated: Task 3
- Backend/frontend verification: Task 4

## Out of Scope

- Reworking the prompt template format itself
- Changing the local ASR model download UX
- Reintroducing a separate template editor panel
- Rewriting the AI note analysis pipeline
