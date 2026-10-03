# 首轮整理结果

## 已完成阶段

| 阶段 | 提交 | 结果 |
| --- | --- | --- |
| 计划 | `5cafeb1` | 明确模型、文件隔离和验收方式 |
| 基线 | `0efdaa0` | 记录真实模块布局、测试配置和用户迁移风险 |
| 前端试点 | `367c2ac` | 队列归一化提取至 `newQueueNormalization.ts`，store 保留公开导出 |
| 后端试点 | `4609b11` | 字幕选择与 SRT 转换提取至 `subtitle_utils.py`，原私有方法保留委托 |

## 模型分工

两个 GPT-5.6 Terra / low 负责前后端实现；GPT-5.6 Luna / low 完成基线盘点；GPT-6 Sol / low 独立审查。协调者汇总、修正并提交。本轮没有创建分支、推送远端或操作用户原有暂存内容。

## 审查与修正

- 独立审查发现 store 遗漏 `normalizeSchedulerState` 的原公开导出；已补回并添加入口测试。
- 字幕 JSON 解析保持原先裸 except 的捕获范围，提取代码使用显式 `BaseException`，避免本轮顺带改变异常行为。未来收窄范围需独立评估和测试。
- 未发现提取引入的循环依赖；后续大组件拆分仍需单独分析依赖。

## 验证

- 前端：最终队列归一化测试 5/5 通过，`tsc -b` 通过。
- 前端执行代理在导出修正前运行 Vite production build，通过；既有 CSS 选择器、混合动态导入和 bundle 体积警告仍存在。
- 首次 pnpm 调用触发环境依赖检查与安装，受 esbuild 构建批准限制中断；随后通过本地已落盘工具完成验证。未留下 package/lockfile 配置变更。
- 后端：新测试中的两项纯函数断言通过；对原方法与提取实现进行了 34 项等价比较，全部通过；两份服务文件语法检查通过。
- 后端没有可用项目虚拟环境，未运行 pytest 或完整 DownloadService 集成测试。独立断言及比较绕过了包初始化，不能证明 FastAPI 启动或依赖注入正常。
- 本轮代码差异通过 `git diff --check`。原有迁移、删除和暂存变更保留，不计入上述提交。

## 下一阶段候选

1. 修正测试布局文档与迁移后的 Playwright 相对路径，独立提交；先确定是否接续用户原有迁移。
2. 提供后端虚拟环境后运行 `tests/test_subtitle_utils.py` 与下载相关回归测试，再扩大字幕模块迁移。
3. 对视频详情页和 AI 笔记服务先形成职责与调用地图，每轮提取一个职责，避免仅按行数拆文件。

本轮完成基线和两个试点，整个项目的整理尚未完成。

## 第二轮：测试布局与 AI 流水线规则

用户授权继续，沿用 GPT-5.6 Terra / low 实现、GPT-5.6 Luna / low 文档同步及 GPT-6 Sol / low 独立审查。

- `ba488f1`：校准 AGENTS.md 和 README 的后端入口、Python 版本、文档目录、测试和类型检查命令。
- `138bbdc`：接续原有 Playwright 配置迁移，提交旧根配置删除与新配置移动，并将 `testDir` 修正为 `.`；补全测试文档中的根 Python 测试入口和覆盖率限制。此提交明确包含这项已有迁移，其他用户原有暂存改动保留。
- AI 规则提取：新增 `note_pipeline.py` 和三项纯规则测试，AiNoteService 保留常量别名和所有私有入口。未修改数据库、ASR 控制、Prompt 或主流水线编排。
- 形成 `REFACTOR_MODULE_MAP.md`，记录 AI 服务及视频详情页职责边界，下一轮前端候选为详情缓存。

验证结果：

- 当前本地 Playwright 二进制执行 `--list` 成功：19 个文件、263 个测试。未实际运行集成用例。文档中的 pnpm 命令仍要求安装对应依赖；此环境包装器的构建审批限制未解决。
- 文档中的前端 `tsc --noEmit` 检查通过。
- AI 规则三项测试函数直接执行通过，49 项原实现/提取实现比较通过，Python 语法检查通过。
- 后端 pytest 和服务启动仍因项目虚拟环境缺失而未验证；纯模块断言绕过包初始化和 conftest，不能作为集成验证。
- 独立审查未发现 AI 提取的阻塞问题；`_stage_index` 不再经 `self._stage_key`，仓库无私有覆写调用。当前阶段索引算法按首个匹配模式计算，已通过测试固定原行为。
- pnpm 包装器生成的临时 Web workspace YAML 已清理，未留下依赖配置变更。

未推送远端。后续先运行后端环境中的定向回归，再逐职责处理详情缓存或分析上下文。

## 第三轮：视频详情缓存（2026-10-01）

沿用 GPT-5.6 Terra / low 实现、GPT-5.6 Luna / low 只读边界盘点和 GPT-6 Sol / low 独立审查。

- 新增 `apps/web/src/pages/videoDetailCache.ts`，迁出详情数据类型、内存 Map、sessionStorage、缓存键与 TTL 读写逻辑。页面减少 93 行净代码，保留原请求、播放、下载和 UI 逻辑。
- 新增 10 项缓存测试，覆盖内存命中、TTL 边界、过期存储、坏 JSON、读取异常、getter 异常传播、video/opus 隔离、写入失败、过期内存回退及清理失败。
- 缓存命中仍继续刷新请求；保留原始路由 ID、缓存前缀及 5 分钟边界，不顺带修改时间戳校验或 getter 异常行为。
- 更新 Web 实现文档的缓存边界及模块地图。

验证结果：

- 最终 4 个详情测试文件、20 项测试通过，包括缓存、媒体、播放和图文测试。运行时显式指定 `VITE_API_BASE_URL=http://localhost:8000`，与既有图文测试的固定 URL 断言一致；未修改 API 配置。
- 默认环境原图文测试有 1 项 localhost/127.0.0.1 断言失败；相关实现、配置和原测试文件本轮没有改动。不能将受控基址下通过解释为默认环境全套通过。
- 最终 TypeScript project build 通过；执行代理运行 Vite production build 通过，既有 CSS、混合动态导入和 bundle 体积警告保留。
- 独立审查无阻塞问题；补充了审查指出的过期内存回退和删除失败测试。
- 代码差异检查通过。不执行页面集成或网络测试，不声称验证完整请求降级链路。

代码和文档按主题分别提交，保留其他用户原有暂存改动，未推送远端。

## 第四轮：本地播放控制器（2026-10-01）

GPT-5.6 Terra / low 实现，GPT-5.6 Luna / low 只读盘点，GPT-6 Sol / low 独立审查。为保留生命周期，本轮限定为控制器提取，没有把路由与播放映射请求整体搬进 hook。

- 新增 `useLocalVideoPlayback.ts`，管理 video ref、待跳转、播放、钉固、时长与媒体事件。
- 页面保留原本详情和播放映射请求、清空 entry 与 poster 切换、条目选择、分 P 导航及 poster reset effect 的位置。
- 保留待跳转在 metadata 时消费一次、无 ref 时 no-op、play() 同步/异步失败不抛出、结束事件不跳下一 P、旧时长不因 poster 清理而清空等行为。
- 新增 8 项 hook 测试，并同步 Web 实现文档和模块地图。

验证结果：

- 5 个测试文件、28 项测试通过：hook、详情播放匹配、媒体、缓存和图文。图文测试沿用上一轮受控 `VITE_API_BASE_URL=http://localhost:8000`，没有修改默认 API 配置。
- 最终 `tsc -b --pretty false` 通过，执行代理的 Vite production build 通过；既有 CSS、混合动态导入和 bundle 体积警告保留。
- 独立审查无阻塞问题；补充一次性跳转、无 ref 消费、pause/ended、时长保留及同步播放异常覆盖。
- 差异检查通过；没有运行真实浏览器媒体播放、跨路由异步切换或分 P 交互集成测试，不将控制器单测等同于这些验证。

既有详情/播放映射请求的跨路由竞态本轮没有更改，后续若调整需专门验收。下一轮候选为 AI 笔记时间戳关键点解析的纯逻辑提取。

## 完整整理里程碑（2026-10-03）

用户要求设置 goal、多个代理持续执行、全部 low、不使用 Astra，并沿用分阶段 commit。当前子代理工具不提供 Terra / 5.6 Luna，本轮明确改用 GPT-6 Luna 和 GPT-5.6 Sol 执行，GPT-6 Sol 独立审查；没有自动提高推理强度。范围及验收见 `REFACTOR_COMPLETION_PLAN.md`，不将本轮完成冒充所有产品技术债解决。

### 交付与阶段提交

- `357064d`：定义可检验的 A–E 阶段、范围和检查点。
- `6452d20`：Vitest 只发现 src 下单测，修正误收集 Playwright e2e 导致的两个套件错误。
- `e5bdf79`：提取 `note_context.py` 的语言、格式、timecode 和 prompt extras 纯规则，保留旧私有 wrapper；新增阈值、完整文本和 AST 委托测试。
- `cdb686b`：提取 `videoDetailKeypoints.ts`，保留章节优先/fallback、按秒去重、排序前 18 项及原宽松时间码行为；补充 9 项纯解析测试。
- `165a762`：下载 hook 新增 mock 回归，验证选中分 P、选项 payload、重复/已完成及强制重下载，恢复保留原三个完整字段断言；生产 hook 和队列实现不变。
- `95d257b`：新增标准库直接依赖/常见 IO 检查及 7 项回归，覆盖所列 3 个 Python 和 3 个 TypeScript 纯模块。脚本可从 /tmp 运行；缺模块、读取失败及非法依赖非通过。
- 收尾文档提交同步模块地图、测试运行说明、Web/AI/队列职责及本阶段证据。未推送远端。

### 实际验证

- 最终受控 API 基址 `VITE_API_BASE_URL=http://localhost:8000 ./node_modules/.bin/vitest run`：23 个文件、124 项通过；包括原有队列、AI 面板等单测，不只新模块。
- 最终默认基址重跑：120 项通过、4 项旧 URL 断言失败，分布于图文解析、MarkdownPreview 和 MarkdownEditor；这些源文件、默认 API 配置和原断言本轮未改，不把受控环境通过宣称为默认环境全绿。
- 详情相邻回归：6 个文件、37 项通过。最终 `./node_modules/.bin/tsc -b --pretty false` 通过，Vite production build 通过。
- 既有 CSS `.data-tip]`、动态/静态混合 import、大 bundle 和 Browserslist 过期警告保留；没有声称零告警。
- 建立 Git 忽略的 `apps/api/venv`（Python 3.13），按原 requirements.txt / requirements-test.txt 安装；`python -m pip check` 通过，依赖清单和 lockfile 不变。
- API 目录激活虚拟环境，以 `DATABASE_URL=sqlite:///:memory: python -m pytest -p no:postgresql -o addopts= -q tests/test_note_pipeline.py tests/test_subtitle_utils.py tests/test_note_context.py tests/test_note_service_boundaries.py tests/test_refactor_boundaries.py` 运行：28 项通过。
- 后端相邻安全回归：orchestrator 的 execution_plan/priority_configuration/execution_summary/dependency_configuration 选择 9 项通过；UnifiedQueueManager 的 event_manager 选择 4 项通过；字幕 handler 的 SRT/time conversion 选择 2 项通过。
- `test_queue_manager_execution.py`：6 项通过、1 项旧失败。失败为 `test_scheduler_writes_series_nfo` 同步调用 async `_write_series_nfo`，未 await，产生 RuntimeWarning 且 tvshow.nfo 不存在；测试和 scheduler 本轮无 diff，未顺手改动。
- PostgreSQL 自动插件缺 libpq，默认 pytest 在收集前失败；纯规则/SQLite 检查显式禁用该插件，不代表 PostgreSQL 可用。pytest.ini 当前段名 `[tool:pytest]` 不被 pytest 作为 `[pytest]` 配置加载，其文本中的 80% coverage 门槛没有全库验收。
- 最终 Playwright `--list` 发现 19 文件、263 用例；没有实际执行完整 E2E，也没有验证真实下载、播放、账号、ASR/LLM、生产库或部署。

### 审查、保留与完成边界

GPT-6 Sol / low 独立审查无 P1/P2 阻塞；补齐语言阈值/采样、完整 policy/extras、等秒时间码、CRLF、章节结束和 fallback 测试。协调复核发现下载回归替换了原测试，要求恢复完整断言后重新验证。

服务委托测试使用 AST，只能证明调用结构，不能证明服务初始化/事务/worker 运行。下载 hook mock 不能覆盖详情页独立合集、剩余分 P 或跨路由时序，已在模块地图中明确保留后续验收。边界脚本只检查直接静态/动态依赖与常见模式，不是全仓安全证明。

每次按显式文件清单提交，原 staged 二进制快照复核一致；原迁移、删除、未跟踪测试及其他用户工作不纳入本轮提交。所有本里程碑新增代码、测试和文档均按主题提交，不自动推送。当前 A–E 整理里程碑完成，已记录的历史失败和范围外集成/架构工作仍未解决。
