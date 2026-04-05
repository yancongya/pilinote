# 账号登录与缓存全链路升级（阶段3）

- 组件分布
  - 后端：FastAPI + SQLAlchemy，提供认证、会话、cookie 持久化与会话切换接口，以及阶段3的监控与灰度组件。
  - 前端：React + TypeScript，使用 Zustand 进行全局身份状态管理，localStorage 持久化。前端通过后端 API 获取登录态，后续变更对 UI 的影响最小。
  - HeadersManager：新增同步助手 sync_cookies_from_db(user_id)，并提供阶段3的监控端点与灰度开关。
  - AuthMetrics、Metrics API：暴露 Cookies 同步统计数据，便于监控与可观测性。
  - 启动阶段预加载：Phase 2 已实现的启动阶段 cookies 预加载在阶段3基础上增强，可结合 Canary 逐步上线。

- 数据模型概览
  - User：id, mid, username, avatar, sessdata, is_active, created_at, updated_at, last_refresh_time。
  - Cookie（与用户绑定）：name, value, user_id, expires_at。
  - 新增：AuthMetrics 数据聚合，用于统计 Cookies 同步情况。

- 认证全链路要点
  1) 前端触发登录（扫码/短信/SESSDATA）。
  2) 服务端通过 Bilibili 服务获取 sessdata/cookies，并写入数据库。 
  3) 将该账号设为活动账号（is_active = True）。
  4) HeadersManager 同步内存中的 Cookies 并刷新请求头，确保后续请求携带最新 cookies。
  5) 任何需要认证的接口在服务器端读取活动账号的 Cookies 以调用 Bilibili API。

- 初始问题诊断要点
  - 登录后若前端显示未登录，通常是内存中的 Cookies 未能及时同步至 HeadersManager。
  - 阶段3 引入的同步助手可以避免该问题，通过 DB -> 内存的同步确保后续请求带有有效 sessdata。

- 本文档的变更范围
  - 本文档覆盖阶段3及其对阶段1/阶段2的影响，帮助团队理解、评审与上线策略。
