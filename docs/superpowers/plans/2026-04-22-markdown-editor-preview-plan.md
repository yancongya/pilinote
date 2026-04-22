# AI 笔记 Markdown 编辑/预览轻量化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 笔记页从自研 Markdown 解析切换为轻量标准渲染，并支持编辑 / 预览 / 分屏实时切换，同时保留本地图片与标题锚点能力。

**Architecture:** 后端补齐笔记文件路径信息，前端用 `textarea` 负责编辑、`react-markdown` 负责预览，页面只保留状态和保存逻辑。Markdown 预览层集中处理标题、图片、链接、列表、引用和代码块，不再让 `NoteTab` 自己维护一套脆弱的正则解析器。

**Tech Stack:** React 19、TypeScript、`react-markdown`、`remark-gfm`、现有 `getLocalImageUrl`、FastAPI。

---

### Task 1: 让本地笔记接口返回文件路径，供预览层解析相对图片

**Files:**
- Modify: `apps/api/src/routers/local.py`
- Modify: `apps/web/src/services/api.ts`
- Test: `apps/api/test_local_file_response.py`

- [ ] **Step 1: Write the failing test**

```python
from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


def test_local_note_response_exposes_file_and_folder_path():
    response = client.get("/api/local/file/demo-video?file_type=note")
    payload = response.json()

    assert "file_path" in payload
    assert "folder_path" in payload
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/api
pytest test_local_file_response.py -q
```

Expected: fail because `file_path` / `folder_path` are not returned yet.

- [ ] **Step 3: Extend the local file response payload**

```python
class LocalFileResponse(BaseModel):
    success: bool
    data: str = None
    error: str = None
    file_path: str | None = None
    folder_path: str | None = None
```

```python
elif file_type == "note":
    md_files = list(video_dir.glob("*.ai-note.md"))
    if not md_files:
        return LocalFileResponse(success=True, data="", folder_path=str(video_dir))
    note_file = md_files[0]
    return LocalFileResponse(
        success=True,
        data=note_file.read_text(encoding="utf-8"),
        file_path=str(note_file),
        folder_path=str(video_dir),
    )
```

```ts
export interface LocalFileResponse {
  success: boolean
  data?: string
  error?: string
  file_path?: string
  folder_path?: string
}
```

- [ ] **Step 4: Run the test and a compile check**

Run:

```bash
cd apps/api
pytest test_local_file_response.py -q
python3 -m py_compile src/routers/local.py
```

Expected:

- `pytest` passes
- `py_compile` passes

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routers/local.py apps/web/src/services/api.ts apps/api/test_local_file_response.py
git commit -m "feat: expose local note file paths for markdown preview"
```

---

### Task 2: 新增 MarkdownPreview 组件，集中处理标准 Markdown 渲染和本地图片

**Files:**
- Create: `apps/web/src/components/ai/MarkdownPreview.tsx`
- Create: `apps/web/src/components/ai/markdownPreviewUtils.ts`
- Test: `apps/web/src/components/ai/__tests__/MarkdownPreview.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../MarkdownPreview';

it('renders headings and local images', () => {
  render(
    <MarkdownPreview
      content={'# Title\\n\\n![Screenshot](./screenshots/shot.jpg)'}
      sourceFolderPath="/Users/me/downloads/demo"
    />,
  );

  expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
  expect(screen.getByAltText('Screenshot')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/MarkdownPreview.test.tsx
```

Expected: fail because the component does not exist yet.

- [ ] **Step 3: Implement the preview utilities and component**

```ts
import { getLocalImageUrl } from '../../config/api';

export function resolveMarkdownImageSrc(src: string, sourceFolderPath?: string): string {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;

  const cleanSrc = src.replace(/^\.\//, '').replace(/^\//, '');
  const resolvedPath = sourceFolderPath ? `${sourceFolderPath}/${cleanSrc}` : cleanSrc;
  return getLocalImageUrl(resolvedPath);
}
```

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownPreview({
  content,
  sourceFolderPath,
  className = '',
}: MarkdownPreviewProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ src = '', alt = '' }) => (
          <img
            src={resolveMarkdownImageSrc(src, sourceFolderPath)}
            alt={alt}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 4: Run the test and a type check**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/MarkdownPreview.test.tsx
pnpm exec tsc --noEmit --pretty false
```

Expected:

- `MarkdownPreview` test passes
- `tsc` does not report new errors from the new component

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/MarkdownPreview.tsx apps/web/src/components/ai/markdownPreviewUtils.ts apps/web/src/components/ai/__tests__/MarkdownPreview.test.tsx
git commit -m "feat: add lightweight markdown preview component"
```

---

### Task 3: 新增 MarkdownEditor 组件，提供编辑 / 预览 / 分屏切换

**Files:**
- Create: `apps/web/src/components/ai/MarkdownEditor.tsx`
- Test: `apps/web/src/components/ai/__tests__/MarkdownEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { MarkdownEditor } from '../MarkdownEditor';

it('switches between edit, preview and split modes', () => {
  render(
    <MarkdownEditor
      content="# Hello"
      onChange={() => {}}
      sourceFolderPath="/Users/me/downloads/demo"
    />,
  );

  expect(screen.getByRole('textbox')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '预览' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '分屏' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/MarkdownEditor.test.tsx
```

Expected: fail because the component does not exist yet.

- [ ] **Step 3: Implement the editor shell**

```tsx
export type MarkdownEditorMode = 'edit' | 'preview' | 'split';

export interface MarkdownEditorProps {
  content: string;
  onChange: (next: string) => void;
  sourceFolderPath?: string;
  mode: MarkdownEditorMode;
  onModeChange: (next: MarkdownEditorMode) => void;
}
```

```tsx
<div className="markdown-editor">
  <div className="markdown-editor-toolbar">
    <button onClick={() => onModeChange('edit')}>编辑</button>
    <button onClick={() => onModeChange('preview')}>预览</button>
    <button onClick={() => onModeChange('split')}>分屏</button>
  </div>

  {mode === 'edit' && (
    <textarea value={content} onChange={(e) => onChange(e.target.value)} />
  )}

  {mode === 'preview' && (
    <MarkdownPreview content={content} sourceFolderPath={sourceFolderPath} />
  )}

  {mode === 'split' && (
    <div className="markdown-editor-split">
      <textarea value={content} onChange={(e) => onChange(e.target.value)} />
      <MarkdownPreview content={content} sourceFolderPath={sourceFolderPath} />
    </div>
  )}
</div>
```

- [ ] **Step 4: Run the test and a type check**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/MarkdownEditor.test.tsx
pnpm exec tsc --noEmit --pretty false
```

Expected:

- `MarkdownEditor` test passes
- `tsc` passes for the new component

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ai/MarkdownEditor.tsx apps/web/src/components/ai/__tests__/MarkdownEditor.test.tsx
git commit -m "feat: add markdown edit preview split shell"
```

---

### Task 4: 把 NoteTab 接到新编辑/预览组件，删除手写 Markdown 解析

**Files:**
- Modify: `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- Modify: `apps/web/src/components/ai/AiNotePanel.tsx`（仅在需要统一结果展示时）
- Test: `apps/web/src/pages/components/AiNotePanel/__tests__/NoteTab.test.tsx`

- [ ] **Step 1: 写一个回归测试，验证 NoteTab 还会渲染笔记正文并保留编辑入口**

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { NoteTab } from '../NoteTab';

vi.mock('../../../../services/api', () => ({
  apiService: {
    getLocalFile: vi.fn().mockResolvedValue({
      success: true,
      data: '# Demo',
      file_path: '/Users/me/downloads/demo/demo.ai-note.md',
      folder_path: '/Users/me/downloads/demo',
    }),
    saveLocalFile: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../../hooks/useAiRuntimeState', () => ({
  useAiRuntimeState: () => ({
    testedModels: { openai: ['gpt-4o-mini'] },
    updatedAt: '',
    source: 'local',
  }),
}));

it('renders note content with markdown editor shell', () => {
  render(<NoteTab videoId="demo-video" />);

  expect(screen.getByText('AI 模型')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认旧解析路径仍在支撑页面**

Run:

```bash
cd apps/web
pnpm exec vitest run src/pages/components/AiNotePanel/__tests__/NoteTab.test.tsx
```

Expected: fail or partially pass before切换实现，因为页面还没有接入 `MarkdownEditor`。

- [ ] **Step 3: 用新组件替换 NoteTab 内部的 parseMarkdown / parseInline**

```tsx
const noteFilePath = response.file_path || '';
const noteFolderPath = response.folder_path || noteFilePath.replace(/\/[^/]+$/, '');

<MarkdownEditor
  content={content}
  onChange={setContent}
  sourceFolderPath={noteFolderPath}
  mode={renderMode}
  onModeChange={setRenderMode}
/>
```

```tsx
// 删除以下本地手写渲染函数：
// - parseMarkdown
// - parseInline
// - slugify（如果不再由 NoteTab 负责锚点生成）
```

同时保留：

- 保存逻辑
- 重新生成逻辑
- 模型 / 风格 / 详细程度 / 高级设置工具条
- 页面级 toast

- [ ] **Step 4: 运行定向验证**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run src/pages/components/AiNotePanel/__tests__/NoteTab.test.tsx
```

Expected:

- `NoteTab` 没有新增类型错误
- 页面能在编辑 / 预览 / 分屏之间切换
- 本地图片能按文件夹路径正确显示

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/components/AiNotePanel/NoteTab.tsx apps/web/src/components/ai/AiNotePanel.tsx
git commit -m "refactor: use markdown editor shell for ai note tab"
```

---

### Task 5: 浏览器手工验收与残留清理

**Files:**
- Modify: `apps/web/src/components/ai/MarkdownViewer.tsx`（仅在发现它还需要共享新预览能力时）
- Modify: `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`

- [ ] **Step 1: 在浏览器里验证三种模式**

检查：

1. 编辑模式只显示 `textarea`
2. 预览模式只显示渲染后的 Markdown
3. 分屏模式左右同时显示编辑和预览

- [ ] **Step 2: 验证本地图片和锚点**

检查：

1. `![Screenshot](./screenshots/xxx.jpg)` 能显示图片
2. `# 标题` 能点击跳转
3. 外链继续在新标签打开

- [ ] **Step 3: 决定是否统一复用 `MarkdownViewer.tsx`**

如果 `MarkdownViewer.tsx` 仍然被其它页面使用，就保留它为兼容组件；如果它已经没有调用方，可以在这一步删除或迁移到新预览层。

- [ ] **Step 4: 记录最终验收结果**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false
```

Expected:

- 这次改动没有引入 `NoteTab` / `MarkdownPreview` / `MarkdownEditor` 的新类型错误
- 现有仓库历史错误不因这次改动恶化
