# 后续阶段：测试基线修复

本阶段只修复已复现的测试契约问题，不改生产 API、下载队列或 scheduler 行为。继续多 agents、全部 low、禁止 Astra、显式清单提交，不 push。

## 分工与检查点

1. 前端（6 Luna / low）：修复图文解析、MarkdownPreview、MarkdownEditor 中硬编码 localhost 的四项断言；保留完整 endpoint、编码参数与渲染断言。分别验证默认、localhost 和非本地 API 基址。
2. 后端（5.6 Sol / low）：修复临时目录 NFO 测试对 async 方法未 await 的调用；保留文件与内容断言，mock artwork，验证七项队列执行测试。审查发现设置服务导入会刷新真实 ASR singleton，增加模块替身 fixture，并在最终回归启动前设置临时运行目录。
3. 协调者：增加 API 基址优先级、localhost/IPv6/LAN、生产相对路径、图片编码及 WebSocket 配置独立测试，防止从配置构造预期 URL 掩盖基址规则回归。
4. 独立审查（6 Sol / low）：对照 645f515 检查测试是否保留原覆盖、mock 是否隔离、生产实现是否无变更；通过后分主题 commit 并同步记录。

验收：默认环境全前端单测通过，指定基址单测通过，TypeScript 检查及后端限定回归通过；边界脚本仍通过，原 staged 快照保持不变。

未纳入：pytest 全库配置/coverage、缺 libpq 的 PostgreSQL 插件、真实网络/模型/数据库/下载、完整浏览器集成、详情跨路由请求竞态。不得将本阶段全单测通过等同于上述验收。

当前检查点：完成。默认与 localhost 前端均 132 项、非本地基址 19 项、后端限定 35 项和边界扫描通过；类型与生产构建通过，6 Sol / low 独立审查无阻塞。按主题提交计划、前端、后端及验证记录。已有 ASR registry 差异未回滚或提交，隔离后的回归前后 ASR/AI runtime/数据库 SHA-256 不变；内容哈希是改动检测，不是全仓写入防护。
