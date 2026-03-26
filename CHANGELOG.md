# PiliNote 开发日志

## 项目初始化 (2026-03-26)

### 阶段 0: 项目规划
- [x] 需求分析和路线图设计
- [x] 架构图绘制 (pilinote_architecture.drawio)
- [x] 参考项目调研和克隆
- [x] 技术方案文档编写
- [x] 开发文档结构搭建

### 完成工作
1. 创建系统架构设计图，包含5个Phase：
   - Phase 1: 用户认证
   - Phase 2: 视频源获取
   - Phase 3: 下载管理
   - Phase 4: 文件组织
   - Phase 5: 部署方案

2. 参考项目克隆到 `reference/` 目录：
   - PiliPala (Flutter B站客户端)
   - Hermes (自托管视频下载器)
   - VidBee (Electron视频下载器)
   - bilibili-downloader (B站下载器)
   - bilibili-favlist-auto-downloader (收藏夹自动下载)

3. 创建开发文档 `docs/dev/`：
   - 技术方案
   - 认证方案
   - API列表
   - 下载引擎方案
   - 文件组织方案
   - 部署方案
   - 项目结构设计
   - 开发路线图
   - 参考项目索引

### 阶段 1: 前端Demo创建 (2026-03-26)
- [x] 搭建React + Vite + TypeScript前端框架
- [x] 配置Tailwind CSS样式
- [x] 创建基础UI组件
- [x] 实现登录页面（三种登录方式）
- [x] 实现主页面布局（桌面端 + 移动端导航）
- [x] 实现收藏夹页面（网格布局）
- [x] 实现稍后再看页面（列表布局）
- [x] 实现下载管理页面（统计卡片）
- [x] 配置响应式设计（手机优先，桌面兼容）

### 完成工作
1. 技术栈选择：React 19 + Vite 6 + TypeScript 5
2. 项目结构：apps/web/src/ (components, pages, layouts, utils, types)
3. 基础功能：
   - 三种登录方式UI（扫码、SESSDATA、密码）
   - 响应式布局（手机优先，< 640px, 640-1024px, > 1024px）
   - 页面路由和状态管理

### 阶段 2: UI/UX优化 (2026-03-26)
- [x] 安装Web Design Guidelines skill
- [x] 添加完整ARIA标签和可访问性支持
- [x] 优化颜色对比度和视觉设计
- [x] 改进移动端触摸目标（最小44x44px）
- [x] 添加加载和错误状态样式
- [x] 优化响应式断点和布局

### 完成工作
1. 可访问性优化：
   - ARIA标签（role, aria-label, aria-selected, aria-controls）
   - 语义化HTML（header, nav, main, section, article）
   - 键盘焦点支持（tabindex, focus-visible）
   - 屏幕阅读器友好

2. 视觉设计改进：
   - 颜色对比度优化（符合WCAG AA标准）
   - 更大的圆角（16px）和阴影效果
   - 改进的间距和字体大小
   - 平滑的过渡动画

3. 交互反馈增强：
   - hover/active/focus状态
   - 加载状态支持
   - 错误和成功状态样式
   - 平滑的动画效果

### 阶段 3: App风格界面 (2026-03-26)
- [x] 安装Ui Ux Pro Max skill
- [x] 添加App风格的底部导航栏（移动端）
- [x] 优化页面切换动画
- [x] 添加App风格的卡片和交互
- [x] 改进导航和状态栏
- [x] 添加手势支持和触摸反馈
- [x] 实现iOS安全区域适配

### 完成工作
1. App风格导航：
   - 桌面端：顶部标签导航 + 图标 + 文字标签
   - 移动端：底部导航栏 + 图标 + 文字标签
   - 页面切换动画（淡入淡出 + 轻微位移）

2. App风格设计元素：
   - 图标按钮（44x44px圆形按钮）
   - 刷新按钮（旋转动画图标）
   - 视频时长覆盖层（渐变背景 + 模糊效果）
   - 统计卡片（图标 + 数字 + 标签）
   - 下载按钮（图标 + 文字）

3. 原生App特性：
   - 全屏高度布局
   - 固定头部和底部导航
   - iOS安全区域支持（刘海屏适配）
   - 触摸优化（44px最小触摸目标）
   - 横屏模式适配
   - -webkit-overflow-scrolling（原生滚动）

4. 移动端优先体验：
   - 底部导航栏（< 768px显示）
   - 平板适配（769-1024px）
   - 大屏优化（> 1400px）
   - 触摸设备专用样式
   - 高对比度模式支持
   - 减少动画模式支持

### 技术栈总结
- **前端**: React 19 + Vite 6 + TypeScript 5
- **样式**: 原生CSS（无框架）
- **设计**: 移动优先，桌面兼容
- **可访问性**: 完整ARIA标签支持
- **响应式**: 3个断点（<640px, 640-2024px, >1024px）

### 阶段 4: 后端登录功能 (2026-03-26)
- [x] 搭建FastAPI后端框架
- [x] 实现B站扫码登录API
- [x] 实现B站SESSDATA登录API
- [x] 实现B站密码登录API
- [x] 创建SQLite数据库模型
- [x] 实现用户信息存储和管理
- [x] 配置CORS跨域支持

### 完成工作
1. 技术栈：
   - FastAPI 0.115.6 + Uvicorn 0.34.0
   - SQLAlchemy 2.0.36 + SQLite
   - Pydantic 2.10.4 + httpx 0.28.1
   - passlib 1.7.4 (密码加密)

2. 项目结构：
   - apps/api/src/
     - config.py (配置管理)
     - database.py (数据库连接)
     - models/ (数据模型)
     - schemas/ (Pydantic模式)
     - routers/ (API路由)
     - services/ (业务逻辑)

3. API端点：
   - GET /api/auth/qrcode - 获取登录二维码
   - GET /api/auth/qrcode/status/{qrcode_key} - 查询二维码状态
   - POST /api/auth/sessdata - SESSDATA登录
   - POST /api/auth/password - 密码登录
   - GET /api/auth/user-info - 获取用户信息

### 阶段 5: 前后端集成 (2026-03-26)
- [x] 创建前端API服务层
- [x] 实现用户状态管理 (Zustand)
- [x] 集成扫码登录流程
- [x] 集成SESSDATA登录流程
- [x] 集成密码登录流程
- [x] 修复二维码显示问题
- [x] 修复扫码登录状态轮询问题

### 完成工作
1. 前端服务层：
   - apps/web/src/services/api.ts
   - 统一API调用接口
   - 错误处理和响应格式化

2. 状态管理：
   - apps/web/src/stores/auth.ts
   - 使用Zustand管理用户状态
   - 本地持久化存储（localStorage）

3. 问题修复：
   - **二维码显示问题**：B站API返回的URL不是图片，使用qrcode.react库生成二维码
   - **扫码登录过期问题**：后端返回数据缺少code字段，前端无法识别登录成功状态
   - **数据结构不匹配**：统一前后端API响应格式，确保包含必要的状态码

### 技术栈总结
- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端状态**: Zustand + localStorage
- **API通信**: RESTful + JSON
- **二维码生成**: qrcode.react
- **认证方式**: 扫码 + SESSDATA + 密码

### 下一阶段计划
- [ ] Phase 3: 视频源管理
  - 实现收藏夹API
  - 实现稍后再看API
  - 实现链接智能识别
  - 前端视频源页面

---

## 待记录...