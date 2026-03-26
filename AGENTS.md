# PiliNote - 项目上下文

## 项目概述

**PiliNote** 是一个专为哔哩哔哩（B站）设计的视频下载管理系统，支持Web、Docker和桌面端多种部署方式。项目采用现代化的技术栈，旨在提供高效、可靠的视频下载和管理体验。

### 核心功能
- **用户认证**: 支持扫码登录、SESSDATA、密码登录三种方式
- **视频源获取**: 收藏夹管理、稍后再看、智能链接解析
- **下载管理**: 异步任务队列、实时进度、断点续传
- **文件组织**: 自动分类、字幕/弹幕下载、元数据管理

### 开发状态
- **当前阶段**: 项目规划完成（阶段0）
- **下一阶段**: 核心功能搭建（阶段1）
- **开发周期**: 8周

## 技术架构

### 后端技术栈
- **语言**: Python 3.11+
- **Web框架**: FastAPI 0.104+
- **下载引擎**: yt-dlp
- **ORM**: SQLAlchemy 2.0+
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **任务队列**: Celery 5.3+ + Redis 7.0+
- **数据验证**: Pydantic v2

### 前端技术栈
- **框架**: React 18+
- **构建工具**: Vite 5.0+
- **语言**: TypeScript 5.0+
- **样式**: Tailwind CSS 3.4+ / shadcn/ui
- **状态管理**: TanStack Query / Zustand
- **路由**: React Router v6

### 桌面端技术栈
- **框架**: Electron 28+
- **构建工具**: electron-builder
- **支持平台**: Windows, macOS, Linux

### 部署方案
- **Web部署**: 响应式Web应用
- **Docker部署**: 容器化部署 + Docker Compose
- **桌面端**: Electron跨平台应用

## 项目结构

```
pilinote/
├── docs/dev/              # 开发文档
│   ├── 00-tech-stack.md          # 技术栈方案
│   ├── 01-auth-solution.md       # 用户认证方案
│   ├── 02-api-list.md            # B站API列表
│   ├── 03-download-engine.md     # 下载引擎方案
│   ├── 04-file-organization.md   # 文件组织方案
│   ├── 05-deployment.md          # 部署方案
│   ├── 06-project-structure.md   # 项目结构
│   ├── 07-development-roadmap.md # 开发路线图
│   ├── 08-reference-projects.md  # 参考项目索引
│   └── README.md                 # 文档索引
├── reference/             # 参考项目（已克隆）
│   ├── pilipala/                 # Flutter B站客户端（认证和API实现）
│   ├── hermes/                   # 自托管视频下载器（架构和部署）
│   ├── vidbee/                   # Electron视频下载器（桌面端实现）
│   ├── bilibili-downloader/      # B站下载器（下载实现）
│   └── bilibili-favlist-auto-downloader/ # 收藏夹自动下载
├── docs/dev/              # 开发文档
│   └── pilinote_architecture.drawio  # 系统架构设计图
├── CHANGELOG.md           # 开发日志
└── .gitignore             # Git忽略规则
```

## 项目需求

### 功能需求

#### 核心功能
1. **用户认证**
   - 扫码登录
   - SESSDATA登录
   - 密码登录
   - 多账号管理

2. **视频源获取**
   - 收藏夹管理
   - 稍后再看
   - 链接解析

3. **下载管理**
   - 下载队列
   - 进度显示
   - 任务控制
   - 断点续传

4. **文件组织**
   - 自动分类
   - 字幕/弹幕下载
   - 元数据保存

#### 非功能需求
1. **性能**
   - 异步下载
   - 并行处理
   - 实时进度

2. **可靠性**
   - 错误重试
   - 状态持久化
   - 日志记录

3. **可扩展性**
   - 模块化设计
   - 插件机制
   - API开放

### 项目约束

#### 时间约束
- 开发周期: 8周
- 按阶段交付

#### 资源约束
- 开发环境: macOS
- 测试环境: Docker
- 生产环境: 云服务器

#### 技术约束
- 后端: Python 3.11+
- 前端: React 18+
- 桌面端: Electron 28+
- 数据库: SQLite/PostgreSQL

## 开发原则

### 核心原则
1. **避免重复造轮子** - 优先使用成熟方案
2. **参考现有项目** - 从reference/目录索引实现
3. **模块化设计** - 保持高内聚低耦合
4. **渐进式开发** - 按路线图逐步实现

### UI/UX要求
- **手机模式优先**: 移动端响应式设计，触摸友好
- **电脑宽屏兼容**: 桌面端适配，大屏幕利用
- **响应式断点**: Mobile (< 640px), Tablet (640-1024px), Desktop (> 1024px)

### 开发优先级
1. **Web端优先开发** - 完成Web版所有功能
2. **作为桌面端基础** - 便于测试和调试

## 参考项目使用指南

### 认证功能实现
**参考项目**: `reference/pilipala/`
**关键文件**:
- `lib/http/login.dart` - 登录实现（扫码、密码、SESSDATA）
- `lib/http/user.dart` - 用户API
- `lib/http/api.dart` - API定义
- `lib/utils/login.dart` - 登录工具

**适用场景**:
- 实现B站认证流程
- Cookie管理机制
- B站API调用

### 架构和部署
**参考项目**: `reference/hermes/`
**关键文件**:
- `packages/hermes-api/` - 后端实现
- `packages/hermes-app/` - 前端实现
- `docker-compose.yml` - 部署配置
- `Caddyfile` - 反向代理

**适用场景**:
- 前后端分离架构
- Celery任务队列
- WebSocket实时通信
- Docker部署方案

### 桌面端实现
**参考项目**: `reference/vidbee/`
**关键文件**:
- `apps/desktop/` - 桌面端
- `apps/api/` - API服务
- `apps/web/` - Web前端

**适用场景**:
- Electron打包
- 跨平台支持
- UI/UX设计

### 下载功能实现
**参考项目**: `reference/bilibili-downloader/`
**关键文件**:
- `src/main_app.py` - 主程序
- `requirements.txt` - 依赖

**适用场景**:
- yt-dlp集成
- FFmpeg视频处理
- 下载队列管理

## 开发路线图

### Phase 1: 核心功能 (Week 1-2)
- [ ] 搭建FastAPI后端框架
- [ ] 搭建React前端框架
- [ ] 实现SESSDATA认证
- [ ] 集成yt-dlp基础下载
- [ ] 实现SQLite数据库

### Phase 2: 视频源管理 (Week 3)
- [ ] 实现收藏夹API
- [ ] 实现稍后再看API
- [ ] 实现链接智能识别
- [ ] 前端视频源页面

### Phase 3: 下载管理 (Week 4)
- [ ] 集成Celery + Redis
- [ ] 实现下载队列
- [ ] WebSocket进度推送
- [ ] 前端下载管理页面

### Phase 4: 文件组织 (Week 5)
- [ ] 自动下载字幕/弹幕
- [ ] 音轨提取
- [ ] 元数据保存
- [ ] 文件夹组织逻辑

### Phase 5: 部署优化 (Week 6)
- [ ] Docker Compose配置
- [ ] Caddy反向代理
- [ ] 环境变量管理
- [ ] 生产环境优化

### Phase 6: 桌面端 (Week 7-8)
- [ ] Electron基础框架
- [ ] 打包配置
- [ ] 跨平台测试
- [ ] 发布流程

## 关键B站API

### 认证相关
- 获取二维码: `/x/passport-login/web/qrcode/generate`
- 轮询登录状态: `/x/passport-login/web/qrcode/poll`
- 获取加密key: `/x/passport-login/web/key`
- 密码登录: `/x/passport-login/web/login`

### 收藏夹相关
- 获取收藏夹列表: `/x/v3/fav/folder/created/list`
- 获取收藏夹详情: `/x/v3/fav/resource/list`

### 稍后再看
- 获取列表: `/x/v2/history/toview`

### 视频信息
- 视频详情: `/x/web-interface/view`
- 视频播放地址: `/x/player/wbi/playurl`

## 开发规范

### 代码规范
- **Python**: PEP 8
- **TypeScript**: ESLint + Prettier
- **提交信息**: Conventional Commits

### Git工作流
- **main**: 生产分支
- **develop**: 开发分支
- **feature/***: 功能分支

### 测试要求
- 单元测试
- 集成测试
- E2E测试

## 环境信息

### 开发环境
- **操作系统**: macOS (Darwin 25.2.0)
- **开发工具**: 已安装 ffmpeg
- **版本控制**: Git 2.50.1

### 技术约束
- 后端: Python 3.11+
- 前端: React 18+
- 桌面端: Electron 28+
- 数据库: SQLite/PostgreSQL

## 重要文档

- [开发文档索引](docs/dev/README.md) - 完整开发文档
- [系统架构图](docs/dev/pilinote_architecture.drawio) - 可视化架构设计
- [开发日志](CHANGELOG.md) - 开发进度记录
- [参考项目索引](docs/dev/08-reference-projects.md) - 参考项目详情

## 快速开始

1. 查阅 [00-tech-stack.md](docs/dev/00-tech-stack.md) 了解技术栈
2. 查看 [07-development-roadmap.md](docs/dev/07-development-roadmap.md) 了解开发计划
3. 参考 [08-reference-projects.md](docs/dev/08-reference-projects.md) 查找具体实现

## 注意事项

- 所有参考项目已克隆到 `reference/` 目录，开发时优先查阅
- 避免重复造轮子，充分利用成熟方案
- UI布局优先适配手机模式，同时兼容电脑宽屏
- Web端优先开发，作为桌面端的基础
- 按8周路线图分阶段交付