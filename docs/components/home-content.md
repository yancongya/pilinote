# HomeContent 组件

## 概述

首页内容组件，负责解析 B 站链接、显示视频/图文预览卡片，以及添加到下载列表。

## 文件位置

`apps/web/src/pages/components/HomeContent.tsx`

## 功能特性

### 1. 链接解析
- 支持视频链接和图文链接
- 调用 `/api/download/parse` 接口获取媒体信息
- 自动清空输入框并显示解析结果

### 2. 视频/图文预览卡片

#### 布局
- 统一使用横向卡片布局（`flexDirection: 'row'`）
- 封面固定 320px 宽 × 180px 高
- 详情区域填充剩余空间

#### 视频卡片
```
┌─────────────────────────────────────────────┐
│ [封面 320x180] │ 标题                       │
│         00:00  │ UP主名称                   │
│                │ 👁1000 💬100 👍500 🪙100   │
│                │ ⭐50 💬20 🔗10             │
│                │ 视频简介...                │
│                │ ┌─ 视频章节 (3) ── [全选]  │
│                │ │ P1: xxx  05:30  ☑        │
│                │ │ P2: xxx  10:00  ☐        │
│                │ └──────────────────────────│
│                │ [添加到列表 (2)]           │
└─────────────────────────────────────────────┘
```

#### 图文卡片
```
┌─────────────────────────────────────────────┐
│ [封面 320x180] │ 标题                       │
│          图文  │ UP主名称                   │
│                │ 👍100 ⭐50 💬20 🔗10       │
│                │ [添加到列表]               │
└─────────────────────────────────────────────┘
```

### 3. 统计信息

#### 视频统计
| 图标 | 说明 |
|------|------|
| 👁 Eye | 播放量 |
| 💬 MessageSquare | 弹幕数 |
| 👍 ThumbsUp | 点赞数 |
| 🪙 Coins | 投币数 |
| ⭐ Star | 收藏数 |
| 💬 MessageCircle | 评论数 |
| 🔗 Share2 | 分享数 |

#### 图文统计
| 图标 | 说明 |
|------|------|
| 👍 ThumbsUp | 点赞数 |
| ⭐ Star | 收藏数 |
| 💬 MessageCircle | 评论数 |
| 🔗 Share2 | 分享数 |

### 4. 分P选择（仅多P视频）
- 全选/全不选按钮
- 点击选择分P
- 显示已选择数量

### 5. 添加到下载列表
- 图文：添加到下载列表（后端实现中）
- 单P视频：直接添加到下载列表
- 多P视频：批量添加已选中的分P

## 数据结构

### VideoInfo
```typescript
interface VideoInfo {
  bvid: string
  aid: number
  title: string
  desc: string
  pic: string
  duration: number
  cid?: number  // 图文可能没有 cid
  owner: {
    mid: number
    name: string
    face: string
  }
  stat: {
    view: number
    danmaku: number
    reply: number
    like: number
    coin: number
    favorite: number
    share: number
  }
}
```

### ParseResponse
```typescript
interface ParseResponse {
  success: boolean
  data?: {
    video: VideoInfo
    download_options: DownloadOptions
    parsed_id?: {
      type: 'video' | 'opus' | ...
      id: string
    }
  }
  message?: string
}
```

## 核心功能

### 1. handleParseUrl
解析用户输入的 B 站链接，获取视频/图文信息。

### 2. handleDownload
添加视频/图文到下载列表：
- **图文**: 调用 `apiService.addToDownloadQueue`（后端实现中）
- **单P视频**: 直接调用 `apiService.addToDownloadQueue`
- **多P视频**: 遍历选中的分P，逐个调用 `apiService.addToDownloadQueue`

### 3. 错误处理
- 显示后端返回的具体错误消息
- 网络错误显示通用提示

## 关联组件

- [AlertModal](alert-modal.md) - 提示弹窗（通过父组件）
- [VideoDetailPage](video-detail-page.md) - 点击卡片跳转

## 更新日志

### 2026-04-12 - 首页解析卡片优化

#### 优化
- **统一横向布局**: 图文和视频都使用横向卡片样式
- **图文标记**: 封面右下角显示粉色"图文"标记
- **图标替换**: emoji 替换为 lucide-react 图标库
  - 统一图标大小（11-14px）
  - 弹幕使用 MessageSquare，评论使用 MessageCircle
- **统计信息对齐**: 使用 flexWrap 支持自动换行
- **按钮文案**: 
  - 图文/视频（单P）："添加到列表"
  - 视频（多P）："添加到列表 (N)"
- **事件冒泡**: 按钮和分P点击添加 stopPropagation
- **错误提示**: 显示后端返回的具体错误消息
- **Hook 修复**: useAuthStore 移至组件顶层

---

[返回上级](./README.md)
