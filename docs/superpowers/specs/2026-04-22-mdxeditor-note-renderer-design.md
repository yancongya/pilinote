# AI 笔记 MDXEditor 文档渲染器替换设计

> **For agentic workers:** 需根据此 spec 创建实现计划 (writing-plans skill)

**Goal:** 将 AI 笔记页的自研 Markdown 编辑/预览实现替换为 `@mdxeditor/editor`，获得更稳定的文档型编辑体验，并保留本地图片、标题锚点、编辑/预览切换与保存/重生成流程。

**Architecture:** 用单一 `MDXEditor` 作为笔记正文的核心渲染与编辑容器，笔记页继续保留业务工具栏与后台任务控制；Markdown 语义、图片路径和只读/编辑状态由 MDXEditor 插件与 props 统一承接。

**Tech Stack:** React + TypeScript + Vite, `@mdxeditor/editor`, existing AI note backend and local file APIs

---

## 一、现状与问题

当前 AI 笔记页的 Markdown 展示已经从手写解析迁移到轻量自研方案，但整体观感仍然不稳定：

- 预览区样式是我们自己拼出来的，标题、段落、引用、代码块和图片之间的视觉关系不够统一
- 编辑态、预览态、分屏态由我们自己维护，壳层较多
- Markdown 语义虽然已经比以前稳定，但仍然依赖自定义样式来撑住排版
- 用户已经明确要求“文档型”体验，希望更接近 Notion / 语雀 这类成熟文档产品

现在的问题不是功能缺失，而是“文档渲染器”本身不够成熟，导致视觉质量和交互一致性不足。

---

## 二、目标与非目标

### 目标

- 用 `@mdxeditor/editor` 替换当前 AI 笔记页的 Markdown 编辑/预览实现
- 保留笔记内容的完整 Markdown 语义
- 保留以下能力：
  - 编辑 / 预览 / 分屏切换
  - 标题层级与锚点跳转
  - 列表、引用、代码块、表格、链接、任务列表
  - 本地相对路径图片与截图路径
  - 笔记保存
  - 笔记重新生成与停止任务
- 让笔记正文的视觉样式更接近成熟文档产品，减少手写 CSS 和渲染分叉

### 非目标

- 不在这一轮重做字幕页渲染器
- 不把 AI 笔记改成富文本文档系统或协同编辑系统
- 不改后端 AI 生成内容格式
- 不把整站所有 Markdown 入口一起迁移，优先只收敛 AI 笔记页

---

## 三、方案对比

### 方案 A：`@mdxeditor/editor` 替换现有 Markdown 组件（推荐）

**结构**
- `NoteTab` 继续负责业务状态、任务触发、保存
- 文档正文由 `MDXEditor` 单组件承接
- 通过插件启用 headings / lists / quote / table / link / image / markdown shortcuts
- 使用 `readOnly` 或 source 模式来承接预览态

**优点**
- 文档型体验成熟，默认样式和交互更完整
- 比手写解析器更稳
- 统一编辑与预览，不需要我们自己维护两套渲染壳层

**缺点**
- 依赖更重
- 需要调整当前笔记页布局，避免工具栏重复
- 本地图片与相对路径需要做适配

### 方案 B：继续保留轻量自研渲染器

**优点**
- 不引入新依赖
- 改动较小

**缺点**
- 视觉仍然不稳定
- 后续样式和语法支持继续依赖手工维护
- 不符合当前“直接换成熟组件库”的目标

### 方案 C：换成另一类轻量 Markdown 组件库

**优点**
- 比自研快
- 可能比 MDXEditor 更轻

**缺点**
- 一般不如 MDXEditor 在文档型编辑体验和插件体系上完整
- 对图文混排、本地图片、source 模式的支持通常不如预期

**结论：采用方案 A。**

---

## 四、设计方案

### 1. 组件边界

把 AI 笔记正文收敛成一个专门的文档组件层：

- `MdxNoteEditor`
  - 负责装配 `MDXEditor`
  - 负责编辑 / 预览 / 分屏状态
  - 负责把 `content`、`sourceFolderPath`、`readOnly` 等业务参数传入编辑器
- `NoteTab`
  - 继续负责：
    - 加载笔记
    - 保存笔记
    - 重新生成笔记
    - 停止任务
    - 顶部业务工具栏
  - 不再手写 Markdown 语法渲染

旧的自研组件逐步收口：

- `apps/web/src/components/ai/MarkdownEditor.tsx`
- `apps/web/src/components/ai/MarkdownPreview.tsx`
- `apps/web/src/components/ai/markdownPreviewUtils.ts`

这些文件不再作为 AI 笔记主入口使用，后续可删除或保留为兼容层，但主链路必须切到 `MDXEditor`。

### 2. 编辑器模式

统一支持三种模式：

- `edit`
- `preview`
- `split`

在 MDXEditor 里通过现成的模式插件或只读开关来实现，不再自己拼 `textarea + preview`。

约束：

- `edit`：允许修改 markdown
- `preview`：只读展示
- `split`：左编辑右预览

模式切换不触发保存，也不触发重新生成。

### 3. Markdown 插件组合

最小可用插件组合建议如下：

- headings
- lists
- quote
- thematic break
- markdown shortcuts
- link
- image
- table

如后续发现代码块、搜索、diff/source 需要更强能力，再单独加插件，不在这一轮过度扩张。

### 4. 图片与本地路径

笔记正文里可能包含：

- `./screenshots/xxx.jpg`
- `screenshots/xxx.jpg`
- 其它相对本地路径图片

需要保留本地图片展示能力：

- 继续使用笔记文件所在目录作为相对路径解析基准
- 在编辑器层把相对路径转换成可访问的本地资源 URL
- 截图目录保持原有生成规则，不改后端输出格式

如果 MDXEditor 的 image 插件对本地路径的处理不满足要求，则在本地图片解析层补一个最小适配器，而不是回退到手写 Markdown 预览。

### 5. 样式策略

目标不是继续堆自定义 CSS，而是借助组件库自带的结构和主题能力，做最少的覆盖：

- 统一字体、字号和行距
- 统一正文宽度和留白
- 保留标题层级、引用块、代码块、图片的默认文档感
- 只对边距、背景、边框、圆角做少量项目级定制

重点是避免再出现：

- 自绘标题块
- 自绘代码块卡片
- 自绘预览容器与编辑容器双重冲突

### 6. 业务流程不变

以下流程不变，只换正文渲染器：

- 笔记加载
- 笔记编辑
- 笔记保存
- 笔记重新生成
- 笔记停止任务
- toast 提示

也就是说，这一轮是“文档渲染器替换”，不是业务流程重写。

---

## 五、文件影响范围

### 前端新增

- `apps/web/src/components/ai/MdxNoteEditor.tsx`

### 前端修改

- `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- `apps/web/src/components/ai` 下的 Markdown 相关组件引用
- `apps/web/package.json`
- `apps/web/pnpm-lock.yaml`
- `apps/web/src/index.css` 或组件级样式文件（如果需要少量主题覆盖）

### 前端可能删除或降级为兼容层

- `apps/web/src/components/ai/MarkdownEditor.tsx`
- `apps/web/src/components/ai/MarkdownPreview.tsx`
- `apps/web/src/components/ai/markdownPreviewUtils.ts`

### 依赖新增

建议安装：

```bash
cd apps/web
pnpm add @mdxeditor/editor
```

并按官方文档同步引入样式：

```ts
import '@mdxeditor/editor/style.css'
```

---

## 六、风险与处理

### 风险 1：MDXEditor 与现有 Vite / React 运行环境的样式冲突

处理方式：
- 先做笔记页单点替换
- 用最小插件集验证可用性
- 先保证功能，再微调主题

### 风险 2：图片和相对路径不兼容

处理方式：
- 先保留本地路径解析逻辑
- 如果 image 插件不直接满足，补一层 URL 转换适配器

### 风险 3：工具栏重复

处理方式：
- `NoteTab` 顶部业务工具栏保留
- MDXEditor 自带工具栏只保留必要能力
- 避免在页面里再保留一套独立 Markdown 工具条

### 风险 4：旧笔记格式兼容问题

处理方式：
- 保持 markdown 原文不改
- 只替换渲染器和编辑器 UI
- 不迁移存量文件格式

---

## 七、验证策略

### 手工验证

1. 打开 AI 笔记页
2. 切换到笔记 tab
3. 确认笔记可以正常加载
4. 确认编辑、预览、分屏可切换
5. 确认标题、列表、引用、代码块、图片、表格显示正常
6. 确认相对路径截图能够显示
7. 确认保存后重新打开内容不丢失
8. 确认重新生成与停止按钮仍然可用

### 代码验证

- 运行 `pnpm exec vitest run` 相关组件测试
- 运行 `pnpm exec tsc --noEmit --pretty false`
- 如需要，再做一轮浏览器截图比对

### 回归关注点

- 笔记内容是否还会停留在“加载笔记中...”
- 编辑态是否能正确写回本地文件
- 预览态是否还会出现简陋或错乱的样式
- 图片路径是否被破坏

---

## 八、结论

这次改造的核心不是增加功能，而是把 AI 笔记页的 Markdown 呈现基础设施从“自研壳层”替换成“成熟编辑器组件”。

如果后续还要继续优化字幕页，可以复用同样的思路，但本轮先把笔记页收口，避免范围扩散。
