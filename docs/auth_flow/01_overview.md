# 账号登录与缓存全链路概览

- 组件分布
  - 后端：FastAPI + SQLAlchemy，提供认证、会话、以及 cookie 持久化与会话切换接口。
  - 前端：React + TypeScript，使用 Zustand 进行全局身份状态管理，localStorage 持久化。
  - 持久化层：数据库中保存用户及其 cookies，HeadersManager 持有全局请求头与 cookies，确保对外请求携带正确的认证信息。
  - 稍后再看：后端提供/watchlater/收藏等接口，依赖 cookies/session 验证。

- 数据模型概览
  - User：id, mid, username, avatar, sessdata, is_active, created_at, updated_at, last_refresh_time。
  - Cookie（与用户绑定）：name, value, user_id, expires_at。
- 认证链路要点
 1) 前端触发登录（扫码/短信/SESSDATA）。
 2) 服务端通过 Bilibili 服务获取 sessdata/cookies，并写入数据库。
 3) 将该账号设为活动账号（is_active = True）。
 4) HeadersManager 同步内存中的 Cookies 并刷新请求头，确保后续请求带有有效 cookies。
 5) 任何需要认证的接口在服务器端读取活动账号的 Cookies 以调用 Bilibili API。

- 常见坑位/问题场景
  - 登录后若前端仍然显示未登录，可能原因在于内存中的 Cookies 未及时从数据库同步，导致对外请求缺失必要的 SESSDATA/Cookies。
- 本文档后续将给出逐步修复清单与代码变更点。 
