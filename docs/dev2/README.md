# PiliNote 开发文档 (整理版)

## 文档结构

本目录包含PiliNote项目的开发文档，按功能模块和开发阶段组织。

### 架构设计
- **[architecture/project-structure.md](architecture/project-structure.md)** - 项目结构设计
  - MVC架构设计
  - 目录结构说明
  - 模块划分

- **[architecture/mvc-architecture.md](architecture/mvc-architecture.md)** - MVC架构详细设计
  - 分层架构图
  - 数据流向
  - 设计原则

- **[architecture/system-architecture.drawio](architecture/system-architecture.drawio)** - 系统架构设计图

### 功能模块

#### 认证功能
- **[features/authentication/auth-solution.md](features/authentication/auth-solution.md)** - 用户认证方案
  - 扫码登录、短信登录、SESSDATA登录
  - Cookie管理机制
  - 前端实现细节

- **[features/authentication/api-auth.md](features/authentication/api-auth.md)** - 认证API文档
  - B站认证API列表
  - API响应格式
  - 错误处理

#### 下载功能
- **[features/download/download-engine.md](features/download/download-engine.md)** - 下载引擎方案
  - yt-dlp集成
  - 任务管理
  - 画质支持

- **[features/download/download-management.md](features/download/download-management.md)** - 下载管理功能
  - 下载队列管理
  - 系列视频处理
  - 恢复功能

- **[features/download/download-settings.md](features/download/download-settings.md)** - 下载设置
  - 分辨率、音频码率、编码格式
  - 存储设置
  - 缓存管理

#### 视频源功能
- **[features/video-source/video-api.md](features/video-source/video-api.md)** - 视频相关API
  - 收藏夹API
  - 稍后再看API
  - 视频详情API
  - HTML解析方法

#### UI设计
- **[features/ui-design/ui-ux-design.md](features/ui-design/ui-ux-design.md)** - UI/UX设计系统
  - Soft UI Evolution设计风格
  - 配色方案、字体系统
  - 组件设计规范
  - 响应式设计

### 实现细节
- **[implementation/html-parsing.md](implementation/html-parsing.md)** - HTML解析方法详解
  - 绕过B站API限制
  - 数据提取流程
  - 性能优化

- **[implementation/bilitools-reference.md](implementation/bilitools-reference.md)** - BiliTools设置参考
  - 设置数据结构
  - 数据管理方式
  - 应用建议

### 部署方案
- **[deployment/deployment.md](deployment/deployment.md)** - 部署方案
  - Web部署、Docker部署、桌面端部署
  - 开发环境配置
  - 配置管理

### 参考项目
- **[reference/reference-projects.md](reference/reference-projects.md)** - 参考项目索引
  - PiliPala (Flutter B站客户端)
  - Hermes (自托管视频下载器)
  - VidBee (Electron视频下载器)
  - bilibili-downloader

### 技术栈
- **[tech-stack/tech-stack.md](tech-stack/tech-stack.md)** - 技术栈方案
  - 后端技术栈
  - 前端技术栈
  - 桌面端技术栈
  - 部署技术栈

## 开发原则
1. **避免重复造轮子** - 优先使用成熟方案
2. **参考现有项目** - 从reference/目录索引实现
3. **模块化设计** - 保持高内聚低耦合
4. **渐进式开发** - 按路线图逐步实现

## 快速开始
1. 查阅 [tech-stack/tech-stack.md](tech-stack/tech-stack.md) 了解技术栈
2. 查看 [architecture/project-structure.md](architecture/project-structure.md) 了解项目结构
3. 参考 [reference/reference-projects.md](reference/reference-projects.md) 查找具体实现
4. 查看 [deployment/deployment.md](deployment/deployment.md) 了解环境配置和启动方法

## 文档维护
- 文档按功能模块组织，避免数字编号
- 重要更新记录在CHANGELOG.md中
- 已实现功能文档在dev目录，待实现功能在todo目录

## 注意事项
- 所有参考项目已克隆到 `reference/` 目录，开发时优先查阅
- 避免重复造轮子，充分利用成熟方案
- UI布局优先适配手机模式，同时兼容电脑宽屏
- Web端优先开发，作为桌面端的基础