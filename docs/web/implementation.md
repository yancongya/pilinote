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
│       ├── FavoriteList.tsx
│       ├── WatchLaterList.tsx
│       ├── VideoListCard.tsx
│       └── DownloadQueue.tsx
├── stores/          # Zustand 状态管理
├── hooks/           # 自定义 Hooks
└── services/       # API 服务
```

## 核心组件

### MainLayout

主布局组件，包含导航栏和侧边栏。

```tsx
// 主要功能
- 主题切换 (theme)
- 登录状态检查
- 布局渲染
```

### 页面组件

| 组件 | 说明 |
|------|------|
| LoginPage | 登录页面（SESSDATA/二维码/手机验证码）|
| SettingsPage | 设置页面（下载/存储/通用/自动下载）|
| VideoDetailPage | 视频详情页面 |
| HomeContent | 首页内容 |

### 视频列表

| 组件 | 说明 |
|------|------|
| FavoriteList | 收藏夹列表 |
| WatchLaterList | 稍后再看列表 |
| VideoListCard | 视频卡片 |

## 状态管理 (Zustand)

### 认证状态

```typescript
interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (sessdata: string) => Promise<void>
  logout: () => Promise<void>
  checkStatus: () => Promise<void>
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
interface SettingsStore {
  settings: Settings | null
  loading: boolean
  updateSettings: (update: Partial<Settings>) => Promise<void>
  fetchSettings: () => Promise<void>
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
const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/favorites', element: <FavoritesPage /> },
  { path: '/watchlater', element: <WatchLaterPage /> },
  { path: '/download', element: <DownloadPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/video/:id', element: <VideoDetailPage /> },
]
```

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