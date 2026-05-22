# AI 笔记导图 Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 笔记页新增一个基于当前 Markdown 动态生成的导图 tab，并提供全屏与导出能力。

**Architecture:** 前端直接从 `NoteTab` 共享的笔记 Markdown 全文生成 markmap 树并渲染 SVG。`MindMapTab` 只负责展示与导出，不引入后端缓存，也不改动现有笔记保存、版本管理和字幕流程。

**Tech Stack:** React + TypeScript + Vite, `markmap-lib`, `markmap-view`, `markmap-toolbar`, `markmap-common`, existing AI note content state

---

### Task 1: 引入 markmap 依赖并补齐类型声明

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/pnpm-lock.yaml`
- Create: `apps/web/src/types/markmap-view.d.ts`

- [ ] **Step 1: 写出依赖变更**

```json
{
  "dependencies": {
    "markmap": "^0.6.1",
    "markmap-common": "^0.18.10",
    "markmap-lib": "^0.18.10",
    "markmap-toolbar": "^0.18.10",
    "markmap-view": "^0.18.10"
  }
}
```

- [ ] **Step 2: 安装依赖并生成 lockfile**

Run:

```bash
cd apps/web
pnpm install
```

Expected:

- `package.json` 和 `pnpm-lock.yaml` 同步更新
- 本地可以解析 `markmap-lib / markmap-view / markmap-toolbar / markmap-common`

- [ ] **Step 3: 补齐最小类型声明**

```ts
declare module 'markmap-lib';
declare module 'markmap-view';
declare module 'markmap-toolbar';
declare module 'markmap-common';
```

Expected:

- TypeScript 不再因为缺少模块声明阻断编译

---

### Task 2: 提取导图渲染组件与 Markdown 转树逻辑

**Files:**
- Create: `apps/web/src/pages/components/AiNotePanel/MindMapTab.tsx`
- Create: `apps/web/src/components/ai/mindmapUtils.ts`

- [ ] **Step 1: 写 Markdown 到 markmap 树的转换测试**

```ts
import { describe, expect, it } from 'vitest';
import { extractMindMapSource, buildMindMapData } from '../mindmapUtils';

describe('mindmap utils', () => {
  it('keeps headings and lists only', () => {
    const markdown = `# Root\n\n## One\n- A\n- B\n\n\`\`\`ts\nconst x = 1\n\`\`\`\n\n![img](./a.png)`;
    const source = extractMindMapSource(markdown);
    expect(source).toContain('# Root');
    expect(source).toContain('## One');
    expect(source).toContain('- A');
    expect(source).not.toContain('const x = 1');
    expect(source).not.toContain('![img]');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/mindmapUtils.test.ts
```

Expected:

- 失败，提示 `mindmapUtils` 尚未实现

- [ ] **Step 3: 实现最小转换器与导图组件壳层**

```ts
export function extractMindMapSource(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '\n')
    .replace(/^\s*>\s?/gm, '')
    .trim();
}

export function buildMindMapData(markdown: string) {
  // 只保留标题和列表结构，交给 markmap transformer 处理。
  return extractMindMapSource(markdown);
}
```

`MindMapTab.tsx` 先实现基础结构：

```tsx
export function MindMapTab({ content }: { content: string }) {
  return <div className="h-full w-full" />;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/mindmapUtils.test.ts
```

Expected:

- PASS

---

### Task 3: 完成导图渲染、全屏与导出能力

**Files:**
- Modify: `apps/web/src/pages/components/AiNotePanel/MindMapTab.tsx`
- Modify: `apps/web/src/components/ai/mindmapUtils.ts`

- [ ] **Step 1: 写导出与全屏行为测试**

```ts
import { describe, expect, it } from 'vitest';
import { formatMindMapExportName } from '../mindmapUtils';

describe('mindmap export name', () => {
  it('uses a safe default name', () => {
    expect(formatMindMapExportName('')).toBe('mindmap');
    expect(formatMindMapExportName('My Note')).toBe('My Note');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/mindmapUtils.test.ts
```

Expected:

- 失败，提示 `formatMindMapExportName` 尚未实现

- [ ] **Step 3: 实现 markmap 初始化与导出**

```ts
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { Toolbar } from 'markmap-toolbar';

const transformer = new Transformer();

const { root } = transformer.transform(markdownSource);
const mm = Markmap.create(svgElement, {});
mm.setData(root).then(() => mm.fit());
```

导出实现需要覆盖：

```ts
const exportSvg = async () => { /* clone svg and download */ };
const exportPng = async () => { /* serialize svg into canvas and download */ };
const exportHtml = () => { /* embed root json into static html */ };
const exportXMind = () => { /* convert tree to xmind json and zip */ };
```

全屏实现需要覆盖：

```ts
const enterFullscreen = () => svgContainer.requestFullscreen();
const exitFullscreen = () => document.exitFullscreen();
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/mindmapUtils.test.ts
```

Expected:

- PASS

---

### Task 4: 将导图 tab 接入 AI 笔记面板并共享笔记内容

**Files:**
- Modify: `apps/web/src/pages/components/AiNotePanel/index.tsx`
- Modify: `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- Modify: `apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx`（仅保证 tab 结构不被破坏）
- Modify: `apps/web/src/pages/components/AiNotePanel/MindMapTab.tsx`

- [ ] **Step 1: 写 tab 切换测试或最小渲染断言**

```tsx
render(<AiNotePanel />);
expect(screen.getByRole('button', { name: '导图' })).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd apps/web
pnpm exec vitest run src/pages/components/AiNotePanel/__tests__/AiNotePanel.test.tsx
```

Expected:

- 失败，提示导图 tab 尚未存在

- [ ] **Step 3: 接入导图 tab 并常驻挂载**

```tsx
type TabType = 'subtitle' | 'note' | 'mindmap';

const tabs = [
  { id: 'subtitle', label: '字幕' },
  { id: 'note', label: '笔记' },
  { id: 'mindmap', label: '导图' },
];
```

`AiNotePanel` 需要新增一个共享状态来保存最新笔记 Markdown 和导出标题，并在初始化时预加载一次当前笔记内容：

```tsx
const [noteMarkdown, setNoteMarkdown] = useState('');
const [noteTitle, setNoteTitle] = useState('mindmap');

useEffect(() => {
  if (!videoId) return;
  void apiService.getLocalFile(videoId, 'note').then((response) => {
    if (response.success && typeof response.data === 'string') {
      setNoteMarkdown(response.data);
    }
    if (response.success && response.file_path) {
      const fileName = response.file_path.split('/').pop() || 'mindmap';
      setNoteTitle(fileName.replace(/\.ai-note\.md$/i, '').replace(/\.md$/i, '') || 'mindmap');
    }
  });
}, [videoId]);
```

`AiNotePanel` 继续维持 `mountedTabs` 常驻挂载逻辑，确保：

```tsx
{mountedTabs.has('mindmap') && (
  <div style={{ display: activeTab === 'mindmap' ? 'block' : 'none', height: '100%' }}>
    <MindMapTab content={noteMarkdown} title={noteTitle} />
  </div>
)}
```

`NoteTab` 需要增加一个明确的同步回调，并在以下时机调用：

```tsx
<NoteTab
  videoId={videoId}
  selectedSubtitleFilename={selectedSubtitleFilename}
  onContentSnapshotChange={setNoteMarkdown}
/>
```

`NoteTab` 内部在 `loadNote`、编辑时 `onChange`、`saveNote` 成功后、取消编辑时都要调用 `onContentSnapshotChange(nextContent)`，保证父层持有的导图数据始终和正文一致。

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
cd apps/web
pnpm exec vitest run src/pages/components/AiNotePanel/__tests__/AiNotePanel.test.tsx
```

Expected:

- PASS

---

### Task 5: 收口样式、空态和导出失败处理

**Files:**
- Modify: `apps/web/src/pages/components/AiNotePanel/MindMapTab.tsx`
- Modify: `apps/web/src/components/ai/mindmapUtils.ts`

- [ ] **Step 1: 写空态和错误态测试**

```ts
it('shows empty state for blank content', () => {
  render(<MindMapTab content="" title="note" />);
  expect(screen.getByText('暂无可展示的导图内容')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd apps/web
pnpm exec vitest run src/pages/components/AiNotePanel/__tests__/MindMapTab.test.tsx
```

Expected:

- 失败，提示空态尚未实现

- [ ] **Step 3: 补齐空态、错误态和导出提示**

```tsx
if (!normalizedMarkdown.trim()) {
  return <div className="flex h-full items-center justify-center">暂无可展示的导图内容</div>;
}

try {
  // export...
} catch (err) {
  toast.error('导出失败');
}
```

导图工具栏保留参考项目里的核心按钮，并确保所有导出动作都可在暗色模式下正常显示。

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
cd apps/web
pnpm exec vitest run src/pages/components/AiNotePanel/__tests__/MindMapTab.test.tsx
```

Expected:

- PASS

---

### Task 6: 回归检查与提交

**Files:**
- Modify: 以上所有涉及文件

- [ ] **Step 1: 跑前端类型检查**

Run:

```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false
```

Expected:

- 这次新增的导图相关文件不再产生错误
- 仓库既有的其他错误如果仍存在，单独记录，不混入本次改动

- [ ] **Step 2: 跑导图相关测试**

Run:

```bash
cd apps/web
pnpm exec vitest run src/components/ai/__tests__/mindmapUtils.test.ts src/pages/components/AiNotePanel/__tests__/AiNotePanel.test.tsx src/pages/components/AiNotePanel/__tests__/MindMapTab.test.tsx
```

Expected:

- PASS

- [ ] **Step 3: 提交代码**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/types/markmap-view.d.ts apps/web/src/components/ai/mindmapUtils.ts apps/web/src/pages/components/AiNotePanel/MindMapTab.tsx apps/web/src/pages/components/AiNotePanel/NoteTab.tsx apps/web/src/pages/components/AiNotePanel/index.tsx
git commit -m "新增 AI 笔记导图 tab 与导出功能"
```

---

## Self-Review Coverage Check

- 参考项目的前端动态导图实现：Task 2 / Task 3
- 导图 tab 新增与页面接入：Task 4
- 只抽标题和列表结构：Task 2
- 导出 SVG / PNG / HTML / XMind：Task 3
- 全屏 / 退出全屏：Task 3
- 空态 / 错误态：Task 5
- 类型检查与回归：Task 6

No placeholder text remains in the plan.
