# Phase 3: 前端界面 - 执行计划

## 目标
完成前端 UI 和交互

## Wave 3: 前端界面

### 03-01: 创建 AI 分析面板组件

**任务 ID**: 03-01
**描述**: 在媒体库视频详情页添加 AI 分析面板
**依赖**: 无

#### 原子任务

**03-01-T01**: 创建 AI 模块目录和 API 服务
- 文件: `apps/web/src/services/aiNote.ts`
- 内容:
  - API 调用: `analyzeVideo()`, `getNoteStatus()`, `getNote()`
  - 类型定义: `AiNoteRequest`, `AiNoteResponse`

**03-01-T02**: 创建 AI 分析面板组件
- 文件: `apps/web/src/components/ai/AiNotePanel.tsx`
- 内容:
  - 触发分析按钮
  - 状态显示区域
  - 结果展示区域

**03-01-T03**: 在视频详情页集成面板
- 文件: `apps/web/src/pages/VideoDetail.tsx` 或类似页面
- 内容: 引入并放置 AiNotePanel

---

### 03-02: 实现风格选择器 UI

**任务 ID**: 03-02
**描述**: 创建笔记风格选择器 UI
**依赖**: 03-01

#### 原子任务

**03-02-T01**: 创建风格选择器组件
- 文件: `apps/web/src/components/ai/StyleSelector.tsx`
- 内容:
  - 9 种风格选项（精简、详细、学术、教程、小红书、生活向、任务导向、商业、会议纪要）
  - 选中状态管理
  - 风格描述提示

**03-02-T02**: 创建格式选择器组件
- 文件: `apps/web/src/components/ai/FormatSelector.tsx`
- 内容:
  - 4 种格式选项（目录、原片跳转、原片截图、AI总结）
  - 多选支持

---

### 03-03: 集成 Markdown 渲染组件

**任务 ID**: 03-03
**描述**: 集成 Markdown 渲染组件显示笔记
**依赖**: 03-01

#### 原子任务

**03-03-T01**: 安装 react-markdown 依赖
- 文件: `apps/web/package.json`
- 内容: 添加 `react-markdown`, `remark-gfm`, `react-syntax-highlighter`

**03-03-T02**: 创建 Markdown 渲染组件
- 文件: `apps/web/src/components/ai/MarkdownViewer.tsx`
- 内容:
  - 使用 react-markdown 渲染
  - 支持 GFM (表格、任务列表等)
  - 代码高亮
  - 自定义样式

**03-03-T03**: 创建 Markdown 预览弹窗
- 文件: `apps/web/src/components/ai/MarkdownPreviewModal.tsx`
- 内容:
  - 完整笔记预览
  - 复制功能
  - 导出功能（可选）

---

### 03-04: 集成思维导图组件

**任务 ID**: 03-04
**描述**: 集成 markmap 展示思维导图
**依赖**: 03-03

#### 原子任务

**03-04-T01**: 安装 markmap 依赖
- 文件: `apps/web/package.json`
- 内容: 添加 `markmap`, `d3` (如果需要)

**03-04-T02**: 创建思维导图组件
- 文件: `apps/web/src/components/ai/MindMapViewer.tsx`
- 内容:
  - 使用 markmap-viewer
  - 从 Markdown 提取标题结构
  - 交互式展示

**03-04-T03**: 集成到笔记面板
- 内容: 在 AiNotePanel 中添加思维导图视图切换

---

### 03-05: 任务状态轮询和进度展示

**任务 ID**: 03-05
**描述**: 实现任务状态轮询和进度展示
**依赖**: 02-03

#### 原子任务

**03-05-T01**: 创建轮询 Hook
- 文件: `apps/web/src/hooks/useNotePolling.ts`
- 内容:
  - 定时轮询 note status
  - 处理 pending/processing/completed/failed 状态
  - 清理轮询

**03-05-T02**: 创建进度展示组件
- 文件: `apps/web/src/components/ai/NoteProgress.tsx`
- 内容:
  - 处理中状态动画
  - 进度百分比
  - 状态文字

**03-05-T03**: 集成到分析面板
- 内容: 面板使用轮询和进度组件

---

## 任务依赖图

```
Wave 3: 前端界面
├── 03-01: AI 分析面板
│   ├── 03-01-T01: API 服务
│   ├── 03-01-T02: 面板组件
│   └── 03-01-T03: 集成到详情页
│
├── 03-02: 风格选择器 (依赖 03-01)
│   ├── 03-02-T01: 风格选择器
│   └── 03-02-T02: 格式选择器
│
├── 03-03: Markdown 渲染 (依赖 03-01)
│   ├── 03-03-T01: 安装依赖
│   ├── 03-03-T02: 渲染组件
│   └── 03-03-T03: 预览弹窗
│
├── 03-04: 思维导图 (依赖 03-03)
│   ├── 03-04-T01: 安装依赖
│   ├── 03-04-T02: 思维导图组件
│   └── 03-04-T03: 集成视图切换
│
└── 03-05: 状态轮询 (依赖 02-03)
    ├── 03-05-T01: 轮询 Hook
    ├── 03-05-T02: 进度组件
    └── 03-05-T03: 集成面板
```

## 执行顺序

1. **03-01** - 先创建基础 API 和面板
2. **03-02** - 风格选择器
3. **03-03** - Markdown 渲染
4. **03-04** - 思维导图
5. **03-05** - 状态轮询（可与前面并行开发）

## 验证标准

- 媒体库视频可触发 AI 分析
- 风格和格式可选择
- Markdown 笔记正常渲染
- 思维导图可交互
- 状态轮询正常工作