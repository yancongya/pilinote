# 可能的主要问题与诊断要点

- 问题场景
  1) 用户已登录，后端数据库中 cookies 已保存，但前端仍显示未登录状态。
  2) 登陆后，后端 In-Memory CookieStore 未及时更新，导致后续请求仍使用旧 cookies。
  3) /api/auth/status 读取活跃用户时未加载该用户的 cookie 到内存，导致验证失败。

- 诊断要点
  - 启动时是否正确调用了 HeadersManager.init()，并从数据库加载活跃用户的 cookies？（见 lifespan 中的实现）
  - 登录完成后，是否有调用 cookie_manager.load_from_db(user_id) + refresh() 来同步内存 Cookies？
  - /api/watchlater/list 及 /api/auth/status 在进入时是否先执行 load_from_db(active_user.id) 并 refresh？
  - 数据库中的活跃用户 (is_active=True) 是否存在且唯一？若无，后续状态判断将出错。

- 诊断工具建议
   - 在登录成功分支添加日志打印：当前活跃用户ID、内存 Cookies 快照、数据库 Cookies 快照。
  - 在 /api/auth/status 内部打印加载的 Cookies 内容以及 sessdata 值。
   - 通过 API 调试确认 watch-later 的 sessdata 是否随请求携带并有效。
- 风险点与对策（新增）
- Canary 风险：阈值设置不当可能导致覆盖范围偏低或偏高，需监控并逐步提升覆盖率。
- 并发与锁：若锁实现不完善，仍需关注可能的死锁或性能瓶颈，已引入 per-user 锁进行缓解。
