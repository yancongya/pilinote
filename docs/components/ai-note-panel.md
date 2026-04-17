# AiNotePanel 前端组件

## 概述

AI 分析面板组件，集成在媒体库视频详情页，提供 AI 笔记生成功能。

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