# AI 配置（OpenAI-compatible + DeepSeek 已验证）

这一节的目标是：用“兼容 OpenAI API 规范”的方式描述配置，让你不被某一家绑死，同时给出 DeepSeek 的实测写法。

## 关键概念

- Provider：模型提供方（OpenAI / DeepSeek / 其它兼容实现）
- Endpoint：API 地址
- API Key：鉴权
- Model：具体模型名
- Prompt：提示词模板（决定输出结构与质量）

## 推荐策略（先稳定再高级）

1. 先用默认模板跑通一条链路
2. 再逐步调整 prompt（章节/问题/结论/行动项）
3. 最后再考虑“更复杂的上下文拼装/多轮分析”

## DeepSeek（示例）

只要你的实现支持 OpenAI-compatible，一般需要配置：

- `base_url`：DeepSeek 的兼容接口地址
- `api_key`
- `model`

注意：

- 成本：长视频/评论很容易把 token 打爆，建议先做抽样或限制输入
- 隐私：如果你对隐私敏感，避免把评论区/全文字幕上传到第三方

## Prompt 建议（实用向）

建议把输出拆成稳定结构，便于后续“回跳/检索/复盘”：

- 章节（含时间戳）
- 每章关键点（bullet）
- 问题与结论（Q/A）
- 复习卡片（短句）

