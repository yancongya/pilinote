// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore, Task } from '../../stores/newQueue'
import { useToast } from '../../components/Toast'
import { Inbox as EmptyIcon, RefreshCw, Calendar, Film } from 'lucide-react'
import { useEffect, useState } from 'react'
import VideoListControls from '../VideoListControls'

interface VideoFile {
  path: string
  title: string
  size: number
  size_mb: number
  modified_time: number
  modified_date: string
}

interface FolderMetadata {
  name: string
  title: string
  path: string
  file_count: number
  size: number
  metadata_size: number
  total_size: number
  size_mb: number
  size_gb: number
  cover?: string
  cover_path?: string
  avatar?: string
  avatar_path?: string
  studio?: string
  nfo_data?: any
  created_time: number
}

interface LibraryCardProps {
  task: Task
  isExpanded: boolean
  onToggle: () => void
  getLocalImageUrl: (path: string) => string
  formatFileSize: (bytes: number) => string
}

// LibraryCard组件 - 显示文件夹卡片
function LibraryCard({ task, isExpanded, onToggle, getLocalImageUrl, formatFileSize }: LibraryCardProps) {
  const hasMultipleVideos = task.meta?.file_count > 1
  const hasCover = task.cover && task.cover.trim()
  const coverUrl = task.cover ? getLocalImageUrl(task.cover) : ''
  
  // 格式化创建时间
  const formatDate = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
      return { date: '未知日期', time: '' }
    }
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      return { date: '未知日期', time: '' }
    }
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].substring(0, 5) // HH:MM
    return { date: dateStr, time: timeStr }
  }

  return (
    <div className="library-folder-card">
      {/* 文件夹头部 */}
      <div className="library-folder-header">
        {/* 封面 */}
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
          {hasMultipleVideos && (
            <div className="library-folder-expand-icon" onClick={onToggle}>
              <span className="library-folder-video-count">{task.meta?.file_count || 0}</span>
              <Film size={20} color="white" />
            </div>
          )}
        </div>

        {/* 文件夹信息 */}
        <div className="library-folder-info">
          <div className="library-folder-header-row">
            <h4 className="library-folder-title">{task.title}</h4>
            
            {/* 创建时间 - 分开显示 */}
            <div className="library-folder-timestamp">
              <div className="library-folder-created-date">
                <Calendar size={12} />
                <span>{formatDate(task.created_at).date}</span>
              </div>
              <div className="library-folder-created-time">
                <span>{formatDate(task.created_at).time}</span>
              </div>
            </div>
          </div>

          <div className="library-folder-meta">
            {/* UP主信息 */}
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

            {/* 文件统计 */}
            <div className="library-folder-stats">
              <span className="library-folder-size">
                {formatFileSize(task.meta.total_size + task.meta.metadata_size)}
                {task.meta.metadata_size > 0 && task.meta.total_size > 0 && ' | '}
                {task.meta.total_size > 0 && `视频: ${formatFileSize(task.meta.total_size)}`}
                {task.meta.metadata_size > 0 && ` | 元数据: ${formatFileSize(task.meta.metadata_size)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 展开的视频列表（仅多视频文件夹） */}
      {hasMultipleVideos && isExpanded && task.meta?.files && (
        <div className="library-folder-videos">
          {task.meta.files.map((file: VideoFile, index: number) => (
            <div key={`${file.path}-${index}`} className="library-folder-video-item">
              <div className="library-video-info">
                <div className="library-video-title">{file.title}</div>
                <div className="library-video-meta">
                  <span>{formatFileSize(file.size)}</span>
                  <span className="stats-divider">·</span>
                  <span>{file.modified_date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VideoLibrary() {
  const { connected } = useNewQueueStore()
  const { showToast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState('created')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 获取本地图片URL（通过API代理）
  const getLocalImageUrl = (filePath: string | undefined): string => {
    if (!filePath) return ''
    return `http://localhost:8000/api/library/image?file_path=${encodeURIComponent(filePath)}`
  }

  // 排序函数
  const sortTasks = (tasks: Task[]): Task[] => {
    const sorted = [...tasks]
    
    switch (order) {
      case 'size':
        // 按大小排序
        sorted.sort((a, b) => {
          const sizeA = a.meta?.total_size + a.meta?.metadata_size || 0
          const sizeB = b.meta?.total_size + b.meta?.metadata_size || 0
          return sortDirection === 'desc' ? sizeB - sizeA : sizeA - sizeB
        })
        break
      case 'name':
        // 按命名首字母排序
        sorted.sort((a, b) => {
          const nameA = a.title?.toLowerCase() || ''
          const nameB = b.title?.toLowerCase() || ''
          return sortDirection === 'desc' 
            ? nameB.localeCompare(nameA, 'zh')
            : nameA.localeCompare(nameB, 'zh')
        })
        break
      case 'created':
        // 按创建时间排序
        sorted.sort((a, b) => {
          const timeA = a.created_at || 0
          const timeB = b.created_at || 0
          return sortDirection === 'desc' ? timeB - timeA : timeA - timeB
        })
        break
      default:
        break
    }
    
    return sorted
  }

  // 过滤和排序任务
  const getFilteredAndSortedTasks = (): Task[] => {
    let filtered = tasks
    
    // 关键词搜索
    if (keyword.trim()) {
      const lowerKeyword = keyword.toLowerCase().trim()
      filtered = filtered.filter(task => {
        const title = task.title?.toLowerCase() || ''
        const studio = task.meta?.studio?.toLowerCase() || ''
        return title.includes(lowerKeyword) || studio.includes(lowerKeyword)
      })
    }
    
    // 排序
    return sortTasks(filtered)
  }

  // 将扫描的文件转换为Task格式
  const convertFilesToTasks = (scanData: any): Task[] => {
    const tasks: Task[] = []
    
    if (!scanData || !scanData.folders) {
      return tasks
    }

    // 遍历所有文件夹
    scanData.folders.forEach((folder: FolderMetadata) => {
      // 获取该文件夹的视频文件
      const folderVideos = scanData.folder_videos?.[folder.name]?.files
      
      if (!folderVideos || folderVideos.length === 0) {
        return
      }

      // 创建一个任务代表整个文件夹
      const task: Task = {
        id: `folder-${folder.name}`,
        ts: Date.now(),
        seq: 0,
        title: folder.title,
        cover: folder.cover_path || '',
        desc: folder.nfo_data?.plot || '',
        duration: 0,
        pubtime: folder.created_time * 1000,
        media_type: 'video',
        url: '',
        media_id: folder.name,
        schedulerId: undefined,
        state: 'completed' as const,
        status: {
          progress: 100,
          speed: 0,
          eta: 0,
          stage: 'completed' as const,
          downloaded: folder.size,
          total: folder.size
        },
        meta: {
          folder_name: folder.name,
          folder_path: folder.path,
          file_count: folder.file_count,
          total_size: folder.total_size,
          metadata_size: folder.metadata_size,
          studio: folder.studio,
          cover_path: folder.cover_path,
          avatar_path: folder.avatar_path,
          nfo_data: folder.nfo_data,
          files: folderVideos
        },
        prepare: {},
        subtasks: [],
        subtaskStatus: {},
        created_at: folder.created_time * 1000,
        updated_at: Date.now()
      }

      tasks.push(task)
    })

    return tasks
  }

  // 展开/折叠文件夹
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  // 扫描视频库
  const scanLibrary = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/library/scan', {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        setScanResult(result.data)
        
        // 转换为Task格式
        const convertedTasks = convertFilesToTasks(result.data)
        setTasks(convertedTasks)
        
        return result.data
      }
      throw new Error('扫描失败')
    } catch (error) {
      console.error('扫描视频库失败:', error)
      throw error
    }
  }

  // 刷新视频库
  const handleRefreshLibrary = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const result = await scanLibrary()
      
      if (result) {
        showToast(`视频库刷新完成！${result.folder_count} 个系列，${result.total_files} 个视频`, 'success')
      }
    } catch (error) {
      showToast(`刷新视频库失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    } finally {
      setIsRefreshing(false)
    }
  }

  // 初始化时获取数据
  useEffect(() => {
    if (connected) {
      scanLibrary()
    }
  }, [connected])

  // 监听下载完成事件，延迟刷新视频库
  useEffect(() => {
    if (!connected) return

    const handleDownloadComplete = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        
        // 监听任务完成事件
        if (data.type === 'task_completed' || data.type === 'task.state' && data.state === 'completed') {
          console.log('检测到下载完成，5秒后刷新视频库')
          
          // 延迟5秒后刷新视频库
          const timer = setTimeout(() => {
            console.log('刷新视频库')
            scanLibrary()
          }, 5000)
          
          // 清理定时器
          return () => clearTimeout(timer)
        }
      } catch (error) {
        console.error('处理下载完成事件失败:', error)
      }
    }

    // 监听WebSocket消息
    const ws = (window as any).ws // 从全局获取WebSocket连接
    if (ws) {
      ws.addEventListener('message', handleDownloadComplete)
    }

    return () => {
      if (ws) {
        ws.removeEventListener('message', handleDownloadComplete)
      }
    }
  }, [connected])

  if (!connected) {
    return (
      <div className="video-library">
        <div style={{ textAlign: 'center', padding: '40px', color: '#92400e', background: '#fef3c7', borderRadius: '8px', fontSize: '14px' }}>
          <EmptyIcon size={16} style={{ marginBottom: '8px' }} />
          <br />
          WebSocket 未连接，请检查后端服务
        </div>
      </div>
    )
  }

  const hasTasks = tasks.length > 0

    const totalFiles = scanResult ? scanResult.total_files : 0

    const totalSize = scanResult ? scanResult.total_size : 0

    const filteredTasks = getFilteredAndSortedTasks()

  

    return (

      <div className="video-library">

        {/* 搜索和排序 */}

        {hasTasks && (

          <VideoListControls

            keyword={keyword}

            order={order}

            sortDirection={sortDirection}

            onKeywordChange={setKeyword}

            onOrderChange={setOrder}

            onSortDirectionChange={setSortDirection}

            sortOptions={[

              { value: 'created', label: '按创建时间' },

              { value: 'size', label: '按大小' },

              { value: 'name', label: '按命名首字母' }

            ]}

            seriesCount={tasks.length}

            videoCount={totalFiles}

            totalSize={totalSize}

            onRefresh={handleRefreshLibrary}

            isRefreshing={isRefreshing}

            formatFileSize={formatFileSize}

          />

        )}

  

        {/* 空状态 */}

        {!hasTasks && (

          <div className="empty-state">

            <EmptyIcon size={48} color="#94a3b8" />

            <p>暂无视频文件</p>

            <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>

              点击刷新按钮扫描本地视频库

            </p>

            <button

              className="library-refresh-button-empty"

              onClick={handleRefreshLibrary}

              disabled={isRefreshing}

              style={{ marginTop: '16px' }}

            >

              <RefreshCw size={16} className={isRefreshing ? 'rotating' : ''} />

              <span>{isRefreshing ? '刷新中...' : '刷新'}</span>

            </button>

          </div>

        )}

  

  

        {/* 任务列表 */}

        {hasTasks && (

          <div className="task-list">

            {filteredTasks.map((task) => (

              <LibraryCard

                key={task.id}

                task={task}

                isExpanded={expandedFolders.has(task.id)}

                onToggle={() => toggleFolder(task.id)}

                getLocalImageUrl={getLocalImageUrl}

                formatFileSize={formatFileSize}

              />

            ))}

            

            {/* 搜索无结果 */}

            {filteredTasks.length === 0 && keyword && (

              <div className="empty-state">

                <EmptyIcon size={48} color="#94a3b8" />

                <p>未找到匹配的视频</p>

                <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>

                  请尝试其他关键词或清除搜索条件

                </p>

              </div>

            )}

          </div>

        )}
    </div>
  )
}