---
name: pilinote-cli
description: 使用 PiliNote 原生 CLI 作为 Agent 控制面检查服务、任务和笔记状态，预览或执行任务及笔记控制。适用于已运行的 PiliNote API；ASR、识图和模型推理由 Agent 自己完成。
---

# PiliNote CLI

在目标项目安装 `uv tool install ./agent-harness`，或虚拟环境 `python -m pip install ./agent-harness`。命令 `pilinote` 必须已安装且 API 服务已运行；无需 myworkforce 或全局能力仓库。

1. 先运行 `pilinote --json --api-url ORIGIN health`，要求 success=true 且 data.status=healthy；生产返回 release 标识。
2. 下载任务用 `tasks list` / `tasks get TASK_ID`，统一队列用 `queue-status`。笔记用 `notes status NOTE_ID` / `notes get NOTE_ID`。
3. 控制任务用 `tasks pause|cancel|retry|delete TASK_ID`，笔记用 `notes pause|resume|cancel NOTE_ID`。默认预览不发请求。用户明确授权实际改变后追加 `--apply`。
4. 创建任务用 `tasks create --input -`，stdin JSON 至少含 media_id、media_type；先预览，实际提交再 --apply。不要把 Cookie 或 Token 放命令行。
5. 核对退出码、success 和业务字段；预览 dryRun=true 不等于实际操作完成。失败不要从未知正文泄露凭据，不自动重试删除或创建，先核对实际状态。CLI 是控制面，不在 CLI 内实现 ASR、识图或模型 SDK。

全局 --json/--api-url/--timeout 放在子命令之前。可用 PILINOTE_API_URL 指定服务 origin；令牌仅由授权环境或 bwvault 提供。复用服务既有登录态，不要求重新登录，不访问生产数据库文件。HTTP 入口是否对外有鉴权取决于服务部署，CLI 不是服务器访问控制层。

代表性只读任务：检查健康和 release；列出任务并检查返回数量/状态；读取给定笔记状态；预览取消操作并确认 dryRun=true。格式选项用 `pilinote --json formats`（兼容 API，非新功能覆盖）。

当前 CLI 不覆盖完整账户/配置管理、真实 AI 生成及所有下载业务。Agent 应通过 CLI 获取任务/文件引用，再在自己的工具链执行 ASR、识图或模型推理，并把结构化结果写回 PiliNote。无授权不连接未知服务，不启动下载、AI 计费或删除现有数据。生成 Skill 的全局安装仅交 SkillDo，不复制到各工具目录。
