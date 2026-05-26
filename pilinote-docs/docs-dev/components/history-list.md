# HistoryList 历史记录

## 概述

历史记录功能模块，自动记录用户解析过的 B 站链接，支持快速访问和管理浏览历史。

## 文件位置

```
apps/web/src/
├── stores/history.ts           # 状态管理 (HistoryStore)
└── pages/components/
    ├── HistoryList.tsx          # 历史记录列表组件
    └── HistoryCard.tsx          # 单条历史记录卡片组件
```

## 数据结构

### HistoryItem
历史记录项接口，定义单条历史记录的数据结构。

```typescript
interface HistoryItem {
  id: string;                    // bvid 或 opusId
  type: 'video' | 'opus';        // 媒体类型
  title: string;                 // 标题
  cover: string;                 // 封面URL
  duration: number;              // 时长（秒）
  uploader: string;              // UP主名称
  uploader_mid: number;          // UP主 ID
  timestamp: number;             // 添加时间戳
  view_count?: number;           // 播放量（可选）
  danmaku_count?: number;        // 弹幕数（可选）
}
```

### HistoryState
历史记录状态接口，定义状态管理的数据结构。

```typescript
interface HistoryState {
  history: HistoryItem[];        // 历史记录列表
  maxHistorySize: number;        // 最大历史记录数量
  
  // Actions
  addToHistory: (item: HistoryItem) => void;      // 添加到历史记录
  removeFromHistory: (id: string) => void;        // 删除单条记录
  clearHistory: () => void;                        // 清空所有记录
  getHistory: () => HistoryItem[];                // 获取历史记录
}
```

## 核心组件

### 1. HistoryStore (history.ts)

使用 Zustand + persist 中间件的状态管理器，负责历史记录的存储和管理。

#### 功能特性
- **持久化存储**：数据自动保存到 localStorage
- **自动去重**：相同 ID 的记录会更新时间戳并移到最前
- **数量限制**：最多保存 20 条记录，超出后删除最旧的
- **存储键名**：`pilinote-history`

#### 使用示例
```typescript
import { useHistoryStore } from '../../stores/history';

function MyComponent() {
  const addToHistory = useHistoryStore((state) => state.addToHistory);
  const history = useHistoryStore((state) => state.history);
  
  // 添加到历史记录
  addToHistory({
    id: 'BV1xx411c7mD',
    type: 'video',
    title: '视频标题',
    cover: 'https://example.com/cover.jpg',
    duration: 180,
    uploader: 'UP主名称',
    uploader_mid: 123456789,
    timestamp: Date.now(),
  });
  
  // 获取历史记录
  const allHistory = useHistoryStore.getState().getHistory();
}
```

### 2. HistoryCard (HistoryCard.tsx)

单条历史记录卡片组件，显示历史记录的简要信息。

#### Props
```typescript
interface HistoryCardProps {
  item: HistoryItem;             // 历史记录项
  onDelete: (id: string) => void; // 删除回调
}
```

#### 功能特性
- **类型标识**：显示"视频"或"图文"标签，使用不同颜色区分
- **时间显示**：显示相对时间（如"5分钟前"、"2小时前"）
- **点击导航**：点击卡片跳转到对应详情页
- **删除功能**：独立的删除按钮，支持删除单条记录
- **无障碍支持**：使用语义化标签和 ARIA 属性

#### 时间显示规则
| 时间差 | 显示格式 |
|--------|----------|
| < 1 分钟 | "刚刚" |
| < 1 小时 | "N分钟前" |
| < 1 天 | "N小时前" |
| < 1 周 | "N天前" |
| < 1 个月 | "N周前" |
| < 1 年 | "N个月前" |
| ≥ 1 年 | "N年前" |

### 3. HistoryList (HistoryList.tsx)

历史记录列表组件，显示所有历史记录并提供管理功能。

#### 功能特性
- **空状态显示**：无历史记录时显示友好的空状态提示
- **记录统计**：显示历史记录总数量
- **批量操作**：支持清空所有历史记录
- **确认对话框**：清空前显示确认提示，防止误操作

#### 布局结构
```
┌─────────────────────────────────────────────┐
│ 浏览历史                      10 条记录 🗑️  │
├─────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐        │
│ │ [视频] 标题    │ │ [图文] 标题    │        │
│ │ 🕐 5分钟前 ✕  │ │ 🕐 2小时前 ✕  │        │
│ └───────────────┘ └───────────────┘        │
│ ┌───────────────┐                          │
│ │ [视频] 标题    │                          │
│ │ 🕐 1天前 ✕    │                          │
│ └───────────────┘                          │
└─────────────────────────────────────────────┘
```

## 功能特性

### 自动记录
- 解析 B 站链接成功后自动添加到历史记录
- 解析成功时记录视频/图文的元信息（标题、封面、UP主等）
- 已存在的记录会更新时间戳并移到最前

### 持久化存储
- 使用 Zustand persist 中间件
- 数据自动保存到浏览器 localStorage
- 刷新页面后数据保留

### 数量限制
- 默认最多保存 20 条历史记录
- 超出限制时自动删除最旧的记录
- 通过 `maxHistorySize` 配置

### 管理功能
- **删除单条**：点击卡片右上角的删除图标（✕）
- **清空全部**：点击头部右侧的清空图标（🗑️）（需确认）
- **快速访问**：点击卡片跳转到详情页

### 响应式设计
- **移动端**（< 375px）：单列布局
- **平板**（768px - 1024px）：双列布局
- **桌面**（≥ 1024px）：多列网格布局

### 类型区分
- **视频**：蓝色标签 (#2563EB)
- **图文**：粉色标签 (#FB7299)

## 使用示例

### 在首页集成历史记录

```typescript
import HistoryList from './components/HistoryList';
import { useHistoryStore } from '../../stores/history';

function HomeContent() {
  const addToHistory = useHistoryStore((state) => state.addToHistory);
  
  const handleParseUrl = async () => {
    const response = await apiService.parseDownloadUrl(url);
    
    if (response.success && response.data?.video) {
      const video = response.data.video;
      const parsedId = response.data.parsed_id;
      
      // 添加到历史记录
      if (parsedId) {
        addToHistory({
          id: parsedId.id,
          type: parsedId.type === 'opus' ? 'opus' : 'video',
          title: video.title,
          cover: video.pic,
          duration: video.duration || 0,
          uploader: video.owner.name,
          uploader_mid: video.owner.mid,
          timestamp: Date.now(),
        });
      }
    }
  };
  
  return (
    <div>
      {/* 解析输入框 */}
      {/* 解析结果卡片 */}
      
      {/* 历史记录列表 */}
      <HistoryList />
    </div>
  );
}
```

### 自定义历史记录显示

```typescript
import { useHistoryStore } from '../../stores/history';

function CustomHistoryView() {
  const history = useHistoryStore((state) => state.history);
  const removeFromHistory = useHistoryStore((state) => state.removeFromHistory);
  
  return (
    <div>
      <h2>最近浏览</h2>
      <ul>
        {history.map((item) => (
          <li key={item.id}>
            <span>{item.type}: {item.title}</span>
            <button onClick={() => removeFromHistory(item.id)}>
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 样式说明

### 主要 CSS 类

| 类名 | 说明 |
|------|------|
| `.history-list` | 历史记录列表容器 |
| `.history-list-header` | 列表头部 |
| `.history-list-header-actions` | 头部操作区域（数量 + 清空按钮） |
| `.history-list-title` | 标题文本 |
| `.history-list-count` | 记录数量 |
| `.history-list-grid` | 网格布局容器 |
| `.history-card` | 历史记录卡片 |
| `.history-card-type` | 类型标签 |
| `.history-card-type.video` | 视频类型样式 |
| `.history-card-type.opus` | 图文类型样式 |
| `.history-card-title` | 标题文本 |
| `.history-card-meta` | 元数据（时间等） |
| `.history-card-delete-icon` | 删除图标 |
| `.history-list-clear-btn` | 清空按钮（小图标样式） |
| `.history-list-empty` | 空状态容器 |

### 响应式断点

| 屏幕尺寸 | 网格列数 | 卡片最小宽度 |
|----------|----------|--------------|
| < 375px | 1 列 | 100% |
| 375px - 767px | 自适应 | 280px |
| 768px - 1023px | 自适应 | 240px |
| ≥ 1024px | 自适应 | 220px |

### 颜色方案

| 元素 | 颜色 | 说明 |
|------|------|------|
| 视频标签背景 | rgba(37, 99, 235, 0.1) | 蓝色半透明 |
| 视频标签文字 | #2563EB | 蓝色 |
| 图文标签背景 | rgba(251, 114, 153, 0.1) | 粉色半透明 |
| 图文标签文字 | #FB7299 | 粉色 |
| 卡片背景 | #F8FAFC | 浅灰蓝 |
| 卡片悬停背景 | #F1F5F9 | 深一点的灰蓝 |
| 删除按钮文字 | #EF4444 | 红色 |

## 关联组件

- [HomeContent](home-content.md) - 首页内容（集成历史记录）
- [VideoDetailPage](video-detail-page.md) - 视频详情页（历史记录跳转目标）
- [ConfirmModal](confirm-modal.md) - 确认对话框（清空确认）

## 存储位置

- **存储类型**：localStorage
- **存储键名**：`pilinote-history`
- **数据格式**：JSON 序列化的 HistoryItem 数组
- **持久化中间件**：Zustand persist

## 注意事项

1. **隐私保护**：历史记录仅存储在浏览器本地，不会上传到服务器
2. **存储限制**：localStorage 有约 5MB 的存储限制
3. **浏览器兼容性**：需要支持 localStorage 的现代浏览器
4. **时间显示**：时间戳使用浏览器本地时间
5. **ID 唯一性**：使用 bvid 或 opusId 作为唯一标识

## 更新日志

### 2026-04-13 - UI 优化：简化操作布局

#### 优化
- **布局调整**：
  - 清空历史按钮移至头部，位于历史记录数量右侧
  - 删除底部 `.history-list-actions` 容器
  - 清空按钮改为纯图标样式（只显示垃圾桶图标）
- **删除图标优化**：
  - 卡片删除按钮改为纯图标样式
  - 去掉按钮背景和边框，只保留图标功能
  - 悬停时红色高亮
- **样式更新**：
  - 新增 `.history-list-header-actions` 样式（头部操作区域）
  - `.history-card-delete-btn` 改为 `.history-card-delete-icon`
  - 清空按钮从底部大按钮改为头部小图标

### 2026-04-13 - 历史记录功能上线

#### 新增
- **HistoryStore**：基于 Zustand 的状态管理器
  - 支持添加、删除、清空历史记录
  - 持久化存储到 localStorage
  - 最多保存 20 条记录
- **HistoryCard 组件**：单条历史记录卡片
  - 显示类型标签（视频/图文）
  - 显示相对时间
  - 支持删除操作
  - 点击跳转到详情页
- **HistoryList 组件**：历史记录列表
  - 响应式网格布局
  - 空状态提示
  - 清空所有记录功能
  - 确认对话框
- **样式设计**：
  - 移动端优先的响应式设计
  - 平滑的悬停和点击动画
  - 清晰的类型标识颜色
  - 无障碍支持（ARIA 属性）

#### 集成
- **HomeContent 组件**：解析成功后自动添加到历史记录
- **index.css**：新增历史记录相关样式

---

## HistoryContent 观看历史页面组件

### 概述

HistoryContent 是观看历史页面的主要组件，提供完整的观看历史管理功能，包括分页加载、搜索、排序和下载管理。

### 文件位置

```
apps/web/src/pages/components/HistoryContent.tsx
```

### 功能特性

#### 1. 数据获取和状态管理
- 使用 `useVideoList` Hook 管理视频列表
- 支持无限滚动加载
- 自动分页（每页 20 条）
- 数据格式化（时长、数字、时间、进度等）

#### 2. 搜索和排序
- **关键词搜索**：支持按视频标题搜索
- **多种排序方式**：
  - 默认排序
  - 按播放量
  - 按发布时间
  - 按观看时间
- **排序方向**：支持升序和降序切换

#### 3. 下载管理
- 集成新下载系统（useNewQueueStore）
- 检查视频下载状态（未下载、队列中、已下载）
- 支持添加到下载队列
- 重复下载检测和确认
- 下载状态实时更新

#### 4. UI 组件
- **VideoListContainer**：视频列表容器
- **VideoListControls**：搜索和排序控制
- **AlertModal**：提示对话框
- **ConfirmModal**：确认对话框

#### 5. 用户体验
- 未登录时显示登录提示
- 空状态显示
- 加载状态显示
- 错误处理和提示

### 数据流

```
HistoryContent
    │
    ├── useVideoList (视频列表管理)
    │   ├── fetchHistoryVideos (获取观看历史)
    │   ├── formatItem (格式化视频数据)
    │   └── loadMore (加载更多)
    │
    ├── useVideoDownload (下载管理)
    │   ├── toggleDownload (切换下载状态)
    │   └── checkBeforeAdd (检查是否已下载)
    │
    ├── useNewQueueStore (新下载系统状态)
    │   ├── tasks (任务列表)
    │   ├── fetchTasks (获取任务)
    │   └── cleanupDuplicateCompletedTasks (清理重复任务)
    │
    └── VideoLibraryService (视频库服务)
        └── checkBeforeAdd (检查视频库状态)
```

### 组件状态

```typescript
interface HistoryContentState {
  // 数据状态
  totalCount: number;              // 总数量
  keyword: string;                 // 搜索关键词
  order: string;                   // 排序方式
  sortDirection: 'desc' | 'asc';   // 排序方向
  
  // 对话框状态
  alertModal: AlertModalState;     // 提示对话框
  confirmModal: ConfirmModalState; // 确认对话框
  
  // Refs
  tasksSyncedRef: boolean;         // 数据同步标志
}
```

### 关键功能实现

#### 1. 数据同步

```typescript
useEffect(() => {
  const syncData = async () => {
    if (tasksSyncedRef.current) return
    tasksSyncedRef.current = true

    try {
      // 清理本地缓存
      newQueueStore.forceClearCache()
      
      // 同步最新数据
      await newQueueStore.fetchTasks()
      await newQueueStore.fetchSchedulers()
      
      // 清理重复的已完成任务
      await newQueueStore.cleanupDuplicateCompletedTasks()
    } catch (error) {
      console.error('[History] 同步数据失败:', error)
    }
  }
  syncData()
}, [])
```

#### 2. 获取观看历史

```typescript
const fetchHistoryVideos = useCallback(async (page: number, pageSize: number) => {
  if (!user?.mid) {
    return { success: false, message: '缺少必要参数' }
  }
  
  const response = await apiService.getHistoryList(
    page, 
    pageSize, 
    keyword, 
    order, 
    sortDirection
  )
  return response
}, [user?.mid, keyword, order, sortDirection])
```

#### 3. 检查下载状态

```typescript
const getDownloadStatus = (bvid: string): 'none' | 'in_list' | 'downloaded' => {
  const tasks = newQueueStore.tasks
  const newSystemTasks = Object.values(tasks)
  
  // 检查是否在队列中
  const hasActiveTask = newSystemTasks.some(task =>
    task.media_id === bvid && !['completed', 'cancelled'].includes(task.state)
  )
  
  if (hasActiveTask) {
    return 'in_list'
  }
  
  // 检查是否已下载完成
  const hasCompletedTask = newSystemTasks.some(task =>
    task.media_id === bvid && task.state === 'completed'
  )
  
  if (hasCompletedTask) {
    return 'downloaded'
  }
  
  return 'none'
}
```

#### 4. 切换下载状态

```typescript
const toggleDownload = useCallback(async (video: any, e: React.MouseEvent) => {
  try {
    // 检查视频是否已下载
    const decision = await videoLibraryService.checkBeforeAdd(video)
    
    switch (decision.action) {
      case 'add':
        // 直接添加
        await baseToggleDownload(video, e)
        break
        
      case 'show_confirm':
        // 显示确认对话框
        setAlertModal({
          show: true,
          title: '重新下载视频',
          message: `视频 ${video.title} 已在视频库中，是否重新下载？`,
          type: 'info',
          showConfirm: true,
          onConfirm: async () => {
            await baseToggleDownload(video, e)
            setAlertModal(prev => ({ ...prev, show: false }))
          }
        })
        break
        
      case 'skip':
        // 静默跳过
        setAlertModal({
          show: true,
          title: '提示',
          message: `视频 ${video.title} 已下载，已在视频库中`,
          type: 'success'
        })
        break
    }
  } catch (error) {
    console.error('检查下载状态失败:', error)
    // 降级到原有逻辑
    const result = await baseToggleDownload(video, e)
    if (result.success) {
      if (result.shouldNavigateToLibrary) {
        navigate('/downloads', { replace: true })
        setTimeout(() => {
          setAlertModal({
            show: true,
            title: '操作成功',
            message: result.message,
            type: 'success'
          })
        }, 100)
      } else {
        setAlertModal({
          show: true,
          title: '操作成功',
          message: result.message,
          type: 'success'
        })
      }
    } else {
      setAlertModal({
        show: true,
        title: '操作失败',
        message: result.message,
        type: 'error'
      })
    }
  }
}, [baseToggleDownload, navigate])
```

### 排序选项

```typescript
const sortOptions = [
  { value: 'default', label: '默认' },
  { value: 'view', label: '按播放量' },
  { value: 'pubtime', label: '按发布时间' },
  { value: 'view_time', label: '按观看时间' }
]
```

### 数据格式化

HistoryContent 使用 `videoFormatters` 工具函数格式化数据：

- `formatDuration(seconds)`: 格式化视频时长（秒 → "MM:SS"）
- `formatNumber(num)`: 格式化数字（1000 → "1.0k"）
- `formatProgress(progress, duration)`: 格式化观看进度（秒/秒 → "50%"）
- `formatTime(timestamp)`: 格式化时间戳（时间戳 → "2小时前"）

### Props

HistoryContent 不接收任何 props，它是一个独立的功能页面组件。

### 依赖项

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useNewQueueStore } from '../../stores/newQueue'
import { videoLibraryService } from '../../services/videoLibraryService'
import { formatDuration, formatNumber, formatProgress, formatTime } from '../../utils/videoFormatters'
import { useVideoList } from '../../hooks/useVideoList'
import { useVideoDownload } from '../../hooks/useVideoDownload'
import VideoListContainer from '../../components/VideoListContainer'
import VideoListControls from '../../components/VideoListControls'
import AlertModal from '../../components/AlertModal'
import ConfirmModal from '../../components/ConfirmModal'
```

### 使用场景

HistoryContent 组件用于 `/history` 路由，提供完整的观看历史管理功能。

### 与 HistoryList 的区别

| 特性 | HistoryList | HistoryContent |
|------|-------------|----------------|
| 用途 | 本地浏览历史（前端记录） | B 站观看历史（B站数据） |
| 数据来源 | localStorage | B 站 API |
| 数据范围 | 解析过的链接 | 观看过的视频 |
| 搜索 | 不支持 | 支持 |
| 排序 | 不支持 | 支持 |
| 分页 | 固定 20 条 | 支持无限滚动 |
| 下载 | 不支持 | 支持完整下载管理 |

### 性能优化

1. **useCallback**：缓存 fetchFn 等函数，避免不必要的重渲染
2. **useRef**：使用 Ref 追踪数据同步状态，避免重复同步
3. **懒加载**：使用无限滚动，按需加载数据
4. **数据缓存**：使用 Zustand persist 缓存下载状态

### 相关组件

- [VideoListContainer](video-list-container.md) - 视频列表容器
- [VideoListControls](video-list-controls.md) - 搜索和排序控制
- [AlertModal](alert-modal.md) - 提示对话框
- [ConfirmModal](confirm-modal.md) - 确认对话框

### 相关 Hooks

- [useVideoList](../../apps/web/src/hooks/useVideoList.ts) - 视频列表管理
- [useVideoDownload](../../apps/web/src/hooks/useVideoDownload.ts) - 下载管理

### 相关服务

- [apiService](../../apps/web/src/services/api.ts) - API 服务
- [videoLibraryService](../../apps/web/src/services/videoLibraryService.ts) - 视频库服务

### 相关 Store

- [useAuthStore](../../apps/web/src/stores/auth.ts) - 认证状态
- [useNewQueueStore](../../apps/web/src/stores/newQueue.ts) - 新下载系统状态

---

[返回上级](./README.md)
