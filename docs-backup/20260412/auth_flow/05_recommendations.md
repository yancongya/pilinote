# 修复与改进建议

- 核心改动（高优先级）
  1) 登录后立即同步内存中的 Cookies：在 sessdata/sms/login/qrcode 登录成功后，调用 HeadersManager.cookie_manager.load_from_db(user_id) 并执行 refresh()。
  2) 登录状态校验前，确保加载活跃用户的 Cookies 到 HeadersManager：在 /api/auth/status、/api/watchlater/list、以及需要鉴权的路由入口处加入 pre-load 步骤。
  3) watch-later、收藏等需要鉴权的路由，在进入前触发 load_from_db(active_user.id) 以确保 cookie 就绪。

- 代码层面建议
  - 将上面的逻辑抽象成一个小的 Helper，例如 refresh_headers_for_user(user_id)，在登录流程、切换账号、以及状态校验处复用。
  - 避免在一个请求中多次创建/刷新 HeadersManager，确保单例稳定性。

 - 测试建议
  - 手动测试：先登录后刷新页面，访问 watch-later、收藏夹等接口，确认返回正确的数据并且 is_logged_in 为 true。
   - 同步失败场景的回退策略，确保对用户友好提示。
  - 灰度上线策略：逐步提升范围，确保业务稳定后再逐步扩大。
  - 文档与培训：阶段性变更需要配套的上线培训与变更日志。
