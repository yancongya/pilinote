# AI 配置与状态迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 服务商配置与运行状态拆分到正确的存储层：数据库只保留稳定配置，本地缓存保存测试结果和本地 ASR 模型状态，并通过一次性迁移脚本把现有数据收口。

**Architecture:** 现有系统里，AI 服务商配置、测试结果、本地 ASR 模型状态和前端读取逻辑存在交叉依赖。迁移后，数据库只负责持久化配置项（provider、model、api_key、temperature、风格/格式配置），运行态状态则写入本地缓存文件。后端提供稳定的读写接口，前端只消费统一的状态接口，不再直接耦合旧的混合字段。

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React, TypeScript, local JSON cache files, existing settings service and AI model service.

---

### Task 1: Define the new state boundaries and migration targets

**Files:**
- Modify: `apps/api/src/services/settings_service.py`
- Modify: `apps/api/src/schemas/settings.py`
- Modify: `apps/web/src/stores/settings.ts`
- Create: `docs/superpowers/plans/2026-04-18-ai-config-state-migration.md` (this plan)

- [ ] **Step 1: Record the target split**

```text
Database keeps:
- ai_note.llm.provider
- ai_note.llm.model
- ai_note.llm.api_key
- ai_note.llm.temperature
- ai_note.style.style
- ai_note.style.length
- ai_note.style.custom_styles
- ai_note.format.*
- ai_note.auto_analyze

Local cache keeps:
- ai_note.llm.tested_models
- local ASR model runtime state
  - active model
  - downloaded / downloading / failed status
  - progress
  - downloaded_bytes
  - total_bytes
```

- [ ] **Step 2: Add a local cache schema for AI runtime state**

```python
class AiRuntimeState(BaseModel):
    tested_models: Dict[str, List[str]] = Field(default_factory=dict)
    updated_at: str = ""

class AiRuntimeCache(BaseModel):
    ai_note: AiRuntimeState = Field(default_factory=AiRuntimeState)
```

- [ ] **Step 3: Update settings schemas to stop treating tested_models as persistent DB config**

```python
class LLMSettings(BaseModel):
    provider: str = Field(default="openai")
    model: str = Field(default="gpt-4o-mini")
    api_key: str = Field(default="")
    temperature: float = Field(default=0.7, ge=0, le=2)
```

Expected result: `tested_models` is no longer part of the persisted `Settings` payload that the frontend writes back to the database.

- [ ] **Step 4: Verify current read path before changing it**

Run:
```bash
cd apps/api
sqlite3 data/pilinote.db "select key, value from settings where key like 'ai_note.llm.%' order by key;"
```

Expected:
```text
ai_note.llm.api_key|...
ai_note.llm.model|...
ai_note.llm.provider|...
ai_note.llm.temperature|...
ai_note.llm.tested_models|...
```

### Task 2: Add a one-time migration script for AI config and runtime state

**Files:**
- Create: `apps/api/scripts/migrate_ai_config_state.py`
- Modify: `apps/api/src/services/settings_service.py`
- Modify: `apps/api/src/services/ai/local_asr_model_service.py`
- Create: `apps/api/data/ai_runtime_state.json`
- Create: `apps/api/data/ai_runtime_state.version.json`

- [ ] **Step 1: Write the migration script skeleton**

```python
#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from sqlalchemy.orm import Session

def migrate_ai_runtime_state(db: Session) -> dict:
    ...

if __name__ == "__main__":
    ...
```

- [ ] **Step 2: Implement migration from DB settings into local cache**

```python
tested_models = json.loads(setting.value) if setting and setting.value else {}
runtime_cache = {
    "ai_note": {
        "tested_models": tested_models,
        "updated_at": datetime.utcnow().isoformat(),
    }
}
Path("data/ai_runtime_state.json").write_text(json.dumps(runtime_cache, ensure_ascii=False, indent=2), encoding="utf-8")
```

Migration rules:
- Copy `ai_note.llm.tested_models` from the database into `data/ai_runtime_state.json`
- Preserve `provider`, `model`, `api_key`, `temperature`, `style`, `format` in the database
- Keep existing local ASR cache file `data/local_asr_models.json` as the source of truth for ASR runtime state

- [ ] **Step 3: Clear the migrated DB field only after a successful cache write**

```python
setting = db.query(Setting).filter(Setting.key == "ai_note.llm.tested_models").first()
if setting:
    setting.value = "{}"
```

Expected result: the DB no longer acts as the runtime source for tested model lists after migration.

- [ ] **Step 4: Add an idempotent migration marker**

```json
{
  "version": 1,
  "migrated_at": "2026-04-18T00:00:00Z",
  "migrations": {
    "ai_config_state": true
  }
}
```

Expected result: running the script again does not duplicate data or re-clear already migrated state.

- [ ] **Step 5: Verify migration script behavior**

Run:
```bash
cd apps/api
python3 scripts/migrate_ai_config_state.py
sqlite3 data/pilinote.db "select key, value from settings where key = 'ai_note.llm.tested_models';"
cat data/ai_runtime_state.json
```

Expected:
```text
tested_models in DB is {}
tested_models in ai_runtime_state.json contains the previously tested models
```

### Task 3: Update backend readers and writers to use the new split

**Files:**
- Modify: `apps/api/src/services/settings_service.py`
- Modify: `apps/api/src/routers/ai.py`
- Create: `apps/api/src/routers/ai_runtime_state.py`
- Modify: `apps/api/src/routers/settings.py`
- Modify: `apps/api/src/services/ai/local_asr_model_service.py`
- Create: `apps/api/src/services/ai/ai_runtime_state_service.py`

- [ ] **Step 1: Add a runtime cache service**

```python
class AiRuntimeStateService:
    def get_tested_models(self) -> Dict[str, List[str]]:
        ...

    def set_tested_models(self, tested_models: Dict[str, List[str]]) -> None:
        ...
```

- [ ] **Step 2: Make the AI test-model route update runtime cache instead of the DB**

```python
runtime_state = ai_runtime_state_service.get_state()
runtime_state.ai_note.tested_models.setdefault(provider, [])
runtime_state.ai_note.tested_models[provider] = sorted(set(runtime_state.ai_note.tested_models[provider] + [model]))
ai_runtime_state_service.save(runtime_state)
```

Expected result: model test success writes to local cache, not to `settings.ai_note.llm.tested_models`.

- [ ] **Step 2.1: Expose the runtime cache through a dedicated read-only API**

```python
@router.get("/runtime-state")
async def get_runtime_state():
    return runtime_state_service.get_state()
```

Expected result: the frontend can fetch `tested_models` and other runtime-only AI state from `/api/ai/runtime-state`.

- [ ] **Step 3: Make settings GET read persistent config only**

```python
llm_dict = {
    "provider": ...,
    "model": ...,
    "api_key": ...,
    "temperature": ...,
}
```

Expected result: settings payload no longer depends on the runtime cache field to be correct.

- [ ] **Step 4: Make local ASR readiness read from local runtime state only**

```python
def to_readiness_response(self) -> LocalASRReadinessResponse:
    model = self.get_active_model()
    return LocalASRReadinessResponse(
        ready=model.ready,
        active_model_id=model.model_id,
        model=model,
    )
```

Expected result: the ASR model panel and AI analysis gating are driven by the local ASR cache file, not by database settings.

- [ ] **Step 5: Verify read/write split with direct API calls**

Run:
```bash
cd apps/api
curl -s http://127.0.0.1:8000/api/settings/ | jq '.ai_note.llm'
curl -s http://127.0.0.1:8000/api/ai/asr/readiness | jq
curl -s -X POST http://127.0.0.1:8000/api/ai/test-model \
  -H 'Content-Type: application/json' \
  -d '{"provider":"deepseek","model":"deepseek-coder","baseUrl":"https://api.deepseek.com/v1","apiKey":"xxx"}' | jq
cat data/ai_runtime_state.json
```

Expected result:
- `settings` still returns provider/model/api_key/temperature
- `ai/asr/readiness` reflects the local ASR cache
- test-model success updates `ai_runtime_state.json`

### Task 4: Update the frontend to read runtime state from the new source

**Files:**
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx`
- Modify: `apps/web/src/components/ai/LocalAsrModelPanel.tsx`
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/services/localAsrModels.ts`
- Create: `apps/web/src/services/aiRuntimeState.ts`
- Modify: `apps/web/src/stores/settings.ts`

- [ ] **Step 1: Remove any write-back assumption for tested_models in the settings store**

```ts
interface Settings {
  ai_note: {
    llm: {
      provider: string
      model: string
      api_key: string
      temperature: number
    }
    ...
  }
}
```

Expected result: the store keeps config fields only and does not expect `tested_models` to round-trip through the database.

- [ ] **Step 2: Make the model test UI read its available models from the runtime cache**

```ts
const ready = await localAsrModelService.checkReady()
if (!ready.ready) {
  showToast('请先下载并启用本地 ASR 模型', 'warning')
}
```

Expected result: AI note modal only gates on the local ASR cache state, not on stale DB state.

- [ ] **Step 3: Make the AI note modal stop reading tested_models from settings**

```ts
const providerModels = useMemo(() => {
  const runtime = aiRuntimeState?.ai_note?.tested_models || {}
  return runtime[activeProvider] || []
}, [aiRuntimeState, activeProvider])
```

Expected result: the modal gets tested models from the runtime cache service, not from `settings.ai_note.llm.tested_models`.

- [ ] **Step 4: Verify the modal still opens when local ASR is ready**

Run manually:
```text
1. 下载并激活一个本地 ASR 模型
2. 在 AI 服务商里测试一个模型
3. 打开媒体库卡片上的 AI 图标
4. 确认弹窗不再提示“请先下载并启用本地 ASR 模型”
```

Expected result: the modal opens when local ASR readiness is true, regardless of the old DB field.

### Task 5: One-time verification and cleanup

**Files:**
- Modify: `docs/superpowers/plans/2026-04-18-ai-config-state-migration.md`
- Modify: `apps/api/src/services/settings_service.py`
- Modify: `apps/api/src/routers/ai.py`
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx`

- [ ] **Step 1: Run backend compilation checks**

Run:
```bash
cd apps/api
python3 -m py_compile src/services/settings_service.py src/routers/ai.py src/services/ai/local_asr_model_service.py scripts/migrate_ai_config_state.py
```

Expected:
```text
No output
```

- [ ] **Step 2: Run frontend type checks for touched files**

Run:
```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false 2>&1 | rg -n "AiNoteSettings.tsx|AiNoteModal.tsx|LocalAsrModelPanel.tsx|localAsrModels.ts"
```

Expected:
```text
No matching errors for the touched files
```

- [ ] **Step 3: Confirm migration state files exist and DB no longer owns runtime state**

Run:
```bash
cd apps/api
test -f data/ai_runtime_state.json
test -f data/local_asr_models.json
sqlite3 data/pilinote.db "select value from settings where key='ai_note.llm.tested_models';"
```

Expected:
```text
ai_runtime_state.json exists
local_asr_models.json exists
tested_models is stored as '{}' in DB after migration
```

- [ ] **Step 4: Commit the migration and split-state changes**

```bash
git add apps/api apps/web docs/superpowers/plans/2026-04-18-ai-config-state-migration.md
git commit -m "feat: migrate ai runtime state to local cache"
```
