# VideoClassifier 视频分类器

## 概述

基于视频标题、标签、描述自动分类并推荐笔记风格。

## 文件位置

`apps/api/src/services/ai/video_classifier.py`

## 分类规则

| 视频类型 | 关键词 | 推荐风格 |
|----------|--------|----------|
| 教程类 | 教程、教学、怎么、如何、学习、入门 | tutorial |
| 学术类 | 研究、分析、原理、科学、理论 | academic |
| 生活类 | 生活、日常、分享、感悟、日记 | life_journal |
| 小红书类 | 好物、推荐、宝藏、神器 | xiaohongshu |
| 商业类 | 商业、营销、变现、赚钱、创业 | business |
| 任务类 | 任务、待办、计划、目标 | task_oriented |
| 会议类 | 会议、纪要、总结会、周会 | meeting_minutes |

## 使用方式

```python
from src.services.ai.video_classifier import VideoClassifier

result = VideoClassifier.classify(
    title="Python 入门教程",
    tags="Python,教程,编程",
    description=""
)

# 返回
{
    "category": "tutorial",
    "confidence": 0.8,
    "recommended_style": "tutorial",
    "reason": "检测到关键词: tutorial"
}
```

## API 接口

### GET /api/note/recommend-style

```bash
GET /api/note/recommend-style?title=视频标题&tags=标签&description=描述
```

**响应**:
```json
{
  "success": true,
  "category": "tutorial",
  "confidence": 0.8,
  "recommended_style": "tutorial",
  "reason": "检测到关键词: tutorial"
}
```