# AI 笔记 MDXEditor 文档渲染器替换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 笔记页的自研 Markdown 编辑/预览替换为 `@mdxeditor/editor`，保留编辑/预览/分屏、本地图片、标题锚点和笔记保存/重生成流程，同时显著改善文档型视觉表现。

**Architecture:** `NoteTab` 继续负责业务状态、加载、保存和重生成；`MdxNoteEditor` 负责包装 `MDXEditor` 并承接编辑/预览/分屏模式。本地图片解析沿用现有相对路径规则，样式只做少量项目级覆盖，避免再次自绘一套预览器。

**Tech Stack:** React + TypeScript + Vite, `@mdxeditor/editor`, existing AI note backend and local file APIs

---

### Task 1: Add MDXEditor dependency and baseline wiring

**Files:**
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/package.json`
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/pnpm-lock.yaml`

- [ ] **Step 1: Install the editor package**

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm add @mdxeditor/editor
```

- [ ] **Step 2: Verify the lockfile changed only for the new dependency**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
git diff -- package.json pnpm-lock.yaml
```

Expected:
- `@mdxeditor/editor` is added to dependencies
- lockfile updates resolve cleanly

- [ ] **Step 3: Add the editor stylesheet import**

In the new editor component created in Task 2, import the stylesheet exactly once:

```ts
import '@mdxeditor/editor/style.css'
```

- [ ] **Step 4: Confirm the app still starts**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm dev
```

Expected:
- Vite starts without a dependency resolution error
- No runtime crash from the new package import

---

### Task 2: Create the dedicated MDX note editor wrapper

**Files:**
- Create: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/MdxNoteEditor.tsx`
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/markdownPreviewUtils.ts`
- Create: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/__tests__/MdxNoteEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

Create a focused test that renders the wrapper in each mode and asserts the basic controls exist:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MdxNoteEditor } from '../MdxNoteEditor'

describe('MdxNoteEditor', () => {
  it('renders the mode controls and content area', () => {
    render(
      <MdxNoteEditor
        content="# Title"
        mode="preview"
        onChange={vi.fn()}
        onModeChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: '编辑' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '分屏' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails before implementation**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec vitest run src/components/ai/__tests__/MdxNoteEditor.test.tsx
```

Expected:
- FAIL because `MdxNoteEditor` does not exist yet

- [ ] **Step 3: Implement the wrapper around MDXEditor**

Implement `MdxNoteEditor` with this shape:

```tsx
import '@mdxeditor/editor/style.css'
import {
  MDXEditor,
  toolbarPlugin,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  imagePlugin,
  tablePlugin,
  diffSourcePlugin,
  diffSourceToolbarPlugin,
} from '@mdxeditor/editor'

export type MdxNoteEditorMode = 'edit' | 'preview' | 'split'

export interface MdxNoteEditorProps {
  content: string
  mode: MdxNoteEditorMode
  onChange: (content: string) => void
  onModeChange: (mode: MdxNoteEditorMode) => void
  sourceFolderPath?: string | null
  className?: string
}

export function MdxNoteEditor(props: MdxNoteEditorProps) {
  return (
    <div className={props.className}>
      <MDXEditor
        markdown={props.content}
        onChange={props.onChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          imagePlugin(),
          tablePlugin(),
          toolbarPlugin({
            toolbarContents: () => null,
          }),
          diffSourcePlugin({ diffMarkdown: props.content, viewMode: 'rich-text' }),
          diffSourceToolbarPlugin(),
        ]}
      />
    </div>
  )
}
```

Use the existing `resolveMarkdownImageUrl`, `createHeadingIdGenerator`, and any local-path helpers only if MDXEditor needs an explicit image URL adapter. Keep the wrapper focused on editor orchestration, not business logic.

- [ ] **Step 4: Run the test to confirm the wrapper exists**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec vitest run src/components/ai/__tests__/MdxNoteEditor.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Verify the wrapper compiles**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec tsc --noEmit --pretty false
```

Expected:
- No new type errors from `MdxNoteEditor.tsx`
- Existing unrelated repo errors may still remain

---

### Task 3: Replace NoteTab's current markdown editor stack with MDXEditor

**Files:**
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- Remove or deprecate: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/MarkdownEditor.tsx`
- Remove or deprecate: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/MarkdownPreview.tsx`
- Remove or deprecate: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/markdownPreviewUtils.ts`

- [ ] **Step 1: Write the failing integration test**

Add a test that renders `NoteTab` with a stubbed local-file response and asserts the old editor shell is gone while the new MDX wrapper is present:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { NoteTab } from '../NoteTab'

vi.mock('../../../services/api', () => ({
  apiService: {
    getLocalFile: vi.fn().mockResolvedValue({
      success: true,
      data: '# Title',
      file_path: '/tmp/demo.ai-note.md',
      folder_path: '/tmp',
    }),
    saveLocalFile: vi.fn(),
    getSubtitleFiles: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}))

vi.mock('../../../components/ai/MdxNoteEditor', () => ({
  MdxNoteEditor: () => <div data-testid="mdx-note-editor" />,
}))

describe('NoteTab', () => {
  it('renders the MDX note editor after loading', async () => {
    render(<NoteTab videoId="BV1XMdYBHEGp" />)
    expect(await screen.findByTestId('mdx-note-editor')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails first**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec vitest run src/pages/components/AiNotePanel/NoteTab.test.tsx
```

Expected:
- FAIL because `NoteTab` still uses the old markdown editor stack

- [ ] **Step 3: Swap the render path**

Update `NoteTab.tsx` so the note body renders `MdxNoteEditor` instead of the current `MarkdownEditor`.

Keep these behaviors unchanged:
- load note content from `/api/local/file/{videoId}?file_type=note`
- preserve `selectedSubtitleFilename`
- keep `saveNote`, `startAnalyze`, `handleStopAnalysis`
- keep the top business toolbar

Remove or simplify:
- custom markdown preview padding/styling
- duplicated preview toolbar
- any old state that only exists to support the self-made renderer

Use the same mode state shape, but map it into the new wrapper if the wrapper needs a different API.

- [ ] **Step 4: Verify the integration test passes**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec vitest run src/pages/components/AiNotePanel/NoteTab.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Verify the page still loads and saves**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec tsc --noEmit --pretty false
```

Then open the AI note page in the browser and confirm:
- note content appears
- edit mode works
- save still works
- no infinite loading state

---

### Task 4: Adapt local image resolution for MDXEditor if needed

**Files:**
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/MdxNoteEditor.tsx`
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/markdownPreviewUtils.ts`
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/__tests__/MarkdownPreview.test.tsx`

- [ ] **Step 1: Write the failing image-path test**

Add a test that feeds a note image path like `./screenshots/demo.jpg` and verifies the rendered `img` resolves to the existing local image URL format used by the app.

```tsx
import { render } from '@testing-library/react'
import { MarkdownPreview } from '../MarkdownPreview'

it('resolves local screenshot paths', () => {
  const { container } = render(
    <MarkdownPreview content='![shot](./screenshots/demo.jpg)' sourceFolderPath="/tmp/demo" />
  )

  expect(container.querySelector('img')).toBeTruthy()
})
```

- [ ] **Step 2: Implement the adapter**

If MDXEditor image rendering needs a custom URL resolver, reuse the existing helper logic:

```ts
export function resolveMarkdownImageUrl(src: string, sourceFolderPath?: string | null): string {
  if (!src) return src
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src
  if (!sourceFolderPath) return src
  // keep the existing local-image URL scheme here
  return src
}
```

The exact implementation must preserve current local-file access semantics. Do not invent a new image route unless the existing route cannot support MDXEditor.

- [ ] **Step 3: Run the test and verify local images still render**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec vitest run src/components/ai/__tests__/MarkdownPreview.test.tsx
```

Expected:
- PASS
- local images are still available in rendered output

---

### Task 5: Remove the old custom markdown rendering path and tighten the note page UI

**Files:**
- Modify: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- Delete or archive: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/MarkdownEditor.tsx`
- Delete or archive: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/MarkdownPreview.tsx`
- Delete or archive: `/Users/tanyancong/工作/开发/pilinote/apps/web/src/components/ai/markdownPreviewUtils.ts`

- [ ] **Step 1: Remove dead imports and dead state**

After NoteTab uses `MdxNoteEditor`, delete:
- `MarkdownEditor` imports
- `MarkdownPreview` imports
- helper-only state that was introduced only for the custom markdown renderer

- [ ] **Step 2: Remove duplicated editor chrome**

Ensure the note page has only one editor control surface:
- the top business toolbar in `NoteTab`
- the `MDXEditor` surface below it

Do not keep a second toolbar just for edit/preview mode if MDXEditor already exposes it in a clearer form.

- [ ] **Step 3: Delete or archive the old custom components**

If nothing else in the app uses them, remove the old markdown files so the codebase no longer advertises the fallback path.

- [ ] **Step 4: Verify the old custom path is no longer referenced**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote
rg -n "MarkdownEditor|MarkdownPreview|markdownPreviewUtils" apps/web/src
```

Expected:
- only tests or archival references remain, or nothing remains if deletion is complete

---

### Task 6: End-to-end verification in browser

**Files:**
- No code changes unless a bug is found

- [ ] **Step 1: Start the app and open the AI note page**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm dev
```

- [ ] **Step 2: Verify note rendering in a browser**

Check the AI 笔记 tab for:
- readable heading hierarchy
- comfortable line height
- code blocks with clear separation
- images and screenshots with proper width and rounding
- no blank loading state

- [ ] **Step 3: Verify interactions**

Confirm:
- edit mode works
- preview mode works
- split mode works
- save works
- reanalyze works
- stop works

- [ ] **Step 4: Fix only what the browser reveals**

If the browser shows a specific issue:
- adjust the MDXEditor wrapper first
- avoid reintroducing a custom markdown renderer

---

### Task 7: Final type and regression sweep

**Files:**
- No code changes unless a specific issue is found

- [ ] **Step 1: Run type checking**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec tsc --noEmit --pretty false
```

Expected:
- No new type errors from the MDXEditor migration
- Existing unrelated repo errors may still remain

- [ ] **Step 2: Run the focused tests again**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/web
pnpm exec vitest run src/components/ai/__tests__/MdxNoteEditor.test.tsx src/pages/components/AiNotePanel/NoteTab.test.tsx
```

Expected:
- both tests pass

- [ ] **Step 3: Confirm note page no longer depends on the old markdown stack**

Run:

```bash
cd /Users/tanyancong/工作/开发/pilinote
rg -n "MarkdownEditor|MarkdownPreview|markdownPreviewUtils" apps/web/src/pages/components/AiNotePanel apps/web/src/components/ai
```

Expected:
- no active production references in the note page path

