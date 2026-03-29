# 开发路线图

## Phase 1: 核心功能 (Week 1-2)
- [x] 搭建FastAPI后端框架
- [x] 搭建React前端框架
- [x] 实现SESSDATA认证
- [ ] 集成yt-dlp基础下载
- [ ] 实现SQLite数据库

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
- [ ] 集成Celery + Redis (计划中)
- [ ] WebSocket进度推送 (计划中)

## Phase 4: 文件组织 (Week 5)
- [ ] 自动下载字幕/弹幕
- [ ] 音轨提取
- [ ] 元数据保存
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

### Phase 3 - 下载管理 (已实现70%)
- ✅ Download数据模型：
  - 支持多种状态管理
  - 进度追踪字段
  - B站特定字段
  - 元数据字段
  - 文件管理字段
- ✅ DownloadService异步下载服务：
  - asyncio异步下载
  - 进度回调机制
  - yt-dlp集成
  - 错误处理
  - 任务状态管理
- ✅ 下载API接口：
  - POST /api/download/start - 创建下载任务
  - GET /api/download/list - 获取下载列表
  - DELETE /api/download/{id} - 删除下载任务
  - POST /api/download/{id}/cancel - 取消下载
  - POST /api/download/{id}/retry - 重试失败任务
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
1. **缓存策略**：收藏夹列表可以考虑前端缓存
2. **懒加载**：视频列表采用无限滚动懒加载
3. **图片优化**：封面图片使用合适的尺寸和质量
4. **API去重**：避免重复请求相同数据
5. **Intersection Observer**：使用现代API替代scroll事件监听，减少性能开销
6. **客户端分页**：稍后再看采用客户端分页，减少API请求次数

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
