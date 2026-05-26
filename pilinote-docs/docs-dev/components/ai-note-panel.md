# AiNotePanel 前端组件（详情页）

## 概述

`AiNotePanel` 是视频/图文详情页里的 AI 分析面板，负责展示已生成的笔记结果与任务状态。媒体库里用于发起分析和展示队列日志的弹窗是 `AiNoteModal`，不是这个组件。
现在这两个入口会共用同一套 AI 分析快照缓存，关闭面板或刷新页面后都可以先回读本地状态，再按需向服务端回填最新结果。

图文详情页这条链路会显式使用 `image_text` 流水线；后端 `by-video` 查询也会优先返回最近一次分析结果，避免旧的 `video` 失败记录覆盖掉最新成功状态。

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
- 图文分析不会再默认回落到 `video` 模式，详情页触发和重试都显式携带 `image_text`

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
