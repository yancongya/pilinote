# AI 笔记 Markdown 编辑/预览轻量化设计

> **For agentic workers:** 需根据此 spec 创建实现计划 (writing-plans skill)

**Goal:** 将 AI 笔记页的 Markdown 渲染从自研正则解析切换为轻量、可切换编辑/预览的实现，并支持实时切换模式、保留本地图片与锚点能力。

**Architecture:** `textarea` 编辑 + `react-markdown` 预览 + 页面级模式切换（编辑 / 预览 / 分屏）

---

## 一、现状与问题

当前项目的 Markdown 展示并不是标准渲染器，而是多套定制实现：

- `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
  - 手写 `parseMarkdown` / `parseInline`
  - 负责 AI 笔记页正文展示
- `apps/web/src/components/ai/MarkdownViewer.tsx`
  - 使用字符串正则 + `dangerouslySetInnerHTML`
  - 仅覆盖少量 Markdown 语法
- `apps/web/src/pages/videoDetailOpus.ts`
  - 仅用于图文内容的局部解析

现有问题：

- 维护成本高，Markdown 语法覆盖不完整
- 行内语法与标题/列表规则容易互相干扰
- 编辑态和预览态不是统一的模式切换
- 本地图片、锚点、代码块等能力需要继续扩展，手写解析器很难稳定演进

---

## 二、目标与非目标

### 目标

- AI 笔记页支持 `编辑 / 预览 / 分屏` 模式切换
- 编辑时使用 `textarea`
- 预览时使用轻量标准 Markdown 解析器
- 保留以下能力：
  - 标题层级渲染
  - 列表、引用、代码块、粗体、斜体、链接
  - 图片渲染
  - 本地相对路径图片转换为可访问 URL
  - 标题锚点跳转
- 尽量少引入额外复杂度

### 非目标

- 不做所见即所得富文本编辑器
- 不做完整的文档协同编辑
- 不重写全站所有 Markdown 组件，只优先解决 AI 笔记页

---

## 三、方案对比

### 方案 A：`react-markdown + textarea`（推荐）

**结构**
- 编辑态：`textarea`
- 预览态：`react-markdown`
- 模式切换：页面顶部按钮或 segmented control

**优点**
- 轻量
- React 生态成熟
- 语法覆盖比手写解析器完整
- 可以按需定制 `img`、`a`、`h1~h6`

**缺点**
- 需要新增依赖
- 需要额外适配本地图片 URL 和标题锚点

### 方案 B：`@uiw/react-md-editor`

**优点**
- 自带编辑/预览切换
- 上手快

**缺点**
- 依赖更重
- 样式和交互更偏通用编辑器，不容易完全贴合现有页面
- 本地图片与锚点定制成本高于方案 A

### 方案 C：继续手写解析器

**优点**
- 不引入新依赖

**缺点**
- 维护成本最高
- 容易继续出现语法漏洞
- 很难做到完整且一致的预览体验

**结论：选择方案 A。**

---

## 四、设计方案

### 1. 组件拆分

新增一个轻量的 Markdown 编辑/预览组件层：

- `MarkdownEditor`
  - 管理 `mode: 'edit' | 'preview' | 'split'`
  - 管理编辑输入、预览渲染、模式切换
- `MarkdownPreview`
  - 负责只读渲染
  - 封装 `react-markdown` 的定制规则

AI 笔记页只负责数据流：

- 读取笔记内容
- 保存笔记内容
- 触发重新生成
- 传入 `content` 和 `onChange`

### 2. 渲染能力

预览层使用 `react-markdown`，配合以下定制：

- `remark-gfm`：支持表格、任务列表、删除线等常用 GitHub 风格语法
- 自定义 `img`：
  - 如果是相对路径图片，转换为项目可访问的本地图片 URL
  - 复用现有本地资源解析逻辑
- 自定义 `a`：
  - 支持外链
  - 支持标题锚点跳转
- 自定义标题节点：
  - 自动生成 id
  - 支持点击滚动到对应位置

### 3. 模式切换

顶部提供三个模式：

- `编辑`
- `预览`
- `分屏`

行为约束：

- `编辑`：只显示 `textarea`
- `预览`：只显示渲染结果
- `分屏`：左侧编辑、右侧预览

模式切换不影响当前内容，不触发自动保存。

### 4. 自动保存与手动保存

当前 AI 笔记页已有手动保存逻辑，保留为主。

可选增强：

- 编辑态内容变化后，只做本地 state 更新
- 用户点击 `保存` 时写回文件
- 不引入实时自动保存，避免覆盖生成结果或误写入

### 5. 本地图片兼容

AI 笔记生成结果里可能包含：

- `./screenshots/xxx.jpg`
- `screenshots/xxx.jpg`
- 其它本地相对路径图片

预览层需要统一处理：

- 保留现有本地文件路径规则
- 将 Markdown 图片路径转换为可访问的本地资源 URL
- 避免直接依赖浏览器相对路径解析

### 6. 代码迁移

`NoteTab.tsx` 中现有的：

- `parseMarkdown`
- `parseInline`

将从页面主逻辑中移除，替换为新的预览组件。

`apps/web/src/components/ai/MarkdownViewer.tsx` 可以：

- 保留为兼容层，或
- 逐步切换为基于 `react-markdown` 的通用预览组件

优先级上，先改 `NoteTab`，不强制一次性改全站所有 Markdown 入口。

---

## 五、文件影响范围

### 前端

- 新增：
  - `apps/web/src/components/ai/MarkdownEditor.tsx`
  - `apps/web/src/components/ai/MarkdownPreview.tsx`
- 修改：
  - `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
  - `apps/web/src/components/ai/MarkdownViewer.tsx`（可选，取决于是否统一复用）

### 依赖

前端新增依赖建议：

```bash
cd apps/web
pnpm add react-markdown remark-gfm
```

如果后续需要更严格的安全处理，可再评估：

- `rehype-sanitize`

但默认不强制引入，避免增加不必要体积。

---

## 六、数据流

1. `NoteTab` 读取 `.ai-note.md`
2. 将 `content` 传给 `MarkdownEditor`
3. `MarkdownEditor` 根据模式选择：
   - 编辑：`textarea`
   - 预览：`MarkdownPreview`
   - 分屏：两者并排
4. 用户编辑后点击保存
5. 保存回写本地文件，刷新当前笔记内容

---

## 七、错误处理

- Markdown 解析失败：
  - 预览层降级为纯文本显示
  - 不阻塞编辑
- 图片路径无法解析：
  - 仅渲染 alt 文本或占位提示
  - 不影响整篇文档
- 非法链接或空链接：
  - 跳过渲染或按普通文本处理

---

## 八、验收标准

- [ ] AI 笔记页可在编辑 / 预览 / 分屏之间切换
- [ ] 编辑态为 `textarea`
- [ ] 预览态使用标准 Markdown 渲染
- [ ] 标题、列表、引用、代码块、粗体、斜体、链接正常渲染
- [ ] 本地相对路径图片可正确显示
- [ ] 标题锚点可点击跳转
- [ ] 保存逻辑不受模式切换影响
- [ ] 当前页面不再依赖 `NoteTab.tsx` 内部手写 Markdown 解析器

---

## 九、实施顺序建议

1. 增加 Markdown 预览组件
2. 接入 `react-markdown` 和 `remark-gfm`
3. 替换 `NoteTab` 的旧解析逻辑
4. 统一本地图片处理和标题锚点
5. 补充验证

