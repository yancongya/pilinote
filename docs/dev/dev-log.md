# 开发日志

## 2026.04.12

### 文档完善：设置模块

- 更新 settings 模块文档结构，按 4 大类设置组织
- 更新 `docs/settings/README.md`：索引 4 项设置（download/storage/general/auto_download）+ 完整配置结构
- 更新 `docs/settings/storage.md`：增加存储设置配置项（路径、清理、sidecar、FTP）
- 更新 `docs/settings/backup.md`：标注 WebDAV 未实现，仅支持 FTP
- 新建 `docs/settings/download.md`：下载设置（视频质量、编码、并发、元数据）
- 新建 `docs/settings/general.md`：通用设置（主题、语言、剪贴板监控）
- 新建 `docs/settings/auto-download.md`：自动下载设置（扫描配置、收藏夹配置）

### 文档规范

- 修复 doc-workflow skill 添加 YAML 头格式
- 将 skill 复制到项目 `.agents/skills/` 目录

---

## 2026.04.12

### 修复：登录状态验证问题

- 修复 MainLayout 登录检查：使用 `isAuthenticated` 代替 `user?.sessdata`
- 修复 AuthGuardWrapper 登录检查：使用 `isAuthenticated` 代替 `user?.sessdata`
- 原因：后端 `/api/auth/status` 返回的 user 对象不包含 sessdata
- 修复后收藏夹和稍后再看页面正常显示内容

### 文档修正

- login-flow.md: 删除已停用的密码登录方式
- 原因：代码中已移除密码登录功能

### 文档完善

- 重建文档系统，按功能模块组织文档结构
- 备份旧文档至 `docs-backup/20260412/`
- 创建 doc-workflow skill 规范文档工作流
- 更新登录模块文档元数据（关联文档、涉及文件、依赖服务）
- 完善 login-flow.md：添加 API 端点详情、完整登录链路、错误码
- 完善 cookies.md：添加刷新流程详解、Cookie 表结构、HeadersManager 结构
- 更新 video-sources/watchlater.md：添加元数据
- 更新 database/models.md：添加 Cookie 模型和关联关系

## 历史记录

详见 `docs-backup/` 目录下的备份文档。

---

[返回上级](./README.md)