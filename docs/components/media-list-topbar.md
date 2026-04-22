# MediaListTopBar 顶部导航筛选条

## 概述

`MediaListTopBar` 是收藏页、稍后再看页、历史记录页共用的顶部导航筛选条组件，用来把标题、数量、页面动作和筛选控件组合成一个 sticky 的全宽顶部区域。

## 文件位置

`apps/web/src/components/media-list/MediaListTopBar.tsx`

## 设计目标

- 让历史型视频列表的顶部区域始终悬浮在内容上方
- 让导航和筛选条填满列表内容区的左右边缘
- 把页面标题、统计信息和筛选控件统一成同一套布局语言
- 降低各页面单独拼接 header + controls 的样式漂移

## 核心结构

### 1. 标题区

- 显示页面标题和数量徽章
- 支持放入复合标题节点，例如收藏夹返回按钮 + 收藏夹名称
- 左侧保持主信息，避免和右侧操作互相挤压

### 2. 动作区

- `secondaryActions` 和 `primaryActions` 预留给页面级操作
- 当前三页主要使用标题区 + 筛选区
- 没有动作时不会渲染空占位

### 3. 筛选区

- 用于承载 `VideoListControls` 或其他筛选组件
- 与顶部标题区共享同一块 sticky surface
- 在移动端自动换行并收紧间距

## Props

```typescript
export interface MediaListTopBarProps {
  title: ReactNode
  countLabel?: ReactNode
  primaryActions?: ReactNode
  secondaryActions?: ReactNode
  filters?: ReactNode
  className?: string
}
```

## 使用场景

- 收藏夹详情页：返回按钮 + 收藏夹标题 + 数量 + 筛选条
- 稍后再看页：标题 + 数量 + 搜索排序条
- 历史记录页：标题 + 数量 + 搜索排序条

## 相关组件

- `MediaListShell`
- `VideoListControls`
- `VideoListContainer`
