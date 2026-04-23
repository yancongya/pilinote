# AiNotePanel 前端组件（详情页）

## 概述

`AiNotePanel` 是视频/图文详情页里的 AI 分析面板，负责展示已生成的笔记结果与任务状态。媒体库里用于发起分析和展示队列日志的弹窗是 `AiNoteModal`，不是这个组件。

## 文件位置

`apps/web/src/components/ai/AiNotePanel.tsx`

## 功能

- 检查视频是否已有 AI 笔记
- 风格选择（9 种）
- 格式选择（4 种）
- 触发 AI 分析
- 状态轮询（pending → processing → completed）
- 展示 Markdown 笔记
- 思维导图视图
- 适合单个详情页条目，不负责系列视频的 episode 队列和流水线切换

## 子组件

| 组件 | 文件 | 说明 |
|------|------|------|
| StyleSelector | `StyleSelector.tsx` | 风格选择器 |
| FormatSelector | `FormatSelector.tsx` | 格式选择器 |
| MarkdownViewer | `MarkdownViewer.tsx` | Markdown 渲染 |
| MindMapViewer | `MindMapViewer.tsx` | 思维导图 |

## Hook

`useNotePolling` - 任务状态轮询

```typescript
const { status, progress, error, startPolling, clearPolling } = useNotePolling({
  noteId: 'xxx',
  onStatusChange: (s) => console.log(s),
  onComplete: (note) => console.log(note),
  onError: (e) => console.error(e),
});
```

## API 服务

`services/aiNote.ts`

```typescript
aiNoteService.analyze({ video_id, style, formats })
aiNoteService.getStatus(noteId)
aiNoteService.getNote(noteId)
aiNoteService.getNoteByVideo(videoId)
```

## 使用方式

```typescript
import { AiNotePanel } from './components/ai/AiNotePanel';

<AiNotePanel videoId="xxx" videoTitle="视频标题" />
```
