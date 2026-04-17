# Phase 1: 基础设施 - 执行计划

## 目标
完成数据模型、LLM 客户端抽象、Prompt 管理器

## Wave 1: 数据模型

### 01-01: 创建 ai_notes 数据模型

**任务 ID**: 01-01
**描述**: 创建 AI 笔记数据模型（SQLAlchemy）
**依赖**: 无

#### 原子任务

**01-01-T01**: 创建 AI 笔记基础模型类
- 文件: `apps/api/src/models/ai_note.py`
- 内容:
  - 创建 `AiNote` 模型类，`__tablename__ = "ai_notes"`
  - 字段: `id` (String, PK), `task_id` (String, FK), `video_id` (String)
  - 字段: `content` (Text, 笔记内容), `style` (String, 笔记风格)
  - 字段: `formats` (JSON, 输出格式), `status` (Enum)
  - 字段: `model_provider` (String, LLM 提供商), `model_name` (String, 模型名)
  - 字段: `meta` (JSON, 元数据), `error` (Text, 错误信息)
  - 字段: `created_at`, `updated_at` (时间戳)

**01-01-T02**: 注册模型到 `__init__.py`
- 文件: `apps/api/src/models/__init__.py`
- 内容: 导入并导出 `AiNote` 模型

**01-01-T03**: 创建 Pydantic Schema
- 文件: `apps/api/src/schemas/ai_note.py`
- 内容:
  - `AiNoteCreate` (请求模型)
  - `AiNoteResponse` (响应模型)
  - `AiNoteUpdate` (更新模型)

---

### 01-02: 扩展 downloads 表添加 AI 相关字段

**任务 ID**: 01-02
**描述**: 扩展现有 downloads 表，添加 AI 笔记相关字段
**依赖**: 01-01

#### 原子任务

**01-02-T01**: 修改 Download 模型添加 AI 字段
- 文件: `apps/api/src/models/download.py`
- 内容: 在 `Download` 模型中添加:
  - `ai_note_id` (String, 关联 AI 笔记)
  - `ai_summary` (Text, AI 摘要)
  - `ai_markdown` (Text, 完整 Markdown)
  - `ai_style` (String, 使用的风格)
  - `ai_status` (String, pending/processing/completed/failed)
  - `ai_error` (Text, 错误信息)
  - `transcript` (Text, 字幕转写文本)
  - `transcript_lang` (String, 转写语言)

**01-02-T02**: 更新 Download Pydantic Schema
- 文件: 现有 schema 文件（如 `src/schemas/download.py`）
- 内容: 添加 AI 相关字段的序列化

**01-02-T03**: 创建数据库迁移
- 文件: `apps/api/migrations/xxx_add_ai_fields.py`
- 内容: 使用 ALTER TABLE 添加新字段

---

## Wave 2: LLM 客户端抽象

### 01-03: 创建 LLM 客户端抽象层

**任务 ID**: 01-03
**描述**: 创建 LLM 客户端抽象层（支持 OpenAI/Claude/DeepSeek）
**依赖**: 无

#### 原子任务

**01-03-T01**: 定义 LLM 提供商枚举和接口
- 文件: `apps/api/src/llm/providers.py`
- 内容:
  - `LLMProvider` 枚举: OPENAI, CLAUDE, DEEPSEEK, QWEN, CUSTOM
  - `LLMMessage` 数据类: role, content
  - `LLMResponse` 数据类: content, model, usage, finish_reason
  - `BaseLLMClient` 抽象基类

**01-03-T02**: 实现 OpenAI 客户端
- 文件: `apps/api/src/llm/openai_client.py`
- 内容:
  - `OpenAIClient` 类，继承 `BaseLLMClient`
  - 支持 `openai` 包，兼容 OpenAI API 格式
  - `chat()` 方法流式/非流式响应

**01-03-T03**: 实现 Claude 客户端
- 文件: `apps/api/src/llm/claude_client.py`
- 内容:
  - `ClaudeClient` 类，继承 `BaseLLMClient`
  - 使用 Anthropic API 格式
  - 配置 `ANTHROPIC_API_KEY` 环境变量

**01-03-T04**: 实现 DeepSeek 客户端
- 文件: `apps/api/src/llm/deepseek_client.py`
- 内容:
  - `DeepSeekClient` 类，继承 `BaseLLMClient`
  - 使用 DeepSeek API，base_url 指向 deepseek.com

**01-03-T05**: 实现 LLM 客户��工厂
- 文件: `apps/api/src/llm/factory.py`
- 内容:
  - `LLMClientFactory` 工厂类
  - `create_client(provider: LLMProvider, api_key: str, **kwargs)` 静态方法
  - 支持配置自定义 base_url

**01-03-T06**: 创建 `__init__.py` 统一导出
- 文件: `apps/api/src/llm/__init__.py`
- 内容: 导出所有客户端和工厂

---

## Wave 3: Prompt 管理器

### 01-04: 实现 Prompt 管理器

**任务 ID**: 01-04
**描述**: 实现 Prompt 管理器（9 种风格模板）
**依赖**: 01-03

#### 原子任务

**01-04-T01**: 定义 Prompt 风格常量
- 文件: `apps/api/src/llm/prompts/constants.py`
- 内容:
  - `NOTE_STYLES` 常量列表（9 种风格）
  - `NOTE_FORMATS` 输出格式常量
  - 风格定义: minimal, detailed, academic, tutorial, xiaohongshu, life_journal, task_oriented, business, meeting_minutes

**01-04-T02**: 实现格式模板函数
- 文件: `apps/api/src/llm/prompts/formats.py`
- 内容:
  - `get_toc_format()` - 目录格式
  - `get_link_format()` - 原片跳转时间戳
  - `get_screenshot_format()` - 截图标注
  - `get_summary_format()` - AI 总结

**01-04-T03**: 实现风格模板函数
- 文件: `apps/api/src/llm/prompts/styles.py`
- 内容:
  - 9 个风格处理函数，对应 prompt_builder.py 中的风格定义
  - 包含小红书风格的爆款关键词和二极管标题法

**01-04-T04**: 实现 Prompt 构建器
- 文件: `apps/api/src/llm/prompts/builder.py`
- 内容:
  - `PromptBuilder` 类
  - `build(video_title, segment_text, tags, formats, style, extras)` 方法
  - 组合基础 prompt + 格式 + 风格

**01-04-T05**: 定义系统基础 Prompt
- 文件: `apps/api/src/llm/prompts/base.py`
- 内容:
  - `BASE_PROMPT` 模板
  - 指导 LLM 生成笔记的系统提示词

**01-04-T06**: 创建 `__init__.py` 统一导出
- 文件: `apps/api/src/llm/prompts/__init__.py`
- 内容: 导出所有 Prompt 相关模块

---

## 任务依赖图

```
Wave 1: 数据模型
├── 01-01: ai_notes 数据模型（新建表）
│   ├── 01-01-T01: 创建 AiNote 模型类
│   ├── 01-01-T02: 注册到 __init__.py
│   └── 01-01-T03: 创建 Pydantic Schema
│
└── 01-02: 扩展 downloads 表（依赖 01-01）
    ├── 01-02-T01: 修改 Download 模型
    ├── 01-02-T02: 更新 Download Schema
    └── 01-02-T03: 数据库迁移

Wave 2: LLM 客户端抽象
└── 01-03: LLM 客户端抽象层
    ├── 01-03-T01: 定义接口和枚举
    ├── 01-03-T02: OpenAI 客户端
    ├── 01-03-T03: Claude 客户端
    ├── 01-03-T04: DeepSeek 客户端
    ├── 01-03-T05: 工厂模式
    └── 01-03-T06: __init__.py

Wave 3: Prompt 管理器 (依赖 01-03)
└── 01-04: Prompt 管理器
    ├── 01-04-T01: 风格常量
    ├── 01-04-T02: 格式模板
    ├── 01-04-T03: 风格模板
    ├── 01-04-T04: Prompt 构建器
    ├── 01-04-T05: 基础 Prompt
    └── 01-04-T06: __init__.py
```

## 执行顺序

1. **Wave 1** (数据模型)
   - 先执行 01-01（新建 ai_notes 表）
   - 再执行 01-02（扩展 downloads 表）
2. **Wave 2** (LLM 客户端) - 独立于 Wave 1，可并行执行
3. **Wave 3** (Prompt 管理器) - 依赖 Wave 2 的接口定义