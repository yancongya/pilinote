# 下载列表组件

## 概述

DownloadsList 组件是新下载页面的核心组件，负责展示和管理下载任务。支持任务筛选、批量操作、状态管理和视频库同步等功能。

**文件位置**：`apps/web/src/components/NewDownload/DownloadsList.tsx`

**依赖组件**：
- TaskCard - 单个任务卡片
- SchedulerCard - 调度器任务卡片
- Toast - 消息提示组件

**状态管理**：使用 `useNewQueueStore` 进行全局状态管理

---

## 核心功能

### 1. 任务筛选

支持按状态筛选下载任务：

| 状态值 | 说明 |
|--------|------|
| `all` | 全部任务 |
| `backlog` | 待处理 |
| `active` | 下载中 |
| `paused` | 已暂停 |
| `failed` | 失败 |

**实现**：
```typescript
<select
  value={filterStatus}
  onChange={(e) => setFilterStatus(e.target.value)}
>
  <option value="all">全部</option>
  <option value="backlog">待处理</option>
  <option value="active">下载中</option>
  <option value="paused">已暂停</option>
  <option value="failed">失败</option>
</select>
```

### 2. 刷新功能

#### 刷新菜单

提供下拉菜单，包含两种刷新选项：

1. **刷新任务列表** - 更新下载任务状态和进度
2. **刷新本地视频库** - 扫描下载目录并同步

**实现代码**：
```typescript
// 刷新任务列表
const handleRefresh = async () => {
  setIsRefreshing(true)
  try {
    await Promise.all([
      fetchTasks(),
      fetchSchedulers()
    ])
  } finally {
    setIsRefreshing(false)
  }
}

// 刷新本地视频库
const handleRefreshLibrary = async () => {
  setIsRefreshing(true)
  setShowRefreshMenu(false)
  try {
    const response = await fetch(
      'http://localhost:8000/api/library/sync?auto_import=true&auto_cleanup=false',
      { method: 'POST' }
    )
    if (response.ok) {
      const result = await response.json()
      showToast(
        `视频库刷新完成！${result.data.scan_result.total_files} 个文件，${result.data.imported_count} 个新文件`,
        'success'
      )
      await fetchTasks()
      await fetchLibraryStats()
    }
  } catch (error) {
    showToast(
      `刷新视频库失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'error'
    )
  } finally {
    setIsRefreshing(false)
  }
}
```

**API 端点**：
- 任务列表：`GET /api/queue`（通过 store 的 fetchTasks）
- 视频库同步：`POST /api/library/sync`

#### 清除缓存

清除本地缓存数据，重新从服务器加载：

```typescript
const handleClearCache = () => {
  if (!confirm('确定要清除本地缓存吗？这将重新从服务器加载所有数据。')) {
    return
  }
  localStorage.removeItem('new-queue-storage')
  window.location.reload()
}
```

### 3. 批量管理

#### 批量选择

支持单个选择和全选：

```typescript
// 单个选择
const handleTaskSelect = (taskId: string) => {
  const newSelected = new Set(selectedTasks)
  if (newSelected.has(taskId)) {
    newSelected.delete(taskId)
  } else {
    newSelected.add(taskId)
  }
  setSelectedTasks(newSelected)
}

// 全选/取消全选
const handleSelectAll = () => {
  if (selectedTasks.size === filteredTasks.length) {
    setSelectedTasks(new Set())
  } else {
    setSelectedTasks(new Set(filteredTasks.map(t => t.id)))
  }
}
```

#### 批量操作

1. **批量删除**
```typescript
const handleBatchDelete = async () => {
  if (selectedTasks.size === 0) return
  if (!confirm(`确定要删除选中的 ${selectedTasks.size} 个任务吗？`)) {
    return
  }
  try {
    await batchDeleteTasks(Array.from(selectedTasks))
    setSelectedTasks(new Set())
    setIsBatchMode(false)
  } catch (error) {
    showToast('批量删除失败，请重试', 'error')
  }
}
```

2. **批量开始下载**
```typescript
const handleBatchStart = async () => {
  if (selectedTasks.size === 0) return
  try {
    await batchStartTasks(Array.from(selectedTasks))
    setSelectedTasks(new Set())
    setIsBatchMode(false)
  } catch (error) {
    showToast('批量开始下载失败，请重试', 'error')
  }
}
```

3. **删除所有任务**
```typescript
const handleDeleteAll = async () => {
  if (filteredTasks.length === 0) return
  if (!confirm(`确定要删除所有 ${filteredTasks.length} 个任务吗？此操作不可恢复！`)) {
    return
  }
  try {
    await deleteAllTasks()
    setSelectedTasks(new Set())
    setIsBatchMode(false)
  } catch (error) {
    showToast('删除所有任务失败，请重试', 'error')
  }
}
```

### 4. 任务分组

任务按调度器分组显示：

```typescript
// 按调度器分组
const schedulerTasks = filteredTasks.filter(t => t.schedulerId)
const independentTasks = filteredTasks.filter(t => !t.schedulerId)

const groupedByScheduler = schedulerTasks.reduce((acc, task) => {
  const sid = task.schedulerId!
  if (!acc[sid]) acc[sid] = []
  acc[sid].push(task)
  return acc
}, {} as Record<string, typeof schedulerTasks>)
```

**显示逻辑**：
- 先显示调度器任务（使用 SchedulerCard）
- 再显示独立任务（使用 TaskCard）

---

## 文件命名规范

### 视频库文件命名

视频库采用统一的文件命名规范，确保跨系统兼容性和易于管理：

**封面图片**：
- 统一命名为 `cover.jpg`
- 存放在视频文件夹根目录
- 自动从 NFO 文件或下载时获取

**UP主头像**：
- 优先使用 `avatar.jpg`
- 如果不存在则查找 `avatar.png`
- 存放在视频文件夹根目录

**NFO文件**：
- 使用文件夹名称命名
- 格式：`{文件夹名}.nfo`
- 包含视频元数据和统计信息

**视频文件**：
- 保持原始下载文件名
- 支持多种格式：mp4, flv, mkv, webm, avi, mov, wmv, m4v

### 时间显示格式

视频库中的时间信息采用分层显示：

**创建时间**：
- 来源：文件夹的创建时间（`st_ctime`）
- 格式：
  ```
  2024-04-14
  15:30
  ```
- 日期和时间换行显示，提高可读性

**修改时间**：
- 来源：视频文件的修改时间（`st_mtime`）
- 格式：ISO 8601 标准格式（`YYYY-MM-DD HH:MM:SS`）

### 时间优先级

在显示视频信息时，时间优先级如下：

1. **文件夹创建时间**（用于系列视频）
   - 作为整个文件夹的创建时间
   - 显示在 LibraryCard 组件中
   - 用于排序和过滤

2. **视频修改时间**（用于单个视频）
   - 记录文件的最后修改时间
   - 用于文件同步和版本控制
   - 不用于前端显示

## 状态管理

### Store 方法

从 `useNewQueueStore` 获取的方法：

```typescript
const {
  filterStatus,           // 当前筛选状态
  setFilterStatus,        // 设置筛选状态
  getFilteredTasks,       // 获取筛选后的任务列表
  fetchTasks,             // 获取任务列表
  fetchSchedulers,        // 获取调度器列表
  schedulers,             // 调度器数据
  batchDeleteTasks,       // 批量删除任务
  deleteAllTasks,         // 删除所有任务
  batchStartTasks         // 批量开始任务
} = useNewQueueStore()
```

### 本地状态

```typescript
const [isRefreshing, setIsRefreshing] = useState(false)           // 刷新状态
const [isBatchMode, setIsBatchMode] = useState(false)             // 批量模式
const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())  // 选中的任务
const [showRefreshMenu, setShowRefreshMenu] = useState(false)      // 显示刷新菜单
const [libraryStats, setLibraryStats] = useState<any>(null)       // 视频库统计
```

---

## API 集成

### 视频库统计信息

```typescript
const fetchLibraryStats = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/library/statistics')
    if (response.ok) {
      const result = await response.json()
      setLibraryStats(result.data)
    }
  } catch (error) {
    console.error('获取视频库统计信息失败:', error)
  }
}
```

**响应数据**：
```json
{
  "success": true,
  "data": {
    "exists": true,
    "path": "/path/to/downloads",
    "file_count": 112,
    "total_size": 5368709120,
    "total_size_mb": 5120.0,
    "total_size_gb": 5.0,
    "video_files_by_type": {
      ".mp4": 100,
      ".flv": 10
    },
    "database_stats": {
      "total_downloads": 120,
      "completed_downloads": 110
    }
  }
}
```

---

## UI 组件结构

### 过滤栏

```
[筛选下拉框] [刷新按钮] [清除缓存] [批量管理] [批量删除] [批量开始] [全部删除] [全选]
```

### 任务列表

```
[SchedulerCard - 调度器1]
  └─ [TaskCard - 任务1]
  └─ [TaskCard - 任务2]

[SchedulerCard - 调度器2]
  └─ [TaskCard - 任务3]

[TaskCard - 独立任务1]
[TaskCard - 独立任务2]
```

### 刷新菜单

```
┌─────────────────────────────┐
│ 📊 刷新选项                  │
├─────────────────────────────┤
│ 🔄 刷新任务列表              │
│    更新下载任务状态和进度     │
├─────────────────────────────┤
│ 📁 刷新本地视频库            │
│    扫描 112 个文件，5.0 GB   │
└─────────────────────────────┘
```

---

## 样式说明

**样式文件**：`apps/web/src/components/NewDownload/DownloadsList.css`

### 核心样式类

| 类名 | 说明 |
|------|------|
| `.downloads-list` | 列表容器 |
| `.filter-bar` | 过滤栏 |
| `.refresh-dropdown` | 刷新下拉菜单容器 |
| `.refresh-menu` | 刷新菜单 |
| `.refresh-menu-header` | 菜单头部 |
| `.refresh-menu-item` | 菜单项 |
| `.refresh-menu-item-content` | 菜单项内容容器 |
| `.refresh-menu-item-desc` | 菜单项描述 |
| `.refresh-button` | 刷新按钮 |
| `.empty-state` | 空状态 |

### 动画效果

**旋转动画**（刷新图标）：
```css
@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.rotating {
  animation: rotate 1s linear infinite;
}
```

---

## 用户交互流程

### 1. 查看任务列表

1. 页面加载时自动获取任务列表
2. 显示所有任务（默认筛选：全部）
3. 可以通过筛选器查看特定状态的任务

### 2. 刷新任务状态

1. 点击"刷新"按钮
2. 显示下拉菜单
3. 选择"刷新任务列表"
4. 获取最新任务状态
5. 显示旋转动画指示刷新中

### 3. 批量管理任务

1. 点击"批量管理"按钮
2. 显示全选按钮和批量操作按钮
3. 点击单个任务选择/取消选择
4. 点击全选按钮选择所有任务
5. 点击批量操作按钮执行操作

### 4. 同步视频库

1. 点击"刷新"按钮
2. 显示下拉菜单
3. 选择"刷新本地视频库"
4. 扫描下载目录
5. 显示扫描结果和导入数量
6. Toast 提示操作结果

---

## 错误处理

### 网络错误

```typescript
try {
  await fetchTasks()
} catch (error) {
  console.error('刷新失败:', error)
  showToast('刷新失败，请重试', 'error')
}
```

### 确认对话框

```typescript
if (!confirm('确定要删除选中的任务吗？')) {
  return
}
```

### Toast 提示

使用 Toast 组件显示操作结果：

```typescript
showToast('操作成功', 'success')
showToast('操作失败', 'error')
showToast('提示信息', 'info')
```

---

## 性能优化

### 1. 条件渲染

只在需要时显示刷新菜单：

```typescript
{showRefreshMenu && (
  <div className="refresh-menu">
    {/* 菜单内容 */}
  </div>
)}
```

### 2. 批量操作优化

批量操作前检查选择数量：

```typescript
if (selectedTasks.size === 0) return
```

### 3. 点击外部关闭

使用 useRef 和 useEffect 实现点击外部关闭菜单：

```typescript
const refreshMenuRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (refreshMenuRef.current && !refreshMenuRef.current.contains(event.target as Node)) {
      setShowRefreshMenu(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [])
```

---

## 无障碍访问

### ARIA 属性

- `aria-label` - 按钮描述
- `title` - 工具提示
- `role="status"` - 状态指示

### 键盘导航

- Tab 键 - 在按钮间导航
- Enter/Space - 激活按钮

---

## 相关组件

### TaskCard

单个任务卡片组件，显示任务详情和控制按钮。

**文件**：`apps/web/src/components/NewDownload/TaskCard.tsx`

**功能**：
- 显示任务标题、封面、进度
- 显示任务状态
- 提供开始、暂停、删除等操作按钮
- 支持批量选择

### SchedulerCard

调度器任务卡片组件，显示调度器信息和包含的任务列表。

**文件**：`apps/web/src/components/NewDownload/SchedulerCard.tsx`

**功能**：
- 显示调度器标题和状态
- 展开查看包含的任务
- 批量操作调度器中的任务

---

## 相关文档

- [下载队列系统](../download/queue.md) - 后端队列系统文档
- [视频库API](../api/library-api.md) - 本地视频库API文档
- [状态管理](../web/implementation.md) - 前端状态管理文档
- [API端点](../api/endpoints.md) - 后端API端点文档

---

[返回上级](./README.md)