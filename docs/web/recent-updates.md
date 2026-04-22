# 最近更新概览

## 更新时间线

### 2026-04-23 - 视频源列表加载稳定性优化

本次更新重点收敛了收藏夹、稍后再看和观看历史三类列表的加载链路，减少滚动翻页时的重复请求和整页报错。

#### 主要更新

##### 1. 列表加载容错收敛
**影响范围**: 收藏页 / 稍后再看页 / 历史记录页
**相关文件**:
- `apps/web/src/hooks/useVideoList.ts`
- `apps/web/src/components/VideoListContainer.tsx`
- `apps/web/src/pages/components/FavoritesContent.tsx`
- `apps/web/src/pages/components/WatchLaterContent.tsx`
- `apps/web/src/pages/components/HistoryContent.tsx`

**更新内容**:
- `useVideoList` 增加页面缓存、请求去重、短暂重试和加载更多冷却
- `useVideoList` 首屏第一页还会落到 `sessionStorage`，刷新同一标签页时可直接复用缓存，不再重复拉首屏
- `VideoListContainer` 将首屏错误与加载更多错误分离，避免增量失败清空已有列表
- 收藏页手动“加载更多”改为基于 `currentPage + 1` 推进，避免重复请求同一页

##### 2. 后端缓存与错误语义统一
**影响范围**: 收藏夹 / 稍后再看 / 历史记录 API
**相关文件**:
- `apps/api/src/routers/favorites.py`
- `apps/api/src/routers/watchlater.py`
- `apps/api/src/routers/history.py`
- `apps/api/src/services/bilibili.py`
- `apps/web/src/services/api.ts`

**更新内容**:
- 收藏夹详情失败时改为明确的 `502` 上游错误，不再使用 `200 + detail`
- 稍后再看和历史记录缓存键统一为 `user.mid`
- 前端 API 层补齐 `detail` 形态兼容，避免后端错误包装导致前端误判

#### 验证结果

- `apps/web` 的 `tsc --noEmit` 已通过
- `apps/api/src` 的 `compileall` 已通过

### 2026-04-22 - 历史型列表统一与账号刷新修复

本次更新统一了收藏页、稍后再看页、历史记录页的列表壳层，并修复了开发态 API 解析和账号刷新链路问题。

#### 主要更新

##### 1. 历史型视频列表统一
**影响范围**: 收藏页 / 稍后再看页 / 历史记录页
**相关文件**:
- `apps/web/src/components/media-list/MediaListShell.tsx`
- `apps/web/src/components/media-list/MediaListTopBar.tsx`
- `apps/web/src/components/media-list/MediaListState.tsx`
- `apps/web/src/components/VideoCardSkeleton.tsx`
- `apps/web/src/components/VideoListContainer.tsx`
- `apps/web/src/pages/components/FavoritesContent.tsx`
- `apps/web/src/pages/components/WatchLaterContent.tsx`
- `apps/web/src/pages/components/HistoryContent.tsx`

**更新内容**:
- 三页统一使用同一套列表壳层和交互规范
- 首屏加载、加载更多、空态、错误态统一
- 收藏页详情默认采用懒加载，避免首屏逐条补全视频详情
- 顶部导航与筛选条统一为页面壳层固定的全宽布局，滚动时始终位于内容上方

##### 2. 开发态 API 基址修复
**影响范围**: 前端开发环境
**相关文件**:
- `apps/web/src/config/api.ts`
- `apps/web/src/components/NewDownload/TaskCard.tsx`
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`

**更新内容**:
- 开发环境下将 `localhost` 和 `::1` 统一映射到 `127.0.0.1`
- 避免浏览器本机地址解析差异导致 API 请求异常
- 视频库中手写的 `localhost` 请求一并收口

##### 3. 账号刷新修复
**影响范围**: 设置页账号管理
**相关文件**:
- `apps/api/src/routers/auth.py`
- `apps/api/src/services/account_refresh_service.py`
- `apps/web/src/pages/settings/AccountsSettings.tsx`

**更新内容**:
- 刷新前先同步目标账号自己的 Cookie 到内存
- 避免当前活跃账号的 Cookie 错刷到别的账号上
- 路径参数版刷新接口作为前端首选调用方式

##### 4. 登录状态与列表回退修复
**影响范围**: 顶部登录状态、收藏页、稍后再看页
**相关文件**:
- `apps/api/src/routers/auth.py`
- `apps/api/src/routers/favorites.py`
- `apps/api/src/routers/watchlater.py`
- `apps/api/src/routers/history.py`
- `apps/api/src/services/bilibili.py`
- `apps/web/src/stores/auth.ts`

**更新内容**:
- `/api/auth/status` 采用非破坏性校验，临时探活失败不再直接把前端踢回游客
- 收藏夹列表每次都使用当前活跃账号的 `SESSDATA`，避免共享 headers 残留旧账号状态
- 收藏页、稍后再看页、历史记录页在实时请求失败时优先回退缓存，减少刷新时的报错和空白页

#### 验证结果

- `apps/web` 的 `tsc --noEmit` 已通过
- 本地接口在 `127.0.0.1:8000` 下可正常返回历史、稍后再看、收藏夹和账号刷新数据

### 2026-04-15 - 主题系统全面升级和功能增强

本次更新实现了完整的暗色模式支持和统一的设计令牌系统，确保在亮色和暗色主题下都有良好的用户体验。

#### 主要更新

##### 1. 暗色模式全面实现
**影响范围**: 全站所有组件和页面
**相关文件**:
- `apps/web/src/design-tokens.css` (新建)
- `apps/web/tailwind.config.js` (更新)
- `apps/web/src/index.css` (更新)
- `apps/web/src/settings-page.css` (更新)
- 所有组件和页面文件

**更新内容**:
- 建立完整的CSS变量系统
- 实现亮色/暗色模式切换
- 所有组件适配暗色模式
- 统一品牌色和设计令牌

**设计令牌系统**:
- 品牌色：`#2563EB` (primary-600)
- 辅助色：完整的灰色系
- 功能色：success、warning、error、info
- 语义化颜色：bg、text、border

**暗色模式配色**:
- 主背景：`#0f0f0f` (纯黑色)
- 次要背景：`#1a1a1a` (深灰)
- 第三级背景：`#2a2a2a` (中灰)
- 主要文字：`#E0E0E0` (浅灰白)
- 次要文字：`#94A3B8` (中灰)

##### 2. 主题切换功能
**影响范围**: MainLayout组件
**相关文件**:
- `apps/web/src/components/MainLayout.tsx`

**更新内容**:
- 顶部导航栏WiFi图标左侧添加暗色模式切换按钮
- 使用太阳/月亮图标切换
- localStorage持久化用户偏好
- 自动检测系统主题设置

**功能特性**:
- 点击切换亮色/暗色模式
- 平滑的过渡动画
- 页面刷新后保持选择
- 支持系统偏好自动切换

##### 3. 已适配的组件
**核心组件**:
- ✅ MainLayout.tsx - 主布局和主题切换
- ✅ Toast.tsx - 消息提示
- ✅ Modal.tsx - 模态框
- ✅ AlertModal.tsx - 警告模态框
- ✅ ConfirmModal.tsx - 确认模态框

**页面组件**:
- ✅ SettingsPage.tsx - 设置页面
- ✅ VideoDetailPage.tsx - 视频详情页
- ✅ HomeContent.tsx - 首页内容
- ✅ FavoritesContent.tsx - 收藏夹内容
- ✅ WatchLaterContent.tsx - 稍后再看内容
- ✅ VideoListCard.tsx - 视频卡片

**新下载组件**:
- ✅ VideoLibrary.tsx - 视频库
- ✅ SchedulerCard.tsx - 调度器卡片
- ✅ TaskCard.tsx - 任务卡片
- ✅ DownloadsList.tsx - 下载列表
- ✅ ScanResultContent.tsx - 扫描结果

**设置页面组件**:
- ✅ AccountsSettings.tsx - 账号设置
- ✅ AutoDownloadSettings.tsx - 自动下载设置
- ✅ DownloadSettings.tsx - 下载设置
- ✅ StorageSettings.tsx - 存储设置
- ✅ BackupSettings.tsx - 备份设置

**其他组件**:
- ✅ VideoListContainer.tsx - 视频列表容器

##### 4. Tailwind配置更新
**影响范围**: 全局样式配置
**相关文件**:
- `apps/web/tailwind.config.js`

**更新内容**:
- 所有颜色配置使用CSS变量
- 暗色模式通过dark:前缀支持
- 阴影系统基于CSS变量
- 完整的设计令牌支持

**配置示例**:
```javascript
colors: {
  primary: {
    600: 'var(--color-primary-600)',
    700: 'var(--color-primary-700)',
    500: 'var(--color-primary-500)',
  },
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
  },
  background: {
    primary: 'var(--color-bg-primary)',
    secondary: 'var(--color-bg-secondary)',
  }
}
```

##### 5. CSS样式文件更新
**影响范围**: 全局样式和设置页面样式
**相关文件**:
- `apps/web/src/index.css`
- `apps/web/src/settings-page.css`

**更新内容**:
- 全局暗色模式样式
- 设置页面完整暗色模式支持
- 所有硬编码颜色替换为CSS变量
- 统一的设计语言

**设计原则**:
- 统一的黑色主题（非深蓝色）
- 完整的颜色对比度支持
- 响应式设计保持一致
- 动画和过渡效果流畅

### 2026-04-15 - UI 界面优化和功能增强

本次更新主要围绕用户界面优化和功能增强，包括视频卡片布局重新设计、统计数据显示优化、创建时间显示等功能。

#### 主要更新

##### 1. 视频卡片布局重新设计
**影响范围**: 前端组件
**相关文件**:
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- `apps/web/src/components/NewDownload/TaskCard.tsx`
- `apps/web/src/components/NewDownload/SchedulerCard.tsx`

**更新内容**:
- 重新设计视频卡片布局，采用横向布局（封面+信息）
- 封面固定尺寸（160px × 90px）
- 进度叠加层（封面底部）
- 时长叠加层（右下角）
- 状态标签（彩色）
- 操作按钮（内联显示）

**视觉效果**:
- 悬停效果（上移+阴影增强）
- 响应式布局
- 移动端优化
- B站风格设计

##### 2. 统计数据显示优化
**影响范围**: NFO文件生成和前端显示
**相关文件**:
- `apps/api/src/services/bilibili.py`
- `apps/api/src/services/download_service.py`
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`

**更新内容**:
- NFO文件包含完整的B站统计数据
- 支持播放量、点赞、投币、收藏、分享、弹幕、评论等统计
- 前端优化统计数据显示格式
- 添加五分制互动评分计算

**NFO文件格式**:
```xml
<playcount>18836</playcount>
<rating>2.8</rating>
<tag>弹幕数: 2</tag>
<tag>评论数: 224</tag>
<tag>分享数: 110</tag>
<bilibili_stat xmlns="bilibili">
  <play>18836</play>
  <like>381</like>
  <coin>259</coin>
  <favorite>908</favorite>
  <share>110</share>
  <danmaku>2</danmaku>
  <reply>224</reply>
</bilibili_stat>
```

##### 3. 创建时间显示功能
**影响范围**: 前端组件
**相关文件**:
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- `apps/web/src/components/NewDownload/TaskCard.tsx`

**更新内容**:
- 在标题行右侧显示创建时间
- 优化时间显示格式
- 支持相对时间显示（如"2小时前"）
- 添加时间戳转换工具

##### 4. NFO文件元数据显示增强
**影响范围**: NFO文件生成
**相关文件**:
- `apps/api/src/services/bilibili.py`
- `apps/api/src/services/download_service.py`

**更新内容**:
- 添加完整的视频描述信息
- 包含视频标签
- 优化UP主信息显示
- 改进统计数据格式

**新增字段**:
- 视频描述（plot字段）
- 完整的统计数据
- B站自定义标签
- 五分制互动评分

##### 5. 下载系统修复
**影响范围**: 后端服务
**相关文件**:
- `apps/api/src/services/queue/manager.py`
- `apps/api/src/routers/queue.py`

**更新内容**:
- 修复队列保存逻辑
- 添加队列一致性检查
- 修复调度器创建问题
- 优化任务状态管理

**修复的问题**:
- 队列保存只更新不创建Queue记录
- 服务器重启后backlog队列丢失
- 创建调度器时backlog队列为空
- 任务没有schedulerId

### 2026-04-06 - 收藏夹扫描功能修复

#### 问题修复
修复收藏夹扫描功能返回空结果的问题，并优化前端显示。

#### 根本原因
1. **后端服务器未正确运行**：服务器启动失败导致API调用返回空数据
2. **SESSDATA格式问题**：数据库中的SESSDATA是URL编码格式，需要在使用前进行URL解码
3. **API参数限制**：B站API的page_size参数过大（100）会导致-400错误

#### 修复方案
1. **修复后端扫描服务**：添加URL解码，调整page_size从100到20
2. **添加调试日志**：记录用户信息、SESSDATA长度、扫描参数
3. **重新启动后端服务器**：清理所有占用8000端口的进程

#### 前端优化
1. **更新数据类型定义**：新增`FolderScanInfo`接口
2. **优化扫描结果显示**：收藏夹详情放在最前面，每个收藏夹卡片显示详细信息
3. **添加收藏夹详情样式**：响应式网格布局，悬停效果，阴影

### 2026-04-03 - 调度器删除功能和封面显示优化

#### 后端功能
- **新增**：`DELETE /api/queue/schedulers/{scheduler_id}` 端点
- **新增**：`broadcast_scheduler_deleted()` 函数
- **新增**：`delete_scheduler()` 方法
- **修复**：Scheduler Session 绑定问题

#### 前端功能
- **新增**：`deleteScheduler()` 方法
- **修复**：`scheduler_id` 字段映射问题
- **新增**：封面显示功能
- **改进**：按钮区分（取消按钮和删除按钮）

### 2026-04-03 - 下载系统API响应格式统一

#### 统一API响应格式
所有队列和调度器API端点返回标准格式：
```json
{
  "success": bool,
  "message": str | null,
  "data": Any | null,
  "code": int | null
}
```

#### 修复前端API响应解析
- `fetchTasks` 函数：从 `result.data` 中获取任务数组
- `fetchSchedulers` 函数：从 `result.data` 中获取调度器数组
- 修复 `data.forEach is not a function` 错误

#### 修复图片加载403错误
- 添加 `getProxyImageUrl` 函数
- 使用后端代理 `/api/auth/proxy/avatar?url=...` 加载图片
- 避免直接访问B站图片URL导致的403错误

### 2026-04-02 - 下载系统重构 - 阶段1

#### WebSocket实时通信
- **新增文件**：`apps/api/src/routers/websocket.py`
- **功能**：WebSocket连接管理器、事件广播系统、支持多客户端同时连接

#### 四级队列系统
- **实现**：四级异步队列（backlog, pending, doing, complete）
- **功能**：信号量并发控制、任务生命周期管理、数据库持久化

#### 任务管理API
- **新增端点**：
  - `DELETE /api/queue/tasks/{task_id}` - 删除任务
  - `PUT /api/queue/tasks/{task_id}` - 更新任务状态
  - `GET /api/queue/tasks` - 获取任务列表
  - `GET /api/queue/schedulers` - 获取调度器列表
  - 调度器控制端点（启动、暂停、恢复、取消）

#### 状态管理（Zustand）
- **新增文件**：`apps/web/src/stores/newQueue.ts`
- **功能**：任务和调度器状态管理、WebSocket连接和事件处理、状态映射、进度计算

#### 新下载组件
- **新增目录**：`apps/web/src/components/NewDownload/`
- **组件列表**：
  - `index.tsx` - 主组件，包含Tab切换和连接状态
  - `DownloadsList.tsx` - 下载列表组件
  - `TaskCard.tsx` - 任务卡片
  - `index.css` - 样式文件

### 2026-03-31 - NFO文件生成功能改进

#### 新增：完整的视频元数据信息到NFO文件
- **改进前**：NFO文件只包含基本字段（标题、B站ID、封面URL、UP主、时长）
- **改进后**：NFO文件包含完整的视频元数据：
  - 视频描述（plot字段）
  - 完整的统计数据（播放量、点赞、投币、收藏、分享、弹幕、评论）
  - B站自定义标签（用于存储额外统计信息）

#### 技术实现
1. **添加get_video_info方法**：使用HTML解析方法获取视频详情
2. **修复异步调用问题**：添加await关键字
3. **改进UP主信息获取的容错性**：添加JSON解析失败时的容错处理

### 2026-03-31 - 图像下载功能修复

#### 修复：视频下载完成后封面图片和UP主头像未下载
**根本原因**：
1. **数据库事务问题**：NFO生成和图片下载在数据库事务中执行，失败会导致整个事务回滚
2. **目录路径错误**：使用了错误的目录参数（final_dir而非video_dir）
3. **uploader_mid为0**：前端传递的uploader_mid字段可能为0

#### 修复方案
1. **分离数据库事务和文件操作**：数据库事务和文件操作分离
2. **修正目录路径**：使用video_file.parent获取视频文件所在目录
3. **修复uploader_mid传递**：从视频详情API获取uploader_mid

## 技术改进

### 性能优化
- 多级缓存系统减少API调用
- 并发控制提升下载速度
- WebSocket实时通信减少轮询

### 稳定性提升
- 完善的错误处理机制
- 自动重试和恢复功能
- 数据持久化保证数据安全

### 用户体验优化
- 直观的用户界面
- 实时进度显示
- 自动化功能减少手动操作

## 代码统计

### 文件变更统计（2026-04-15）
| 文件 | 修改行数 | 新增 | 删除 |
|------|---------|------|------|
| apps/web/src/components/NewDownload/VideoLibrary.tsx | +200 | 200 | 50 |
| apps/web/src/components/NewDownload/TaskCard.tsx | +150 | 150 | 30 |
| apps/web/src/components/NewDownload/SchedulerCard.tsx | +180 | 180 | 40 |
| apps/api/src/services/bilibili.py | +80 | 80 | 10 |
| apps/api/src/services/download_service.py | +120 | 120 | 20 |
| **总计** | **+730** | **730** | **150** |

### 2026-04-15 - 排序功能和评分算法优化

本次更新主要围绕视频排序功能增强和评分算法优化，包括新的排序选项、刷新体验改进和科学的五分制评分系统。

#### 主要更新

##### 1. 排序功能增强
**影响范围**: 前端组件
**相关文件**:
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`

**更新内容**:
- 新增按上传时间排序
- 新增按时长排序
- 新增按播放量排序
- 新增按点赞量排序

**排序算法**:
- **上传时间**: 基于NFO中的premiered字段，缺失时回退到创建时间
- **时长**: 支持MM:SS格式转换，统一按秒数排序
- **播放量**: 基于B站播放数据，支持升降序
- **点赞量**: 基于B站点赞数据，支持升降序

##### 2. 刷新按钮提醒逻辑优化
**影响范围**: 前端组件
**相关文件**:
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`

**更新内容**:
- 多阶段延迟提示，提升用户体验
- 第一阶段：toast提示"开始更新NFO元数据..."
- 第二阶段（延迟1秒）：显示NFO更新结果
- 第三阶段（延迟2秒）：显示视频库扫描结果

**用户体验改进**:
- 操作过程更清晰，用户实时了解进度
- 分阶段反馈，避免信息过载
- 失败时有明确的错误提示

##### 3. 评分算法优化（五分制）
**影响范围**: 后端服务
**相关文件**:
- `apps/api/src/services/download_service.py`
- `apps/api/src/services/queue/handlers/nfo.py`

**更新内容**:
- 采用科学的五分制评分系统
- 基于B站算法研究和IMDb贝叶斯平均
- 多维度互动指标计算
- 避免分数虚高问题

**评分算法公式**:
```
1. 互动得分 = 点赞×0.4 + 投币×0.4 + 收藏×0.3 + 分享×0.6 + 弹幕×0.4 + 评论×0.4
2. 互动率 = 互动得分 / 播放量
3. 平滑互动率 = log(1 + 互动率×1000) / log(1001)
4. 基础评分 = 平滑互动率 × 5
5. 贝叶斯加权评分 = (v / (v + m)) × R + (m / (v + m)) × C
   - m = 5000（基准播放量）
   - C = 2.0（全局平均评分，5分制中位数）
6. 最终评分 = min(max(贝叶斯加权评分, 0), 5)
```

**评分分布**:
- 互动率4% ≈ 3.0分（高质量）
- 互动率2% ≈ 2.5分（中等质量）
- 互动率1% ≈ 2.0分（低质量）

**权重设计**:
- 分享（0.6）：最高权重，病毒传播
- 点赞/投币/弹幕/评论（0.4）：深度互动
- 收藏（0.3）：长期价值

**技术亮点**:
- 对数平滑避免极端值
- 贝叶斯平均避免小样本偏差
- 移除播放量本身权重，只计算真实互动
- 更符合五星评分习惯

### 2026-04-15 - NFO轮询分批更新机制

本次更新主要解决NFO文件数量限制问题，实现智能的轮询分批更新机制，确保能够处理任意数量的NFO文件。

#### 主要更新

##### 1. 前端轮询机制
**影响范围**: 前端组件
**相关文件**:
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`

**更新内容**:
- 实现智能分批轮询NFO更新
- 每批处理20个文件，自动循环直到所有文件都被处理
- 实时更新进度显示，用户可以看到当前更新状态
- 批次间100ms延迟，避免服务器压力

**轮询逻辑**:
1. 初始化进度计数器（成功数、失败数、已处理数）
2. 循环处理批次，每批20个文件
3. 使用offset参数跳过已处理的文件
4. 检查返回结果，判断是否还有更多文件需要处理
5. 实时更新进度，显示当前批次处理结果
6. 批次间短暂延迟，避免服务器过载

**用户体验改进**:
- 能够处理任意数量的NFO文件（25个、100个、1000个）
- 实时显示更新进度，用户不会感到等待
- 避免遗漏任何文件，确保完整性
- 降低服务器负载，提升稳定性

##### 2. 后端分页支持
**影响范围**: 后端服务
**相关文件**:
- `apps/api/src/services/nfo_update_service.py`
- `apps/api/src/routers/library.py`

**更新内容**:
- `batch_update_nfos`支持offset参数
- 实现真正的分页处理机制
- 使用切片：`nfo_files[offset:offset + limit]`
- 支持无限扩展的文件数量

**分页逻辑**:
- 支持offset和limit参数
- 按偏移量跳过已处理的文件
- 每次只处理指定数量的文件
- 返回当前批次的处理结果
- 支持空结果返回（没有更多文件时）

**API接口更新**:
```typescript
POST /api/library/nfo/batch-update
Body: {
  directory: string,
  limit: number,    // 每批处理数量
  offset: number    // 跳过的文件数量
}
```

**技术亮点**:
- 智能分批，避免内存溢出
- 支持无限扩展的文件数量
- 轮询机制确保完整性
- 优化服务器资源使用

##### 3. 问题解决
**问题**: 之前硬编码limit为100，文件数量超过100时会遗漏
**解决方案**: 
- 前端实现轮询机制，自动分批处理
- 后端支持分页，返回部分结果
- 自动循环直到所有文件都被处理
- 实时显示进度，提升用户体验

**优势**:
- 不再受硬编码limit限制
- 能够处理任意数量的文件
- 降低服务器负载
- 提升系统稳定性

### 文档更新
- 新增文档：5篇
- 更新文档：8篇
- 总字数：~15,000字

## 已知问题

### 1. UP主头像下载功能
**问题**：UP主头像下载功能因B站风控机制暂时无法正常工作
**原因**：需要实现完整的WBI签名，包括WebGL指纹
**影响范围**：头像图片下载
**解决方案**：待实现完整的WBI签名

### 2. 单元测试覆盖
**问题**：当前没有正式的单元测试框架配置
**影响范围**：代码质量保障
**解决方案**：计划添加单元测试框架（Jest for frontend, pytest for backend）

## 未来计划

### 短期计划（1-2周）
- [ ] 完善单元测试
- [ ] 优化下载速度
- [ ] 添加更多视频格式支持
- [ ] 修复UP主头像下载问题

### 中期计划（1-2个月）
- [ ] 支持多语言
- [ ] 添加播放器功能
- [ ] 支持云存储
- [ ] 优化移动端体验

### 长期计划（3-6个月）
- [ ] 移动端应用
- [ ] 插件系统
- [ ] 社区功能
- [ ] AI智能推荐

## 反馈渠道

如果您在使用过程中遇到任何问题或有任何建议，欢迎通过以下方式反馈：

- GitHub Issues
- 开发者社区
- 用户反馈表单

---

**文档版本**: 1.0.0
**最后更新**: 2026-04-15
**维护者**: PiliNote Team
