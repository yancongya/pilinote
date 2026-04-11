# 前端阶段对齐（Phase 1-6）

本文件将前端在六个阶段的改动要点汇总，帮助前端团队对接后端实现并确保 UI 层在各阶段有明显改动与可测试点。

- Phase 1：基础设置界面
  - 新增 Auto Download 设置面板，展示启用、扫描间隔、质量、编码、音频等字段。
  - 保存配置按钮，成功后显示提示并刷新当前配置。
  - 初始数据来自 /api/auto-download/config 的 GET。
- Phase 2：扫描触发与结果展示
  - 在设置页加入“触发扫描”按钮，触发 /api/auto-download/scan/trigger。
  - 显示简单的扫描状态和结果（视频列表）
- Phase 3：下载队列显示
  - 新增下载队列区域，展示待下载任务，扫描后自动加入队列。
- Phase 4：扩展配置表单
  - 增加 min_duration、max_duration、allowed_uploaders、blocked_uploaders、max_retries、retry_interval 字段。
- Phase 5：定时任务状态
  - 新增调度状态面板，显示下次执行时间等信息。
- Phase 6：筛选规则 UI
  - 增加筛选规则配置区域，支持按时长、UP 主白/黑名单等筛选。

测试要点
- 每阶段确保前端页面能显示新增字段与新区域。
- 提交表单后，通过接口返回的结果来校验保存成功与否。
