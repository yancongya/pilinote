# AI笔记详情面板 - 视频详情页子路由设计

> **For agentic workers:** 需根据此spec创建实现计划 (writing-plans skill)

**Goal:** 在视频详情页 `/video/:videoId` 下新增 `/ai` 子路由，提供字幕、笔记、思维导图的查看和编辑功能

**Architecture:** React Router 嵌套路由 + Tab切换

---

## 一、UI/UX 设计

### 1. 路由结构

```
/video/:videoId      → 视频详情页
/video/:videoId/ai  → AI笔记面板（子路由，默认Tab）
/video/:videoId/ai/subtitle → 字幕Tab
/video/:videoId/ai/note     → 笔记Tab
/video/:videoId/ai/mindmap   → 思维导图Tab
```

### 2. Tab布局

- **Tab1: 字幕 (subtitle)** - 展示SRT字幕内容，支持编辑
- **Tab2: 笔记 (note)** - 展示MD笔记内容，支持编辑
- **Tab3: 思维导图 (mindmap)** - Markmap交互式导图

### 3. 组件交互

| 组件 | 功能 | 来源 |
|------|------|------|
| TranscriptEditor | 字幕SRT展示+编辑 | 参考transcriptViewer.tsx |
| MarkdownEditor | MD内容展示+编辑 | 参考MarkdownViewer.tsx |
| MindMapViewer | 交互式思维导图 | 需安装markmap |

---

## 二、功能实现

### 1. 字幕 Tab

- 读取视频目录下的 `.srt` 文件
- 解析SRT格式显示
- 支持手动编辑保存
- 保存回原文件

### 2. 笔记 Tab

- 读取 `.ai-note.md` 文件
- Markdown渲染展示
- 支持手动编辑保存
- 保存回原文件

### 3. 思维导图 Tab

- 使用 `markmap` 库
- 从MD内容实时生成导图
- 支持缩放、折叠等交互

---

## 三、文件位置

### 前端修改
- 新增: `apps/web/src/pages/components/AiNotePanel/` 目录
- 修改: `apps/web/src/App.tsx` - 添加嵌套路由
- 修改: `apps/web/src/pages/VideoDetailPage.tsx` - 集成Tab

### 依赖安装
```bash
cd apps/web
pnpm add markmap
```

---

## 四、对比参考项目

| 功能 | BiliNote | PiliNote (设计) |
|------|----------|----------------|
| 路由方式 | 独立页面 | 嵌套子路由 |
| Tab数量 | 2个 | 3个(新增MindMap) |
| Markmap | 完整 | 完整 |
| 字幕编辑 | 有 | 有 |
| 笔记编辑 | 有 | 有 |

---

## 五、验收标准

- [ ] 访问 `/video/:id/ai` 显示默认Tab
- [ ] 访问 `/video/:id/ai/subtitle` 显示字幕Tab
- [ ] 访问 `/video/:id/ai/note` 显示笔记Tab
- [ ] 访问 `/video/:id/ai/mindmap` 显示思维导图Tab
- [ ] 字幕内容可编辑保存
- [ ] 笔记内容可编辑保存
- [ ] 思维导图可交互（缩放、折叠）