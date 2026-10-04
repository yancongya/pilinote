# 只读安全验收启动器

## 用途

`apps/api/scripts/run_readonly_acceptance.py` 为已授权的本机安全验收提供隔离启动入口。它只监听 `127.0.0.1`，默认端口为 `8000`，并通过 `readonly_acceptance:create_app` 工厂启动安全应用。

启动器不会直接使用原数据库。每次运行都会创建名称以 `pilinote-readonly-` 开头、权限为 `700` 的临时运行目录，通过 SQLite 只读连接和 backup API 生成权限为 `600` 的数据库快照。服务退出或启动失败后，临时目录和其中可能包含凭据的快照会自动删除。

快照转为只读前会执行安全净化：递归清空 settings JSON 中名为 `api_key`、`password`、`token`、`secret`、`access_token`、`refresh_token` 的字段，强制覆盖或补充 `storage.download_path` 和 `storage.temp_path` 为临时目录，并将存在的 `downloads.file_path` 全部置空。`users` 和 `cookies` 登录数据保留用于授权验收。

## 隔离边界

- `DATABASE_URL` 指向临时快照，并强制使用 SQLite `mode=ro` URI。
- 日志、下载和临时文件目录全部位于临时运行目录。
- 设置 `PILINOTE_ACCEPTANCE_MODE=1`，由安全应用工厂验证并限制验收能力。
- 若原 `ai_runtime_state.json` 存在，仅复制该状态文件。
- 从数据库快照中选取一条已有、已完成的 AI 笔记，在临时下载目录建立临时展示副本，使 AI 笔记界面可读取；目录随服务退出删除。
- 快照内设置中的密码和令牌字段清空，下载/临时路径改指临时目录，下载任务的文件路径清空。
- 不复制 ASR registry，避免恢复或续传模型任务。
- 不输出数据库内容、Cookie、令牌或其他秘密。
- 启动前后核验源数据库、WAL、SHM、ASR registry 和 AI runtime state 的 SHA-256；任何变化都会明确报错，且不会尝试回写恢复。
- 不提供外部监听地址，也不触发真实下载、AI 生成或联网验收。

## 使用

从仓库根目录运行：

```bash
apps/api/venv/bin/python apps/api/scripts/run_readonly_acceptance.py
```

指定本机端口：

```bash
apps/api/venv/bin/python apps/api/scripts/run_readonly_acceptance.py --port 8123
```

停止进程后，确认临时运行目录已被自动清理。安全应用工厂还应拒绝运行目录名称不匹配、位于仓库内部、当前目录与运行目录不一致、数据库 URI 非只读或快照不存在的启动环境。

## 自动测试

测试只通过 `importlib` 加载启动器，并用假的 `uvicorn` 调用验证参数、目录权限、递归脱敏、路径隔离、登录数据保留、源文件不变、ASR registry 排除和异常退出清理；不会启动真实服务，也不会联网。

```bash
apps/api/venv/bin/python -m pytest tests/test_readonly_acceptance_launcher.py
```

## 实测记录（2026-10-04）

- 隔离启动器监听回环地址；健康接口确认只读快照、后台任务关闭。登录状态接口确认现有账号有效；收藏夹、历史、播放映射、笔记记录、本地运行态和设置读取接口均有响应，API key/密码/令牌字段已在快照内清空。
- 本机浏览器在桌面 1440×1000 和移动 390×844 打开 AI 笔记页；由临时快照副本展示一条既有已完成笔记，移动视口 document/body 宽均为 390px，无横向溢出。测试只读笔记，没有编辑或触发重新生成。
- B 站视频详情请求返回 HTTP 412，历史记录中的五条视频详情也均未取得可用数据；因此本轮没有验收真实详情和分 P 信息。该结果是上游反爬响应，不是本地接口的成功内容。
- 写本地文件、AI 分析、视频库刷新和设置修改请求均收到 403；WebSocket 关闭码为 1008。浏览器会尝试队列 WebSocket 与读取版本目录，安全门拒绝这两类请求，因而控制台出现预期的拒绝错误。
- 收尾时原数据库、ASR registry、AI runtime state 三份 SHA-256 与启动前一致；暂存区二进制快照也一致。服务退出后临时目录自动清理。
- 实际回归命令：`apps/api/venv/bin/python -m pytest -o addopts= -q apps/api/tests/test_readonly_acceptance.py tests/test_readonly_acceptance_launcher.py`，15 项通过。未触发下载、模型生成、播放媒体或部署。
