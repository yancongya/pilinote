# LLM 客户端

## 概述

支持多提供商的 LLM 客户端抽象层。

## 支持的提供商

| 提供商 | 模型示例 | 环境变量 |
|--------|----------|----------|
| OpenAI | gpt-4o-mini, gpt-4o | OPENAI_API_KEY |
| Claude | claude-3-haiku | ANTHROPIC_API_KEY |
| DeepSeek | deepseek-chat | DEEPSEEK_API_KEY |

## 架构

```
LLMClientFactory
    ├── BaseLLMClient (抽象基类)
    ├── OpenAIClient
    ├── ClaudeClient
    └── DeepSeekClient
```

## 使用方式

```python
from src.llm import LLMProvider, LLMClientFactory, LLMMessage

# 创建客户端
client = LLMClientFactory.create_client(
    provider=LLMProvider.OPENAI,
    api_key="your-api-key"
)

# 发送消息
messages = [
    LLMMessage(role="system", content="你是一个助手"),
    LLMMessage(role="user", content="你好")
]

response = client.chat(messages)
print(response.content)
```

## 文件结构

| 文件 | 说明 |
|------|------|
| `providers.py` | 枚举和抽象基类 |
| `openai_client.py` | OpenAI 实现 |
| `claude_client.py` | Claude 实现 |
| `deepseek_client.py` | DeepSeek 实现 |
| `factory.py` | 工厂类 |
| `__init__.py` | 统一导出 |