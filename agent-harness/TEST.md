# CLI 验证计划

先验证协议再验证真实后端：安装后从项目之外调用命令；无 --apply 的写命令不发请求；API 成功/失败/非 JSON/重定向有稳定 JSON 和退出码；递归过滤密值；任务和笔记 ID 不构造额外路径。真实隔离 API 验证 health、任务列表和格式选项，不触发 Bilibili 下载或 AI 计费。不运行生产数据库迁移。

## 2026-10-04 本地结果

- 安装后的 CLI：10 项临时 HTTP 协议测试通过。
- 真实隔离 FastAPI：health、formats、tasks list 通过（该项关闭 lifespan，不执行异步下载）。
- 完整 lifespan 生产容器：实际健康、同源 API/WebSocket、容器 CLI、非 root 和重启 SQLite 持久化通过，18 项检查通过，详见 delivery/full-local-container-acceptance.json。
- 新运行目录回归：3 项通过。原冒烟：前端 74 项、后端 50 项通过，1 项按原脚本排除；类型检查和前端构建通过。
- 最终 NAS 发布 workforce-20261004-4：24 项远程检查通过，重启后保留 1 用户、5 Cookie、49 历史任务、32 调度记录。
- 项目之外安装 CLI 对真实 NAS：6 个场景通过；Skill 的 2 个场景各执行 with/without 对照，共 4 次独立代理执行通过。未证明 Skill 相对基线有提升，耗时/token 元数据不可用。
- 真实浏览器：首页到下载页交互、同源 WebSocket 收到消息、无页面错误或失败请求；不是完整业务验收。
- 真实 Bilibili 下载、每条历史媒体播放和 AI 推理未测试。
