# 字幕智能修正与术语管理功能设计

## 概述

在 AI 笔记页面添加字幕智能修正功能，支持：
- CSV文件存储术语库
- 术语自动替换
- AI 检查错别字和语法
- 读取目录内 NFO 作为视频背景上下文
- 对整份 SRT 分批分析，而不是只截取前 50 行

## 当前流程

1. 根据 `video_id` 找到视频目录。
2. 读取目录中的 NFO 文件，提取标题、UP 主 / 厂牌、时长、简介、标签和评论等信息。
3. 将 SRT 解析为稳定字幕块，保留序号、时间轴和正文。
4. 按批次将字幕块送入 LLM，批次之间保留少量重叠上下文。
5. 返回结构化修正建议，兼容 `text/suggestion` 与 `original_text/corrected_text` 两套字段。
6. 前端展示结果后由用户确认应用。
7. 保存时通过本地文件接口写回字幕，并自动生成版本快照。

## 术语库存储

### 目录结构

```
pilinote/
├── term-bases/              # 术语库目录
│   ├── tech.csv            # 技术术语
│   ├── product.csv         # 产品术语
│   └── custom.csv          # 自定义术语
```

### CSV格式

```csv
原术语,替换术语,备注
RAG,检索增强生成,技术术语
Graphify,知识图谱编译器,产品名
```

### 加载顺序

custom → product → tech（后者优先级更高）

## 数据模型

### 字幕修正记录

```python
class SubtitleCorrection(Base):
    id: str (UUID)
    video_id: str
    subtitle_index: int
    original_text: str
    corrected_text: str
    correction_type: str   # "typo", "grammar", "term", "manual"
    is_accepted: bool
    created_at: int
```

## API设计

### 术语库管理

```
GET    /api/ai/vocabulary              # 获取所有术语库
POST   /api/ai/vocabulary              # 添加/更新术语
DELETE /api/ai/vocabulary/:filename   # 删除术语文件
```

### 字幕修正

```
POST   /api/ai/subtitle/pipeline-analyze   # SSE 字幕分析，先读 NFO 再分批纠错
POST   /api/ai/subtitle/analyze            # 单次 AI 分析字幕(错别字、语法)
POST   /api/ai/subtitle/cancel/{task_id}   # 取消字幕分析任务
POST   /api/ai/subtitle/apply-terms   # 应用术语替换
POST   /api/local/file/{video_id}?file_type=subtitle # 写回字幕并生成版本快照
```

## 前端UI设计

### 字幕Tab新增功能

```
┌───────────────────────────────────┐
│ 字幕 [搜索] [AI分析] [术语替换]   │
├───────────────────────────────────┤
│ 00:00:00 → 00:00:03               │
│ 介绍一个改变AI编程助手的...     │
│ ⚠ 错别字: "助手的" → "助手的"    │
├───────────────────────────────────┤
│ 00:00:03 → 00:00:04               │
│ Graphify                          │
│ ✓ 已替换: Graphify → 知识图谱    │
└───────────────────────────────────┘
```

### 术语库设置入口

- 在字幕Tab或笔记Tab中添加"术语库"按钮
- 打开术语库设置弹窗

### 术语库设置弹窗

```
┌───────────────────────────────────┐
│ 术语库设置                  [×]    │
├───────────────────────────────────┤
│ [tech.csv] [product.csv] [custom] │
├───────────────────────────────────┤
│ 术语          │ 替换为    │ 备注   │
│ Graphify     │ 知识图谱 │ 产品名 │
│ RAG         │ 检索增强 │ 技术  │
├───────────────────────────────────┤
│ [+ 添加新术语到当前文件]          │
│ [+ 新建术语文件]                 │
└───────────────────────────────────┘
```

## 实现步骤

### 1. 创建术语库目录和文件
- 创建 `term-bases/` 目录
- 创建示例CSV文件

### 2. 后端 - 术语库服务
- 创建 `TermBaseService` 服务类
- 读取/解析CSV
- 术语替换逻辑

### 3. 后端 - 字幕修正服务
- 创建 `SubtitleCorrectionService`
- AI分析API（LLM调��）
- 保存修正记录

### 4. 后端 - API路由
- 注册新路由到 main.py

### 5. 前端 - 术语库UI
- 术语库设置按钮
- 弹窗组件

### 6. 前端 - 字幕Tab更新
- 添加AI分析按钮
- 添加术语替换按钮
- 显示修正状态
- 双击编辑

### 7. 数据库迁移
- 创建 SubtitleCorrection 表

## LLM Prompt - 字幕分析

```
你是一个字幕编辑助手。请结合视频背景信息分析字幕中的错别字、语法问题和术语错误。

视频背景信息：
- 标题：{title}
- 剧集/别名：{showtitle}
- UP主/厂牌：{studio}
- 时长：{runtime}
- 简介：{intro}
- 剧情/补充：{plot}
- 标签：{tags}
- NFO文本：{nfo_text}

字幕内容：
{字幕块}

请以 JSON 格式返回分析结果，格式如下：
{
  "issues": [
    {
      "index": 1,
      "type": "typo" | "grammar" | "term",
      "text": "原文字幕文本",
      "suggestion": "修正后的完整字幕文本",
      "original_text": "原文字幕文本",
      "corrected_text": "修正后的完整字幕文本",
      "reason": "为什么要修改",
      "confidence": 0.0
    }
  ],
  "summary": "一句话总结"
}
```

---

**状态**：设计完成，等待实现
