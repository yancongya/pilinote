# PiliNote 升级分阶段计划（前后端同步）

本计划以“前后端同频升级”为原则，将 upgrade 流程拆分为六个阶段。每阶段均给出明确的前端改动、后端改动、测试要点与验收标准，确保阶段性成果在 UI 上可见且可验证。

## 阶段划分总览
- Phase 1: 基础数据存储与设置界面（Frontend + Backend 同步）
- Phase 2: 扫描触发与结果展示（Backend 接口落地 + Frontend 展示）
- Phase 3: 自动下载队列落地与显示（后端队列实现 + 前端队列视图）
- Phase 4: 配置持久化与界面扩展（后端持久化 + 前端表单扩展）
- Phase 5: 定时任务集成（后端调度 + 前端调度状态展示）
- Phase 6: 高级筛选与重试策略（后端筛选逻辑 + 前端筛选 UI）

## 阶段 1：基础数据存储与设置界面
Frontend Changes
- 新增 Auto Download 设置界面卡片/标签页，展示以下字段：
  - 启用自动下载
  - 扫描间隔（分钟）
  - 视频质量（数值与编码格式、音频码率、输出格式）
  - 其他基础设置（如 Cron、最小/最大时长等在后续阶段扩展）
- 提供“保存配置”按钮，保存后提示结果并在页面刷新时读取最新值

Backend Changes
- 新增 VideoSourceScan 数据模型用于记录扫描历史（字段示例：id、source_type、source_id、last_scan_time、total_videos、new_videos、status、created_at、updated_at）
- 新增 /api/auto-download/config 的 GET/POST 接口用于读取与保存基础配置（初期可采用简易持久化）
- 提供默认配置，前端首次读取时可看到初始值

Tests & Validation
- 调用 GET /api/auto-download/config，返回默认配置
- 修改配置并调用 POST /api/auto-download/config，返回成功并能再次 GET 验证
- 数据库 video_source_scans 表创建成功，能插入测试记录

Acceptance Criteria
- 前端设置界面可见且能保存/读取配置
- 后端提供基础配置 API，且有默认配置
- 数据库表 video_source_scans 存在且可写入

---

Phase 2：扫描触发与结果展示（Frontend + Backend 同步）
Frontend Changes
- 在下载页新增“开始扫描/触发扫描”按钮
- 展示简单的扫描状态（正在扫描/已完成）
- 展示返回的视频列表（初期可使用简化字段）

Backend Changes
- 实现 VideoSourceScanner 服务，提供 scan_favorite 的基础实现（返回示例视频列表以演示）
- 新增 /api/auto-download/scan-records 与 /api/auto-download/scan/trigger API，支持读取最近的扫描记录与手动触发扫描

Tests & Validation
- 调用 /api/auto-download/scan-records 与 /api/auto-download/scan/trigger，确认返回结构
- 前端触发扫描后，下载页的结果区域更新并显示视频列表

Acceptance Criteria
- 后端可触发扫描并返回结果
- 前端能看到扫描结果并更新视图

---

Phase 3：自动下载队列落地与显示
Frontend Changes
- 下载页增加“队列/下载队列”区域，显示待下载任务（视频信息、状态、进度）
- 当阶段 2 的扫描返回视频后，自动将视频加入队列并在队列区域显示

Backend Changes
- 实现 AutoDownloadService.add_videos_to_queue，将扫描结果写入队列（Task 模型）
- 调整 /api/auto-download/scan/trigger 流程，使其在返回扫描结果的同时尝试将新视频加入队列

Tests & Validation
- 扫描后队列中出现新增任务，状态为 BACKLOG/待下载
- 队列接口返回结构正确，前端能渲染队列项

Acceptance Criteria
- 队列具备基本创建能力，前端可观测到新增项
- 扫描结果自动进入队列，队列可观测

---

Phase 4：配置持久化与界面扩展
Frontend Changes
- 扩展设置表单，增加 min_duration、max_duration、allowed_uploaders、blocked_uploaders、max_retries、retry_interval 等字段
- 提供“保存配置”按钮，提交后提示保存结果

Backend Changes
- 将 AutoDownloadConfig 持久化存储（数据库或配置文件），/config GET/POST 持久化到持久存储
- 与 Phase 1 字段保持向后兼容

Tests & Validation
- 修改配置并重启服务后，读取配置仍然正确
- 提交更新，后端返回成功

Acceptance Criteria
- 配置持久化工作，前端能读取到持久化后的值
- API 支持新增字段并正确返回

---

Phase 5：定时任务集成
Frontend Changes
- 展示下次执行时间、定时开关，以及简单状态面板

Backend Changes
- 集成调度器（如 APScheduler），定时触发扫描与下载
- 提供调度状态接口与日志

Tests & Validation
- 运行定时任务，观察日志与数据库记录
- 前端展示下次执行时间

Acceptance Criteria
- 定时任务按设定周期运行，扫描/下载自动触发
- 前端显示调度状态与 next run 时间

---

Phase 6：高级筛选与重试策略
Frontend Changes
- 提供筛选规则 UI：min_duration、max_duration、allowed_uploaders、blocked_uploaders、max_retries、retry_interval 等字段
- 提供验收测试入口，用于验证筛选效果

Backend Changes
- 实现视频筛选逻辑 should_download(video, config)，基于时长、UP 主名单等条件
- 将筛选逻辑集成到 add_videos_to_queue，确保不符合条件的视频不会进入队列
- 扩展重试策略参数与行为

Tests & Validation
- 基于示例数据验证筛选条件的边界与正确性
- 日志中记录筛选原因

Acceptance Criteria
- 筛选规则生效，非符合条件的视频跳过
- 前端配置筛选规则并保存，后端正确应用

---

升级后验证流程
- 按阶段执行上述测试要点，确保阶段性成果稳定
- 各阶段完成后进行回归测试，确保前后端接口版本匹配
