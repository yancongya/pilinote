# AI 笔记功能设计方案

## Overview

在媒体库添加 AI 笔记功能：媒体库视频卡片点击 AI 按钮 → 弹窗配置风格/格式/LLM → 后台分析 → 生成 Markdown 笔记和思维导图。

## 用户流程

```
媒体库卡片 → [AI按钮] → 弹窗(风格/格式/LLM) → 开始分析 → 卡片加载动画 → 完成
                                                      ↓
详情页 → 垂直显示笔记结果 ←─────────────────────────────
```

## UI 设计

### 1. 媒体库卡片 - AI 按钮

**位置**：卡片右下角（覆盖在封面上）

**状态**：
- 默认：灰色图标 `🤖` 或 `Sparkles`
- 进行中：旋转加载动画 + 蓝色边框
- 已完成：绿色/紫色高亮图标

**交互**：
- 点击按钮 → 打开设置弹窗
- 已有笔记时显示不同状态图标

### 2. 设置弹窗

**Tab 结构**：
1. **风格 Tab**：笔记风格选择（精简/详细/学术/教程/小红书/生活向/任务导向/商业/会议纪要）
2. **格式 Tab**：输出格式开关（目录/原片跳转/截图/AI总结）
3. **LLM Tab**：提供商选择（OpenAI/Claude/DeepSeek）+ 模型选择

**按钮**：开始分析 / 取消

### 3. 详情页

**布局**：
```
┌──────────────────┐
│   视频封面      │
├──────────────────┤
│   视频信息      │
├──────────────────┤
│   AI 笔记结果    │  ← 无分析则不显示此区域
│   (Markdown)   │
└──────────────────┘
```

**无分析时**：不显示 AI 相关区域

## 技术设计

### 前端 (apps/web)

**新增组件**：
- `components/ai/AiNoteButton.tsx` - 媒体库卡片上的 AI 按钮
- `components/ai/AiNoteModal.tsx` - 设置弹窗（含 3 个 Tab）

**修改**：
- `components/NewDownload/VideoLibrary.tsx` - 添加 AiNoteButton
- `pages/VideoDetailPage.tsx` - 移除现有 AiNotePanel，改为垂直笔记展示

### 后端 (apps/api)

**API 端点**：
- `POST /api/note/analyze` - 触发分析（支持 bvid 查找）
- `GET /api/note/status/{note_id}` - 轮询状态
- `GET /api/note/by-video/{bvid}` - 获取笔记

## 实现顺序

1. 移除 VideoDetailPage 中的现有 AiNotePanel
2. 创建 AiNoteButton 组件
3. 创建 AiNoteModal 弹窗组件
4. 在 VideoLibrary 卡片上添加按钮
5. 修复详情页垂直笔记展示
6. 测试完整流程