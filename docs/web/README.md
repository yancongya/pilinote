# 前端实现

本目录包含前端实现相关文档。

## 文档索引

### 1. 前端实现
**文件**: [implementation.md](implementation.md)

内容：
- 项目结构
- 核心组件
- 状态管理 (Zustand)
- API 服务
- 路由
- WebSocket 连接
- 智能响应式侧边栏系统
- 拖拽调整宽度功能
- 自动收缩机制

### 2. 主题系统
**文件**: [theme-system.md](theme-system.md)

内容：
- 设计令牌系统
- 暗色模式实现
- CSS 变量系统
- 主题切换功能
- 已适配的组件列表
- 颜色使用规范
- 暗色模式设计原则
- 主题切换修复记录

### 3. 前端组件
**文件**: [../components/README.md](../components/README.md)

内容：
- MainLayout - 主布局组件（智能响应式侧边栏）
- Modal - 模态框组件
- Toast - 消息提示组件
- AlertModal - 警告模态框
- ConfirmModal - 确认模态框
- VideoListContainer - 视频列表容器
- BatchActionsBar - 批量操作栏

### 4. 下载列表组件
**文件**: [downloads-list.md](downloads-list.md)

内容：
- 组件概述
- 任务筛选
- 刷新功能
- 批量管理
- 任务分组
- 状态管理
- API集成
- 用户交互流程
- 文件命名规范
- 时间显示格式

### 5. 视频库组件
**组件位置**: `apps/web/src/components/NewDownload/VideoLibrary.tsx`

内容：
- 动态扫描和刷新视频库
- 按文件夹显示视频系列
- 搜索和排序功能
- 展开/折叠多视频文件夹
- 显示封面、头像、元数据
- 响应式布局设计
- 文件命名规范（统一使用 cover.jpg）
- 创建时间显示（使用文件夹创建时间，换行显示）

**核心功能**：
- 使用 VideoListControls 组件进行搜索和排序
- 集成 LibraryCard 组件显示文件夹信息
- 支持按大小、名称、创建时间排序
- 统计显示（系列数、视频数、总大小）
- 下载完成后自动刷新（5秒延迟）

### 6. 智能响应式侧边栏系统
**组件位置**: `apps/web/src/components/MainLayout.refactored.tsx`

内容：
- 自动响应式切换（基于屏幕尺寸）
- 拖拽调整宽度功能（180px-400px）
- 智能收缩机制（200px阈值）
- 双重折叠触发方式
- 固定高度独立滚动
- 自定义滚动条样式

**核心功能**：
- 移动端（< 768px）：自动显示底部导航
- 桌面端（≥ 768px）：自动显示左侧固定侧边栏
- 拖拽侧边栏右侧边界调整宽度
- 点击底部折叠按钮切换展开/收缩
- 侧边栏和内容区域独立滚动
- 实时响应窗口尺寸变化

---

## 关联文档

- [api/implementation.md](../api/implementation.md) - 后端实现
- [architecture/system.md](../architecture/system.md) - 系统架构
- [settings/README.md](../settings/README.md) - 设置模块

---

[返回上级](../README.md)