# AiNoteService AI 分析服务

## 概述

核心 AI 笔记分析服务，串联视频转写 → LLM 生成 → 结果存储。

## 文件位置

`apps/api/src/services/ai/note_service.py`

## 渐进整理后的职责边界

- `note_pipeline.py`：模式、阶段键和阶段索引纯规则。阶段索引保留跨模式遍历首个匹配的原语义。
- `note_context.py`：笔记格式过滤、timecode 需求、字幕语言判断、语言策略与系列记忆/用户补充文本拼装。
- `note_outputs.py`：独立文件 IO 模块，负责 Markdown、索引和系列记忆的路径及读写；显式接收路径和元数据，不依赖设置、数据库或 ASR 服务。
- `note_service.py`：保留原私有委托入口、路径覆盖接口、上下文文件读取、数据库事务、主流水线、worker、ASR/LLM 调用和截图输出。
- 语言识别仍最多采样 20,000 字符；少于 50 个中英文字母判为 unknown，中文或英文比例达到 75% 时判为对应语言。
- `test_note_context.py` 验纯转换；`test_note_service_boundaries.py` 通过 AST 核验委托与参数结构，不是服务初始化或运行时集成测试。
- `test_note_outputs.py` 通过 importlib 独立加载输出模块，在临时目录验证文件往返、坏 JSON、索引覆盖、系列路径、记忆拼接和截断；不导入会初始化 ASR 的服务包。索引更新覆盖旧字段，系列记忆仍追加而不去重。
- 不将这些提取描述为完整 AI 服务解耦；真实模型、暂停/恢复/取消和产物持久化仍需独立验收。

## 主要方法

### analyze_video()

```python
def analyze_video(
    self,
    video_id: str,
    style: str = "detailed",
    formats: Optional[List[str]] = None,
    model_provider: str = "openai",
    model_name: str = "gpt-4o-mini",
    extras: Optional[str] = None
) -> AiNote
```

**流程**:
1. 获取视频信息（从 downloads 表）
2. 检查文件存在性
3. 创建 AiNote 记录（pending）
4. 转写视频 → 获取 transcript
5. 调用 LLM 生成 Markdown
6. 提取 AI 总结
7. 保存结果并更新状态

### get_note()

获取笔记详情

### get_note_by_video()

根据视频 ID 获取笔记

### update_status()

更新笔记状态

## 状态流转

```
pending → processing → completed
                    ↘ failed
```

## 关联模块

- `transcriber.py` - 视频转写
- `prompts/` - Prompt 构建
- `llm/` - LLM 客户端
