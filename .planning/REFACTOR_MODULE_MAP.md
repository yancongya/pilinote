# 下一阶段模块边界

## AI 笔记服务

入口：`apps/api/src/services/ai/note_service.py` 的 `AiNoteService`。

| 职责 | 当前边界 | 后续处理 |
| --- | --- | --- |
| 模式与阶段规则 | `note_pipeline.py`，服务保留私有委托及常量别名 | 本轮提取；单独验证规则，不加载数据库 |
| 超时、ASR 进程与取消 | 顶部 worker 和 `_run_process_with_timeout_and_cancel` | 涉及进程和注册表，需专门测试后再拆 |
| 记录及控制状态 | 创建、暂停、恢复、取消、meta 和分析产物持久化 | 保留事务边界，先补生命周期覆盖 |
| 主流水线 | `_run_analysis` | 先梳理输入输出与阶段状态，不按行数机械拆分 |
| 分析上下文 | `_prepare_analysis_context`、NFO/字幕读取、Prompt 构建 | 后续候选，避免把 IO 隐藏进纯规则模块 |
| 输出文件 | Markdown、截图、索引、系列记忆 | 需临时目录回归测试，避免读写真实媒体库 |

规则兼容约束：阶段索引当前按所有模式的遍历顺序取得首个匹配值，不是按当前模式计算。例如 `image_text.NFO.READ` 仍取 video 模式中的索引 2。本轮保留此语义；若调整须独立分析恢复流程。

## 视频详情页

入口：`apps/web/src/pages/VideoDetailPage.tsx`。

已有独立模块包括 `videoDetailPlayback`、`videoDetailMedia`、`videoDetailOpus` 和 `useVideoDownload`；后续整理应扩展这些职责边界。

| 职责 | 当前证据 | 建议次序 |
| --- | --- | --- |
| 详情缓存 | `videoDetailCache.ts`，内存 Map、sessionStorage、5 分钟 TTL | 已提取并覆盖过期、坏 JSON、存储不可用及缓存键隔离 |
| 本地播放 | 已有播放模块，页面管理播放状态和 seek | 第二步明确 hook 输入输出与生命周期 |
| 下载交互 | `handleAddToDownload`、合集/分 P 下载、重下载确认 | 先保证队列 payload 兼容，再拆控制逻辑 |
| 媒体展示 | 视频/图文、封面、UP 主、评论及 AI 面板入口 | 按独立 UI 区块拆组件，避免增加跨组件状态耦合 |

详情缓存试点已完成，缓存键、TTL、内存与 sessionStorage 优先顺序保持不变。下一轮候选是本地播放状态 hook：先明确输入输出与路由切换生命周期，再移出页面控制逻辑，不改变已有播放模块。

## 验证边界

- 根 Playwright：验证迁移后可发现 263 个测试；未执行有登录、队列变更或网络副作用的测试。
- 前端：本轮文档中的 `tsc --noEmit` 命令通过。
- 后端：无项目虚拟环境；纯规则断言和原实现比较不能替代服务集成测试。
