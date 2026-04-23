# AiNoteModal 前端组件

## 概述

`AiNoteModal` 是媒体库里进入 AI 分析时使用的弹窗组件。它负责承接当前媒体的分析配置、运行状态与流水线日志展示，既支持单个视频的分析，也支持系列视频的单集队列分析。

## 文件位置

`apps/web/src/components/ai/AiNoteModal.tsx`

## 功能

- 从媒体库卡片打开 AI 分析弹窗
- 读取 prompt 卡片、LLM 配置与本地 ASR 状态
- 对单个视频直接发起现有单集分析流程
- 对系列视频按“单集任务集合”方式排队执行
- 展示每一集的状态、进度、当前阶段与运行日志
- 支持单集重试
- 支持在列表中切换当前查看的 episode
- 保持流水线节点详情手动展开，不自动弹出第一个节点
- 将当前运行快照写入 `sessionStorage`，关闭面板或刷新页面后可回读上次状态

## 系列模式行为

系列视频不会走新的聚合分析流水线，而是复用现有单集视频流水线逐集执行。弹窗负责的工作是：

1. 展示系列元信息与 episode 列表
2. 允许选择要分析的 episode
3. 按顺序逐集执行分析
4. 将每个 episode 的状态、trace 与 runtime 快照分别保存
5. 切换当前选中 episode 时，只更新下方流水线面板的数据源

### 重要约束

- 每个 episode 都有自己的 `status / progress / currentStage / trace / runtimeState`
- 点击列表只切换当前 episode，不会自动打开节点详情
- 节点日志仍由用户手动点击流水线节点查看
- 单集失败时，失败 trace 会回填到该 episode 自己的状态里
- 单集完成时，最终 trace 也会同步回写，避免底部“生成”节点一直停留在加载态
- 面板关闭后不会丢失快照，重新打开时优先从本地缓存恢复，再按需做服务端回填

## 数据流

```text
VideoLibrary 卡片
  -> 打开 AiNoteModal
  -> 传入当前媒体的 note / episode 上下文
  -> 先读 session 快照，恢复上次状态
  -> 再异步读取服务端最新 note/status，必要时合并回填
  -> 单集模式：直接执行单视频流水线
  -> 系列模式：按 episode 队列顺序执行
  -> 每个 episode 的 runtime 快照回填到列表项
  -> 底部流水线面板读取当前 active episode 的快照
```

## 相关辅助模块

| 模块 | 文件 | 说明 |
|------|------|------|
| seriesAnalysis | `seriesAnalysis.ts` | 系列 episode 的默认选中、排序、状态汇总与进度计算 |
| aiNoteModalCache | `aiNoteModalCache.ts` | 面板快照缓存读写，负责 sessionStorage 恢复与写回 |

## 相关接口

`AiNoteModal` 复用现有 AI 笔记接口，不引入新的后端路由：

- `POST /api/note/analyze`
- `GET /api/note/status/{note_id}`
- `GET /api/note/{note_id}`
- `GET /api/note/by-video?video_id=...`

## 使用方式

通常由媒体库卡片触发，不直接在页面里手动引入。

```typescript
// 由 VideoLibrary 内部打开
<AiNoteModal
  open={open}
  onClose={handleClose}
  episodeList={episodes}
  activeEpisodeId={activeEpisodeId}
/>
```
