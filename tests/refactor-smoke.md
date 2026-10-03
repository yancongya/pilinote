# 重构安全冒烟

本入口用于重复验证视频详情拆分、纯模块边界及既定 AI/队列回归。只调用仓库已有的本地工具，不安装依赖、不使用 `pnpm` wrapper，也不访问真实 API、ASR 服务、Bilibili、下载任务或用户数据库。

## 默认冒烟

从仓库根目录运行：

```bash
bash scripts/smoke-refactor.sh
```

脚本依次运行以下检查：

- 本地 Vitest 定向用例：Presenter、payload、详情页请求、API 配置、缓存、播放映射、关键点、`useVideoDownload` 与 `useLocalVideoPlayback`。
- `apps/web/node_modules/.bin/tsc -b`。
- `scripts/check_refactor_boundaries.py` 静态纯模块边界检查。
- 现有 `apps/api/venv` 中的七个 pytest 文件：`note_pipeline`、`subtitle_utils`、`note_context`、`note_service_boundaries`、`note_outputs`、`refactor_boundaries` 与 `unit/services/test_queue_manager_execution`。

API pytest 阶段会显式 source 已存在的虚拟环境，使用临时 `PILINOTE_RUNTIME_DIR`、内存 SQLite、通过 `-p no:postgresql` 禁用 PostgreSQL pytest entrypoint，并禁用 pytest 缓存；运行参数为 `-o addopts=`、`--timeout=30`、`-W error::RuntimeWarning`。队列执行测试明确排除 `test_scheduler_writes_series_nfo`，避免调用实际 scheduler NFO 写入方法。不会触发依赖安装。若测试环境没有现成的本地二进制或虚拟环境，脚本直接失败，不尝试补装。

只有明确需要生产前端构建时才运行：

```bash
bash scripts/smoke-refactor.sh --build
```

该选项在以上检查通过后额外调用本地 Vite 构建；默认冒烟不构建。

## 安全核验

运行开始前记录三份状态内容的 SHA-256：

- `apps/api/data/local_asr_models.json`（ASR registry）
- `apps/api/data/ai_runtime_state.json`（AI runtime state）
- `apps/api/data/pilinote.db`（生产数据库）

退出时的 `EXIT` trap 会无论测试成功或失败都重新计算三份哈希，并对比整个 Git index 暂存清单（路径、模式和对象 ID，包含已有暂存二进制）。任何状态或暂存快照变化都会使脚本失败。哈希仅用于检测，不是全仓写入防护；若脚本异常中断前状态已变化，请停止后续操作并检查对应文件，不要自动回滚或覆盖。

## 隔离浏览器回归

浏览器 UI/mock 流程不在命令行 smoke 中执行，也不计入其通过结果。需要手工验收时，必须先阅读 [`pilinote-browser-regression.md`](pilinote-browser-regression.md)，再按该文档启动独立 Vite、使用 `pilinote-browser-mock.js` 并遵守首次导航前安装 mock 的步骤。不要连接真实后端、外网 API、账号或下载服务。只有实际执行并留存该流程要求的 mock 请求、页面断言和桌面/移动证据，才能报告浏览器回归通过。
