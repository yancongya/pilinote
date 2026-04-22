# MediaListShell 历史型视频列表壳

## 概述

`MediaListShell` 是收藏页、稍后再看页、历史记录页共用的列表壳层组件，用来统一这些“历史型视频列表”的加载态、空态、错误态、滚动容器和顶部固定区域。

## 文件位置

`apps/web/src/components/media-list/MediaListShell.tsx`

## 设计目标

- 统一三个页面的页面骨架和交互节奏
- 首屏加载时显示骨架，而不是直接空白
- 刷新时避免旧列表残留在新筛选结果下方
- 将分页加载、加载更多和空状态统一成一套视觉语言
- 提供 `topBar` 插槽，接入 `MediaListTopBar` 后由 shell 顶部容器负责吸顶
- 顶部区域在初始状态和吸顶状态下都贴齐 shell 顶边，不再依赖子组件自己 sticky

## 适用页面

- 收藏页 `FavoritesContent`
- 稍后再看页 `WatchLaterContent`
- 历史记录页 `HistoryContent`

## 核心能力

### 1. 页面壳

- 统一标题区、统计信息、筛选条和内容区
- 统一内容容器宽度和间距
- 保持桌面端和移动端一致的层级节奏

### 2. 加载态

- 首次进入时显示骨架卡片
- 刷新中保留壳层，避免页面抖动
- 支持加载更多时在底部追加骨架

### 3. 空态与错误态

- 无数据时显示统一空状态
- 请求失败时显示统一错误提示
- 可通过 `emptyText` 和 `error` 自定义文案

### 4. 控制区

- 支持复用 `VideoListControls`
- 支持不同页面配置不同的排序选项
- 支持紧凑模式和固定吸顶模式
- 推荐通过 `MediaListTopBar` 统一承载标题、统计和筛选

### 5. 顶部区域

- `topBar` 优先于旧的 `title + controls` 组合
- `MediaListShell` 的顶部容器负责 sticky、全宽和左右对齐
- 收藏页、稍后再看页、历史记录页共享同一套顶部交互规范

## 交互规范

- 首屏加载：骨架优先
- 有数据刷新：保留列表主体，顶部轻提示
- 筛选变更：重新挂载当前面板，避免旧结果残留
- 加载更多：只追加底部骨架，不清空现有内容

## 相关组件

- `VideoListContainer`
- `VideoListControls`
- `MediaListState`
- `VideoCardSkeleton`
