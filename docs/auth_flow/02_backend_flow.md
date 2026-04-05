# 后端认证与会话流分析

1) 登录入口与保存
- 端点：/api/auth/sessdata, /api/auth/qrcode/status, /api/auth/sms/login 等
- 成功后，将 sessdata/cookies 写入数据库，对应 User.is_active = True
- 需注意：仅写入数据库并不足以让当前正在运行的进程立即“知晓”新 Cookies，需显式刷新内存中的 cookies。

2) HeadersManager 与 Cookie 管理
- HeadersManager 初始化时会从活跃用户的 cookie 写入到 CookieManager，并据此生成请求头。
- cookie_manager.save_to_db(user_id) 将 cookies 保存到数据库，load_from_db(user_id) 将数据库中的 cookies 加载到内存。
- refresh() 会用内存中的 cookies 构造最新的 HTTP 请求头。
- 登录成功后，推荐的做法是：
  - load_from_db(user_id)
  - refresh()
  - 以确保后续请求携带最新的 cookies。

3) 自动加载与状态校验
- /api/auth/status 会读取当前活跃用户，并用 HeadersManager 的 cookies 去验证 sessdata 的有效性。
- 为避免竞态问题，状态校验前应先确保活跃用户的 cookies 已加载到内存。

4) 稍后再看/watch-later 收藏页
- /api/watchlater/list 依赖当前请求中携带的 sessdata；若 Cookies 未就绪，可能导致未登录状态。
- 为确保正确性，watchlater 路由在获取前会尝试从 DB 加载活跃用户的 cookies，并刷新 Headers。

5) 潜在修复点
- 登录成功后同步内存中的 Cookies：load_from_db + refresh。
- status 与 watchlater 等路由在进入前确保 cookies 已就绪。
