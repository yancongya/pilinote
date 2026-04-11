# 文档完善指南

本文档指导如何逐步完善项目文档。

## 当前状态

文档框架已建立，部分内容待补充。

---

## 待完善任务

### 1. 认证模块 (auth/)

**优先级**: 高

- [ ] **login-flow.md** - 补充各登录方式的具体 API 参数和返回值
- [ ] **cookies.md** - 补充 Cookie 刷新逻辑细节
- [ ] **wbi-sign.md** - 补充 WBI 签名完整实现代码
- [ ] **multi-account.md** - 补充账号切换的完整流程

### 2. 视频源模块 (video-sources/)

**优先级**: 高

- [ ] **favorites.md** - 补充收藏夹数据转换细节
- [ ] **watchlater.md** - 补充稍后再看数据结构

### 3. 下载模块 (download/)

**优先级**: 高

- [ ] **queue.md** - 补充 WebSocket 事件详情
- [ ] **tasks.md** - 补充任务执行细节
- [ ] **scheduler.md** - 补充定时扫描逻辑
- [ ] **handlers.md** - 补充各处理器实现细节

### 4. 设置模块 (settings/)

**优先级**: 中

- [ ] **storage.md** - 补充存储路径处理逻辑
- [ ] **backup.md** - 补充 FTP/WebDAV 实现细节

### 5. 数据库模块 (database/)

**优先级**: 中

- [ ] **models.md** - 补充所有数据模型完整字段
- [ ] **schemas.md** - 补充所有 Schema 定义

### 6. API 模块 (api/)

**优先级**: 中

- [ ] **endpoints.md** - 补充请求/响应示例

### 7. 基础模块 (base/)

**优先级**: 低

- [ ] **tech-stack.md** - 添加版本更新记录
- [ ] **reference-projects.md** - 可选

---

## 完善步骤

### 步骤1: 补充认证模块

建议从最重要的认证模块开始：

1. 阅读 `apps/api/src/routers/auth.py` 补充登录 API
2. 阅读 `apps/api/src/services/headers_manager.py` 补充 Cookies 管理
3. 整理登录流程并更新到文档

### 步骤2: 补充视频源模块

1. 阅读 `apps/api/src/routers/favorites.py` 补充收藏夹 API
2. 阅读 `apps/api/src/routers/watchlater.py` 补充稍后再看 API
3. 阅读 `apps/api/src/services/media_data_transformer.py` 补充数据转换

### 步骤3: 补充下载模块

1. 阅读 `apps/api/src/routers/queue.py` 补充队列 API
2. 阅读 `apps/api/src/services/queue/` 补充任务实现
3. 阅读 `apps/api/src/services/queue/handlers/` 补充处理器

### 步骤4: 补充设置模块

1. 阅读 `apps/api/src/routers/settings.py` 补充设置 API

### 步骤5: 验证和测试

1. 运行前端 `pnpm dev`
2. 运行后端 `uvicorn apps/api/src.main:app`
3. 验证文档中的 API 与实际一致

---

## 文档规范

- 使用中文标题和中文标点
- 代码使用英文变量名
- 保持标题层级清晰
- 每个文档包含 `[返回上级](./README.md)` 链接

---

## 更新日志

- 2026.04.12: 创建本文档