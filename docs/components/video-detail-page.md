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

### 5. 视频库状态检查

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

## 更新日志

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

[返回上级](./README.md)