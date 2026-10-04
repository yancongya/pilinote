---
关联文档:
  - ./nas.md
  - ./analysis.md
涉及文件:
  - agent-harness/pilinote_cli/cli.py
  - compose.production.yaml
  - Dockerfile.api
  - Dockerfile.web
  - deploy/entrypoint.py
  - apps/api/src/services/ai/term_base_service.py
  - apps/web/src/config/api.ts
  - apps/web/src/stores/newQueue.ts
  - apps/web/src/stores/queue.ts
  - apps/web/src/stores/download.ts
  - scripts/deploy_production.py
  - scripts/test_remote_delivery.py
  - skills/pilinote-cli/SKILL.md
依赖服务:
  - PiliNote API
  - Docker Compose
---

# 独立 CLI 与生产容器交付

此次升级在原 PiliNote 仓库内完成，myworkforce 仅编排改造和保存检查记录，项目运行不依赖它。升级前快照为 `b2c782b`。现有开发 Compose 和 NAS 同步脚本保留。

## CLI

Python 3.11+，安装 `uv tool install ./agent-harness`，或在虚拟环境内 `python -m pip install ./agent-harness`。详细命令见仓库 `agent-harness/README.md`。生产容器已安装 CLI。

```sh
pilinote --json --api-url http://127.0.0.1:8080 health
pilinote --json --api-url http://127.0.0.1:8080 tasks list
pilinote --json tasks cancel TASK_ID
```

最后一条默认仅预览，不访问 API；实际操作必须添加 `--apply`。第一版覆盖健康检查、格式、队列、任务和笔记读取/控制，任务创建通过 stdin JSON。CLI 是 Agent 控制面，账户、全部配置、媒体和 AI 功能不塞进 CLI；ASR、识图和模型调用由 Agents 通过稳定 CLI/API 编排。

## 生产容器

```sh
PILINOTE_RELEASE=local docker compose -f compose.production.yaml build
PILINOTE_RELEASE=local docker compose -f compose.production.yaml up -d --wait
```

前端 http://127.0.0.1:8080，经 Nginx 同源代理 API 和 WebSocket。默认只绑定本机，不另行暴露 API 端口。后端 UID 1000、前端 UID 101；前端根文件系统只读。服务不在启动时下载安装依赖，不使用开发服务器或 reload。

旧队列、旧下载和新队列的 WebSocket 入口统一使用 api.ts 地址配置；生产默认跟随页面主机、端口和 ws/wss 协议，显式运行配置仍优先。真实 NAS 浏览器验收发现并修复了绕过配置、写死 8000 端口的旧入口。镜像构建明确设置打包源码的读取/目录遍历权限，避免私有上传目录导致非 root 启动失败；运行数据仍保持私有权限。

首次启动前准备运行目录，保证 API UID 1000 对目录有写权限。`PILINOTE_RUNTIME_DIR` 是宿主机数据目录，默认 `./runtime`。原有运行目录应先做可恢复备份并停旧服务；确认 data/downloads/logs/temp 的完整对应关系，再挂载新容器。SQLite、下载、缓存、提示词覆盖和新截图存于运行目录，重建镜像不会主动清空它们。旧截图若在代码目录 static/screenshots，需由管理员迁入 runtime/static/screenshots。版本内置提示词模板保留在镜像；已有覆盖文件应放 runtime/data/ai_prompt_templates.json。

术语库运行目录为 `/runtime/term-bases`。容器启动入口从镜像内版本化 CSV 补齐缺失文件，已有用户修改不覆盖；实际新增术语及重启持久化有隔离容器验证。密钥、Cookie、数据库和个人覆盖配置不进入构建上下文。

NAS 独立部署和回滚见 [NAS 交付](./nas.md)。本机镜像为 arm64；NAS 构建和远程验收单独核验 amd64、发布标识、业务入口和持久化。凭据沿用已有 infra-ops/bwvault 记录；这里不保存密值。原开发 NAS 脚本仍启动开发 Compose，生产交付使用 scripts/deploy_production.py。

回滚使用已保留的旧镜像标签和配置；数据库若有后续迁移，应停服务并恢复与旧版本匹配的备份，不能仅换镜像。测试脚本只移除它自己创建的独立 Compose 项目与临时卷。

## 验收

```sh
bash scripts/smoke-refactor.sh --build
PILINOTE_CLI=/absolute/path/to/pilinote python -m unittest discover -s agent-harness/tests -v
apps/api/venv/bin/python -m pytest -p no:postgresql -p no:cacheprovider -o addopts= apps/api/tests/test_runtime_storage_delivery.py -q
python3 scripts/test_delivery_containers.py --release local --output pilinote-docs/docs-dev/delivery/container-acceptance.json
```

CLI 协议检查、真实隔离 API、容器健康、同源 API/WebSocket、容器 CLI、非 root 和 SQLite 重启持久化分别保存证据。检查使用新运行目录和独立卷，不使用现有账号及下载数据。实际 Bilibili 下载和 AI 推理/收费服务不属于交付链路冒烟，不能以健康检查替代这些业务验收。NAS 与浏览器验收另有报告。

独立部署入口 `scripts/deploy_production.py` 默认预览；远程验收入口 `scripts/test_remote_delivery.py` 默认只读，追加 `--restart` 验证重启持久化。两者只用 Python 标准库及 SSH/Docker，不导入主编排仓库。

项目 Skill 位于 `skills/pilinote-cli/SKILL.md`。全局发布时由 SkillDo 保存唯一来源并链接到各工具，不复制多份。此轮只在项目内生成与测试，不声称完成全局安装或发布。

PiliNote 的边界是 Agent 控制面：Agent 通过 CLI 读取任务、获取文件引用、执行 ASR/识图/模型推理，再写回结构化结果。PiliNote 不把这些重型 SDK 固化进核心程序；这样每个项目仍可独立运行，Agent 也可以替换模型和工具链。

Agent 能力边界见仓库 `agent-harness/README.md`：Agent 负责 ASR、识图、模型和工作流，PiliNote 负责任务、文件、状态和持久化结果。

本地阶段、NAS 部署和远程全链路各自记录实际证据，最终状态见 pipeline-status.json。旧的本地阶段报告只代表当时检查范围，不能替代最终全链路报告。
