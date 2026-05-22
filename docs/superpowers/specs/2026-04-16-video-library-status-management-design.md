# 视频库状态管理系统设计文档

**文档版本**: 1.1.0  
**创建日期**: 2026-04-16  
**最后更新**: 2026-04-16  
**设计目标**: 解决下载状态判断不准确、重复添加下载等问题

---

## 目录

1. [设计目标](#设计目标)
2. [问题分析](#问题分析)
3. [系统架构](#系统架构)
4. [核心功能](#核心功能)
5. [各场景实现](#各场景实现)
6. [遗漏问题解决](#遗漏问题解决)
7. [配置和用户控制](#配置和用户控制)
8. [实施计划](#实施计划)
9. [测试计划](#测试计划)

---

## 设计目标

### 核心目标

1. **统一状态管理** - 所有组件使用统一的服务判断"是否已下载"
2. **严格文件存在** - 只有文件实际存在于视频库，才认为已下载
3. **自动刷新机制** - 下载完成后自动刷新视频库缓存
4. **防重复添加** - 在所有场景（手动+自动）都避免重复添加
5. **状态一致性** - 确保视频库、任务队列、数据库状态一致

### 用户体验目标

- 状态判断响应时间 < 500ms
- 缓存刷新不影响用户操作
- 提供清晰的重复下载确认对话框
- 支持手动刷新视频库

---

## 问题分析

### 主要问题

1. **重复添加下载**
   - 自动扫描时重复添加已下载视频
   - 手动添加时没有正确判断状态
   - 批量操作时重复添加

2. **状态判断不准确**
   - 视频已下载完成，但状态显示为"未下载"
   - 用户删除文件后，状态仍然显示"已下载"
   - 多P视频的状态判断不准确

3. **按钮状态显示错误**
   - 已取消的视频仍然显示"已下载"
   - 下载失败的视频状态混乱

### 根本原因

1. **缺乏统一的状态判断逻辑**
2. **没有基于文件存在的严格判断**
3. **下载完成后没有自动刷新视频库缓存**
4. **自动扫描时没有检查视频库状态**

---

## 系统架构

### 整体架构

```
用户界面层
├── VideoDetailPage
├── FavoritesContent
└── WatchLaterContent
         │
VideoLibraryService (新增服务)
├── 缓存管理
├── 状态判断
├── 重复检查
└── 缓存刷新
         │
现有系统集成
├── newQueue Store
├── apiService
└── VideoLibrary (后端)
         │
WebSocket 实时事件
```

### 核心组件

#### VideoLibraryService

新建的独立服务，负责：

- 维护已下载视频的缓存列表
- 提供 `isVideoDownloaded()` 方法
- 管理 TTL 和缓存刷新
- 处理重复添加检查
- 显示重新下载确认对话框

---

## 核心功能

### 1. VideoLibraryService 核心方法

```typescript
class VideoLibraryService {
  // 缓存管理
  private cache: Map<string, VideoFileMeta>
  private cacheTTL: number  // 可配置，默认10分钟
  private lastRefreshTime: number
  private isRefreshing: boolean
  private refreshLock: Promise<void> | null

  // 核心方法
  async isVideoDownloaded(bvid: string, cid?: number): Promise<boolean>
  async checkVideosInLibrary(bvids: string[]): Promise<CheckResult>
  
  // 缓存刷新
  async refreshCache(): Promise<RefreshResult>
  scheduleLibraryRefresh(delay: number = 5000): void
  handleDownloadComplete(taskId: string): void
  
  // 重复检查
  async checkBeforeAdd(video: VideoInfo): Promise<AddDecision>
  async showReDownloadDialog(video: VideoInfo): Promise<boolean>
  
  // 用户控制
  async manualRefresh(): Promise<void>
  setCacheTTL(ttl: number): void
  
  // 智能判断
  isCacheFresh(threshold: number): boolean
  checkTaskState(taskId: string): TaskState
}
```

### 2. 状态判断逻辑

```typescript
async isVideoDownloaded(bvid: string, cid?: number): Promise<boolean> {
  // 1. 检查缓存是否有效
  if (!this.isCacheFresh()) {
    await this.ensureCacheLoaded()
  }
  
  // 2. 检查视频库缓存
  const inLibrary = this.checkLibraryCache(bvid, cid)
  if (inLibrary) {
    return true
  }
  
  // 3. 检查任务队列（补充判断）
  const taskState = await this.checkTaskState(bvid, cid)
  return taskState === 'completed'
}
```

### 3. 下载完成自动刷新

```typescript
handleDownloadComplete(taskId: string) {
  // 1. 延迟5秒后刷新（避免过早刷新）
  this.scheduleLibraryRefresh(5000)
  
  // 2. 记录刷新计划（用于调试）
  console.log(`[VideoLibrary] 任务 ${taskId} 完成，计划5秒后刷新视频库`)
  
  // 3. 如果缓存是新鲜的，跳过刷新
  if (this.isCacheFresh(180000)) { // 3分钟
    console.log('[VideoLibrary] 缓存仍然新鲜，跳过刷新')
    return
  }
}
```

---

## 各场景实现

### 1. 手动添加下载（视频详情页）

```typescript
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

### 2. 批量添加下载（收藏夹/稍后再看）

```typescript
const handleBatchAdd = async (videos: VideoInfo[]) => {
  // 1. 批量检查状态
  const checkResult = await videoLibraryService.checkVideosInLibrary(
    videos.map(v => v.bvid)
  )
  
  // 2. 过滤已下载的视频
  const videosToAdd = videos.filter(v => 
    !checkResult.downloaded.includes(v.bvid)
  )
  
  // 3. 显示进度
  if (videos.length > 10) {
    showToast(`正在检查 ${videos.length} 个视频...`, 'info')
  }
  
  // 4. 批量添加
  await addVideosToQueue(videosToAdd)
  
  // 5. 显示结果
  const skipped = videos.length - videosToAdd.length
  if (skipped > 0) {
    showToast(`跳过 ${skipped} 个已下载的视频`, 'info')
  }
}
```

### 3. 自动下载（定时扫描）

后端扫描服务需要添加视频库检查逻辑：

```python
async def add_videos_to_queue(self, videos: List[Video], source_type: str):
    # 1. 检查视频库
    library_response = await self._check_video_library(videos)
    downloaded_bvids = set(library_response.get('downloaded', []))
    
    # 2. 过滤已下载和失败的视频
    videos_to_add = [
        v for v in videos 
        if v.bvid not in downloaded_bvids 
        and v.bvid not in self.failed_bvids
    ]
    
    # 3. 添加到队列
    added_count = await self._add_to_queue(videos_to_add)
    
    logger.info(f"自动添加: {added_count}/{len(videos)} 个视频")
    return added_count
```

---

## 遗漏问题解决

### 高优先级问题（立即处理）

#### 问题1：下载失败状态判断

```typescript
async checkTaskState(bvid: string, cid?: number): Promise<TaskState> {
  const response = await fetch(getApiUrl(`/api/queue/tasks?bvid=${bvid}`))
  const result = await response.json()
  
  const tasks = result.data.tasks || []
  const relevantTasks = cid 
    ? tasks.filter(t => t.meta?.cid === cid)
    : tasks
  
  if (relevantTasks.length === 0) {
    return 'none'
  }
  
  // 只返回 completed 状态，其他状态都不认为已下载
  const lastTask = relevantTasks[relevantTasks.length - 1]
  return lastTask.state === 'completed' ? 'completed' : lastTask.state
}
```

#### 问题2：并发刷新竞态条件

```typescript
private refreshLock: Promise<void> | null = null

async refreshCache(): Promise<RefreshResult> {
  // 1. 如果正在刷新，等待完成
  if (this.refreshLock) {
    await this.refreshLock
    return { success: true, cached: true }
  }
  
  // 2. 获取刷新锁
  this.refreshLock = this._doRefresh()
  
  try {
    return await this.refreshLock
  } finally {
    this.refreshLock = null
  }
}
```

#### 问题3：WebSocket重连后的状态同步

```typescript
handleWebSocketReconnect() {
  // 1. 触发全量同步
  get().fetchTasks()
  get().fetchSchedulers()
  
  // 2. 延迟刷新视频库（确保所有事件都处理完毕）
  setTimeout(async () => {
    // 3. 对比本地和服务器状态
    const localCache = this.cache
    await this.refreshCache()
    
    // 4. 发现差异，通知用户
    if (this.cache.size !== localCache.size) {
      showToast('视频库已更新', 'info')
    }
  }, 3000)
}
```

### 中优先级问题（应该处理）

#### 问题4：多P视频的复杂状态

```typescript
checkLibraryCache(bvid: string, cid?: number): boolean {
  const folder = this.cache.get(bvid)
  if (!folder) {
    return false
  }
  
  // 单P视频：检查文件夹是否存在
  if (!cid) {
    return true
  }
  
  // 多P视频：精确检查对应的文件是否存在
  const videos = folder.videos || []
  return videos.some(v => v.cid === cid && v.exists)
}
```

#### 问题5：批量操作的进度提示

```typescript
async checkVideosInLibrary(bvids: string[]): Promise<CheckResult> {
  if (bvids.length > 50) {
    // 显示进度提示
    showToast(`正在检查 ${bvids.length} 个视频...`, 'info')
  }
  
  try {
    const response = await fetch(getApiUrl('/api/video-library/check-batch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bvids })
    })
    
    const result = await response.json()
    return result.data
  } finally {
    if (bvids.length > 50) {
      showToast('检查完成', 'success')
    }
  }
}
```

#### 问题6：网络错误的降级处理

```typescript
async refreshCache(): Promise<RefreshResult> {
  try {
    // 优先使用视频库API
    const response = await fetch(getApiUrl('/api/video-library/refresh'))
    if (response.ok) {
      return await this._updateFromLibrary(response)
    }
  } catch (error) {
    console.warn('视频库API失败，降级到任务队列检查')
  }
  
  // 降级：使用任务队列作为备用
  return await this._fallbackToTaskQueue()
}
```

### 低优先级问题（后续优化）

- 问题7：大量视频的性能优化
- 问题8：文件系统变化检测
- 问题9：数据库和文件系统一致性检查
- 问题10：删除任务的处理优化

---

## 配置和用户控制

### 可配置参数

```typescript
interface VideoLibraryConfig {
  cacheTTL: number              // 缓存过期时间（默认10分钟）
  autoRefreshDelay: number      // 下载完成后自动刷新延迟（默认5秒）
  maxConcurrentChecks: number   // 最大并发检查数（默认50）
  enableSmartRefresh: boolean   // 启用智能刷新（默认true）
  enableDeepScan: boolean       // 启用深度扫描（默认false）
}
```

### 用户界面

设置页面新增：
- 视频库设置
  - 缓存过期时间：10分钟（可调）
  - 下载完成后自动刷新：启用（可开关）
  - 自动刷新延迟：5秒（可调）
  - 智能刷新：启用（可开关）

下载页面新增：
- 刷新视频库按钮（手动刷新）
- 缓存状态指示（最后刷新时间）
- 一致性检查按钮（高级功能）

---

## 实施计划

### Phase 1: 后端API开发

1. 创建视频库批量检查API
2. 创建视频库刷新API
3. 创建视频库状态API
4. 修改自动扫描服务，集成视频库检查

### Phase 2: 前端服务开发

1. 创建 VideoLibraryService
2. 实现缓存管理逻辑
3. 实现状态判断逻辑
4. 实现重复检查逻辑
5. 实现自动刷新逻辑

### Phase 3: 组件集成

1. 修改 VideoDetailPage
2. 修改 FavoritesContent
3. 修改 WatchLaterContent
4. 修改 newQueue Store（集成WebSocket）

### Phase 4: 配置和UI

1. 添加视频库设置页面
2. 添加刷新按钮和状态指示
3. 添加进度提示

### Phase 5: 测试和优化

1. 单元测试
2. 集成测试
3. 性能优化
4. 边界情况处理

---

## 测试计划

### 单元测试

- VideoLibraryService 各方法
- 缓存管理逻辑
- 状态判断逻辑
- 并发刷新逻辑

### 集成测试

- 手动添加下载场景
- 批量添加下载场景
- 自动下载场景
- WebSocket 重连场景

### 性能测试

- 大量视频状态检查性能
- 缓存刷新性能
- 并发操作性能

### 边界测试

- 网络错误处理
- 文件系统不一致
- 多P视频状态判断
- 并发刷新竞态条件

---

## 附录

### 相关文档

- [下载系统整合优化文档](../download/system-refactor.md)
- [队列系统文档](../download/queue.md)
- [任务系统文档](../download/tasks.md)

### API端点清单

- `POST /api/video-library/check-batch` - 批量检查视频
- `GET /api/video-library/refresh` - 刷新视频库
- `GET /api/video-library/status` - 获取视频库状态

### 配置文件

```typescript
// stores/settings.ts
interface VideoLibrarySettings {
  cacheTTL: number
  autoRefreshDelay: number
  maxConcurrentChecks: number
  enableSmartRefresh: boolean
  enableDeepScan: boolean
}
```

---

## 实施状态

### 已完成任务

#### 后端实现 (已完成)

- ✅ 创建 VideoLibraryService (apps/api/src/services/video_library_service.py)
- ✅ 创建视频库API端点 (apps/api/src/routers/video_library.py)
  - POST /api/video-library/check-batch
  - GET /api/video-library/refresh
  - GET /api/video-library/status
- ✅ 集成视频库检查到扫描服务 (apps/api/src/services/scan_service.py)

#### 前端实现 (已完成)

- ✅ 创建 VideoLibraryService (apps/web/src/services/videoLibraryService.ts)
- ✅ 创建 ReDownloadDialog 组件 (apps/web/src/components/ReDownloadDialog.tsx)
- ✅ 添加视频库配置到 settings store (apps/web/src/stores/settings.ts)
- ✅ 集成 WebSocket 事件处理到 newQueue store (apps/web/src/stores/newQueue.ts)

#### 组件集成 (已完成)

- ✅ 集成视频库状态检查到 VideoDetailPage
- ✅ 修改 FavoritesContent 集成批量检查
- ✅ 修改 WatchLaterContent 集成批量检查
- ✅ 修改 HomeContent 集成批量检查
- ✅ 修改 VideoLibrary 组件集成缓存刷新

#### 设置页面 (已完成)

- ✅ 创建 VideoLibrarySettings 组件 (apps/web/src/pages/settings/VideoLibrarySettings.tsx)
- ✅ 在 SettingsPage 添加视频库设置标签页

#### AlertModal 增强 (已完成)

- ✅ 扩展 AlertModal 支持确认对话框功能

### 待完成任务

- [ ] 清理代码
- [ ] 运行验收测试

### 已修复问题

#### 逻辑偏离修复 (2026-04-16)

**问题**：
在实施过程中出现了逻辑偏离，从原始的文件系统扫描逻辑误用了数据库任务检查逻辑：

- ❌ 错误实现：基于数据库任务 + 文件系统存在性检查
- ✅ 正确实现：基于文件系统nfo文件的直接扫描

**具体问题**：
1. 只能识别通过任务下载的视频，无法识别非任务方式下载的视频
2. 增加了不必要的复杂性和性能开销
3. 违背了"以文件系统为基准"的设计原则

**修复方案**：
1. **后端修复** (`apps/api/src/services/video_library_service.py`)
   - 改回基于文件系统nfo文件的扫描逻辑
   - 从`library_data.folders`中提取nfo文件的bvid
   - 移除了数据库任务查询和文件存在性检查
   - 简化为直接的bvid列表对比

2. **前端修复** (`apps/web/src/services/videoLibraryService.ts`)
   - 改回使用文件系统的bvid列表构建缓存
   - 从`response.data.folders`和`downloaded_bvids`构建缓存
   - 移除了TaskState、taskCache等任务队列相关逻辑
   - 简化状态判断：`bvid in cached_bvids`

3. **清理工作**
   - 移除了所有任务队列检查逻辑
   - 简化了`isVideoDownloaded()`方法
   - 简化了`checkLibraryCache()`方法
   - 简化了`checkBeforeAdd()`方法
   - 移除了`checkTaskState()`, `_refreshTaskCache()`, `_mapTaskState()`等方法

**修复后的优势**：
- 准确反映所有已下载视频，不限于任务方式
- 简单直接的对比逻辑：`bvid in cached_bvids`
- 性能更好（只需扫描一次文件系统）
- 不依赖任务数据库，避免状态不一致问题

### 已知问题

无

### 下一步优化

1. 考虑添加更多视频库状态检查场景（如用户页、UP主页等）
2. 优化大批量视频检查的性能
3. 增强错误处理和降级机制

---

**文档结束**