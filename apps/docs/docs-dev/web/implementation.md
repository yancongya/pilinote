# 前端实现

## 项目结构

```
apps/web/src/
├── components/        # 通用组件
├── pages/           # 页面组件
│   ├── LoginPage.tsx
│   ├── SettingsPage.tsx
│   ├── VideoDetailPage.tsx
│   └── components/
│       ├── HomeContent.tsx
│       ├── FavoritesContent.tsx
│       ├── WatchLaterContent.tsx
│       ├── HistoryContent.tsx
│       └── SubscriptionsContent.tsx
├── stores/          # Zustand 状态管理
├── hooks/           # 自定义 Hooks
└── services/       # API 服务
```

## 核心组件

### MainLayout

主布局组件，包含导航栏、侧边栏和内容区域。

```tsx
// 主要功能
- 智能响应式侧边栏系统
- 拖拽调整宽度功能
- 自动收缩机制
- 固定高度独立滚动
- 主题切换 (dark mode)
- 登录状态检查
- 布局渲染
- 导航管理
```

智能响应式侧边栏系统特性：
- **自动响应式切换**：基于屏幕尺寸自动切换侧边栏/底部导航
  - 移动端（< 768px）：自动显示底部导航栏
  - 桌面端（≥ 768px）：自动显示左侧固定侧边栏
- **拖拽调整宽度**：支持拖拽侧边栏右侧边界调整宽度（180px-400px）
- **智能收缩机制**：拖拽宽度小于200px时自动收缩，大于等于200px时自动展开
- **双重折叠触发**：点击底部折叠按钮或拖拽调整宽度
- **固定高度布局**：侧边栏完全固定，无页面级别滚动
- **独立滚动区域**：侧边栏导航和内容区域可以独立滚动

主题系统特性：
- 支持 亮色/暗色 模式切换
- 使用 CSS 变量实现统一设计令牌
- localStorage 持久化用户偏好
- 自动检测系统主题设置
- 所有组件适配暗色模式

**技术实现**：
- 使用useEffect监听窗口尺寸变化，实时切换布局
- 通过鼠标事件监听实现流畅的拖拽调整功能
- 200px宽度阈值自动触发收缩/展开状态
- 固定高度布局：body/html height: 100vh，overflow: hidden
- 独立滚动：SidebarNav和ContentArea可以独立滚动
- 自定义滚动条样式：6px宽度，主题颜色，悬停效果

### 页面组件

| 组件 | 说明 |
|------|------|
| LoginPage | 登录页面 |
| SettingsPage | 设置页面（统一 settings 设计系统，含下载/存储/通用/自动下载/AI 笔记等）|
| VideoDetailPage | 视频/图文详情页（`/video/:videoId`、`/opus/:opusId`；含 AI 笔记子路由入口） |
| HomeContent | 首页内容（挂载于 `MainLayout` 的 `/home`） |
| FavoritesContent | 收藏夹页（列表与详情共用，依赖路由参数 `folderId`） |
| WatchLaterContent | 稍后再看页 |
| HistoryContent | 历史记录页 |
| SubscriptionsContent | 订阅源页（支持 `sourceType/sourceId` 子路由） |

### 视频详情页

`VideoDetailPage` 已从旧的桌面双栏结构收敛为 B 站 App 风格的单列流式页面：

- 顶部为 sticky 返回栏，标题单行截断，点击后会打开原始 B 站网页
- 标题栏右侧使用 AI 图标按钮，直接进入 AI 笔记子路由
- 返回按钮和右侧入口都做了更明显的暗色模式适配
- 封面 / 本地播放器位于首屏主视觉
- 作者面板位于封面下方，视频简介紧随其后
- 评论区和下载状态组件都保留在下方卡片序列中，下载状态放在评论区之后
- 图文（Opus）同样沿用这套单列节奏，正文和图片按阅读顺序渲染
- `Outlet` 保留在详情页底部，用于 AI 笔记子路由继续挂载

布局原则：

- PC 与手机共用同一套结构，不再有桌面双栏容器
- 只保留字号、圆角、间距的轻度响应式差异
- 所有功能入口继续保留，不删减视频下载、本地播放、评论展示或分 P 列表

#### 刷新与加载态

- 首次进入和刷新时统一先显示骨架屏，不再使用纯文本“加载中...”状态
- 骨架屏采用更柔和的 shimmer 动画，并加入错位延迟，避免整页同步闪烁
- 详情接口短暂失败时，会优先使用本地缓存的最近一次成功数据继续展示
- 只有缓存也不可用、且请求确认为失败时，才显示错误页或不存在页

#### 评论区样式

- 评论区标题只保留主标题，不再显示右上角数量
- 评论卡片采用更轻的背景与边框，去掉偏黑的面板感
- 作者名、置顶标签和头像底色统一收敛为更一致的中性色和强调色

### 历史型视频列表

收藏页、稍后再看页和历史记录页已经统一到同一套列表壳层和交互规范中：

- `MediaListTopBar` 统一顶部导航、数量徽章和筛选区
- `MediaListShell` 统一页面壳、顶部固定区、内容区和状态层
- `MediaListState` 统一首屏加载、加载更多、空态和错误态
- `VideoCardSkeleton` 统一骨架布局
- `VideoListContainer` 作为列表内容渲染器继续复用

这三页现在的共同规则是：

- 首屏先显示骨架，再填充内容
- 刷新时保留页面壳，不直接清空旧数据
- 加载更多只追加底部骨架，不打断当前滚动位置
- 筛选/排序变更后重新挂载当前面板，避免旧内容残留
- 顶部导航和筛选条由页面壳层固定在顶部，左右撑满内容区
- `useVideoList` 负责分页缓存、首屏 sessionStorage 复用、请求去重、短暂重试和加载更多冷却，避免同一页被重复触发
- 当收藏夹、稍后再看或历史列表的实时请求失败时，优先回退到缓存数据；如果只是加载更多失败，页面保留已加载内容，只显示底部提示，不会整页报错

### 登录状态校验

- `apps/web/src/stores/auth.ts` 的 `fetchUser()` 现在采用保守更新策略
- `/api/auth/status` 返回临时验证失败时，只要仍有活跃用户，前端不会自动清空登录态
- 只有明确没有活跃账号，或者用户手动退出时，才切换到游客态

### 开发环境 API 基址

开发环境下 `apps/web/src/config/api.ts` 会把 `localhost` 和 `::1` 统一映射到 `127.0.0.1`，避免本地浏览器因为 IPv6/主机名解析差异导致访问 API 异常。

- 推荐开发基址：`http://127.0.0.1:8000`
- WebSocket 也使用同样的主机名规则

相关文件：
- `apps/web/src/config/api.ts`
- `apps/web/src/components/NewDownload/TaskCard.tsx`
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`

### 视频列表

| 组件 | 说明 |
|------|------|
| FavoritesContent | 收藏夹列表/详情页 |
| WatchLaterContent | 稍后再看列表 |
| HistoryContent | 历史记录列表 |
| VideoListCard | 视频卡片（用于列表项展示） |

## 状态管理 (Zustand)

### 认证状态

```typescript
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  logout: () => void
  fetchUser: () => Promise<void>
  setIsLoading: (loading: boolean) => void
}
```

### 下载状态

```typescript
interface DownloadStore {
  queue: DownloadTask[]
  activeTasks: DownloadTask[]
  addTask: (task: DownloadTask) => Promise<void>
  removeTask: (id: string) => Promise<void>
  startTask: (id: string) => Promise<void>
}
```

### 设置状态

```typescript
interface SettingsState {
  settings: Settings | null
  loading: boolean
  error: string | null
  fetchSettings: () => Promise<void>
  updateSettings: (updates: Partial<Settings>) => Promise<void>
  resetSettings: (category?: string) => Promise<void>
  exportSettings: () => Promise<string>
  importSettings: (data: string) => Promise<void>
}
```

## API 服务

### apiService

```typescript
// 认证相关
loginBySessdata(sessdata: string): Promise<LoginResult>
getUserInfo(): Promise<UserInfo>
getFavorites(): Promise<Favorite[]>
getWatchLater(): Promise<Video[]>

// 下载相关
addToQueue(mediaId: string, quality: number): Promise<Task>
getQueue(): Promise<Task[]>
controlTask(id: string, action: string): Promise<void>

// 设置相关
getSettings(): Promise<Settings>
updateSettings(settings: Partial<Settings>): Promise<Settings>
```

## 路由

```typescript
<Routes>
  <Route path="/" element={<Navigate to="/home" replace />} />
  <Route path="/home" element={<MainLayout />} />
  <Route path="/favorites" element={<MainLayout />} />
  <Route path="/favorites/:folderId" element={<MainLayout />} />
  <Route path="/watch-later" element={<MainLayout />} />
  <Route path="/history" element={<MainLayout />} />
  <Route path="/subscriptions" element={<MainLayout />} />
  <Route path="/subscriptions/:sourceType/:sourceId" element={<MainLayout />} />
  <Route path="/downloads" element={<MainLayout />} />
  <Route path="/opus/:opusId" element={<VideoDetailPage type="opus" />} />
  <Route path="/opus/:opusId/ai" element={<AiNotePanel />} />
  <Route path="/video/:videoId" element={<VideoDetailPage />} />
  <Route path="/video/:videoId/ai" element={<AiNotePanel />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
  <Route path="*" element={<Navigate to="/home" replace />} />
</Routes>
```

说明：
- `MainLayout` 是承载型路由组件：`/home`、`/favorites*`、`/watch-later`、`/history`、`/subscriptions*`、`/downloads` 都复用同一套布局与页面壳层。
- 详情页有两类：视频（`/video/:videoId`）与图文（`/opus/:opusId`），并各自提供 AI 笔记子路由（`/ai`）。
- `AiNotePanel` 既会作为详情页内的可复用面板（组件路径）出现，也被用于 `/video/:videoId/ai`、`/opus/:opusId/ai` 作为独立路由页面。

### SettingsPage 页面系统

设置页已经从“单页局部样式”升级为统一的页面级设计系统，后续所有设置 tab 默认都应先复用这套结构。

**核心组件**：
- `SettingsPageShell` - 页面壳层
- `SettingsTabPanel` - tab 切换过渡容器
- `SettingsSection` - 面板组
- `SettingsField` - 字段块
- `SettingsToggleRow` - 开关行
- `SettingsActionRow` - 操作行
- `SettingsStatusBadge` - 状态徽章
- `SettingsLoadingState` / `SettingsEmptyState` - 状态页

**设计原则**：
- 保持一层主 surface
- 减少嵌套卡片和深色容器
- 按钮默认使用 outlined / tonal 语义
- tab 过渡使用淡入与轻微位移
- 优先让局部布局服从统一节奏，而不是反过来定义新的视觉语言

## WebSocket 连接

用于实时下载进度：

```typescript
const ws = new WebSocket('ws://localhost:8000/ws')

ws.onmessage = (event) => {
  const progress = JSON.parse(event.data)
  updateDownloadProgress(progress)
}
```

## 环境配置

```typescript
// .env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## 关联文档

- [api/implementation.md](../api/implementation.md) - 后端实现
- [settings/README.md](../settings/README.md) - 设置模块

---

[返回上级](../README.md)
