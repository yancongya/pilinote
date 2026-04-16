# PiliNote 文档中心

## 文档索引

### 架构文档
- [系统架构](architecture/system.md) - 整体架构、技术栈、模块结构

### 基础文档
- [技术栈](base/tech-stack.md) - 技术选型
- [参考项目](base/reference-projects.md) - 参考项目

### 实现文档
- [前端实现](web/implementation.md) - React 组件、状态管理、API服务
- [后端实现](api/implementation.md) - FastAPI路由、Services、数据模型

### 功能模块
- [认证功能](auth/) - 登录、Cookies、刷新、多账号
- [视频源](video-sources/) - 收藏夹、稍后再看、观看历史
- [下载系统](download/) - 队列、任务、调度器
- [评论数据提取](download/comment-extraction.md) - B站评论数据提取和NFO存储
- [设置管理](settings/) - 存储、备份

### 数据层
- [数据库设计](database/) - 数据模型、API Schema
- [元数据系统](metadata/) - NFO文件格式、评分算法、标签系统

### 接口文档
- [API 端点](api/) - 后端接口列表

### 组件文档
- [组件](components/) - 前后端共用组件

### 开发笔记
- [开发日志](dev/dev-log.md) - 开发记录
- [文档完善指南](dev/roadmap.md) - 完善文档步骤

## 最新更新

### 2026-04-17 - 观看历史功能上线

#### 功能特性
- **B站观看历史**：自动同步用户在B站的观看历史记录
- **分页加载**：支持无限滚动，每页20条记录
- **搜索功能**：支持按视频标题搜索
- **多种排序**：支持按默认、播放量、发布时间、观看时间排序
- **排序方向**：支持升序和降序切换
- **观看进度**：显示视频观看进度百分比
- **下载集成**：完整集成新下载系统，支持一键下载
- **下载状态**：实时显示视频下载状态（未下载、队列中、已下载）

#### 后端实现
- **API端点**：`GET /api/history/list`
- **数据源**：B站 API `/x/v2/history`
- **数据转换**：使用 `MediaDataTransformer` 统一转换数据格式
- **搜索和排序**：客户端实现，支持关键词搜索和多维度排序
- **认证**：使用 Cookie 中的 SESSDATA 进行身份验证

#### 前端实现
- **HistoryContent 组件**：观看历史页面的主要组件
- **VideoListContainer**：统一的视频列表容器
- **VideoListControls**：搜索和排序控制
- **下载管理**：集成 useNewQueueStore 和 useVideoDownload
- **数据格式化**：使用 videoFormatters 工具函数
- **无限滚动**：使用 useVideoList Hook 实现

#### 测试覆盖
- **API端点测试**：验证端点存在性和响应格式
- **功能测试**：验证分页、搜索、排序功能
- **前端UI测试**：验证页面访问和导航
- **数据转换测试**：验证数据格式正确性
- **性能测试**：验证API响应时间和页面加载时间
- **错误处理测试**：验证无效参数和错误情况处理

#### 文档完善
- 新增观看历史 API 文档 (`docs/api/history-api.md`)
- 更新组件文档，添加 HistoryContent 组件说明
- 更新主文档索引，添加观看历史功能引用
- 更新 API 端点索引，添加观看历史 API

#### 相关文件
- **后端**：`apps/api/src/routers/history.py`
- **前端**：`apps/web/src/pages/components/HistoryContent.tsx`
- **数据转换**：`apps/api/src/services/media_data_transformer.py`
- **测试**：`tests/history.spec.ts`
- **文档**：`docs/api/history-api.md`

### 2026-04-16 - 下载系统整合优化完成

#### 统一队列系统
- 将分散的下载功能整合到统一的队列系统中
- 四级队列系统（BACKLOG → PENDING → DOING → COMPLETE）
- 并发控制（默认最大3个并发下载）
- 完善的任务调度和管理

#### 实时进度推送
- 使用WebSocket推送下载进度，替代轮询机制
- 减少90%的API请求
- 实时进度更新，用户体验更流畅
- 自动重连机制，保证连接稳定性

#### 前端状态管理优化
- 使用Zustand进行状态管理
- 支持离线浏览（persist中间件）
- 统一的错误处理和重试机制
- 详细的下载信息（进度、速度、ETA等）

#### 下载历史记录
- 完整的下载历史记录功能
- 支持按状态筛选
- 支持批量操作
- 历史记录持久化存储

#### 错误处理和重试机制
- 详细的错误分类和错误信息
- 自动重试机制（最多3次）
- 智能重试策略
- 错误提示和恢复建议

#### API变更
- 废弃旧的下载API (`/api/download/*`)
- 新增下载队列API (`/api/queue/*`)
- 新增下载列表API (`/api/downloads/*`)
- WebSocket实时进度推送 (`ws://localhost:8000/ws/downloads`)

#### 文档完善
- 新增下载系统整合优化文档
- 更新API端点文档
- 更新后端架构文档
- 更新下载系统文档
- 添加迁移指南

**重要提示**：旧的下载API已废弃，请使用新的下载系统

### 2026-04-15 - 前端重构完成

#### 智能响应式侧边栏系统
- 实现基于屏幕尺寸的自动切换（侧边栏/底部导航）
- 拖拽调整侧边栏宽度功能（180px-400px）
- 智能收缩机制（200px阈值自动折叠）
- 固定高度布局，独立滚动区域
- 双重折叠触发方式（点击按钮/拖拽调整）

#### 主题系统优化
- 修复硬编码颜色问题
- 完善主题切换功能
- 全站统一的CSS变量系统
- 新下载页面完整暗色模式适配（249个硬编码颜色修复）

#### 文档完善
- 添加新下载页面组件文档
- 更新主题系统文档
- 完善组件索引

#### 响应式布局增强
- 视频列表响应式网格布局（1-4列自适应）
- 移动端优先的交互设计
- 桌面端优化体验

#### 文档完善
- 更新MainLayout组件文档
- 完善主题系统文档
- 添加前端实现文档索引

---

## 快速开始

### 启动后端

```bash
cd apps/api
source venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 启动前端

```bash
cd apps/web
pnpm install
pnpm dev
```

### 登录方式

1. **SESSDATA 登录** - 在 Bilibili 页面F12获取 SESSDATA
2. **二维码登录** - 扫描二维码
3. **手机验证码登录** - 需要验证码

### 下载流程

1. 访问收藏夹或稍后再看
2. 选择视频质量
3. 添加到下载队列
4. 开始下载

---

> 旧文档备份至 `docs-backup/`