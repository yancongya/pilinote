# 下一阶段模块边界

## AI 笔记服务

入口：`apps/api/src/services/ai/note_service.py` 的 `AiNoteService`。

| 职责 | 当前边界 | 后续处理 |
| --- | --- | --- |
| 模式与阶段规则 | `note_pipeline.py`，服务保留私有委托及常量别名 | 本轮提取；单独验证规则，不加载数据库 |
| 超时、ASR 进程与取消 | 顶部 worker 和 `_run_process_with_timeout_and_cancel` | 涉及进程和注册表，需专门测试后再拆 |
| 记录及控制状态 | 创建、暂停、恢复、取消、meta 和分析产物持久化 | 保留事务边界，先补生命周期覆盖 |
| 主流水线 | `_run_analysis` | 先梳理输入输出与阶段状态，不按行数机械拆分 |
| 分析上下文 | `note_context.py` 承载语言、格式、timecode 和 Prompt extras 纯规则；NFO/字幕 IO 留在服务 | 已提取安全转换；上下文读取和编排不能以纯单测代替集成验收 |
| 输出文件 | `note_outputs.py` 负责 Markdown、索引、系列记忆 IO；服务保留路径委托与截图 | 临时目录测试，不导入真实服务包；不是纯模块 |

规则兼容约束：阶段索引当前按所有模式的遍历顺序取得首个匹配值，不是按当前模式计算。例如 `image_text.NFO.READ` 仍取 video 模式中的索引 2。本轮保留此语义；若调整须独立分析恢复流程。

## 视频详情页

入口：`apps/web/src/pages/VideoDetailPage.tsx`。

已有独立模块包括 `videoDetailPlayback`、`videoDetailMedia`、`videoDetailOpus` 和 `useVideoDownload`；后续整理应扩展这些职责边界。

| 职责 | 当前证据 | 建议次序 |
| --- | --- | --- |
| 详情缓存 | `videoDetailCache.ts`，内存 Map、sessionStorage、5 分钟 TTL | 已提取并覆盖过期、坏 JSON、存储不可用及缓存键隔离 |
| 本地播放 | 播放匹配模块及 `useLocalVideoPlayback` 控制器；页面使用身份/刷新序号保护映射请求 | 页面 mock 请求与隔离浏览器验收，真实媒体播放不在本 goal |
| 下载交互 | `videoDetailDownloadPayloads.ts` 纯构造；页面保留合集/分 P、重下载确认 | 参数单测及隔离页面交互；不触发真实下载 |
| 媒体展示 | `VideoDetailPresenters.tsx` 独立骨架、评论及 AI 预览 | 保留 DOM/CSS/回调，桌面和移动验收 |

详情缓存、播放控制器、AI 关键点、展示和下载参数已提取。请求仍在页面，按路由/认证生命周期保护旧响应；不机械搬进 hook。最终验收进度见 `REFACTOR_FULL_GOAL.md`。

## 下载队列

- `apps/web/src/utils/newQueueNormalization.ts`：纯归一化；`stores/newQueue.ts` 保留公开 re-export、持久化和请求。
- `useVideoDownload`：选中分 P 与重复/已完成/重下载控制。mock 测试不代表真实下载或详情整页流程通过。
- `apps/api/src/services/queue/` 与 `unified_queue_manager.py`：保留不同入口，不进行架构合并。
- 后续基线修复已让 NFO 测试显式 await `_write_series_nfo`，并 mock artwork；设置服务采用模块替身，避免导入真实 ASR singleton。七项队列执行测试通过，scheduler 生产实现未改。

## 边界检查

`scripts/check_refactor_boundaries.py` 检查所列 Python/TypeScript 纯模块（含下载参数构造）的直接依赖及常见 IO，不加载业务服务。缓存、Opus、输出 IO、展示组件、请求 hook 和完整服务不属于纯模块白名单，也不被此检查证明无副作用。

## 验证边界

- 根 Playwright：本轮重新发现 263 个测试；未执行有登录、队列变更或网络副作用的完整套件。
- 前端：四项旧 URL 断言已跟随实际基址并保留独立路径/query 断言；新增八项基址契约测试。默认环境全单测已通过；类型和生产构建单独记录。
- 后端：本轮建立了被忽略的 `apps/api/venv` 并按原依赖清单安装；SQLite/纯模块 pytest 禁用缺 libpq 的 PostgreSQL 插件。服务委托 AST 测试不是运行时集成验证。
- 具体计数、命令、审查及提交以 `REFACTOR_PROGRESS.md` 当前里程碑记录为准。
