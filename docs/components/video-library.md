# VideoLibrary - 媒体库组件

## 概述

`VideoLibrary` 是 PiliNote 本地媒体库的前端展示组件，用于浏览和管理已下载的视频与图文目录。它支持按一级文件夹组织媒体、显示 NFO 元数据、搜索排序，以及批量刷新 NFO。

## 特性

- ✅ **动态扫描**：实时扫描本地下载目录，自动识别视频与图文目录
- ✅ **媒体类型识别**：根据 NFO 中的 `bvid` 或 `opus_id` 判断视频/图文
- ✅ **文件夹组织**：按一级文件夹组织媒体目录
- ✅ **元数据显示**：显示封面、头像、统计信息等
- ✅ **多视频支持**：支持展开/折叠多视频文件夹
- ✅ **图文卡片支持**：图文目录显示为独立卡片，可跳转图文详情页
- ✅ **搜索排序**：支持关键词搜索和多种排序方式
- ✅ **NFO集成**：解析并显示NFO文件中的元数据
- ✅ **统计数据**：显示播放量、点赞数、投币数等
- ✅ **评分显示**：基于互动率的评分显示
- ✅ **标签显示**：从统计数据生成标签
- ✅ **时长显示**：显示视频时长
- ✅ **响应式设计**：适配移动端和桌面端
- ✅ **批量更新NFO**：支持批量更新NFO文件的统计数据

## 组件结构

```
VideoLibrary/
├── VideoLibrary.tsx    # 主组件
└── index.css          # 样式文件
```

## Props 接口

```typescript
interface VideoLibraryProps {
  // 无外部Props，内部使用store管理状态
}
```

## 状态管理

组件内部使用React Hooks和Zustand store管理状态：

```typescript
const { connected } = useNewQueueStore()        // WebSocket连接状态
const { settings } = useSettingsStore()        // 应用设置

const [isRefreshing, setIsRefreshing] = useState(false)                    // 刷新状态
const [scanResult, setScanResult] = useState<any>(null)                   // 扫描结果
const [folderVideos, setFolderVideos] = useState<Map<string, Task[]>>(new Map())  // 文件夹视频映射
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())      // 展开的文件夹
const [keyword, setKeyword] = useState('')                                // 搜索关键词
const [order, setOrder] = useState('created')                             // 排序方式
const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc') // 排序方向
const [isUpdatingNfo, setIsUpdatingNfo] = useState(false)                  // NFO更新状态
const [nfoUpdateProgress, setNfoUpdateProgress] = useState({              // NFO更新进度
  success: 0, 
  failed: 0, 
  total: 0
})
```

## 核心功能

### 1. 动态扫描媒体库

**函数**：`scanLibrary()`

**描述**：调用后端 API 扫描本地下载目录，获取视频文件、图文目录和元数据。

```typescript
const scanLibrary = async () => {
  if (!connected) {
    showToast('WebSocket未连接', 'error')
    return
  }
  
  setIsRefreshing(true)
  
  try {
    const response = await fetch('http://localhost:8000/api/library/scan', {
      method: 'POST'
    })
    
    if (response.ok) {
      const result = await response.json()
      
      if (result.success) {
        setScanResult(result.data)
        
        // 转换为媒体卡片任务
        const convertedTasks = convertScanDataToMediaTasks(result.data)
        setTasks(convertedTasks)
        
        showToast(
          `扫描完成：发现 ${result.data.total_files} 个视频文件，${result.data.folder_count} 个媒体目录`,
          'success'
        )
      }
    }
  } catch (error) {
    console.error('扫描媒体库失败:', error)
    showToast('扫描媒体库失败', 'error')
  } finally {
    setIsRefreshing(false)
  }
}
```

### 2. 搜索和排序

**函数**：`getFilteredAndSortedFolders()`

**描述**：根据关键词搜索和排序规则过滤和排序文件夹。

**排序选项**：

| 值 | 标签 | 说明 |
|------|------|------|
| `created` | 按创建时间 | 按文件夹创建时间排序 |
| `size` | 按大小 | 按媒体目录总大小排序 |
| `name` | 按命名首字母 | 按文件夹名称首字母排序 |
| `author` | 按作者 | 按UP主名称排序 |

```typescript
const getFilteredAndSortedFolders = () => {
  if (!scanResult?.folders) return []
  
  let filtered = scanResult.folders
  
  // 关键词过滤
  if (keyword) {
    const lowerKeyword = keyword.toLowerCase()
    filtered = filtered.filter((folder: any) => {
      const titleMatch = folder.title?.toLowerCase().includes(lowerKeyword)
      const studioMatch = folder.studio?.toLowerCase().includes(lowerKeyword)
      return titleMatch || studioMatch
    })
  }
  
  // 排序
  const sorted = [...filtered]
  
  switch (order) {
    case 'created':
      sorted.sort((a: any, b: any) => {
        const timeA = a.created_time || 0
        const timeB = b.created_time || 0
        return sortDirection === 'desc' ? timeB - timeA : timeA - timeB
      })
      break
    case 'size':
      sorted.sort((a: any, b: any) => {
        const sizeA = a.total_size || 0
        const sizeB = b.total_size || 0
        return sortDirection === 'desc' ? sizeB - sizeA : sizeA - sizeB
      })
      break
    case 'name':
      sorted.sort((a: any, b: any) => {
        const nameA = a.name?.toLowerCase() || ''
        const nameB = b.name?.toLowerCase() || ''
        return sortDirection === 'desc' 
          ? nameB.localeCompare(nameA, 'zh')
          : nameA.localeCompare(nameB, 'zh')
      })
      break
    case 'author':
      sorted.sort((a: any, b: any) => {
        const authorA = a.studio?.toLowerCase() || ''
        const authorB = b.studio?.toLowerCase() || ''
        return sortDirection === 'desc' 
          ? authorB.localeCompare(authorA, 'zh')
          : authorA.localeCompare(authorB, 'zh')
      })
      break
    default:
      break
  }
  
  return sorted
}
```

### 3. 批量更新NFO文件

**函数**：`handleBatchUpdateNfo()`

**描述**：批量更新下载目录下的 NFO 文件，从 B 站 API 获取最新统计数据。视频 NFO 通过 `bvid` 刷新，图文 NFO 通过 `opus_id` 刷新。

### 4. 媒体类型与大小口径

当前媒体库统一复用同一套卡片，但会根据媒体类型切换展示逻辑：

- **视频目录**
  - 点击跳转 `/video/{bvid}`
  - 可展开多视频文件夹
  - 显示播放量、弹幕、时长、评分
  - 大小文案：`视频: X | 元数据: Y`

- **图文目录**
  - 点击跳转 `/opus/{cv数字}`
  - 不显示时长和多视频展开
  - 显示点赞、投币、收藏、分享、评论
  - 大小文案：`文档/图片: X | 元数据: Y`

图文大小统计口径：

- `文档/图片`：`*.md` 与 `images/` 目录内文件
- `元数据`：`*.nfo`、封面、头像等其余非正文资源

### 5. AI 笔记入口

每张媒体卡右下角的 AI 按钮会打开 `AiNoteModal`：

- **单个视频**：沿用现有单集分析链路，直接发起分析任务
- **系列视频**：在弹窗里以 episode 队列方式逐个分析
- **日志展示**：底部流水线面板始终展示当前选中 episode 的独立运行快照
- **节点查看**：节点日志保持手动点击查看，不会在切换 episode 时自动弹出

系列模式下，弹窗负责排队和状态展示，分析本身仍复用单集视频流水线，不新增独立的系列聚合后端流程。

```typescript
const handleBatchUpdateNfo = async () => {
  if (isUpdatingNfo) return
  
  const downloadPath = settings?.storage?.download_path || './downloads'
  
  setIsUpdatingNfo(true)
  setNfoUpdateProgress({ success: 0, failed: 0, total: 0 })
  
  try {
    const response = await fetch('http://localhost:8000/api/library/nfo/batch-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        directory: downloadPath,
        limit: 20  // 每次最多更新20个
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      
      if (result.success) {
        setNfoUpdateProgress({
          success: result.success_count,
          failed: result.failed_count,
          total: result.total
        })
        
        showToast(
          `NFO更新完成：成功${result.success_count}个，失败${result.failed_count}个`,
          'success'
        )
        
        // 延迟刷新视频库以显示更新后的信息
        setTimeout(() => {
          scanLibrary()
        }, 1000)
      } else {
        showToast(`NFO更新失败: ${result.message}`, 'error')
      }
    } else {
      showToast('NFO更新请求失败', 'error')
    }
  } catch (error) {
    console.error('批量更新NFO失败:', error)
    showToast(
      `批量更新NFO失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'error'
    )
  } finally {
    setIsUpdatingNfo(false)
  }
}
```

### 4. 缓存刷新

**函数**：`handleRefreshLibrary()`

**描述**：调用后端API刷新视频库缓存，确保状态判断准确。

```typescript
const handleRefreshLibrary = async () => {
  if (isRefreshing) return
  
  setIsRefreshing(true)
  
  try {
    const response = await fetch('http://localhost:8000/api/video-library/refresh', {
      method: 'GET'
    })
    
    if (response.ok) {
      const result = await response.json()
      
      if (result.success) {
        showToast('视频库缓存已刷新', 'success')
        
        // 延迟重新扫描以显示最新状态
        setTimeout(() => {
          scanLibrary()
        }, 500)
      }
    }
  } catch (error) {
    console.error('刷新视频库失败:', error)
    showToast('刷新视频库失败', 'error')
  } finally {
    setIsRefreshing(false)
  }
}
```

**特性**：
- 防止重复刷新（`isRefreshing`状态）
- 刷新成功后延迟扫描（避免过快请求）
- 显示加载状态和错误提示

## 子组件

### LibraryCard

**描述**：单个视频文件夹的卡片组件，显示文件夹的封面、元数据和视频列表。

**Props**：

```typescript
interface LibraryCardProps {
  task: Task                              // 文件夹任务对象
  isExpanded: boolean                     // 是否展开
  onToggle: () => void                    // 展开/折叠回调
  getLocalImageUrl: (path: string) => string  // 获取本地图片URL
  formatFileSize: (bytes: number) => string   // 格式化文件大小
}
```

**显示内容**：

1. **封面区域**：
   - 封面图片（`cover.jpg`）
   - 时长显示（左下角overlay）
   - 评分显示（右上角badge）
   - 视频数量指示器（多视频时）

2. **信息区域**：
   - 标题（带hover tooltip显示简介）
   - 创建时间（日期和时间分开显示）
   - UP主信息和发布日期（inline显示）
   - 统计数据（播放量、点赞、投币、收藏、分享、弹幕、评论）
   - 标签（最多3个+溢出指示）
   - 文件大小（视频+元数据）

3. **视频列表**（展开时）：
   - 文件名
   - 文件大小
   - 修改时间

**示例代码**：

```typescript
function LibraryCard({ task, isExpanded, onToggle, getLocalImageUrl, formatFileSize }: LibraryCardProps) {
  const hasCover = task.meta?.cover_path
  const coverUrl = hasCover ? getLocalImageUrl(task.meta.cover_path) : ''
  const hasMultipleVideos = task.meta?.file_count > 1
  
  // 格式化时长
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '--:--'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:00`
    }
    return `${minutes}:00`
  }
  
  // 格式化数字
  const formatNumber = (num: number): string => {
    if (!num || num === 0) return '0'
    if (num >= 100000000) {
      return `${(num / 100000000).toFixed(1)}亿`
    } else if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}千`
    }
    return num.toString()
  }
  
  return (
    <div className="library-folder-card">
      {/* 封面区域 */}
      <div className="library-folder-header">
        <div className="library-folder-cover">
          {hasCover ? (
            <img
              src={coverUrl}
              alt={task.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const placeholder = e.currentTarget.parentElement?.querySelector('.cover-placeholder')
                if (placeholder) {
                  (placeholder as HTMLElement).style.display = 'flex'
                }
              }}
            />
          ) : (
            <div className="cover-placeholder">
              <Film size={32} color="#42a5f5" />
            </div>
          )}
          
          {/* 时长显示 */}
          {task.meta?.runtime && (
            <div className="library-folder-duration">
              {formatDuration(task.meta.runtime)}
            </div>
          )}
          
          {/* 评分显示 */}
          {task.meta?.rating && (
            <div className="library-folder-rating">
              <Star size={12} color="#fbbf24" fill="#fbbf24" />
              <span>{task.meta.rating}</span>
            </div>
          )}
          
          {/* 视频数量指示器 */}
          {hasMultipleVideos && (
            <div className="library-folder-expand-icon" onClick={onToggle}>
              <span className="library-folder-video-count">{task.meta?.file_count || 0}</span>
              <Film size={20} color="white" />
            </div>
          )}
        </div>
        
        {/* 信息区域 */}
        <div className="library-folder-info">
          <div className="library-folder-header-row">
            <h4 
              className="library-folder-title" 
              title={task.meta?.nfo_data?.plot ? `${task.meta.nfo_data.plot.substring(0, 200)}${task.meta.nfo_data.plot.length > 200 ? '...' : ''}` : task.title}
            >
              {task.title}
            </h4>
            
            {/* 创建时间 */}
            <div className="library-folder-timestamp">
              <Calendar size={12} />
              <span>{task.created_at ? new Date(task.created_at * 1000).toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>
          
          <div className="library-folder-meta">
            {/* UP主信息 + 发布日期 */}
            <div className="library-folder-studio-row">
              {task.meta?.studio && (
                <div className="library-folder-studio">
                  {task.meta.avatar_path && (
                    <img
                      src={getLocalImageUrl(task.meta.avatar_path)}
                      alt={task.meta.studio}
                      className="studio-avatar"
                    />
                  )}
                  <span>{task.meta.studio}</span>
                </div>
              )}
              {task.meta?.premiered && (
                <div className="library-folder-premiered-inline">
                  <Calendar size={12} />
                  <span>{task.meta.premiered}</span>
                </div>
              )}
            </div>
            
            {/* 统计数据 */}
            {task.meta?.statistics && (
              <div className="library-folder-stats">
                <Eye size={12} />
                <span>{formatNumber(task.meta.statistics.play)}</span>
                <ThumbsUp size={12} />
                <span>{formatNumber(task.meta.statistics.like)}</span>
                <Coins size={12} />
                <span>{formatNumber(task.meta.statistics.coin)}</span>
                <Star size={12} />
                <span>{formatNumber(task.meta.statistics.favorite)}</span>
                {task.meta.statistics.share && (
                  <>
                    <Share2 size={12} />
                    <span>{formatNumber(task.meta.statistics.share)}</span>
                  </>
                )}
                {task.meta.statistics.danmaku && (
                  <>
                    <MessageSquare size={12} />
                    <span>{formatNumber(task.meta.statistics.danmaku)}</span>
                  </>
                )}
                {task.meta.statistics.reply && (
                  <>
                    <MessageCircle size={12} />
                    <span>{formatNumber(task.meta.statistics.reply)}</span>
                  </>
                )}
              </div>
            )}
            
            {/* 视频标签 */}
            {task.meta?.tags && task.meta.tags.length > 0 && (
              <div className="library-folder-tags">
                <Hash size={12} />
                {task.meta.tags.slice(0, 3).map((tag: string, index: number) => (
                  <span key={index} className="library-folder-tag">{tag}</span>
                ))}
                {task.meta.tags.length > 3 && (
                  <span className="library-folder-tag-more">+{task.meta.tags.length - 3}</span>
                )}
              </div>
            )}
            
            {/* 文件统计 */}
            <div className="library-folder-size">
              {formatFileSize(task.meta.total_size + task.meta.metadata_size)}
              {task.meta.metadata_size > 0 && task.meta.total_size > 0 && ' | '}
              {task.meta.total_size > 0 && `视频: ${formatFileSize(task.meta.total_size)}`}
              {task.meta.metadata_size > 0 && ` | 元数据: ${formatFileSize(task.meta.metadata_size)}`}
            </div>
          </div>
        </div>
      </div>
      
      {/* 视频列表（展开时） */}
      {isExpanded && (
        <div className="library-folder-videos">
          {folderVideos.get(task.title || '')?.map((video, index) => (
            <div key={index} className="library-folder-video-item">
              <div className="video-item-name">{video.title}</div>
              <div className="video-item-size">{formatFileSize(video.size)}</div>
              <div className="video-item-time">{video.modified_date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## 样式特性

### 卡片布局

```css
.library-folder-card {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.library-folder-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

### 封面区域

```css
.library-folder-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: 8px 8px 0 0;
}

/* 时长显示 */
.library-folder-duration {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(4px);
  z-index: 10;
}

/* 评分显示 */
.library-folder-rating {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 2px;
  backdrop-filter: blur(4px);
  z-index: 10;
}
```

### 统计数据

```css
.library-folder-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}

.library-folder-stats svg {
  flex-shrink: 0;
}

.library-folder-stats span {
  font-size: 12px;
  color: #64748b;
}
```

### 标签样式

```css
.library-folder-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  flex-wrap: wrap;
}

.library-folder-tag {
  padding: 2px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 11px;
  color: #475569;
  white-space: nowrap;
}

.library-folder-tag-more {
  padding: 2px 6px;
  background: #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}
```

## 工具函数

### formatFileSize

格式化文件大小为易读的字符串。

```typescript
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
```

### formatDuration

格式化视频时长为`MM:SS`或`HH:MM:SS`格式。

```typescript
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds === 0) return '--:--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:00`
  }
  return `${minutes}:00`
}
```

### formatNumber

格式化数字为易读的字符串（如：1.2万、3.5亿）。

```typescript
const formatNumber = (num: number): string => {
  if (!num || num === 0) return '0'
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}亿`
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}千`
  }
  return num.toString()
}
```

### getLocalImageUrl

获取本地图片的URL（通过API代理）。

```typescript
const getLocalImageUrl = (filePath: string): string => {
  return `http://localhost:8000/api/library/image?file_path=${encodeURIComponent(filePath)}`
}
```

## 集成组件

组件集成了以下子组件：

### VideoListControls

**描述**：视频列表搜索和排序控件。

**Props传递**：
- `keyword`: 搜索关键词
- `order`: 排序方式
- `sortDirection`: 排序方向
- `onKeywordChange`: 关键词变化回调
- `onOrderChange`: 排序方式变化回调
- `onSortDirectionChange`: 排序方向变化回调
- `sortOptions`: 排序选项配置
- `onRefresh`: 刷新回调
- `isRefreshing`: 刷新状态
- `formatFileSize`: 格式化文件大小函数
- `onUpdateNfo`: 批量更新NFO回调
- `isUpdatingNfo`: NFO更新状态
- `nfoUpdateProgress`: NFO更新进度

## 生命周期

### useEffect - 初始化

```typescript
useEffect(() => {
  if (connected) {
    scanLibrary()
  }
}, [connected])
```

当WebSocket连接建立时，自动扫描视频库。

## 交互流程

### 1. 初始化流程

```
组件挂载
  ↓
检查WebSocket连接状态
  ↓
连接成功 → 扫描视频库
  ↓
显示扫描结果
```

### 2. 刷新流程

```
用户点击刷新按钮
  ↓
调用scanLibrary()
  ↓
设置刷新状态为true
  ↓
调用后端API扫描
  ↓
更新扫描结果
  ↓
设置刷新状态为false
  ↓
显示成功消息
```

### 3. 搜索流程

```
用户输入搜索关键词
  ↓
触发onKeywordChange
  ↓
更新keyword状态
  ↓
触发getFilteredAndSortedFolders()
  ↓
过滤和排序文件夹
  ↓
更新显示结果
```

### 4. 排序流程

```
用户选择排序方式
  ↓
触发onOrderChange
  ↓
更新order状态
  ↓
触发getFilteredAndSortedFolders()
  ↓
过滤和排序文件夹
  ↓
更新显示结果
```

### 5. 展开/折叠流程

```
用户点击展开/折叠按钮
  ↓
触发onToggle
  ↓
更新expandedFolders状态
  ↓
显示/隐藏视频列表
```

### 6. 批量更新NFO流程

```
用户点击批量更新NFO按钮
  ↓
调用handleBatchUpdateNfo()
  ↓
设置更新状态为true
  ↓
调用后端API批量更新
  ↓
更新进度状态
  ↓
显示成功消息
  ↓
延迟1秒刷新视频库
  ↓
设置更新状态为false
```

## 性能优化

### 1. 按需扫描

- 用户主动点击刷新按钮时才扫描
- 避免后台频繁扫描影响性能

### 2. 缓存扫描结果

- 扫描结果存储在前端状态中
- 用户切换标签页时不重新扫描

### 3. 延迟刷新

- NFO更新完成后延迟1秒刷新视频库
- 给后端API足够的时间处理

### 4. 图片懒加载

- 只在需要显示图片时才请求
- 使用API代理避免file://协议限制

## 错误处理

### 1. WebSocket未连接

```typescript
if (!connected) {
  showToast('WebSocket未连接', 'error')
  return
}
```

### 2. API请求失败

```typescript
try {
  const response = await fetch(...)
  if (!response.ok) {
    throw new Error('API请求失败')
  }
} catch (error) {
  console.error('操作失败:', error)
  showToast('操作失败', 'error')
}
```

### 3. 封面图片加载失败

```typescript
<img
  src={coverUrl}
  alt={task.title}
  onError={(e) => {
    e.currentTarget.style.display = 'none'
    const placeholder = e.currentTarget.parentElement?.querySelector('.cover-placeholder')
    if (placeholder) {
      (placeholder as HTMLElement).style.display = 'flex'
    }
  }}
/>
```

## 响应式设计

### 移动端

- 垂直布局
- 卡片全宽显示
- 简化统计数据显示
- 隐藏部分详细信息

### 桌面端

- 网格布局
- 卡片宽度固定
- 完整统计数据显示
- 详细信息可见

## 最佳实践

### 1. 数据获取

- 使用WebSocket连接状态判断是否可以操作
- API请求失败时显示错误提示
- 避免重复请求

### 2. 状态管理

- 使用React Hooks管理本地状态
- 使用Zustand store管理全局状态
- 及时更新UI反映状态变化

### 3. 用户体验

- 显示加载状态
- 提供错误提示
- 支持搜索和排序
- 响应式设计

### 4. 性能优化

- 避免频繁API调用
- 缓存扫描结果
- 延迟刷新
- 图片懒加载

## 未来改进

- [ ] 添加虚拟滚动支持大量视频
- [ ] 添加视频预览功能
- [ ] 添加视频播放功能
- [ ] 支持拖拽排序
- [ ] 添加批量操作功能
- [ ] 支持自定义显示字段
- [ ] 添加视频筛选功能
- [ ] 支持导出视频列表

## 相关文档

- [本地视频库API](../api/library-api.md)
- [NFO文件格式](../download/nfo-format.md)
- [VideoListControls组件](./video-list-controls.md)
- [下载服务实现](../download/download-service.md)

## 相关文件

- **组件文件**: `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- **样式文件**: `apps/web/src/components/NewDownload/index.css`
- **API路由**: `apps/api/src/routers/library.py`
- **本地库服务**: `apps/api/src/services/local_library_service.py`

---

[返回上级](./README.md)
