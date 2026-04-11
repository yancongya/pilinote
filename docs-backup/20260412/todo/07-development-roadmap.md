# 开发路线图

## Phase 1: 核心功能 (Week 1-2)
- [x] 搭建FastAPI后端框架
- [x] 搭建React前端框架
- [x] 实现SESSDATA认证
- [x] 集成yt-dlp基础下载
- [x] 实现SQLite数据库

## Phase 2: 视频源管理 (Week 3)
- [x] 实现收藏夹API
- [x] 实现稍后再看API
- [ ] 实现链接智能识别
- [x] 前端视频源页面

## Phase 3: 下载管理 (Week 4)
- [x] 集成yt-dlp基础下载
- [x] 实现SQLite数据库
- [x] 实现下载队列 (asyncio版本)
- [x] 实时进度更新
- [x] 前端下载管理页面
- [x] 链接智能解析（支持视频和课程）
- [x] 课程下载支持
- [x] 下载任务管理（开始、暂停、继续、取消）
- [x] 并发控制（最大3个任务）
- [x] 任务状态可视化
- [ ] 集成Celery + Redis (计划中)
- [ ] WebSocket进度推送 (计划中)

## Phase 4: 文件组织 (Week 5)
- [x] 元数据保存（NFO文件生成）
- [ ] 图像下载（封面、UP主头像）
- [ ] 字幕下载
- [ ] 弹幕下载（XML/ASS/SRT格式）
- [ ] 音轨提取
- [ ] 文件夹组织逻辑

## Phase 5: 部署优化 (Week 6)
- [ ] Docker Compose配置
- [ ] Caddy反向代理
- [ ] 环境变量管理
- [ ] 生产环境优化

## Phase 6: 桌面端 (Week 7-8)
- [ ] Electron基础框架
- [ ] 打包配置
- [ ] 跨平台测试
- [ ] 发布流程

## 已完成功能详情

### Phase 1 - 核心功能
- ✅ FastAPI后端框架搭建完成
- ✅ React + TypeScript + Tailwind CSS前端框架搭建完成
- ✅ 用户认证功能：
  - 扫码登录
  - SESSDATA登录
  - 密码登录（需验证码）
  - 手机验证码登录
- ✅ 用户状态管理（Zustand）
- ✅ 响应式设计（移动端优先）

### Phase 2 - 视频源管理
- ✅ 收藏夹API实现：
  - 获取收藏夹列表
  - 获取收藏夹详情（视频列表）
  - 支持分页和排序
- ✅ 收藏夹前端页面：
  - 收藏夹列表展示
  - 视频卡片展示（封面、标题、UP主、播放量等）
  - 无限滚动加载
  - 图片防盗链处理（代理API）
- ✅ 视频详情功能：
  - 视频基本信息（标题、封面、UP主、时长等）
  - 统计信息（播放量、弹幕数、评论数）
  - 分P信息展示
  - 视频简介（支持链接点击和文本选择）
  - 下载功能（支持多P选择）
- ✅ 稍后再看功能：
  - 稍后再看列表API
  - 子tab栏（全部/未看完切换）
  - 客户端分页（支持大量视频）
  - 观看进度显示（进度条和百分比）
  - 无限滚动加载（Intersection Observer）
  - 智能分页（移动端5条，桌面端10条）

### Phase 3 - 下载管理 (已完成)
- ✅ Download数据模型：
  - 支持多种状态管理
  - 进度追踪字段
  - B站特定字段
  - 元数据字段
  - 文件管理字段
  - 课程支持字段（season_id）
- ✅ DownloadManager异步下载管理器：
  - asyncio.Queue任务队列
  - 并发控制（最大3个同时下载）
  - 任务状态管理（8种状态）
  - 任务控制方法（start/pause/resume/cancel）
  - FIFO队列调度
- ✅ DownloadEngine下载引擎：
  - yt-dlp集成
  - 进度回调机制（下载进度、速度、ETA）
  - FFmpeg支持和格式转换
  - 错误处理和重试机制
- ✅ DownloadService异步下载服务：
  - asyncio异步下载
  - 进度回调机制
  - yt-dlp集成
  - 错误处理
  - 任务状态管理
- ✅ 下载API接口：
  - POST /api/download/start - 创建下载任务
  - POST /api/download/parse - 解析下载链接
  - GET /api/download/list - 获取下载列表
  - DELETE /api/download/{id} - 删除下载任务
  - POST /api/download/{id}/cancel - 取消下载
  - POST /api/download/{id}/retry - 重试失败任务
  - POST /api/download/{download_id}/start - 开始下载任务
  - POST /api/download/{download_id}/pause - 暂停下载任务
  - POST /api/download/{download_id}/resume - 继续下载任务
  - POST /api/download/{download_id}/cancel - 取消下载任务
  - GET /api/download/{download_id}/status - 获取任务状态
  - GET /api/download/manager/tasks - 获取所有任务
- ✅ 链接智能解析：
  - 支持B站视频链接（bvid/aid）
  - 支持课程链接（ss360格式）
  - 支持完整URL解析
  - 自动识别链接类型
- ✅ 课程下载支持：
  - 课程详情获取
  - 课程分集列表获取
  - 批量课程下载
  - 课程元数据保存
- ✅ App风格UI界面：
  - 两个Tab切换（视频列表/下载列表）
  - 系列视频分组
  - Material Design 3风格
  - 移动端响应式设计
- ✅ 下载管理功能：
  - 系列视频详情页
  - 实时进度更新（2秒间隔）
  - 任务控制（开始、暂停、继续、取消、删除）
  - 状态可视化（颜色标识）
  - 时长统计显示
  - 并发控制（最大3个任务）
  - 任务队列管理
  - 批量操作支持
- ⏳ Celery+Redis队列（计划中）
- ⏳ WebSocket实时推送（计划中）
  - 支持多种状态管理
  - 进度追踪字段
  - B站特定字段
  - 元数据字段
  - 文件管理字段
  - 课程支持字段（season_id）
- ✅ DownloadService异步下载服务：
  - asyncio异步下载
  - 进度回调机制
  - yt-dlp集成
  - 错误处理
  - 任务状态管理
- ✅ 下载API接口：
  - POST /api/download/start - 创建下载任务
  - POST /api/download/parse - 解析下载链接
  - GET /api/download/list - 获取下载列表
  - DELETE /api/download/{id} - 删除下载任务
  - POST /api/download/{id}/cancel - 取消下载
  - POST /api/download/{id}/retry - 重试失败任务
- ✅ 链接智能解析：
  - 支持B站视频链接（bvid/aid）
  - 支持课程链接（ss360格式）
  - 支持完整URL解析
  - 自动识别链接类型
- ✅ 课程下载支持：
  - 课程详情获取
  - 课程分集列表获取
  - 批量课程下载
  - 课程元数据保存
- ✅ App风格UI界面：
  - 两个Tab切换（视频列表/下载列表）
  - 系列视频分组
  - Material Design 3风格
  - 移动端响应式设计
- ✅ 下载管理功能：
  - 系列视频详情页
  - 实时进度更新（2秒间隔）
  - 任务控制（取消、重试、删除）
  - 状态可视化（颜色标识）
  - 时长统计显示
- ⏳ Celery+Redis队列（计划中）
- ⏳ WebSocket实时推送（计划中）

## 最近改进

### 下载管理系统完成 (2026-03-30)
- **DownloadManager异步下载管理器**:
  - 基于asyncio.Queue的任务队列实现
  - 支持最大3个并发下载任务的并发控制
  - 完整的任务状态管理（8种状态：pending/queued/downloading/paused/processing/completed/failed/cancelled）
  - FIFO队列调度机制
  - 任务控制方法：start（开始）、pause（暂停）、resume（继续）、cancel（取消）
  - 实时任务状态追踪和更新

- **DownloadEngine下载引擎**:
  - 完整的yt-dlp集成
  - 进度回调机制（下载进度、下载速度、剩余时间ETA）
  - FFmpeg支持和自动格式转换
  - 错误处理和自动重试机制
  - 支持多种视频质量和格式

- **任务管理API**:
  - POST /api/download/{download_id}/start - 开始下载任务
  - POST /api/download/{download_id}/pause - 暂停下载任务
  - POST /api/download/{download_id}/resume - 继续下载任务
  - POST /api/download/{download_id}/cancel - 取消下载任务
  - GET /api/download/{download_id}/status - 获取任务状态
  - GET /api/download/manager/tasks - 获取所有任务

- **前端状态管理增强**:
  - Zustand store添加任务控制方法
  - 实时进度更新（2秒间隔）
  - 统一的错误处理和状态更新
  - API服务层扩展（支持所有任务控制操作）

- **UI/UX优化**:
  - 使用VideoListCard组件统一卡片设计
  - 任务控制按钮（开始、删除）
  - 实时进度显示（进度条、速度、ETA）
  - 支持单个视频和系列视频显示
  - 状态筛选和搜索功能
  - 响应式设计（移动端优先）

- **Bug修复**:
  - 数据库模型添加'paused'状态支持
  - 前端过滤条件添加'paused'状态
  - 修复CSS语法错误（未闭合括号）
  - 添加条件渲染避免空src警告
  - 恢复VideoListCard组件，移除冲突样式

### 下载管理功能完善 (2026-03-30)
- **添加到列表功能**: 实现完整的"添加到列表"功能
  - 批量添加视频到下载列表
  - 智能识别视频类型（普通视频/多P视频/课程）
  - 添加后不会立即开始下载，用户可以手动控制
  - 自动保存视频元数据（封面、标题、UP主等）
- **系列管理优化**: 
  - 根据bvid自动分组显示系列视频
  - 使用B站API获取真实的系列名称
  - 显示系列的完成进度和总时长
  - 支持对整个系列进行批量操作
- **下载控制增强**:
  - 批量开始、批量删除功能
  - 单个任务开始、删除功能
  - 完整的状态管理（7种状态）
  - 实时进度更新（2秒间隔）
- **恢复功能**:
  - 支持删除单个或批量删除任务
  - 刷新功能可以恢复已删除的分P
  - 自动检测缺失的分P并提示恢复
  - 立即更新前端列表，提高响应速度
- **UI/UX优化**:
  - 下载详情页：显示系列名称、下载进度概览、分P列表
  - 操作按钮：全选/取消全选/反选/删除选中/刷新列表/开始全部下载
  - 单个任务操作：开始下载（绿色播放图标）、删除（红色垃圾桶图标）
  - 状态颜色：7种状态用不同颜色区分
  - 简化日志输出，仅保留错误日志

### 课堂功能重构 (2026-03-29)
- **重构原因**: B站没有公开的已购课程列表API，专门的课堂功能无法实现
- **重构内容**: 
  - 移除专门的课堂页面和导航tab
  - 删除课堂相关前端组件（ClassroomsContent.tsx）
  - 删除课堂相关后端路由（classrooms.py）
  - 保留课程链接解析和下载功能
- **保留功能**: 
  - 课程链接解析（支持ss360格式和完整URL）
  - 课程详情获取
  - 课程分集列表获取
  - 课程下载支持
- **用户影响**: 用户需要在首页手动输入课程链接来下载课程，无法浏览已购课程列表
- **技术优势**: 简化系统架构，专注于核心下载功能

### 缓存机制优化 (2026-03-29)
- **问题**: 切换Tab时缓存未验证，导致过期数据仍被使用
- **解决方案**: 移除isMounted ref限制，每次Tab切换都验证缓存有效期
- **实现**: Zustand + persist，5分钟自动过期
- **影响页面**: 收藏夹列表、稍后再看列表

### UI/UX交互优化 (2026-03-29)
- **悬浮效果优化**: 视频卡片添加平滑的cubic-bezier过渡动画
  - 悬浮时卡片上移2px
  - 阴影加深和颜色变化
  - 标题文字变为主题粉色
  - 进度条高度增加
- **移动端间距优化**: 
  - 移除home-content默认内边距
  - 减少section-header、video-list等容器的间距
  - 仅在桌面模式(>769px)添加24px内边距

### UI/UX设计系统升级 (2026-03-30)
- **设计系统**: 采用 Soft UI Evolution 设计风格
  - 改进的 Neumorphism 设计，提供更好的对比度和现代感
  - 符合 WCAG AA 可访问性标准（对比度 ≥ 4.5:1）
  - 150-300ms 的微交互动画
  - 从 375px 移动端到 1440px+ 桌面端的全设备适配
- **配色方案升级**:
  - Primary: #2563EB (专业蓝)
  - Secondary: #3B82F6 (明亮蓝)
  - Background: #F8FAFC (优雅浅灰)
  - Text: #1E293B (深灰黑)
- **登录页面优化**:
  - Tab 切换：200ms 淡入 + 横向位移动画
  - 输入框：焦点状态优化（蓝色边框 + 多层阴影）
  - 按钮：渐变背景 + 光泽动画效果
  - 内容区域：淡入动画（opacity + transform）
  - 错误提示：滑入动画，带警告图标
- **可访问性增强**:
  - 所有交互元素有清晰的焦点状态
  - 键盘导航完整支持
  - 屏幕阅读器标签正确
  - 支持减少运动偏好设置
- **性能优化**:
  - 使用 transform 和 opacity 实现高性能动画
  - 动画时长 ≤ 300ms
  - 避免 layout 重排
- **设计文档**: 创建 [12-ui-ux-design.md](12-ui-ux-design.md) 完整设计系统文档

### Bug修复 (2026-03-29)
- **侧栏隐藏问题**: 修复桌面模式下切换Tab后侧栏消失的问题
  - 原因: 侧栏使用条件渲染(activeTab === 'home')
  - 解决: 移除条件渲染，所有Tab都显示侧栏
- **API响应格式**: 修复收藏夹API返回格式不匹配问题
  - 添加data.medias包装结构
  - 添加page_size和info字段
- **视频详情页**: 移除观看次数和评论数组件，禁用简介文本选择和链接点击

### 图标库迁移 (2026-03-29)
- **技术升级**: 从手写SVG迁移到lucide-react图标库
  - 安装lucide-react 1.7.0
  - 替换所有手写SVG为React组件
  - 统一图标风格和设计语言
- **迁移范围**: 
  - 核心页面组件: HomePage, VideoDetailPage, LoginPage, DownloadSeriesDetailPage
  - 内容组件: VideoListCard, FavoritesContent, HomeContent, DownloadsContent
- **使用的图标**:
  - 导航: LogIn, Home, Heart, Clock, Download, ArrowLeft, ChevronLeft, ChevronRight
  - 功能: Film, Eye, MessageCircle, Folder, User, Plus, Check
  - 操作: X, RefreshCw, Trash, Loader2
- **优势提升**:
  - 代码简化: 从复杂SVG路径简化为组件调用
  - 类型安全: 完整TypeScript支持
  - 性能优化: tree-shaking支持，减少打包体积
  - 可维护性: 集中管理，易于更新

## 当前注意事项

### 前端注意事项
1. **移动端优先**：所有页面都采用移动端优先设计，同时兼容桌面端
2. **图片防盗链**：所有B站图片都需要通过后端代理API处理
3. **分页优化**：收藏夹视频列表采用智能分页（移动端5条，桌面端10条）
4. **响应式断点**：Mobile (< 640px), Tablet (640-1024px), Desktop (> 1024px)
5. **无限滚动**：使用Intersection Observer API实现，避免scroll事件监听
6. **客户端分页**：稍后再看采用客户端分页，一次性加载所有数据本地分页

### 后端注意事项
1. **API响应格式**：所有API都应返回统一格式 `{success, data, message}`
2. **错误处理**：B站API错误需要转换为友好的错误信息
3. **用户认证**：所有需要用户信息的API都需要SESSDATA参数
4. **图片代理**：需要维护专门的图片代理端点

### 性能优化
1. **缓存策略**：使用Zustand + persist实现前端缓存，收藏夹列表和稍后再看列表均支持5分钟缓存过期，切换Tab时自动验证缓存有效性
2. **懒加载**：视频列表采用无限滚动懒加载
3. **图片优化**：封面图片使用合适的尺寸和质量
4. **API去重**：避免重复请求相同数据
5. **Intersection Observer**：使用现代API替代scroll事件监听，减少性能开销
6. **客户端分页**：稍后再看采用客户端分页，减少API请求次数
7. **UI交互优化**：视频卡片采用cubic-bezier缓动函数实现流畅的悬浮交互效果

### 数据一致性
1. **用户状态**：使用Zustand管理全局用户状态
2. **数据同步**：收藏夹操作后需要同步更新本地状态
3. **错误恢复**：网络错误时提供重试机制

## 参考资源
- `reference/pilipala/` - 认证和API实现
- `reference/hermes/` - 架构和部署
- `reference/vidbee/` - Electron实现
- `reference/bilibili-downloader/` - 下载功能实现
- `reference/bilibili-favlist-auto-downloader/` - 收藏夹下载

## 技术栈
- **后端**: FastAPI + Python 3.11+ + SQLAlchemy + SQLite
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **认证**: B站扫码登录 + SESSDATA
- **下载**: yt-dlp (已集成)
- **部署**: Docker Compose（待实现）

## Phase 4 - 文件组织 (进行中)
### 已完成功能
- ✅ NFO元数据文件生成：
  - 自动生成包含完整视频信息的NFO文件
  - 支持B站互动评分计算（基于点赞、投币、收藏）
  - 生成符合Kodi/Jellyfin等媒体库标准的NFO格式
  - 支持视频标签、封面、UP主信息、时长等元数据
  - 从B站API获取视频描述和统计数据
  - 完整的统计数据（播放、点赞、投币、收藏、分享、弹幕、评论）

### NFO文件详细信息
- 基本信息：视频标题、描述、标签、封面URL
- UP主信息：UP主名称、MID
- 时间信息：发布日期、时长（秒）
- 统计数据：播放数、点赞数、投币数、收藏数、分享数、弹幕数、评论数
- 互动评分：基于点赞(0.4) + 投币(0.3) + 收藏(0.3)的加权计算
- B站自定义数据：完整的Bilibili_stat XML节点

### 待实现功能
- [ ] 图像下载（封面、UP主头像）
- [ ] 字幕下载
- [ ] 弹幕下载（XML/ASS/SRT格式）
- [ ] 音轨提取
- [ ] 文件夹组织逻辑
