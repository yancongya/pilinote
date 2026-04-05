# 前端认证与本地缓存交互

- Zustand 状态管理
  - useAuthStore 保存 user 信息和 isAuthenticated 状态，并通过本地存储持久化。
  - fetchUser() 会调用 /api/auth/status 以获取当前登录状态，并据此更新本地状态。

- LocalStorage 与 Cookies 的关系
  - LocalStorage 用于持久化前端的用户信息（如 mid、username、sessdata 等）。
  - 实际的认证判断基于后端的 sessdata/cookies 验证，前端仅通过 /api/auth/status 获取结果。
  - 服务器端通过 HeadersManager 管理 cookies，实际请求头中的 cookie 字符串来自 CookieManager 的 cookies 集合。

- 关于 watch-later 收藏页
  - 访问 /api/watchlater/list 时，后端会从 HeadersManager 获取 SessData，以调用 Bilibili API。
  - 若后端在登录后未及时将 cookies 同步到内存，前端可能仍然看到未登录状态。
  - 现有改动将确保登陆后服务端在处理登录结果后，更新 HeadersManager 的内存 cookies，并刷新 header。

- 交互要点
  - 登陆成功后应立即刷新 header，确保后续请求有效。
  - 断网或服务重启后，前端应尽量通过 /api/auth/status 重新拉取状态以校验。
