# PiliNote CLI

独立 Python 命令，业务继续由现有 PiliNote API 负责，不依赖 myworkforce 或全局 Skills。CLI 是 Agent 的控制面，不是 ASR、视觉识别或模型运行时；重型能力由 Agent 选择工具和模型后调用 API。

安装：`uv tool install ./agent-harness`，或在虚拟环境中 `python -m pip install ./agent-harness`。Python 3.11+，CLI 本身只用标准库。API 服务是必要业务后端。

```sh
pilinote --json --api-url http://127.0.0.1:8000 health
pilinote --json formats
pilinote --json tasks list
pilinote --json tasks get TASK_ID
pilinote --json queue-status
pilinote --json capabilities
pilinote --json api get /api/favorites/folders
# 任意已授权 API 写操作默认预览，执行必须显式 --apply
pilinote --json api post /api/history/list --input - < payload.json
pilinote --json api post /api/history/list --input - --apply < payload.json
pilinote --json notes status NOTE_ID
pilinote --json notes get NOTE_ID
pilinote --json tasks cancel TASK_ID
# 上一条只预览；实际执行需显式 --apply
pilinote --json tasks cancel TASK_ID --apply
# 创建任务：JSON 走 stdin，不把 Cookie/Token 放 argv
pilinote --json tasks create --input - < task.json
pilinote --json tasks create --input - --apply < task.json
```

任务支持 pause/cancel/retry/delete，笔记支持 pause/resume/cancel，写命令均默认预览。任务创建遵循原 API TaskCreate 输入，最少提供 media_id/media_type，其他业务参数由 API 验证。

任务创建和任务控制使用同一个 `/api/queue/tasks` 入口，保证创建后可以继续读取、暂停、取消、重试和删除。`all`、`batch` 是后端保留路由名，CLI 会拒绝它们作为单任务 ID，避免误触发批量操作。

`PILINOTE_API_URL` 指定 API origin，默认 http://127.0.0.1:8000。生产同源 Web 地址也可作为 origin。需要服务令牌时由已授权环境提供 `PILINOTE_API_TOKEN`，不写到命令参数或文档。CLI 不导出后端 cookies/密码配置；敏感字段和已知签名参数过滤，错误不回显原始响应。输出不是所有未知正文中秘密的通用防泄漏保证。

退出码：0 成功/预览，1 网络/HTTP/业务/输入失败，2 参数用法错误。JSON 字段 schema/success/dryRun/data，预览仅显示 method/path。拒绝 URL 内嵌凭据、重定向、超大响应和路径 ID 注入。

测试：安装后设置 `PILINOTE_CLI=/absolute/path/to/pilinote`，运行 `python -m unittest discover -s agent-harness/tests -v`；再运行 `python3 scripts/test_cli_lifecycle.py --cli "$PILINOTE_CLI" --output pilinote-docs/docs-dev/delivery/cli-lifecycle-acceptance.json`，验证真实隔离 FastAPI 上的创建、读取、状态保护、删除和清理。协议测试使用临时 HTTP 服务；真实 API 与容器检查见项目 delivery 验收记录。`capabilities` 与受限 `api` 适配层覆盖认证、收藏、稍后再看、历史、视频、媒体、下载、队列、订阅、自动下载、媒体库、笔记、AI/ASR、设置、缓存和指标等 API 域。

## Agent 能力边界

Agent 通过 CLI 负责意图理解、工作流编排、ASR、字幕分段、图片/封面识别、模型选择和结果解释。PiliNote API 负责认证态、任务记录、媒体文件、队列状态和可恢复结果。Agent 不直接读生产 SQLite、Cookie 或下载目录；需要处理媒体时先通过 CLI 获取已授权任务/文件引用，再把结构化结果写回对应任务或笔记。

推荐的 Agent 调用链是：`tasks get` → Agent 执行 ASR/视觉工具 → 写入结果 → `tasks get`/`queue-status` 验证状态。真实 AI provider 和外部 ASR/视觉服务由调用方凭据与运行环境决定，PiliNote 不把这些 SDK 打进核心 CLI。
