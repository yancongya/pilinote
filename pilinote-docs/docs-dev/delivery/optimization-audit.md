# PiliNote 交付层精简审计

审计日期：2026-10-07。范围为仓库内 CLI、Docker、部署/验收脚本、交付说明以及 SkillDo/ponytail 接入。本文依据当前文件和本机 SkillDo 登记状态整理；NAS 未在本次操作中部署或重启。

## 结论

PiliNote 的交付架构已经有清晰边界：项目自己维护 CLI、容器和部署脚本；myworkforce 负责跨阶段编排；SkillDo 负责全局 Skill 唯一副本及软连接同步。CLI 是 API 的薄控制面，Docker 负责运行时，脚本分别负责部署和隔离验收。没有证据支持为这些职责再新建公共包或仓库。

本轮发现并修正文档漂移：2026-10-04 的初始分析曾把完整 API 和若干域记为不在 CLI 覆盖范围；现在 `capabilities` 与受限 `api` 入口可以访问白名单 API。历史文件保留其当时语境并标明快照属性。验收 JSON 是运行证据，应保留，不用新的“汇总报告”覆盖历史结果。

## 分域审计

| 范围 | 当前实现 | 精简判断 / 处理 |
|---|---|---|
| CLI | `agent-harness/` 使用 Python 标准库；专用命令处理健康、队列、任务、笔记，受限 API 入口覆盖白名单中的其他路由；JSON 输出和写操作 `--apply` 保护 | 保持薄 HTTP 适配。不要再复制业务逻辑或增加全局依赖。能力目录是发现信息，不是全路由端到端验收声明 |
| Skill 文档 | `skills/pilinote-cli/SKILL.md` 跟随项目仓库；SkillDo 中心副本位于 `~/.skillshub/pilinote-cli`，工具端软连接 | 两种副本角色不同：项目源保障项目可独立交付，SkillDo 中央副本保障全局唯一管理。修改后通过 SkillDo 同步；禁止在工具目录另建可编辑拷贝 |
| Docker | 两个生产镜像分别构建 API 与 Web；Compose 只暴露 Web，同源代理 API；API 运行数据挂载 runtime，Web 只读根文件系统，容器使用非 root 用户 | 分开镜像符合运行边界。当前不存在可以安全删除的镜像层或 Compose 服务；运行数据挂载必须保持独立，不能为了少配置合并进源码层 |
| 部署 | `scripts/deploy_production.py` 默认 dry-run；`--apply` 才传输不可变 release、构建并切换服务；`--resume` 校验源码与配置清单；`current` 指向当前 release，历史版本由 Agent Ops inventory 发现 | 维持显式 apply 与逐版本目录。不要把生产流程与开发用 NAS 文件同步脚本合并，二者风险和用途不同 |
| 本地容器验收 | `scripts/test_delivery_containers.py` 生成随机 Compose 项目，使用新命名卷并绑定临时回环端口；结束只清理该项目卷 | 保留真实容器层检查。该脚本会创建/删除隔离卷；必须继续确保 project 名随机且绝不挂载已有 runtime |
| 远程验收 | `scripts/test_remote_delivery.py` 默认通过 SSH 只读检查 API、SQLite integrity、队列、容器和版本；`--restart` 才重启 API 并检查计数持久 | 保留默认只读。NAS 生产数据检查使用 SQLite `mode=ro`；不要把 `--restart` 加入默认流水线 |
| CLI 生命周期验收 | `scripts/test_cli_lifecycle.py` 启动本地隔离 FastAPI 和临时 SQLite，验证创建、读取、保护条件、删除及清理 | 保留端到端 API 验证。该用例的 `--apply` 仅对临时数据库使用；失败路径的进程与数据清理需继续保持 |
| 文档/报告 | `delivery/` 同时保存说明、历史分析和 JSON 验收证据；部分内容按阶段重复记录 | 说明文件应链接到权威总览，阶段 JSON 保持不可覆盖的证据属性。旧分析已加历史标识；不批量删除旧报告，避免失去发布依据 |
| Ponytail / myworkforce | `ponytail` 是 SkillDo 管理的通用代码瘦身 Skill；myworkforce 是编排器 | Ponytail 是审查准则，不是 PiliNote 运行依赖，也不应该因为追求少行数删安全约束。项目仍是独立仓库 |

## 已核对的安全边界

- 部署默认不执行；目标服务目录和数据目录都要求显式绝对路径，拒绝服务/共享数据父目录作为目标。
- 生产 runtime 与不可变 release 分开；镜像切换不会主动清空 SQLite、下载、日志、临时文件或用户覆盖配置。
- CLI 拒绝不安全 URL/路径 ID、默认隐藏敏感字段、写操作先预览；生产 API 鉴权仍由服务部署策略负责。
- 本地容器测试不挂载 NAS 或开发运行目录；远程 SQLite 读取以只读 URI 打开。
- SkillDo 实际登记状态已核对：`ponytail` 和 `pilinote-cli` 均为 `ok`，中央副本均有 Codex `symlink` 目标。

## 可延后事项

1. 为 CLI 白名单按读/写、是否需要登录态以及预期副作用生成可审阅的接口矩阵。生成来源应是当前路由注册与 CLI allowlist，不能手工维护第二份过期列表。
2. 交付 JSON 可在将来增加索引文件来链接 release、时间、脚本和覆盖范围；当前无需迁移或重命名现存报告。
3. 如果部署逻辑以后增加第二种目标主机，先看是否确有重复且契约一致，再考虑抽公共模块；目前仅有一个生产部署实现，抽象没有实益。

本轮未修改 NAS、数据库、凭据、容器配置或业务代码，也未声称真实下载、AI 计费或完整账户流程已经验收。

## 2026-10-09 部署适配器契约补强

项目部署脚本现输出 `project-deploy/v1` JSON，新增工作区干净检查、不可变源码清单、Docker 源码摘要标签、独立 runtime 路径检查、Compose/API/业务代理健康验收和失败后自动恢复。`current` 只指向当前 release；历史候选由 Agent Ops 的只读 inventory 发现，不再依赖 `previous-release.txt`。NAS 执行与回滚仍未在本轮验证；适配器测试和本地假 Docker 恢复演练不能代替生产运行验收。
