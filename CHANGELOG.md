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

### 阶段 6: 登录界面优化 (2026-03-26)
- [x] 修复头像403问题（创建头像代理API）
- [x] 实现手机验证码登录（后端API实现）
- [x] 简化登录选项（保留扫码和SESSDATA两种方式）
- [x] 优化tab切换效果（左右切换 + 固定容器高度）
- [x] 修复移动端tab布局（保持横向排列）
- [x] 清理未使用的CSS样式

### 完成工作
1. 功能改进：
   - **头像代理API**：创建 `/api/auth/proxy/avatar` 接口解决B站图片防盗链403问题
   - **手机验证码登录**：实现短信发送和验证登录API（B站限制：需要CAPTCHA验证码）
   - **登录方式简化**：移除密码登录和短信登录，保留扫码和SESSDATA两种可靠方式

2. UI/UX优化：
   - **App风格tab切换**：左右横向tab按钮，固定容器高度（桌面400px，移动360px）
   - **绝对定位布局**：qrcode-section和sessdata-section使用绝对定位在固定容器内显示
   - **错误消息固定显示**：error-message绝对定位在容器底部
   - **移动端横向布局**：删除 `flex-direction: column`，确保移动端tab按钮也横向排列

3. 代码清理：
   - 删除未使用的样式定义（.sms-input-group, .send-sms-btn等）
   - 删除重复的样式定义
   - 移除未使用的状态变量和事件处理器

4. 技术实现：
   - 头像代理使用httpx获取图片并设置正确的Referer和User-Agent
   - 二维码生成使用qrcode.react的QRCodeSVG组件
   - 状态轮询使用setInterval实现2秒间隔查询
   - 错误提示使用友好的中英文双语消息

### 遇到的问题和解决方案

**问题1：头像403 Forbidden**
- 原因：B站图片有防盗链保护，直接访问返回403
- 解决：创建头像代理API，后端代理请求并返回图片数据，设置正确的Referer和User-Agent

**问题2：手机验证码登录400错误**
- 原因：B站要求Geetest CAPTCHA验证码才能发送短信
- 解决：返回详细的错误响应，包含error_type和hint字段，引导用户使用其他登录方式

**问题3：JSX语法错误**
- 原因：error div的缩进不正确，导致JSX结构混乱
- 解决：修正缩进，确保标签正确嵌套

**问题4：tab布局在移动端变为垂直**
- 原因：CSS媒体查询中设置了 `flex-direction: column`
- 解决：删除该属性，保持tab按钮在所有设备上都是横向排列

### 阶段 7: 首页功能实现 (2026-03-26)
- [x] 添加首页tab到导航栏
- [x] 实现URL输入框和添加功能
- [x] 实现URL列表显示和删除功能
- [x] 优化首页布局（居中显示，无标题）
- [x] 完成移动端响应式适配

### 完成工作
1. 功能实现：
   - **首页tab**：在顶部导航栏和底部导航栏都添加了首页tab作为默认tab
   - **URL输入框**：用户可以粘贴B站视频链接，支持Enter键提交
   - **URL列表**：显示已添加的链接，可以点击删除按钮移除
   - **计数显示**：实时显示待处理视频的数量

2. UI/UX优化：
   - **居中布局**：搜索框和添加按钮居中显示，最大宽度800px
   - **无标题设计**：去掉"首页"标题，保持简洁
   - **居中对齐**：输入框和列表都采用居中对齐方式
   - **响应式设计**：移动端自动适应屏幕宽度

3. 交互设计：
   - **Enter键支持**：在输入框按Enter键可以添加链接
   - **禁用状态**：输入为空时添加按钮禁用
   - **悬停效果**：URL列表项和删除按钮有悬停效果
   - **平滑动画**：保持tab切换的平滑动画效果

4. 技术实现：
   - 使用React state管理URL列表状态
   - 使用flex布局实现居中对齐
   - 使用max-width限制最大宽度并保持居中
   - 完整的移动端媒体查询适配

### 下一阶段计划
- [ ] Phase 3: 视频源管理
  - 实现收藏夹API
  - 实现稍后再看API
  - 实现链接智能识别
  - 前端视频源页面

### 阶段 8: 收藏页面重构 (2026-03-26)
- [x] 移除子Tab栏（视频、追番、课堂）
- [x] 重新设计收藏夹列表为水平布局
- [x] 实现收藏夹详情页面（视频列表）
- [x] 固定为亮色模式，使用pilipala默认绿色主题
- [x] 优化布局（左侧封面和右侧信息等高）
- [x] 简化顶部组件（只保留标题和数量）
- [x] 优化返回按钮（在标题左侧，整行可点击）

### 完成工作
1. 布局重构：
   - **移除子Tab栏**：删除顶部可拖拽的子Tab栏，直接显示收藏夹列表
   - **水平布局**：收藏夹项和视频项都采用水平布局（左侧16:9封面 + 右侧信息）
   - **等高设计**：左侧封面和右侧信息完全等高，使用align-items: stretch
   - **返回按钮优化**：返回按钮在标题左侧，整行可点击返回

2. 视觉设计：
   - **绿色主题**：使用pilipala默认绿色（#5CB67B）作为主色调
   - **亮色模式**：固定为亮色模式，移除暗色模式切换
   - **渐变背景**：封面使用绿色渐变背景（#5CB67B → #4A9F6D）
   - **简洁设计**：移除编辑/删除按钮和播放全部按钮

3. 收藏夹列表：
   - 显示收藏夹名称、内容数量、UP主、公开/私密状态
   - 点击进入收藏夹详情页
   - 完整的响应式设计支持

4. 收藏夹详情页：
   - 显示收藏夹名称和视频数量
   - 返回按钮在标题左侧
   - 视频列表显示：封面、标题（2行）、收藏时间、UP主、播放量
   - 取消收藏按钮（悬停显示）
   - 整行可点击返回

5. 技术实现：
   - 使用React state管理选中收藏夹状态
   - 条件渲染收藏夹列表和视频列表
   - CSS Grid和Flexbox混合布局
   - 完整的移动端响应式适配

### 参考设计
- PiliPala（Flutter B站客户端）的收藏夹页面设计
- 水平卡片布局（封面 + 信息）
- 16:9封面比例
- 绿色主题色

- 绿色主题色

### 阶段 9: Tab页面解耦 (2026-03-26)
- [x] 创建独立的tab组件文件
- [x] 提取首页内容到HomeContent组件
- [x] 提取收藏内容到FavoritesContent组件
- [x] 提取稍后再看内容到WatchLaterContent组件
- [x] 提取下载管理内容到DownloadsContent组件
- [x] 简化HomePage.tsx，只保留导航和tab切换逻辑
- [x] 每个tab独立管理自己的状态

### 完成工作
1. 组件拆分：
   - 创建 `apps/web/src/pages/components/` 目录
   - 拆分为4个独立组件：
     - HomeContent.tsx（URL输入框和列表）
     - FavoritesContent.tsx（收藏夹和视频列表）
     - WatchLaterContent.tsx（稍后再看页面）
     - DownloadsContent.tsx（下载管理页面）

2. 状态管理：
   - 每个组件独立管理自己的状态
   - HomePage只负责tab切换逻辑
   - 提高代码可维护性和可读性

3. 文件结构优化：
   - HomePage.tsx: 从506行减少到200行左右
   - 清晰的职责分离
   - 更容易扩展和维护

### 阶段 10: 修复解耦后丢失功能 (2026-03-26)
- [x] 修复用户头像显示问题
- [x] 修复用户名显示问题（name改为username）
- [x] 修复退出确认功能
- [x] 修复视频封面比例（16:9）
- [x] 修复封面布局（封面和信息等高）

### 完成工作
1. 功能恢复：
   - 恢复`getAvatarUrl`函数，使用localhost:8000代理API
   - 修复用户名字段（从name改为username）
   - 修复退出确认面板（点击用户信息显示）
   - 恢复正确的类名结构

2. 样式优化：
   - 移除干扰aspect-ratio的height和min-height
   - 统一封面宽度为160px，保持16:9比例
   - 添加头像加载失败的默认处理
   - 收藏夹和视频封面使用相同的比例

3. 用户体验：
   - 点击用户信息显示退出确认面板
   - 头像加载失败显示绿色背景+用户名首字母
   - 退出确认面板带遮罩层，点击外部关闭

### 阶段 11: 路由规划与修复 (2026-03-26)
- [x] 添加React Router路由配置
- [x] 为每个tab配置独立路由
- [x] HomePage根据URL路径确定当前tab
- [x] tab切换使用路由导航
- [x] 修复React Hook调用错误

### 完成工作
1. 路由配置：
   - 配置BrowserRouter在main.tsx最外层
   - 为每个tab添加独立路由：
     - `/home` - 首页
     - `/favorites` - 收藏
     - `/watch-later` - 稍后再看
     - `/downloads` - 下载
   - 根路径`/`重定向到`/home`

2. 路由集成：
   - HomePage使用useLocation获取当前路径
   - 根据路径确定当前activeTab
   - 使用useNavigate进行路由导航
   - tab切换触发路由导航

3. 问题修复：
   - 修复BrowserRouter导致的React Hook调用错误
   - 将BrowserRouter移到React.StrictMode外面
   - 避免React StrictMode创建多个实例导致的hook冲突

4. 优势：
   - URL能反映当前页面状态
   - 可以直接通过URL访问特定tab
   - 刷新页面后保持在当前tab
   - 支持浏览器前进/后退

- 记录路由系统优势

### 阶段 13: 添加下载功能按钮 (2026-03-26)
- [ ] 在收藏页面视频卡片右下角添加心形图标
- [ ] 在稍后再看页面视频卡片右下角添加心形图标
- [ ] 实现点击添加/移除下载列表功能
- [ ] 添加下载列表状态管理
- [ ] 添加按钮样式（未添加状态：灰色轮廓；已添加状态：绿色填充）
- [ ] 修复 CSS 语法错误
- [ ] 测试功能并验证

### 阶段 12: 稍后再看页面重构 (2026-03-26)
- [x] 添加示例视频数据
- [x] 重构为左右布局（左侧缩略图+右侧信息）
- [x] 添加观看进度条显示
- [x] 添加播放全部悬浮按钮
- [x] 完整的CSS样式支持

### 完成工作
1. 布局重构：
   - 左侧缩略图（16:9比例，160px宽）
   - 右侧信息区（标题、作者、播放/评论数）
   - 删除按钮（右侧绝对定位）
   - 播放全部按钮（右下角固定悬浮）

2. 功能特性：
   - 观看进度条（底部进度指示）
   - 时长显示（右下角）
   - 观看进度文字（左上角，已观看/总时长）
   - 播放全部按钮（绿色，带图标）
   - 删除按钮（支持移除视频）

3. 样式优化：
   - 完全参考B站稍后再看页面设计
   - 深色绿色播放按钮（#2E7D32）
   - 悬浮按钮带阴影和hover效果
   - 响应式布局支持

### 下一阶段计划
- [ ] Phase 3: 视频源管理
  - 实现收藏夹API
  - 实现稍后再看API
  - 实现链接智能识别
  - 前端视频源页面

---

## 待记录...
### 阶段 14: 后端收藏夹API实现 (2026-03-27)
- [x] 实现收藏夹列表API
- [x] 实现收藏夹详情API
- [x] 集成BilibiliService
- [x] 添加图片代理API
- [x] 实现统一API响应格式
- [x] 添加错误处理和日志记录

### 完成工作
1. 收藏夹API实现：
   - `GET /api/favorites/folders` - 获取用户收藏夹列表
   - `GET /api/favorites/folders/{folder_id}` - 获取收藏夹详情（视频列表）
   - 支持分页、排序、搜索功能
   - 返回格式化的JSON数据

2. 图片代理API：
   - `GET /api/auth/proxy/avatar` - 代理获取B站图片
   - 解决403防盗链问题
   - 设置正确的Referer和User-Agent

3. 数据处理：
   - 统一API响应格式 `{success, data, message}`
   - B站API错误转换和友好提示
   - 数据格式化和清洗

### 技术实现
- 使用httpx进行异步HTTP请求
- 30秒超时设置
- 完整的错误处理和日志记录
- 支持SESSDATA认证

### 阶段 15: 前端收藏夹功能集成 (2026-03-27)
- [x] 集成后端收藏夹API
- [x] 实现收藏夹列表显示
- [x] 实现收藏夹详情显示
- [x] 添加无限滚动加载
- [x] 修复图片403问题（使用代理API）
- [x] 优化视频卡片显示
- [x] 添加加载更多按钮

### 完成工作
1. API集成：
   - 创建 `apiService.getFolders()` 方法
   - 创建 `apiService.getFolderDetail()` 方法
   - 统一错误处理和响应格式化
   - SESSDATA参数自动传递

2. 收藏夹列表：
   - 显示用户所有收藏夹
   - 收藏夹封面、标题、数量显示
   - 点击进入收藏夹详情
   - 完整的加载和错误状态

3. 收藏夹详情：
   - 显示收藏夹中的视频列表
   - 视频卡片（封面、标题、UP主、播放量、时长）
   - 支持分页和排序
   - 智能分页（移动端5条，桌面端10条）
   - 无限滚动 + 手动加载更多

4. 图片优化：
   - 所有B站图片通过代理API获取
   - 解决403防盗链问题
   - 封面和头像正常显示

5. 性能优化：
   - 懒加载视频列表
   - 避免重复请求
   - 状态管理优化

### 技术实现
- 使用Zustand管理用户状态
- useEffect进行数据获取
- 条件渲染和状态处理
- 响应式设计和移动端优化

### 阶段 16: 视频详情页面实现 (2026-03-27)
- [x] 创建视频详情页面组件
- [x] 实现视频详情API
- [x] 添加路由配置
- [x] 实现视频基本信息显示
- [x] 实现统计信息显示
- [x] 添加分P信息显示
- [x] 添加视频简介显示（支持链接）
- [x] 实现下载功能（模拟模式）
- [x] 优化UI和布局

### 完成工作
1. 视频详情API：
   - `GET /api/video/{video_id}` - 获取视频详情
   - 支持bvid和aid参数
   - 返回完整视频信息（标题、封面、UP主、统计、分P等）
   - 可选SESSDATA参数

2. 视频详情页面：
   - 顶部导航栏（返回按钮 + 视频标题）
   - 视频封面（16:9比例，时长标签）
   - 视频标题和UP主信息
   - 统计信息（播放量、弹幕数、发布时间）
   - 分P信息（多P视频显示所有分P）
   - 视频简介（支持链接点击和文本选择）
   - 下载功能（模拟模式）

3. 下载功能：
   - 多P视频：可以选择单个或多个分P下载
   - 单P视频：简单的下载按钮
   - 全选/取消全选功能
   - 模拟下载状态和反馈

4. UI优化：
   - 移动端优先设计
   - 简洁的布局和信息展示
   - 具体的发布时间显示（不使用相对时间）
   - 图片防盗链处理

### 技术实现
- React Router路由管理
- 动态路由参数（:videoId）
- 状态管理和错误处理
- 链接解析和点击处理
- 选择状态管理

### 阶段 17: 文档更新 (2026-03-27)
- [x] 更新开发路线图文档
- [x] 更新API列表文档
- [x] 添加已实现功能详情
- [x] 添加注意事项和优化建议
- [x] 更新技术栈说明

### 完成工作
1. 开发路线图更新：
   - 标记已完成的Phase和任务
   - 添加已实现功能的详细说明
   - 添加当前注意事项
   - 更新参考资源和技术栈

2. API列表更新：
   - 添加已实现的后端API
   - 添加API响应格式说明
   - 添加图片代理说明
   - 添加注意事项和测试工具

3. 文档完善：
   - 前端注意事项（移动端优先、图片防盗链、分页优化）
   - 后端注意事项（API响应格式、错误处理、用户认证）
   - 性能优化建议（缓存策略、懒加载、图片优化）
   - 数据一致性要求

### 下一阶段计划
- [ ] Phase 3: 下载管理
  - 集成yt-dlp下载引擎
  - 实现下载队列管理
  - 实现下载进度追踪
  - 前端下载管理页面

### 当前状态
- ✅ Phase 1: 核心功能（部分完成）
  - ✅ FastAPI后端框架
  - ✅ React前端框架
  - ✅ 用户认证功能
  - ⏳ yt-dlp集成（待实现）
  - ⏳ SQLite数据库（待实现）

- ✅ Phase 2: 视频源管理（基本完成）
  - ✅ 收藏夹API
  - ⏳ 稍后再看API（待实现）
  - ⏳ 链接智能识别（待实现）
  - ✅ 前端视频源页面

- ⏳ Phase 3: 下载管理（未开始）
  - ⏳ 集成yt-dlp
  - ⏳ 下载队列
  - ⏳ 进度推送
  - ⏳ 下载管理页面


### 阶段 18: UI细节优化 (2026-03-27)
- [x] 移除收藏夹"未收藏"标签显示
- [x] 修改日期显示为具体时间格式
- [x] 调整视频封面尺寸，更大且等高
- [x] 优化封面容器布局

### 完成工作
1. 移除无用标签：
   - 删除收藏夹详情页面标题中的"未收藏"状态显示
   - 删除收藏夹列表卡片下方的"未收藏"状态标签
   - 简化界面，只显示有用信息

2. 日期显示优化：
   - 修改`formatTime`函数返回具体日期时间格式（如"2024-03-27 14:30"）
   - 收藏夹视频列表和视频详情页面统一使用具体时间
   - 移除相对时间显示（如"2天前"、"3小时前"）

3. 视频封面优化：
   - 移除`aspect-ratio: 16/9`限制，让封面占满容器高度
   - 设置封面容器固定宽度（桌面端240px，移动端180px）
   - 使用`align-items: stretch`确保封面和右侧信息完全等高
   - 封面`width: 100%`和`height: 100%`占满容器

4. 布局改进：
   - 封面现在明显更大，视觉效果更好
   - 封面和右侧信息保持完全等高对齐
   - 响应式设计正确适配不同屏幕尺寸

### 用户体验提升
- 界面更简洁，去除冗余信息
- 时间信息更准确，用户能清楚知道具体发布时间
- 视频封面更大更清晰，信息展示更突出
- 整体视觉一致性更好

### 技术实现
- CSS布局优化（flexbox + align-items: stretch）
- 时间格式化改进（相对时间 → 绝对时间）
- 响应式设计调整（移动端/桌面端不同尺寸）
- 移除不必要的DOM元素和样式

### 阶段 19: 稍后再看功能完整实现 (2026-03-27)
- [x] 实现稍后再看后端API
- [x] 集成B站稍后再看API
- [x] 实现前端稍后再看页面
- [x] 添加子tab栏（全部/未看完）
- [x] 实现客户端分页（支持大量视频）
- [x] 添加无限滚动加载（Intersection Observer）
- [x] 优化移动端和桌面端导航布局
- [x] 添加观看进度显示

### 完成工作
1. 后端API实现：
   - `GET /api/watchlater/list` - 获取稍后再看列表
   - 集成B站API `/x/v2/history/toview`
   - 支持分页参数（page, page_size）
   - 返回视频列表、观看进度、统计信息

2. 前端功能实现：
   - 子tab栏：切换查看全部视频或未看完视频
   - 客户端分页：一次性加载所有视频（最多100个），本地分页显示
   - 无限滚动：使用Intersection Observer API实现
   - 观看进度：显示视频观看进度条和百分比
   - 智能分页：移动端5条，桌面端10条

3. UI/UX优化：
   - 深色主题tab栏设计（参考B站设计）
   - 亮色主题视频列表
   - 观看进度条显示（蓝色半透明）
   - 数量统计（全部数量/未看完数量）
   - 移除"加载更多"按钮，纯滚动加载

4. 布局优化：
   - 桌面端：左侧边栏导航（80px宽）
   - 移动端：底部导航栏
   - 视频卡片：左侧封面 + 右侧信息（等高对齐）
   - 响应式设计：自动适配不同屏幕尺寸

5. 技术改进：
   - 使用Intersection Observer替代scroll事件监听
   - 客户端分页减少API请求次数
   - 图片代理解决403防盗链问题
   - 完整的错误处理和加载状态

### 参考设计
- B站稍后再看页面设计
- 深色tab栏 + 亮色内容区域
- 观看进度条设计
- 无限滚动加载模式

### 技术实现
- Intersection Observer API（主流做法）
- 客户端分页和数据缓存
- React hooks状态管理
- 响应式布局和移动端优化

### 性能优化
- 减少API请求次数（客户端分页）
- 避免频繁的scroll事件触发
- 懒加载和条件渲染
- 图片懒加载和代理缓存

### 阶段 20: 项目架构文档优化 (2026-03-27)
- [x] 基于bilitool的MVC架构优化项目结构文档
- [x] 创建完整的MVC架构设计文档
- [x] 更新架构图添加MVC架构可视化
- [x] 添加技术栈详细说明
- [x] 添加配置管理文档
- [x] 添加数据流转说明
- [x] 添加扩展性设计文档

### 完成工作
1. 项目结构文档更新（docs/dev/06-project-structure.md）：
   - 基于MVC架构重新组织项目结构
   - 添加详细的模块划分和职责说明
   - 添加数据模型定义（User, Video, Download, Settings）
   - 添加完整的API结构说明
   - 添加配置管理和环境变量说明
   - 添加技术栈详细说明
   - 添加数据流转和开发环境说明

2. MVC架构设计文档（docs/dev/pilinote_mvc_architecture.md）：
   - 创建完整的MVC架构文档
   - 包含详细的架构图和层次职责说明
   - 添加数据流向和设计原则
   - 添加开发指南和扩展性设计
   - 添加性能优化和安全考虑
   - 添加测试策略和技术选型理由

3. 架构图更新（docs/dev/pilinote_architecture.drawio）：
   - 添加MVC架构可视化图表
   - 包含View层、Controller层、Service层、Model层
   - 显示各层的组件和职责
   - 添加数据流向箭头和设计原则说明
   - 备份原有架构图为pilinote_architecture_old.drawio

4. 技术栈文档化：
   - 后端：Python 3.11+、FastAPI、SQLAlchemy、Celery、Redis
   - 前端：React 19+、TypeScript、Vite、Zustand、React Router
   - 桌面端：Electron 28+
   - 数据库：SQLite（开发）/ PostgreSQL（生产）

5. 配置管理文档：
   - 后端配置（config.py）
   - 环境变量（.env.example）
   - 前端配置（vite.config.ts, tsconfig.json）
   - 部署配置和开发环境说明

6. 参考项目文档：
   - bilitool（MVC架构设计）
   - Hermes（前后端分离架构）
   - Vidbee（Electron桌面端）
   - PiliPala（B站API实现）

### 架构改进
- 分层清晰：View → Controller → Service → Model
- 职责分离：每层只负责自己的职责
- 依赖注入：便于测试和替换实现
- 接口抽象：支持多种存储方式
- 错误处理：统一错误处理机制

### 技术优势
- 可维护性：代码结构清晰，易于维护
- 可扩展性：新功能易于添加
- 可测试性：分层架构便于单元测试
- 团队协作：职责明确，便于分工

### 参考资源
- bilitool的MVC架构设计理念
- 企业级应用架构最佳实践
- RESTful API设计规范
- 前后端分离架构模式

### 阶段 21: 下载链接解析功能实现 (2026-03-27)
- [x] 实现后端下载链接解析API
- [x] 创建下载相关路由和模型
- [x] 集成B站视频信息获取
- [x] 实现前端下载链接解析UI
- [x] 添加视频信息卡片显示
- [x] 实现多P视频章节列表显示
- [x] 添加章节选择功能（全选/全不选/单选）
- [x] 优化下载按钮显示和交互

### 完成工作
1. 后端API实现：
   - `POST /api/download/parse` - 解析下载链接，提取视频ID和基本信息
   - 支持多种链接格式：BV编号、完整URL、短链接、AV编号
   - 返回视频详情、下载选项、多P信息
   - 集成B站视频信息API（`/x/web-interface/view`）
   - 支持画质选择（360P-4K）、格式选择（MP4/FLV/MKV）
   - 支持字幕和弹幕下载标识

2. 下载工具类：
   - 创建 `src/utils/bilibili_utils.py` 工具类
   - 实现链接解析功能（link_parser）
   - 实现ID转换功能（id_converter）
   - 支持多种链接格式识别和标准化

3. 数据模型：
   - 创建 `src/schemas/download.py` 数据模型
   - 定义下载相关的所有Pydantic模型
   - 包含视频信息、下载选项、任务创建等模型

4. 前端API服务：
   - 添加 `parseDownloadUrl()` 方法到 `apiService`
   - 统一的API调用接口
   - 完整的错误处理和响应格式化

5. 前端UI实现：
   - 首页输入框：支持粘贴B站视频链接
   - 解析按钮：点击或按Enter键触发解析
   - 视频信息卡片：显示视频封面、标题、UP主、统计数据
   - 视频描述：支持链接识别和显示
   - 下载按钮：支持下载操作（模拟模式）

6. 多P视频支持：
   - 自动检测多P视频（`multi_part` 标识）
   - 显示视频章节列表（章节序号、标题、时长）
   - 章节选择功能：单选、全选、全不选
   - 默认选中所有章节
   - 动态下载按钮：显示选中章节数量
   - 支持单P和多P视频的统一下载流程

7. UI/UX优化：
   - 加载状态：解析中显示加载动画
   - 错误提示：友好的错误消息显示
   - 视觉设计：粉色主题（#fb7299）与B站风格一致
   - 响应式布局：支持移动端和桌面端
   - 平滑动画：章节选择和交互效果
   - 可访问性：完整的ARIA标签支持

8. 样式实现：
   - 视频信息卡片样式（封面、详情、统计）
   - 章节列表样式（列表、复选框、选中状态）
   - 按钮样式（全选、全不选、下载）
   - 错误消息样式
   - 加载动画样式
   - 响应式媒体查询

### 技术实现
- 后端：FastAPI + httpx + Pydantic
- 前端：React + TypeScript + Zustand
- API通信：RESTful + JSON
- 链接解析：正则表达式 + ID标准化
- 状态管理：React hooks（useState, useEffect）
- 交互设计：点击、hover、键盘事件

### 支持的功能
- 单P视频：直接显示视频信息和下载按钮
- 多P视频：显示章节列表和选择功能
- 链接格式：BV、AV、完整URL、短链接
- 视频信息：标题、封面、UP主、播放量、弹幕数
- 下载选项：画质、格式、字幕、弹幕
- 章节管理：选择、全选、全不选

### 用户体验
- 简单易用：粘贴链接 → 点击解析 → 查看信息 → 选择下载
- 智能识别：自动识别多P视频和章节信息
- 灵活选择：可以单独选择要下载的章节
- 视觉反馈：加载、错误、选中状态都有明确的视觉反馈
- 响应式：在手机和电脑上都有良好的体验

### 下一阶段计划
- [ ] Phase 3: 下载管理（实际下载功能）
  - 集成yt-dlp下载引擎
  - 实现真实的下载任务创建
  - 实现下载进度追踪
  - 实现下载队列管理
  - WebSocket实时进度推送
  - 前端下载管理页面完善

### 阶段 22: 修复稍后再看时间显示问题 (2026-03-27)
- [x] 修复时间格式化函数处理无效时间戳
- [x] 修改稍后再看页面显示添加时间而非发布时间
- [x] 解决视频时间显示为1970-1-1的问题

### 完成工作
1. 时间格式化函数优化：
   - 添加对时间戳为0或无效值的处理
   - 当时间戳无效时显示"未知时间"
   - 避免显示1970-1-1（Unix纪元时间）

2. 时间显示逻辑修复：
   - 修改前：显示发布时间（pubtime字段，通常为0）
   - 修改后：显示添加时间（add_time字段，有实际值）
   - 稍后再看页面更符合用户预期

3. 问题分析：
   - B站API返回的pubtime字段值为0
   - 前端将0转换为时间戳时显示1970-1-1 08:00
   - 稍后再看页面应该显示添加到列表的时间而非视频发布时间

### 技术实现
- 时间戳验证：检查timestamp是否为0或负数
- 友好提示：无效时间显示"未知时间"
- 字段映射：使用add_time替代pubtime进行显示

### 用户体验提升
- 显示有意义的时间信息（添加到稍后再看的时间）
- 避免显示错误的1970年时间
- 提供更好的时间可读性

### 下一阶段计划
- [ ] Phase 3: 下载管理（实际下载功能）
  - 集成yt-dlp下载引擎
  - 实现真实的下载任务创建
  - 实现下载进度追踪
  - 实现下载队列管理
  - WebSocket实时进度推送
  - 前端下载管理页面完善


---

## 阶段 23: 下载管理功能分析与方案设计 (2026-03-27)

### 参考项目分析总结

#### 1. 参考项目对比

**Hermes - 企业级下载管理系统**
- ✅ 完整的任务队列架构（Celery + Redis）
- ✅ 三层进度更新架构（Redis + SSE + DB）
- ✅ 安全的SSE实时推送机制
- ✅ 支持批量下载和任务分组
- ⚠️ 架构复杂度高，学习成本高

**Vidbee - 优秀的UI/UX实现**
- ✅ 实时进度显示（百分比、速度、ETA）
- ✅ 分组显示和批量操作
- ✅ 双机制更新（定时轮询 + SSE）
- ✅ 丰富的交互体验
- ⚠️ 仅前端实现，需要后端API

**Bilibili-downloader - 基础下载实现**
- ✅ 线程化下载和进度回调
- ✅ FFmpeg集成和音视频合并
- ✅ 暂停/取消支持
- ⚠️ 单线程下载，无任务队列

**bilitool - 简单直接的下载实现**
- ✅ 清晰的MVC架构
- ✅ 基础下载功能
- ✅ 文件名清理逻辑
- ❌ 无暂停/取消/重试
- ❌ 无并发下载
- ❌ 无状态持久化

#### 2. 当前项目PiliNote现状

**已完成功能：**
- ✅ 基础框架（FastAPI + SQLAlchemy + SQLite）
- ✅ 用户认证（扫码、SESSDATA）
- ✅ 视频源API（收藏夹、稍后再看、视频详情）
- ✅ 下载链接解析（多P视频支持）
- ✅ 前端UI框架（React + TypeScript）

**缺失功能：**
- ❌ 下载任务数据模型
- ❌ 下载引擎集成（yt-dlp）
- ❌ 任务队列系统
- ❌ 进度追踪机制
- ❌ 实时进度推送
- ❌ 下载任务管理UI

### 技术方案设计

#### 方案选择：渐进式实现

**Phase 1: 快速原型（1-2周）**
- 参考bilitool的简单架构
- 使用asyncio实现异步下载
- 基础进度管理
- 前端UI完善

**Phase 2: 功能增强（2-3周）**
- 添加并发控制
- 实现断点续传
- 错误重试机制
- 任务状态持久化

**Phase 3: 企业升级（3-4周，可选）**
- 集成Celery + Redis
- 实现SSE实时推送
- 三层进度更新架构
- 批量下载优化

#### 数据模型设计

**下载任务表：**
```python
class Download(Base):
    id = Column(String, primary_key=True)
    bvid = Column(String, nullable=False, index=True)
    title = Column(String)
    status = Column(Enum("pending", "queued", "downloading", "processing", "completed", "failed", "cancelled"))
    progress = Column(Float, default=0.0)  # 0.0 to 100.0
    
    # 进度追踪
    downloaded_bytes = Column(Integer)
    total_bytes = Column(Integer)
    download_speed = Column(Float)
    eta = Column(Float)
    
    # B站特定字段
    cid = Column(Integer)
    aid = Column(String)
    quality = Column(Integer)
    format = Column(String)
    
    # 元数据
    thumbnail_url = Column(String)
    duration = Column(Integer)
    uploader = Column(String)
    
    # 文件管理
    file_path = Column(String)
    file_size = Column(Integer)
    
    # 错误处理
    error_message = Column(String)
    retry_count = Column(Integer, default=0)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
```

#### API接口设计

**下载管理API：**
```
POST   /api/download/start          - 创建下载任务
GET    /api/download/list           - 获取下载任务列表
GET    /api/download/{id}           - 获取单个下载任务详情
DELETE /api/download/{id}           - 删除下载任务
POST   /api/download/{id}/pause     - 暂停下载
POST   /api/download/{id}/resume    - 恢复下载
POST   /api/download/{id}/cancel    - 取消下载
POST   /api/download/{id}/retry     - 重试失败的任务
```

#### 前端UI设计

**下载管理页面功能：**
- 任务列表显示（支持状态过滤）
- 进度条和实时数据更新
- 任务控制按钮（暂停/取消/重试）
- 批量操作（多选、批量删除）
- 统计卡片（下载中、已完成、失败）

### 实施计划

#### 第一步：后端基础功能（当前阶段）

**任务清单：**
1. 创建Download数据模型
2. 集成yt-dlp下载引擎
3. 实现异步下载任务
4. 创建下载API端点
5. 实现进度回调机制
6. 添加任务状态管理

**技术实现：**
```python
# 异步下载任务
async def download_video_task(download_id: str, bvid: str, options: Dict):
    download = get_download(download_id)
    download.status = "downloading"
    download.started_at = datetime.utcnow()
    
    # yt-dlp配置
    ydl_opts = {
        'format': f'{options["quality"]}+bestaudio/best',
        'outtmpl': f'downloads/{download_id}/%(title)s.%(ext)s',
        'progress_hooks': [lambda d: update_progress(download_id, d)],
        'cookiefile': get_cookie_file(options.get('sessdata')),
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f'https://www.bilibili.com/video/{bvid}'])
        
        download.status = "completed"
        download.completed_at = datetime.utcnow()
        download.progress = 100.0
        
    except Exception as e:
        download.status = "failed"
        download.error_message = str(e)
        download.retry_count += 1
    
    finally:
        db.commit()
```

#### 第二步：前端UI实现

**任务清单：**
1. 创建下载任务列表组件
2. 实现进度条显示
3. 添加任务控制按钮
4. 实现状态过滤功能
5. 添加实时数据更新
6. 实现批量操作

**技术实现：**
```typescript
// 下载任务组件
function DownloadItem({ download, onPause, onResume, onCancel, onRetry }) {
  const progressPercent = download.progress || 0;
  const isDownloading = download.status === 'downloading';
  const isFailed = download.status === 'failed';
  
  return (
    <div className="download-item">
      <div className="download-info">
        <img src={download.thumbnail_url} alt={download.title} />
        <div className="download-details">
          <h3>{download.title}</h3>
          <div className="download-meta">
            <span>{download.uploader}</span>
            <span>{formatDuration(download.duration)}</span>
          </div>
          <ProgressBar value={progressPercent} />
          <div className="download-stats">
            <span>{progressPercent.toFixed(1)}%</span>
            <span>{download.download_speed || '0 KB/s'}</span>
            <span>ETA: {download.eta || '--'}</span>
          </div>
        </div>
      </div>
      <div className="download-actions">
        {isDownloading && <Button onClick={() => onPause(download.id)}>暂停</Button>}
        {isFailed && <Button onClick={() => onRetry(download.id)}>重试</Button>}
        <Button onClick={() => onCancel(download.id)}>取消</Button>
      </div>
    </div>
  );
}
```

### 技术依赖

**新增依赖：**
```txt
yt-dlp>=2024.1.1  # 下载引擎
celery>=5.3.0    # 任务队列（Phase 2）
redis>=5.0.0     # 消息队列（Phase 2）
```

### 预期成果

**Phase 1完成后：**
- ✅ 支持单个视频下载
- ✅ 实时进度显示
- ✅ 基本任务管理
- ✅ 前端UI完善

**Phase 2完成后：**
- ✅ 支持并发下载（最多3个）
- ✅ 支持断点续传
- ✅ 错误重试机制
- ✅ 任务队列管理

**Phase 3完成后：**
- ✅ 企业级架构
- ✅ SSE实时推送
- ✅ 批量下载优化
- ✅ 完整的任务管理

### 注意事项

1. **文件管理**：自动创建下载目录，按视频ID组织
2. **错误处理**：详细记录错误信息，支持用户查看
3. **并发控制**：限制最大并发下载数，避免资源耗尽
4. **进度更新**：合理的更新频率，避免过度刷新
5. **状态同步**：确保前端和后端状态一致性

### 参考资源

**核心参考项目：**
- reference/hermes/ - 企业级下载管理架构
- reference/vidbee/ - 优秀的UI/UX设计
- reference/bilibili-downloader/ - 下载引擎集成
- reference/bilitool/ - 清晰的MVC架构

**技术文档：**
- yt-dlp官方文档：https://github.com/yt-dlp/yt-dlp
- Celery官方文档：https://docs.celeryq.dev/
- FastAPI异步编程：https://fastapi.tiangolo.com/async/

---

## 阶段 24: 下载管理功能实现 (2026-03-27 - 2026-03-29)

### 实现内容

#### 1. 后端功能实现

**新增文件：**
- \`apps/api/src/models/download.py\` - 下载任务数据模型
- \`apps/api/src/services/download_service.py\` - 下载服务类

**核心功能：**
- ✅ 下载任务数据模型（Download）
- ✅ yt-dlp下载引擎集成
- ✅ 异步下载任务处理
- ✅ 实时进度回调机制
- ✅ 下载API端点（start, list, pause, cancel, retry, delete）
- ✅ 任务状态管理（pending, queued, downloading, processing, completed, failed, cancelled）
- ✅ 文件保存和路径管理

**API端点：**
\`\`
POST   /api/download/start          - 创建下载任务
GET    /api/download/list           - 获取下载任务列表
GET    /api/download/{id}           - 获取单个下载任务详情
DELETE /api/download/{id}           - 删除下载任务
POST   /api/download/{id}/pause     - 暂停下载
POST   /api/download/{id}/resume    - 恢复下载
POST   /api/download/{id}/cancel    - 取消下载
POST   /api/download/{id}/retry     - 重试失败的任务
\`\`

#### 2. 前端功能实现

**新增文件：**
- \`apps/web/src/pages/DownloadSeriesDetailPage.tsx\` - 系列详情页面

**核心功能：**
- ✅ App风格下载管理界面
- ✅ 两个Tab切换（视频列表、下载列表）
- ✅ 系列视频分组显示
- ✅ 实时进度自动刷新（有下载任务时2秒刷新）
- ✅ 系列详情页面（显示该系列的所有视频）
- ✅ 已下载视频的下载任务列表显示
- ✅ 智能点击行为（单个视频→详情页，系列→系列详情页）
- ✅ 下载状态区分（已完成/下载中）
- ✅ 视频详情页下载状态检测

**UI设计特点：**
- Material Design 3风格
- 移动端优先的响应式设计
- 圆角Tab按钮（iOS风格）
- 系列卡片布局（缩略图+信息+箭头）
- 实时进度显示（进度条+百分比+速度+ETA）
- 状态颜色标识（粉色下载中、绿色已完成、红色失败）

#### 3. 数据模型设计

**Download模型字段：**
\`\`python
id              # 下载任务ID (UUID)
bvid            # B站视频ID
title           # 视频标题
status          # 任务状态
progress        # 下载进度 0.0-100.0
downloaded_bytes # 已下载字节数
total_bytes     # 总字节数
download_speed  # 下载速度 (KB/s)
eta             # 预计剩余时间 (秒)
cid             # 视频CID
aid             # 视频AID（用于系列分组）
quality         # 视频质量
output_format   # 输出格式
thumbnail_url   # 视频封面URL
duration        # 视频时长 (秒)
uploader        # UP主名称
uploader_mid    # UP主 MID
file_path       # 文件保存路径
file_size       # 文件大小
error_message   # 错误信息
retry_count     # 重试次数
sessdata        # 用户SESSDATA
created_at      # 创建时间
started_at      # 开始时间
completed_at    # 完成时间
\`\`

#### 4. 文件变更统计

**后端文件：**
- \`apps/api/requirements.txt\` +3行
- \`apps/api/src/models/__init__.py\` +3行
- \`apps/api/src/models/download.py\` +58行（新增）
- \`apps/api/src/services/download_service.py\` +233行（新增）
- \`apps/api/src/routers/download.py\` +246行

**前端文件：**
- \`apps/web/src/App.tsx\` +2行
- \`apps/web/src/index.css\` +1288行
- \`apps/web/src/pages/DownloadSeriesDetailPage.tsx\` +359行（新增）
- \`apps/web/src/pages/VideoDetailPage.tsx\` +127行
- \`apps/web/src/pages/components/DownloadsContent.tsx\` +349行
- \`apps/web/src/pages/components/HomeContent.tsx\` +79行
- \`apps/web/src/services/api.ts\` +51行

**总计：**
- 9个文件修改
- +2048行新增
- -100行删除

### 用户体验改进

**下载管理流程：**
1. 用户在首页输入视频链接
2. 解析视频信息（支持多P视频）
3. 选择要下载的章节
4. 创建下载任务
5. 在"下载列表"Tab查看下载进度
6. 下载完成后在"视频列表"Tab查看
7. 点击已下载视频进入详情页
8. 查看下载任务列表和文件信息

### 阶段 25: 稍后再看API修复与环境配置优化 (2026-03-29)

#### 问题诊断

**问题现象：**
- 稍后再看API只返回20个视频，而不是完整的326个视频
- B站API正确返回count: 326，但我们的API只返回20个

**问题原因：**
- API服务器使用了系统Python启动（`python3 -m uvicorn...`）
- 系统Python缺少项目依赖（如yt_dlp等）
- 代码执行时出现异常，返回不完整的数据

**解决方案：**
- 使用虚拟环境启动API服务器（`./venv/bin/python3 -m uvicorn...`）
- 虚拟环境包含所有必要的依赖包
- 代码正常执行，返回完整的326个视频

#### 文档更新

**更新的文件：**
- `docs/dev/05-deployment.md` - 添加详细的开发环境配置和启动说明
- `docs/dev/README.md` - 在快速开始中强调虚拟环境的重要性

**新增内容：**
1. 后端API服务器启动详细说明
2. 常见问题及解决方案
3. 正确的启动命令示例
4. 重要提示：必须使用虚拟环境启动

#### 技术要点

**正确的启动方式：**
```bash
cd apps/api
./venv/bin/python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**错误的启动方式：**
```bash
# 不要使用这种方式！
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**依赖问题：**
- 系统Python缺少 `yt_dlp` 模块
- 会导致 `ModuleNotFoundError: No module named 'yt_dlp'`
- 影响稍后再看、收藏夹等功能

#### 经验总结

1. **环境隔离**：Python项目必须使用虚拟环境，避免依赖冲突
2. **依赖管理**：确保所有依赖都安装在虚拟环境中
3. **启动规范**：明确说明正确的启动方式，避免用户误用
4. **文档重要性**：详细的环境配置文档能避免很多问题
