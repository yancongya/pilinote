# VideoDetailPage 组件

## 概述

视频/图文详情页面组件，支持显示视频和图文（Opus）两种类型的内容详情。

## 文件位置

`apps/web/src/pages/VideoDetailPage.tsx`

## 组件接口

```typescript
interface VideoDetailPageProps {
  type?: 'video' | 'opus'  // 默认 'video'
}
```

## 功能特性

### 1. 支持多种媒体类型

| 类型 | 说明 | 参数 |
|------|------|------|
| 视频 | 普通视频内容 | `type="video"` |
| 图文 | B站专栏文章（Opus） | `type="opus"` |

### 2. 数据获取

- **视频**: 通过 `apiService.getVideoDetail()` 获取
- **图文**: 通过 `apiService.parseDownloadUrl()` 获取，参数格式 `cv{mediaId}`

### 3. 页面布局

#### 视频布局
```
┌─────────────────────────────────┐
│  ← 标题                        │ ← 顶部导航
├─────────────────────────────────┤
│ [封面图片]                      │ ← 16:9 比例
│                          00:00  │ ← 时长
├─────────────────────────────────┤
│ 标题 (可点击跳转)               │
├─────────────────────────────────┤
│ [头像] UP主名称                 │ ← UP主信息
├─────────────────────────────────┤
│ 2024-01-01 12:00              │ ← 发布时间
│ 1000播放 100弹幕 ❤️500 🪙100   │ ← 统计信息
├─────────────────────────────────┤
│ 视频简介...                     │
├─────────────────────────────────┤
│ [P1: xxx  05:30]               │ ← 分P列表
│ [P2: xxx  10:00]               │
├─────────────────────────────────┤
│        添加到列表               │ ← 下载按钮
└─────────────────────────────────┘
```

#### 图文布局
```
┌─────────────────────────────────┐
│  ← 标题                        │ ← 顶部导航
├─────────────────────────────────┤
│ [封面图片]                      │
│                          图文   │ ← 图文标记
├─────────────────────────────────┤
│ 标题 (可点击跳转)               │
├─────────────────────────────────┤
│ [头像] 作者名    👍100 ⭐50 💬20 🔗10 │ ← 作者信息 + 统计信息（右对齐）
│      2024-01-01                │
├─────────────────────────────────┤
│ 段落文本...                     │ ← 图文内容
│ [图片]                         │
│ 段落文本...                     │
├─────────────────────────────────┤
│        添加到列表               │ ← 下载按钮
└─────────────────────────────────┘
```

## 核心功能

### 1. 下载功能

- 支持单个视频和多P视频
- 显示已添加的分P数量
- 提供添加到下载列表/从列表移除功能

### 2. 时间格式化

支持两种时间格式：
- 时间戳（数字）：自动转换为 `年-月-日 时:分`
- 日期字符串：直接显示日期

### 3. 链接解析

自动识别文本中的 URL 并转换为可点击链接。

### 4. 统计信息显示

#### 视频统计
| 图标 | 说明 | 数据字段 |
|------|------|---------|
| 👁 Eye | 播放量 | `video.view` |
| 💬 MessageCircle | 弹幕数 | `video.danmaku` |
| 👍 ThumbsUp | 点赞数 | `video.like` |
| 🪙 Coins | 投币数 | `video.coin` |
| ⭐ Star | 收藏数 | `video.favorite` |
| 💬 MessageCircle | 评论数 | `video.reply` |
| 🔗 Share2 | 分享数 | `video.share` |

#### 图文统计
| 图标 | 说明 | 数据字段 |
|------|------|---------|
| 👍 ThumbsUp | 点赞数 | `video.like` |
| ⭐ Star | 收藏数 | `video.favorite` |
| 💬 MessageCircle | 评论数 | `video.reply` |
| 🔗 Share2 | 分享数 | `video.share` |

> **注意**: 图文的统计数据来源于 `data.video.stat`，由后端已经扁平化处理，直接使用数字值即可。
> 发布时间仅显示在作者信息下方，底部统计区域不再重复显示。

### 5. 评论区显示

- 视频详情页会优先从本地 NFO 读取评论数据，再回退到后端媒体处理器返回的评论数据
- 当前页面展示热门评论区域，最多显示 3 条评论
- 评论字段包含 `type`、`author`、`content`、`like`、`reply`、`time`
- 评论展示仅在 `video.comments.length > 0` 时出现

**数据链路**：

1. 前端调用 `apiService.getVideoDetail()`
2. 后端 `apps/api/src/routers/video.py` 先尝试从本地 NFO 中提取 `comments`
3. 如果本地无评论，则回退到 `media_info.nfo.comments`
4. 前端将 `data.comments` 写入 `VideoDetailPage` 状态并渲染评论区

### 6. 本地视频播放

- 已下载视频默认仍显示封面
- 当存在本地可播放文件时，封面区域可点击
- 点击封面后，封面容器会原地切换为本地 `<video>` 播放器
- 单视频会直接播放唯一的本地文件
- 多 P 视频优先播放当前详情页对应的 `cid`
- 如果当前 `cid` 未下载，则不会自动猜测其他分 P，而是让用户从已下载分 P 列表中点击播放

**播放链路**：

1. 前端通过 `apiService.getLocalPlaybackMap(bvid)` 获取本地播放映射
2. 后端 `/api/video-library/playback/{bvid}` 返回本地文件列表
3. 前端使用 `videoDetailPlayback.ts` 选择默认可播放文件
4. `<video>` 的 `src` 通过 `/api/library/video?file_path=...` 代理本地文件

### 7. 视频库状态检查

在添加下载前检查视频是否已下载，避免重复添加：

- 使用 `VideoLibraryService` 检查视频是否已下载
- 已下载的视频显示"重新下载"按钮
- 显示确认对话框让用户确认是否重新下载
- 避免重复添加已下载的视频

**使用示例**：

```typescript
import { videoLibraryService } from '../../services/videoLibraryService'

const handleAddToDownload = async (video: VideoInfo) => {
  const decision = await videoLibraryService.checkBeforeAdd(video)
  
  switch (decision.action) {
    case 'add':
      // 直接添加
      await addVideoToQueue(video)
      break
      
    case 'show_confirm':
      // 显示确认对话框
      const confirmed = await videoLibraryService.showReDownloadDialog(video)
      if (confirmed) {
        await addVideoToQueue(video)
      }
      break
      
    case 'skip':
      // 静默跳过
      showToast('视频已下载，已在视频库中', 'info')
      break
  }
}
```

## 使用示例

```typescript
import VideoDetailPage from './pages/VideoDetailPage'

// 视频详情页
<Route path="/video/:videoId" element={<VideoDetailPage />} />

// 图文详情页
<Route path="/opus/:opusId" element={<VideoDetailPage type="opus" />} />
```

## 关联组件

- [AlertModal](alert-modal.md) - 提示弹窗
- [VideoListContainer](video-list-container.md) - 视频列表容器

## 路由参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `videoId` | 视频BV号 | `BV1xx411c7mD` |
| `opusId` | 图文CV号 | `123456789` |

## 最新更新

### 2026-04-17 - 视频详情页全面优化

#### 新增功能
- **点击导航功能**: 视频库卡片可以点击跳转到详情页
  - 从 NFO 文件获取 bvid，跳转到 `/video/{bvid}`
  - 使用 `position: fixed` 占据整个视口
  - 支持返回按钮导航

#### 主题支持
- **完整主题系统**: 添加了暗色/亮色主题支持
  - 使用 CSS 变量替换所有固定颜色
  - 背景色、文字色都支持主题切换
  - 完美适配系统主题切换

#### 滚动功能
- **双层容器架构**: 修复了页面滚动问题
  - 外层视口容器：`position: fixed` + `overflow-y: auto`
  - 内层内容容器：用于居中和响应式布局
  - 支持移动端和桌面端滚动
  - 启用 `-webkit-overflow-scrolling: touch` 优化移动端体验

#### 响应式布局
- **三级响应式设计**: 实现移动端、平板、桌面端的响应式设计
  - Mobile (< 768px): 紧凑布局，最大宽度100%
  - Tablet (768px-1023px): 中等布局，最大宽度900px
  - Desktop (≥ 1024px): 宽敞布局，最大宽度1000px
  - 根据屏幕尺寸动态调整样式

#### 拟态滚动条
- **自定义滚动条样式**: 替换原生滚动条为拟态设计
  - 使用渐变色和阴影效果
  - 支持悬停和激活状态
  - 完美适配亮色和暗色主题
  - 6px宽度，圆角设计

#### 下载状态检查
- **智能状态识别**: 修复了下载状态识别问题
  - 支持视频库、下载队列、完成状态的检查
  - 为单个视频和多分P视频分别实现状态检查
  - 显示"已下载"、"队列中"等状态标签
  - 集成 VideoLibraryService 进行状态检查

#### 调试日志
- **详细日志记录**: 添加了详细的调试日志
  - 帮助诊断下载状态检查问题
  - 记录状态检查的全过程
  - 使用 `console.log` 输出关键状态信息

#### 技术优化
- **状态管理优化**: 使用 `newQueueStore` 和 `videoLibraryService`
  - 统一的状态管理
  - 避免重复请求
  - 实时状态更新
  - 缓存优化

### 2026-04-17 - 评论显示与本地播放

#### 评论显示
- **评论区回填**: 视频详情页接入 `data.comments`
  - 后端优先从本地 NFO 中读取评论
  - 本地没有时回退到媒体处理器返回的评论
  - 前端在封面下方展示热门评论区域

#### 本地播放
- **封面即播放器入口**: 已下载视频点击封面直接播放本地文件
  - 默认保持封面展示，不直接暴露原生播放器
  - 点击后原地切换为 `<video>` 组件
  - 支持从本地视频库接口获取可播放文件路径

#### 多P支持
- **按分P精确播放**: 系列视频优先播放当前 `cid`
  - 如果当前分P未下载，不自动切换到其他分P
  - 已下载的分P在列表中显示“播放本地”状态
  - 当前播放中的分P会高亮显示

---

## 历史更新

### 2026-04-12 - 图文详情页优化

#### 修复
- **统计数据为0问题**: 修正图文统计数据获取路径，从 `data.video.stat` 获取（后端已扁平化处理）
  - 之前错误地从 `data.stat` 或 `data.video?.stat` 获取，导致数据为空

#### 优化
- **图标替换**: 将统计信息中的 emoji 替换为 `lucide-react` 图标库
  - 导入图标: `ThumbsUp, Star, MessageCircle, MessageSquare, Share2, Coins, Eye`
  - 统一图标大小为 `size={12}`
  - **语义区分**: 弹幕使用 `MessageSquare`（对话气泡），评论使用 `MessageCircle`（圆圈消息）
  
- **布局调整**: 图文统计信息移至顶部作者信息区域，右对齐显示
  - 删除底部统计区域中重复的图文统计数据（使用 `!video.isOpus` 条件）
  - 删除底部统计区域中重复的发布日期
  - 作者信息区域使用 `justifyContent: 'space-between'` 实现左右布局
  - 添加 `flexWrap: 'wrap'` 支持移动端响应式换行

- **TypeScript 类型安全**: 新增 `VideoDetailData` 接口定义
  - 替换原有 `any` 类型
  - 包含所有视频/图文字段类型声明
  - 提高代码可维护性和类型检查能力

---

## 技术实现细节

### 1. 页面布局架构

#### 双层容器设计
```tsx
// 外层视口容器 - 固定定位，全屏滚动
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'var(--color-bg-primary)',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  zIndex: 9999
}}>
  {/* 内层内容容器 - 居中和响应式 */}
  <div style={{
    maxWidth: responsiveStyle.maxWidth,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  }}>
    {/* 页面内容 */}
  </div>
</div>
```

### 2. 响应式布局实现

#### 屏幕尺寸检测
```tsx
const [isMobile, setIsMobile] = useState(false)
const [isTablet, setIsTablet] = useState(false)

useEffect(() => {
  const checkScreenSize = () => {
    const width = window.innerWidth
    setIsMobile(width < 768)
    setIsTablet(width >= 768 && width < 1024)
  }

  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  return () => window.removeEventListener('resize', checkScreenSize)
}, [])
```

#### 响应式样式
```tsx
const getResponsiveStyle = () => {
  if (isMobile) {
    return { padding: '12px 16px', maxWidth: '100%' }
  } else if (isTablet) {
    return { padding: '16px 24px', maxWidth: '900px' }
  } else {
    return { padding: '20px 32px', maxWidth: '1000px' }
  }
}
```

### 3. 主题系统

#### CSS 变量使用
```tsx
// 所有颜色都使用 CSS 变量，支持主题切换
style={{
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  borderColor: 'var(--color-border)',
  // 暗色模式自动适配
}}
```

#### 拟态滚动条主题适配
```css
/* 亮色主题 */
.video-detail-page::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, 
    rgba(110, 90, 255, 0.3) 0%, 
    rgba(106, 90, 205, 0.4) 100%);
}

/* 暗色主题 */
.dark .video-detail-page::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, 
    rgba(139, 127, 255, 0.3) 0%, 
    rgba(138, 127, 255, 0.4) 100%);
}
```

### 4. 下载状态检查

#### 状态检查逻辑
```tsx
// 检查单个视频的下载状态
const checkSingleVideoStatus = async () => {
  if (!video) return
  
  try {
    const result = await videoLibraryService.checkBeforeAdd({
      bvid: video.bvid,
      cid: video.cid,
      title: video.title || ''
    })
    
    const tasks = newQueueStore.tasks
    const newSystemTasks = Object.values(tasks)
    
    // 检查是否在新下载系统队列中或已完成
    const hasInNewQueue = newSystemTasks.some(task =>
      task.media_id === video.bvid &&
      !['completed', 'cancelled'].includes(task.state)
    )
    
    const hasCompleted = newSystemTasks.some(task =>
      task.media_id === video.bvid &&
      task.state === 'completed'
    )
    
    let status: 'none' | 'in_list' | 'downloaded' = 'none'
    
    if (result.action === 'skip' || result.action === 'show_confirm') {
      status = 'downloaded'
    } else if (hasInNewQueue) {
      status = 'in_list'
    } else if (hasCompleted) {
      status = 'downloaded'
    }
    
    setDownloadedVideoStatus({ [video.cid]: status })
  } catch (error) {
    console.error('检查单个视频下载状态失败:', error)
  }
}
```

#### 多分P视频状态检查
```tsx
// 检查多分P视频的下载状态
video.pages.forEach((page: any) => {
  const hasInNewQueue = newSystemTasks.some(task =>
    task.media_id === video.bvid &&
    task.meta?.cid === page.cid &&
    !['completed', 'cancelled'].includes(task.state)
  )
  
  const hasCompleted = newSystemTasks.some(task =>
    task.media_id === video.bvid &&
    task.meta?.cid === page.cid &&
    task.state === 'completed'
  )
  
  if (hasInNewQueue) {
    downloadedStatus[page.cid] = 'in_list'
  } else if (hasCompleted) {
    downloadedStatus[page.cid] = 'downloaded'
  } else {
    downloadedStatus[page.cid] = 'none'
  }
})
```

### 5. 调试和故障排除

#### 调试日志输出
```tsx
// 按钮文本计算时的调试日志
console.log('[VideoDetail] 按钮文本计算:', {
  videoBvid: video?.bvid,
  videoCid: video?.cid,
  addedCount,
  status,
  downloadedVideoStatus,
  buttonText: /* ... */
})

// 单个视频状态检查日志
console.log('[VideoDetail] 单个视频状态检查:', {
  bvid: video.bvid,
  cid: video.cid,
  status,
  hasInNewQueue,
  hasCompleted,
  videoLibraryResult: result.action
})

// 数据同步错误日志
console.error('[VideoDetail] 同步数据失败:', error)
```

#### 常见问题排查

**问题1: 下载状态不显示**
- 检查 `newQueueStore` 数据是否正确加载
- 验证 `videoLibraryService` 缓存是否有效
- 检查任务状态字段是否正确

**问题2: 页面滚动不流畅**
- 确认双层容器架构是否正确实现
- 检查 `position: fixed` 和 `overflow-y: auto` 是否设置
- 验证 `WebkitOverflowScrolling: touch` 是否启用

**问题3: 主题切换不生效**
- 检查 CSS 变量是否正确定义
- 确认 `.dark` 类是否正确应用到根元素
- 验证所有颜色都使用了 CSS 变量

**问题4: 响应式布局异常**
- 检查屏幕尺寸检测逻辑
- 验证 `window.addEventListener('resize')` 是否正确设置
- 确认断点值是否正确（768px, 1024px）

---

## API 依赖

### 使用的 API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/video/detail/{bvid}` | GET | 获取视频详情 |
| `/api/download/parse` | POST | 解析下载链接（图文） |

### 使用的服务

| 服务 | 用途 |
|------|------|
| `apiService` | API 请求封装 |
| `videoLibraryService` | 视频库状态检查 |
| `newQueueStore` | 下载队列状态管理 |
| `useVideoDownload` | 下载功能 Hook |
| `useAuthStore` | 用户认证状态 |

---

## 性能优化

### 1. 缓存策略
- 视频库状态缓存（10分钟 TTL）
- 避免重复的状态检查
- 智能刷新机制

### 2. 状态管理
- 使用 Zustand 进行状态管理
- 支持 persist 中间件，离线可用
- 避免不必要的重渲染

### 3. 滚动优化
- 使用 `WebkitOverflowScrolling: touch` 优化移动端
- 双层容器减少重排
- 虚拟化长列表（如有需要）

---

## 可访问性

### 语义化 HTML
- 使用 `<button>` 而非 `<div>` 实现按钮
- 使用 `<a>` 标签实现链接
- 使用 `<h1>`, `<h2>` 等语义化标题

### 键盘导航
- 支持返回按钮键盘操作
- 支持下载按钮键盘操作
- 适当的焦点管理

### 屏幕阅读器
- 图片添加 `alt` 属性
- 链接添加 `aria-label`（如需要）
- 使用 `rel="noopener noreferrer"` 提高安全性

---

## 浏览器兼容性

### 支持的浏览器
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 使用的现代特性
- CSS Variables
- `position: fixed`
- `overflow-y: auto`
- CSS Gradients
- ES6+ 语法

---

## 未来改进计划

### 待实现功能
1. 视频预览功能
2. 评论显示功能
3. 相关推荐视频
4. 分享功能增强
5. 下载质量选择
6. 批量下载优化

### 性能优化
1. 虚拟滚动（长列表）
2. 图片懒加载
3. 代码分割
4. Service Worker 缓存

---

[返回上级](./README.md)
