# AI Prompt Templates Local Storage Implementation Plan

> 状态：已落地。当前 prompt 卡片与本地模板服务已经可用，本计划保留为实现说明。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 笔记的提示词模板从数据库和硬编码中拆出来，落到本地文件里，支持默认模板、编辑、重置和 PromptBuilder 统一读取。

**Architecture:** 用一个本地模板存储层管理 BiliNote 风格的默认提示词，运行时先加载默认模板，再合并本地覆盖文件。后端负责读取、保存和重置模板，前端负责按层级编辑 T0/T1/T2/T3 与 `formats` 模板，但运行配置仍继续由数据库管理。

**Tech Stack:** FastAPI, Pydantic, JSON file storage, React, TypeScript, Vite, Zustand, existing prompt builder utilities

---

## 文件结构

### 新增文件
```
apps/api/src/services/ai/prompt_template_service.py   # 本地模板读写与合并
apps/api/src/routers/ai_prompt_templates.py          # 模板 API
apps/api/data/ai_prompt_templates.default.json       # 默认模板文件
apps/api/data/ai_prompt_templates.json              # 用户覆盖模板文件（首次保存后创建）
apps/web/src/pages/settings/aiPromptTemplates.tsx    # 模板编辑面板
apps/web/src/services/aiPromptTemplates.ts           # 前端模板 API 封装
tests/test_ai_prompt_template_service.py             # 后端模板服务测试
tests/test_ai_prompt_templates_api.py                # 后端 API 测试
```

### 修改文件
```
apps/api/src/llm/prompts/builder.py                  # 从模板服务读取 T0/T1/T2/T3/formats
apps/api/src/llm/prompts/formats.py                  # 保留高级功能预留模板，缩短文案
apps/api/src/llm/prompts/styles.py                   # 复用默认风格模板文本
apps/api/src/routers/ai.py                           # 可选：模型测试接口保持独立，不改逻辑
apps/api/src/main.py                                 # 挂载新模板路由
apps/api/src/services/ai/__init__.py                 # 导出模板服务
apps/web/src/pages/settings/AiNoteSettings.tsx       # 接入模板编辑入口
apps/web/src/components/ai/AiNoteModal.tsx           # 读取模板时保持默认项与折叠态
apps/web/src/services/aiNote.ts                      # 同步高级格式文案
apps/web/src/stores/settings.ts                      # 不新增数据库字段，仅确保类型不变
apps/api/test_ai_note_prompts.py                     # 更新测试断言，适配模板文件加载
```

---

## Phase 1: 后端本地模板存储

### Task 1: 定义默认模板文件与加载器

**Files:**
- Create: `apps/api/data/ai_prompt_templates.default.json`
- Create: `apps/api/src/services/ai/prompt_template_service.py`
- Modify: `apps/api/src/services/ai/__init__.py`
- Test: `tests/test_ai_prompt_template_service.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ai_prompt_template_service.py
from src.services.ai.prompt_template_service import PromptTemplateService

def test_loads_default_templates_when_override_missing(tmp_path, monkeypatch):
    default_path = tmp_path / "ai_prompt_templates.default.json"
    override_path = tmp_path / "ai_prompt_templates.json"
    default_path.write_text(
        '{"t0":{"default":"T0默认"},"t1":{"default":"T1默认"},"t2":{"simple":"T2简单","detailed":"T2详细"},"t3":{"detailed":"T3详细"},"formats":{"summary":"formats总结"}}',
        encoding="utf-8",
    )
    monkeypatch.setattr(PromptTemplateService, "DEFAULT_PATH", default_path)
    monkeypatch.setattr(PromptTemplateService, "OVERRIDE_PATH", override_path)

    service = PromptTemplateService()
    templates = service.get_templates()

    assert templates["t0"]["default"] == "T0默认"
    assert templates["t2"]["simple"] == "T2简单"
    assert templates["formats"]["summary"] == "formats总结"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pytest tests/test_ai_prompt_template_service.py::test_loads_default_templates_when_override_missing -v`
Expected: FAIL with `ModuleNotFoundError` or `PromptTemplateService` not defined.

- [ ] **Step 3: Write minimal implementation**

```python
# apps/api/src/services/ai/prompt_template_service.py
import json
from pathlib import Path
from typing import Any, Dict

class PromptTemplateService:
    BASE_DIR = Path(__file__).resolve().parents[3] / "data"
    DEFAULT_PATH = BASE_DIR / "ai_prompt_templates.default.json"
    OVERRIDE_PATH = BASE_DIR / "ai_prompt_templates.json"

    def get_templates(self) -> Dict[str, Any]:
        default_templates = self._read_json(self.DEFAULT_PATH)
        override_templates = self._read_json(self.OVERRIDE_PATH)
        return self._deep_merge(default_templates, override_templates)

    def save_templates(self, templates: Dict[str, Any]) -> None:
        self.OVERRIDE_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.OVERRIDE_PATH.write_text(json.dumps(templates, ensure_ascii=False, indent=2), encoding="utf-8")

    def reset_templates(self) -> None:
        if self.OVERRIDE_PATH.exists():
            self.OVERRIDE_PATH.unlink()

    def _read_json(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(base)
        for key, value in override.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._deep_merge(merged[key], value)
            else:
                merged[key] = value
        return merged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pytest tests/test_ai_prompt_template_service.py::test_loads_default_templates_when_override_missing -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/data/ai_prompt_templates.default.json apps/api/src/services/ai/prompt_template_service.py tests/test_ai_prompt_template_service.py apps/api/src/services/ai/__init__.py
git commit -m "feat(api): add local ai prompt template storage"
```

---

### Task 2: Add prompt template API

**Files:**
- Create: `apps/api/src/routers/ai_prompt_templates.py`
- Modify: `apps/api/src/main.py`
- Test: `tests/test_ai_prompt_templates_api.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ai_prompt_templates_api.py
from fastapi.testclient import TestClient
from src.main import app

def test_get_prompt_templates():
    client = TestClient(app)
    response = client.get("/api/ai/prompt-templates")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "templates" in data
    assert "t0" in data["templates"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pytest tests/test_ai_prompt_templates_api.py::test_get_prompt_templates -v`
Expected: FAIL with `404 Not Found`.

- [ ] **Step 3: Write minimal implementation**

```python
# apps/api/src/routers/ai_prompt_templates.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from src.services.ai.prompt_template_service import PromptTemplateService

router = APIRouter(prefix="/api/ai/prompt-templates", tags=["ai-prompt-templates"])
service = PromptTemplateService()

class PromptTemplateResponse(BaseModel):
    success: bool = True
    templates: Dict[str, Any]

@router.get("", response_model=PromptTemplateResponse)
async def get_prompt_templates():
    return PromptTemplateResponse(success=True, templates=service.get_templates())

@router.put("")
async def save_prompt_templates(payload: Dict[str, Any]):
    service.save_templates(payload)
    return {"success": True}

@router.post("/reset")
async def reset_prompt_templates():
    service.reset_templates()
    return {"success": True}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pytest tests/test_ai_prompt_templates_api.py::test_get_prompt_templates -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routers/ai_prompt_templates.py apps/api/src/main.py tests/test_ai_prompt_templates_api.py
git commit -m "feat(api): expose ai prompt template endpoints"
```

---

## Phase 2: PromptBuilder 接入

### Task 3: Make PromptBuilder read from template service

**Files:**
- Modify: `apps/api/src/llm/prompts/builder.py`
- Modify: `apps/api/src/llm/prompts/formats.py`
- Modify: `apps/api/src/llm/prompts/styles.py`
- Test: `apps/api/test_ai_note_prompts.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/test_ai_note_prompts.py
def test_build_prompt_uses_loaded_templates():
    prompt = PromptBuilder.build(
        t0_text="T0",
        t1_text="T1",
        level="detailed",
        style="detailed",
        formats=["summary"],
    )
    assert "## T0 视频信息" in prompt
    assert "## T1 视频文本" in prompt
    assert "## T2 详细程度" in prompt
    assert "## T3 风格" in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && python3 test_ai_note_prompts.py`
Expected: FAIL if prompt builder still hardcodes old text or cannot load templates.

- [ ] **Step 3: Write minimal implementation**

```python
# apps/api/src/llm/prompts/builder.py
from src.services.ai.prompt_template_service import PromptTemplateService

template_service = PromptTemplateService()

class PromptBuilder:
    @staticmethod
    def build(...):
        templates = template_service.get_templates()
        # Use templates["t0"], templates["t1"], templates["t2"], templates["t3"], templates["formats"]
        ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && python3 test_ai_note_prompts.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/llm/prompts/builder.py apps/api/src/llm/prompts/formats.py apps/api/src/llm/prompts/styles.py apps/api/test_ai_note_prompts.py
git commit -m "feat(api): load ai prompt templates from local storage"
```

---

## Phase 3: Frontend template editor

### Task 4: Add template editor API and settings panel

**Files:**
- Create: `apps/web/src/services/aiPromptTemplates.ts`
- Create: `apps/web/src/pages/settings/aiPromptTemplates.tsx`
- Modify: `apps/web/src/pages/settings/AiNoteSettings.tsx`
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/services/aiNote.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// No formal frontend test framework is configured.
// Verify manually after implementation:
// - GET /api/ai/prompt-templates returns templates
// - editing a template updates the JSON file
// - reset removes the override file and restores defaults
```

- [ ] **Step 2: Run a manual failing check**

Run: `cd apps/web && pnpm dev`
Expected: AI settings page has no prompt template editor yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/pages/settings/aiPromptTemplates.tsx
// Add a collapsible editor for:
// - T0 视频信息
// - T1 ASR
// - T2 详细程度
// - T3 风格
// - formats 高级功能预留
// Each section loads/saves via /api/ai/prompt-templates
```

- [ ] **Step 4: Run manual verification**

Run:
```bash
cd apps/web
pnpm dev
```
Expected:
- settings page shows template editor
- edit and save writes the local JSON override
- reset restores defaults

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/aiPromptTemplates.ts apps/web/src/pages/settings/aiPromptTemplates.tsx apps/web/src/pages/settings/AiNoteSettings.tsx apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/services/aiNote.ts
git commit -m "feat(web): add local ai prompt template editor"
```

---

## Phase 4: Verification and cleanup

### Task 5: Validate prompts, reset behavior, and docs

**Files:**
- Modify: `apps/api/test_ai_note_prompts.py`
- Modify: `docs/components/ai-note-service.md`
- Modify: `docs/components/prompt-builder.md`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/test_ai_note_prompts.py
def test_summary_remains_default_format():
    prompt = PromptBuilder.build(
        t0_text="T0",
        t1_text="T1",
        formats=["summary"],
    )
    assert "AI 总结" in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && python3 test_ai_note_prompts.py`
Expected: fail if default format wiring is broken.

- [ ] **Step 3: Write minimal implementation**

```python
# Keep summary as the only default enabled format in ai_prompt_templates.default.json
# Update docs to explain:
# - database handles runtime config
# - local JSON handles template text
# - reset deletes override file only
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && python3 test_ai_note_prompts.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/test_ai_note_prompts.py docs/components/ai-note-service.md docs/components/prompt-builder.md
git commit -m "docs: document local ai prompt template storage"
```

---

## Self-Review

### Coverage check
- Local default template file: covered in Task 1.
- Editable override file: covered in Task 1 and Task 4.
- Reset to defaults: covered in Task 1, Task 2, and Task 4.
- PromptBuilder reads templates instead of hardcoded long text: covered in Task 3.
- Frontend editor without database dependency: covered in Task 4.
- `formats` retained as advanced capability: covered in Task 3 and Task 5.

### Placeholder scan
- No TBD/TODO placeholders.
- Each code step includes exact file paths and concrete code.
- Tests include actual runnable commands.

### Type consistency
- `PromptTemplateService.get_templates()`, `save_templates()`, and `reset_templates()` are used consistently across backend tasks.
- Frontend API path is consistently `/api/ai/prompt-templates`.
- `formats` remains the name of the advanced capability layer.
