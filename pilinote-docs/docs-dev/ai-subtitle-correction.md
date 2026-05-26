# AI 字幕纠正

PiliNote 的字幕纠正流程现在采用“**NFO 上下文 + 全量分块分析 + 手动确认应用**”的方式。它不会只看字幕文件的前几行，而是会先读取视频目录下的 NFO 元数据，再分批分析整份 SRT 字幕，最后由用户确认后写回本地字幕文件。

## 处理流程

1. 从 `video_id` 找到视频目录。
2. 读取目录下的 `.nfo` 文件，提取标题、UP 主 / 厂牌、时长、简介、标签等背景信息。
3. 把 SRT 解析成稳定字幕块，保留 `index`、起止时间和正文。
4. 按批次调用 LLM 进行纠错分析，批次之间允许少量重叠，避免上下文断裂。
5. 返回结构化问题列表，每条建议保留原文、修正文、原因和置信度。
6. 前端展示结果后，由用户点击“应用修正”。
7. 保存后通过本地文件接口写回字幕，并自动生成版本快照。

## 结果格式

字幕纠错结果同时兼容旧字段和新字段：

```json
{
  "index": 12,
  "type": "typo",
  "text": "我门去看看",
  "suggestion": "我们去看看",
  "original_text": "我门去看看",
  "corrected_text": "我们去看看",
  "reason": "常见错别字",
  "confidence": 0.94
}
```

前端仍然可以按 `index` 将修正结果回写到对应 SRT block 的正文行。

## 相关接口

- `POST /api/ai/subtitle/pipeline-analyze`
- `POST /api/ai/subtitle/analyze`
- `POST /api/ai/subtitle/cancel/{task_id}`
- `POST /api/local/file/{video_id}?file_type=subtitle`

## 相关文件

- `apps/api/src/services/ai/subtitle_context.py`
- `apps/api/src/services/ai/subtitle_analyzer.py`
- `apps/api/src/routers/ai_subtitle.py`
- `apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx`
- `apps/web/src/components/ai/SubtitleAnalysisModal.tsx`
