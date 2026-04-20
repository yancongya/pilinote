# 字幕智能修正与术语管理功能设计

## 概述

在AI笔记页面添加字幕智能修正功能，支持：
- CSV文件存储术语库
- 术语自动替换
- AI检查错别字和语法

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
POST   /api/ai/subtitle/analyze        # AI分析字幕(错别字、语法)
POST   /api/ai/subtitle/apply-terms   # 应用术语替换
POST   /api/ai/subtitle/save-correction # 保存修正
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
你是一个字幕编辑助手。请分析以下字幕并指出问题：

字幕：
{字幕文本}

请以JSON格式返回分析结果：
{
  "typos": [{"text": "错字", "suggestion": "正字"}],
  "grammar": [{"text": "问题句", "suggestion": "修正建议"}],
  "issues": ["需要检查的问题"]
}
```

---

**状态**：设计完成，等待实现