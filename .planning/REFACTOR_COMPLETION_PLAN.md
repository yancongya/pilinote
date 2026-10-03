# 当前整理里程碑的完成计划

## 范围与约束

本 goal 接续已有渐进式路线图，完成已识别热点的安全提取、队列兼容回归、可重复验证、边界检查及阶段提交，不代表所有大文件、历史技术债或产品集成都已解决。

- 不变更认证、API/下载协议、数据库 schema、产品交互或异步请求时序。
- 真实账号、生产数据库、媒体库、模型下载、LLM/ASR 和真实下载不用于验收；采用 mock、纯函数和内存数据库。
- 已有用户迁移、删除和暂存内容保留；协调者仅按显式清单 commit，不 push。
- 新子代理工具当前不提供 Terra / 5.6 Luna；本轮使用 6 Luna 和 5.6 Sol 执行，6 Sol 独立审查，全部 low，禁止 Astra 和自动升级。
- 原有四阶段及后续试点见 REFACTOR_PROGRESS.md；本计划为当前 goal 的可检验剩余工作，而非无限制重写授权。

## 阶段 A：测试环境与发现边界

建立被 Git 忽略的 apps/api/venv，按原 requirements.txt 和 requirements-test.txt 安装，不改依赖清单。将 apps/web/vite.config.ts 的单测发现限制为 src 下测试，避免收集 e2e 中 Playwright 用例。

验收：实际运行全前端单测、TypeScript project build、Vite production build及后端定向 pytest；记录默认环境失败与受控 API 基址结果。PostgreSQL 插件依赖 libpq，SQLite/纯模块检查明确使用 -p no:postgresql。不声称验证全库覆盖率；pytest.ini 当前使用 [tool:pytest] 而非 [pytest]，其声明的 80% 门槛不等于已生效。

## 阶段 B：视频详情 AI 关键点

文件：VideoDetailPage.tsx、videoDetailKeypoints.ts、videoDetailKeypoints.test.ts。

只提取 Markdown 时间戳转换与关键点，保留章节优先、无结果 heading fallback、按秒去重、排序取前 18 点以及宽松分钟/秒语义。请求、状态、播放器和渲染不搬移。

验收：新纯函数和相邻详情测试通过；覆盖 CRLF、等秒写法、章节结束、无效章节、空输入和数量上限。独立审查无阻塞差异。

## 阶段 C：AI 笔记上下文纯规则

文件：note_service.py、note_context.py、test_note_context.py，以及安全的服务委托测试。

提取语言识别、语言策略文本、格式过滤、timecode 需求和 prompt extras 拼装；旧私有 wrapper 保留。NFO/字幕文件读取、事务、worker、ASR、LLM、恢复和主流水线仍在原服务中。

验收：语言阈值/采样边界、完整文本顺序、格式重复与默认列表、旧委托入口定向 pytest 通过；note_pipeline 和 subtitle_utils 回归通过。独立审查确认原行为。

## 阶段 D：队列与下载边界回归

文件：useVideoDownload.ts、useVideoDownload.test.ts、newQueue.test.ts；后端 queue manager/orchestrator/handler 只读核对并执行确认安全的定向用例。

验证既有 store re-export、归一化旧字段、下载选项、媒体类型、已存在/已完成和强制重下载的 hook 行为。详情页面有独立合集/剩余分 P 处理，不把 hook 单测冒充整页交互验收；无安全提取必要时保留实现。

验收：新增 mock 回归与既有队列/下载测试通过；列明仍未覆盖的整页分支。后端相邻测试若有基线失败，提供具体证据、不改未触及实现、不声称其通过。

## 阶段 E：可持续边界检查与最终收尾

文件：scripts/check_refactor_boundaries.py、test_refactor_boundaries.py、现有模块地图、开发文档和阶段进度。

采用标准库轻量检查直接依赖与常见 IO，固定本轮纯模块不得倒置依赖服务、页面、状态或网络；不是全仓依赖分析或安全证明。测试必须证明正常源、非法依赖/IO和路径独立性。

验收：边界脚本及其回归通过；重跑最终前后端定向/全前端单测、类型及生产构建；Playwright --list 验发现。由 6 Sol / low 审查最终差异及文档，所有本轮阻塞问题修复。按主题 commit，复核原 staged 二进制快照一致，本轮未提交文件为零。文档明确通过、失败、未运行及后续独立任务。

## 不纳入本里程碑验收的工作

详情跨路由请求竞态、完整页面下载/播放交互、真实登录/下载、AI 持久化/子进程/文件输出的全面解耦、旧新队列架构合并、NAS/生产部署及全库 coverage 均须独立计划与环境。本轮不修改这些行为，也不以局部通过推断它们可用。

## 检查点

- A：进行中，测试环境已建立，发现边界已修正，验证待最终记录。
- B：实现完成，审查无阻塞，边界补测中。
- C：实现完成，审查无阻塞，阈值及委托补测中。
- D：下载 mock 回归及后端安全核对中。
- E：直接依赖检查实现中，最终审查、文档和提交待完成。
