# 前端架构文档

## 组件结构

PiliNote 前端采用现代化的组件化设计，基于 React 19.1.0 和 TypeScript，实现清晰的层次结构和模块化设计。

### 项目结构
```
apps/web/src/
├── components/          # UI 组件
│   ├── NewDownload/     # 新下载系统组件
│   │   ├── VideoLibrary.tsx    # 视频库管理
│   │   ├── TaskCard.tsx        # 任务卡片
│   │   ├── SchedulerCard.tsx   # 调度器卡片
│   │   ├── DownloadsList.tsx   # 下载列表
│   │   ├── ScanResultContent.tsx # 扫描结果
│   │   └── index.tsx           # 主组件
│   ├── ai/               # AI 笔记组件 (Phase 3)
│   │   ├── AiNotePanel.tsx     # AI 分析面板
│   │   ├── StyleSelector.tsx   # 风格选择器
│   │   ├── FormatSelector.tsx  # 格式选择器
│   │   ├── MarkdownViewer.tsx # Markdown 渲染
│   │   └── MindMapViewer.tsx  # 思维导图
│   ├── AlertModal.tsx   # 警告弹窗
│   ├── BatchActionsBar.tsx # 批量操作栏
│   ├── ConfirmModal.tsx # 确认弹窗
│   ├── MainLayout.tsx   # 主布局
│   ├── Modal.tsx        # 通用模态框
│   ├── Toast.tsx        # 消息提示
│   └── ...
├── pages/              # 页面组件
│   ├── HomePage.tsx     # 首页
│   ├── LoginPage.tsx    # 登录页
│   ├── SettingsPage.tsx # 设置页
│   ├── VideoDetailPage.tsx # 视频详情页
│   └── components/      # 页面子组件
│       ├── FavoritesContent.tsx  # 收藏夹内容
│       ├── WatchLaterContent.tsx # 稍后再看内容
│       └── ...
├── stores/             # Zustand 状态管理
│   ├── auth.ts         # 认证状态
│   ├── newQueue.ts     # 新下载队列状态
│   └── settings.ts     # 设置状态
├── hooks/              # 自定义 Hooks
│   ├── useVideoDownload.ts # 视频下载Hook
│   └── useNotePolling.ts  # AI 笔记轮询 (Phase 3)
├── services/           # API 服务
│   ├── api.ts          # 通用 API 客户端
│   └── aiNote.ts       # AI 笔记 API (Phase 3)
│   └── api.ts          # API 客户端
├── utils/              # 工具函数
│   └── cn.ts           # 类名合并工具
└── App.tsx             # 应用根组件
```

### 核心组件说明

#### 1. MainLayout 组件
主布局组件，包含导航和页面切换逻辑。
- 路由管理
- 页面标题显示
- 全局状态初始化

#### 2. 新下载系统组件
新的下载管理系统，基于四级队列和调度器架构。

**VideoLibrary 组件**
- 管理已下载的视频库
- 显示已完成的调度器
- 提供视频浏览和筛选功能

**TaskCard 组件**
- 显示单个下载任务
- 显示任务进度和状态
- 提供任务控制操作（暂停、恢复、取消）

**SchedulerCard 组件**
- 显示调度器信息
- 管理调度器内的所有任务
- 提供批量控制操作

**DownloadsList 组件**
- 管理下载列表
- 按状态分组显示任务和调度器
- 提供筛选和排序功能

## 状态管理

PiliNote 使用 Zustand 作为状态管理库，提供轻量级、高性能的状态管理。

### 认证状态 (auth.ts)
```typescript
interface AuthState {
  // 状态
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // 操作
  setUser: (user: User | null) => void
  fetchUser: () => Promise<void>
  logout: () => void
  setIsLoading: (loading: boolean) => void
}
```

### 新下载队列状态 (newQueue.ts)
```typescript
interface NewQueueState {
  // 状态
  tasks: Record<string, Task>
  schedulers: Record<string, Scheduler>
  isConnected: boolean
  
  // 操作
  connectWebSocket: () => void
  fetchTasks: () => Promise<void>
  fetchSchedulers: () => Promise<void>
  submitTask: (taskData: TaskCreate) => Promise<void>
  updateTask: (taskId: string, updates: Partial<Task>) => void
}
```

### 设置状态 (settings.ts)
```typescript
interface SettingsState {
  // 状态
  settings: Settings
  
  // 操作
  fetchSettings: () => Promise<void>
  updateSettings: (settings: Partial<Settings>) => Promise<void>
}
```

## 路由设计

使用 React Router 7.5.x 进行路由管理。

### 路由配置
```typescript
<Routes>
  <Route path="/" element={<Navigate to="/home" replace />} />
  <Route path="/home" element={<MainLayout />} />
  <Route path="/favorites" element={<MainLayout />} />
  <Route path="/favorites/:folderId" element={<MainLayout />} />
  <Route path="/watch-later" element={<MainLayout />} />
  <Route path="/new-downloads" element={<MainLayout />} />
  <Route path="/opus/:opusId" element={<VideoDetailPage type="opus" />} />
  <Route path="/video/:videoId" element={<VideoDetailPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
  <Route path="*" element={<Navigate to="/home" replace />} />
</Routes>
```

### 路由守卫
```typescript
// 认证守卫
useEffect(() => {
  if (isAuthenticated && location.pathname === '/login') {
    const searchParams = new URLSearchParams(location.search)
    const mode = searchParams.get('mode')
    
    if (mode !== 'add') {
      navigate('/home', { replace: true })
    }
  }
}, [isAuthenticated, location.pathname, location.search, navigate])
```

## 样式系统

使用 Tailwind CSS 4.x 作为样式框架，提供高效、响应式的样式管理。

### 样式架构
- **全局样式**: `apps/web/src/index.css`
- **组件样式**: `apps/web/src/components/**/*.css`
- **工具函数**: `apps/web/src/utils/cn.ts` (clsx + tailwind-merge)

### 设计原则
- **响应式设计**: 移动端优先
- **暗色主题**: OLED 风格暗色主题
- **高对比度**: 符合 WCAG AA/AAA 标准
- **无障碍支持**: ARIA 标签和键盘导航

### 典型样式示例
```typescript
<div className="bg-gray-900 text-white rounded-lg p-4 hover:shadow-lg transition-all">
  <div className="flex items-center space-x-4">
    <img src={cover} alt={title} className="w-40 h-24 object-cover rounded" />
    <div className="flex-1">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-400">{uploader}</p>
    </div>
  </div>
</div>
```

## 数据流

### 用户认证流程
```
用户登录 
→ LoginPage 
→ apiService.login() 
→ useAuthStore.setUser() 
→ 路由跳转 /home 
→ MainLayout 
→ fetchUser() 
→ 恢复用户数据
```

### 视频下载流程
```
用户选择视频 
→ useVideoDownload.handleDownload() 
→ apiService.submitTask() 
→ useNewQueueStore.submitTask() 
→ WebSocket 接收任务创建事件 
→ UI 更新任务列表 
→ 实时进度更新
```

### WebSocket 实时通信流程
```
App.tsx 初始化 
→ useNewQueueStore.connectWebSocket() 
→ 建立 WebSocket 连接 
→ 接收事件 (taskCreated, taskUpdated, progress, etc.) 
→ 更新状态 
→ UI 重新渲染
```

## 自定义 Hooks

### useVideoDownload Hook
```typescript
interface UseVideoDownload {
  handleDownload: (video: VideoInfo, quality: number) => Promise<void>
  handleMultiPartDownload: (video: VideoInfo, quality: number) => Promise<void>
  isDownloading: boolean
}
```

**功能**:
- 处理单P视频下载
- 处理多P视频下载
- 创建调度器管理多P任务
- 错误处理和用户反馈

## API 服务

### api.ts
统一的 API 客户端，处理所有 HTTP 请求。

```typescript
class ApiService {
  // 媒体相关
  getVideoInfo(bvid: string): Promise<ApiResponse<VideoInfo>>
  getFavoritesInfo(fid: string): Promise<ApiResponse<FavoritesInfo>>
  getWatchLater(): Promise<ApiResponse<WatchLaterInfo>>
  
  // 队列相关
  submitTask(taskData: TaskCreate): Promise<ApiResponse<Task>>
  getTasks(): Promise<ApiResponse<Task[]>>
  updateTask(taskId: string, updates: Partial<Task>): Promise<ApiResponse<Task>>
  
  // 调度器相关
  createScheduler(schedulerData: SchedulerCreate): Promise<ApiResponse<Scheduler>>
  startScheduler(schedulerId: string): Promise<ApiResponse<void>>
  pauseScheduler(schedulerId: string): Promise<ApiResponse<void>>
  
  // 认证相关
  login(sessdata: string): Promise<ApiResponse<User>>
  logout(): Promise<ApiResponse<void>>
  
  // 设置相关
  getSettings(): Promise<ApiResponse<Settings>>
  updateSettings(settings: Partial<Settings>): Promise<ApiResponse<Settings>>
}
```

## 性能优化

### 1. 代码分割
使用 React.lazy 和 Suspense 进行代码分割：
```typescript
const VideoDetailPage = React.lazy(() => import('./pages/VideoDetailPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
```

### 2. 状态管理优化
- Zustand 的轻量级状态管理
- 持久化存储关键状态
- 避免不必要的重渲染

### 3. 组件优化
- React.memo 优化组件重渲染
- useMemo 和 useCallback 优化函数和计算
- 虚拟化长列表（待实现）

### 4. 网络请求优化
- 请求缓存
- 取消重复请求
- 错误重试机制

## 错误处理

### 错误边界
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    // 上报错误到监控系统
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
```

### API 错误处理
```typescript
try {
  const response = await apiService.submitTask(taskData)
  if (response.success) {
    // 处理成功
  } else {
    // 处理 API 错误
    console.error('API error:', response.message)
  }
} catch (error) {
  // 处理网络错误
  console.error('Network error:', error)
}
```

## 类型安全

### TypeScript 严格模式
- 启用严格类型检查
- 完整的类型定义
- 避免使用 any 类型

### 类型定义示例
```typescript
interface User {
  mid: string
  name: string
  avatar: string
  is_active: boolean
  created_at: number
}

interface Task {
  id: string
  media_type: string
  media_id: string
  title: string
  cover: string | null
  state: TaskState
  progress: number
  scheduler_id: string | null
  created_at: number
}

interface Scheduler {
  id: string
  title: string
  state: SchedulerState
  list: string[]
  count: number
  folder: string | null
  created_at: number
}
```

## 开发规范

### 组件命名
- **组件**: PascalCase (`VideoCard.tsx`)
- **Hook**: camelCase with `use` prefix (`useVideoDownload`)
- **工具函数**: camelCase (`formatDuration`)
- **常量**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### 代码风格
- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 遵循 React 最佳实践

### 注释规范
- 使用 JSDoc 注释复杂函数
- 使用 TODO 注释标记待办事项
- 使用 FIXME 注释标记需要修复的问题

## 相关文档

- [项目概述](../base/project-overview.md)
- [后端架构](./backend-architecture.md)
- [数据库架构](../database/database-architecture.md)
- 开发指南：仓库根目录 `AGENTS.md`

---

**文档版本**: 1.0.0
**最后更新**: 2026-04-15
**维护者**: PiliNote Team
