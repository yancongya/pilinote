# 后端认证与会话流分析（阶段3增强）

1) 阶段3概要
- 新增统一的 Cookies 同步入口 sync_cookies_from_db
- 引入 Canary 灰度开关 cookies_sync_canary_ratio 与 enable_canary
- 引入 AuthMetrics 指标以及 /api/metrics/auth 监控端点

2) Stage3 关键点
- sync_cookies_from_db(user_id) 将指定用户的 cookies 从数据库加载到内存中的 CookieManager，并刷新 Headers
- 使用 per-user 锁避免并发冲突
- Canary 跳过逻辑：基于 user_id 的模 100 的比例决定是否跳过实际同步
- 同步结果通过 AuthMetrics 记录（成功/失败/加载计数）

3) 路由与调用点
- watch_later: 进入前调用 sync_cookies_from_db(active_user.id) 以确保 sessdata 可用
- favorites: sessdata 获取前调用同一个同步助手
- auth: 登录成功后调用 sync_cookies_from_db(user_id) 以确保新账号 cookies 生效并刷新 Headers
- status: 进入后尝试同步活跃用户 Cookies 到内存并刷新

4) Metrics 与 API
- 新增 /api/metrics/auth 暴露阶段统计数据
- 配置项 cookies_sync_canary_ratio、enable_canary

5) 启动阶段
- Phase2 已实现预加载，Phase3 提供监控、灰度与可观测性
