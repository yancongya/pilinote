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
- [视频源](video-sources/) - 收藏夹、稍后再看
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