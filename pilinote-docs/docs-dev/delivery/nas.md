---
关联文档:
  - ./README.md
涉及文件:
  - scripts/deploy_production.py
  - scripts/test_remote_delivery.py
  - compose.production.yaml
依赖服务:
  - SSH
  - Docker Compose
---

# NAS 交付

目标 NAS `tycon@192.168.31.110`，标准服务根 `/vol1/1000/services/pilinote`，运行数据 `/vol1/1000/services/data/pilinote`，访问地址 http://192.168.31.110:8080 。原 `/vol1/1000/pilinote` 是历史归档，未替换或删除。

## 独立执行

```sh
python3 scripts/deploy_production.py --host tycon@192.168.31.110 --release RELEASE --output deployment.json
# 核对预览后实际部署
python3 scripts/deploy_production.py --host tycon@192.168.31.110 --release RELEASE --output deployment.json --apply
python3 scripts/test_remote_delivery.py --host tycon@192.168.31.110 --url http://192.168.31.110:8080 --release RELEASE --output remote-acceptance.json --restart
```

部署脚本上传白名单源码，不上传本地数据库、Cookie、模型、`.env` 或缓存；每个 release 使用独立目录、镜像标签和 `.release.json` 源文件清单。JSON 输出遵循 `project-deploy/v1`，记录 Git revision、源码摘要、工作区状态、计划/完成动作、数据保留声明和健康证据。Agent Ops 可以保存 dry-run/apply 输出作为项目适配器契约。

执行前要求 Git 工作区干净。构建前会核对旧 release 的 runtime/bind/port 配置与本次配置一致，并确认旧镜像仍在；数据目录必须与源码/release 目录分离。镜像带有源码清单摘要标签。native/legacy 不允许重复使用已存在的 release 镜像标签；prebuilt 只接受源码摘要标签匹配的两张镜像。构建结束后先原子切换 `current`，再等待 Compose 健康，并检查 API release identity、格式、队列、任务、前端页面和 API 代理。若切换后任一检查失败，脚本自动把 `current` 指回旧 release 并用旧镜像恢复；恢复结果写入 JSON。旧 release 与镜像不会自动清理。运行数据持续使用同一目录，release 中的 `.env` 只保存发布标签、数据路径和绑定端口这些非秘密配置；秘密不写入这个文件。

`--resume` 只允许续传内容、配置和发布清单都相同的 release；已存在镜像标签时拒绝覆写，需使用新 release ID。部署预览本身不会连接远端。项目适配器仍需先经过 Agent Ops 能力门控，以上本地契约测试不等于 NAS 实际部署验收。

本轮 NAS 的镜像加速源曾返回 502，采用本机拉取 amd64 基础镜像后通过 SSH 送入 NAS，再使用 `--build-mode legacy` 在 NAS 构建。未修改 NAS 全局 Docker 配置。此模式不自动拉取新的基础镜像，更新前应明确刷新所用基础镜像。

NAS 首次保存网页依赖层非常慢，历史上曾在本机构建 `linux/amd64` 镜像后通过 `docker image save | docker load` 传入。当前 `--build-mode prebuilt` 除了检查 NAS 架构，还要求 API/Web 镜像的源码摘要标签与此次白名单源码清单一致；历史上没有该标签的镜像不能用于新预构建 release。

## 数据迁入

2026-10-04 从本地当前 SQLite 使用 backup API 制作一致性副本，保留用户、Cookie、任务和调度器。只在新副本中将 storage.download_path/temp_path 映射到容器 `/runtime/downloads` 和 `/runtime/temp`，不改本地原数据库。AI 运行配置和提示词覆盖以私有方式迁入，不进源码包或文档。

历史 NAS 下载复制到新 downloads，原归档保留。新目录按容器 UID 1000 准备权限；运行目录的嵌套 .gitignore 排除全部内容，避免进入 infra-data 自动提交。迁入前数据库备份在服务根 backups/workforce-20261004-1/pilinote.db；备份及运行数据含私人登录态，不用于发布。

历史任务可能记录旧绝对路径，本轮仅迁移存储根配置和现有下载文件，不批量重写历史任务正文。远程检查证明数据库计数、CLI/API 读取、健康、WebSocket 和重启持久化；不等于每条历史媒体路径或过期 Bilibili 登录态均可使用。自动下载当前关闭，历史任务均为已完成。

## 回滚

本轮为 NAS 首次上线 PiliNote，上线前没有旧运行容器。`workforce-20261004-1` 是失败构建目录，未上线，不是完整回滚版本；`workforce-20261004-2` 启动因源码目录权限失败，同样不是可用回滚版本。`workforce-20261004-3` 的 API 验收通过，但浏览器发现旧队列 WebSocket 端口问题。`workforce-20261004-4` 的浏览器验收通过；最终包含 CLI 控制面修复的版本是 `workforce-20261004-5`。如需恢复到上线前无服务状态，可在 current 目录按相同环境运行 `docker compose -p pilinote -f compose.production.yaml down`，保留所有运行数据和历史归档；不要带 --volumes 或删除运行目录。

后续升级保留之前镜像标签和 releases；`current` 指向正在运行的 release，Agent Ops 通过只读 release inventory 发现历史回滚候选。自动失败恢复会使用切换前的 current 与镜像。独立手动回滚须先经 Agent Ops 重新盘点 current、历史镜像、runtime mount 和业务健康，再使用同一 runtime 路径执行；不要依赖旧版 `previous-release.txt` 文件。若未来引入不兼容数据库迁移，须恢复与旧版本匹配的备份，不能只换镜像。

## 验收证据

- nas-deployment.json：本轮构建输入摘要、release、服务根与数据根。
- nas-data-migration.json：迁入范围与原件保留情况。
- remote-acceptance.json：真实 NAS HTTP、SSH、CLI、镜像架构和持久化。
- full-chain-acceptance.json：最终重跑结果和明确未测业务。
- pipeline-status.json：十一阶段总控状态。
