# 2026-10-04 流水线分析

基线提交 b2c782b，已有目录整理原样提交，19 个测试搬迁内容无变化。截图 output 未纳入。

技术栈：Python FastAPI/SQLite API、React/Vite/pnpm Web、VitePress 文档。业务核心继续在现有 API；CLI 为原生 Python HTTP 薄适配，不复制任务/笔记业务逻辑。

| 范围 | 本次覆盖与限制 |
|---|---|
| 检查 | health、格式选项、统一队列状态 |
| 任务 | 列表、详情、创建、暂停/取消/重试/删除；写操作默认预览 |
| 笔记 | 详情、状态、暂停/恢复/取消；真实 AI 生成需配置模型和任务，暂不计费测试 |
| 凭据 | 不暴露账号 cookie/config；沿用后端登录态和 bwvault，不读取密值到 argv |
| 容器 | 保留开发 Compose，增加构建期安装依赖的生产 Compose/镜像；API 持久化 runtime，Web 同源代理 |
| NAS | 按用户完整流水线要求部署既有 NAS；核对实际架构与服务，保留历史归档，迁入当前数据库副本并实际验证重启 |
| 独立性 | 目标项目 CLI/容器/Skill/验证文档自有，不引入总控运行依赖 |

完整 API、浏览器管理操作、账户生命周期、配置导入导出、所有媒体下载与 AI 模型覆盖不在第一版 CLI 完整覆盖声明中。

既有 scripts/smoke-refactor.sh --build 已通过，真实数据库、ASR 和 AI 运行态文件摘要未变化。
