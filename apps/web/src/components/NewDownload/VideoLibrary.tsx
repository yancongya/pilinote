// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore, Task } from '../../stores/newQueue'
import { useSettingsStore } from '../../stores/settings'
import { useToast } from '../../components/Toast'
import { videoLibraryService } from '../../services/videoLibraryService'
import { Inbox as EmptyIcon, RefreshCw, Calendar, Film, Eye, ThumbsUp, Coins, Star, Hash, Share2, MessageSquare, MessageCircle, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VideoListControls from '../VideoListControls'
import { convertScanDataToMediaTasks, getMediaLibraryRoute, type MediaLibraryFile } from './mediaLibrary'
import { AiNoteButton } from '../ai/AiNoteButton'
import { AiNoteModal } from '../ai/AiNoteModal'
import { useAiNoteLookup } from '../../hooks/useAiNoteLookup'
import { localAsrModelService } from '../../services/localAsrModels'
import { getApiBaseUrl } from '../../config/api'
import { type NoteResponse } from '../../services/aiNote'

interface LibraryCardProps {
  task: Task
  isExpanded: boolean
  onToggle: () => void
  getLocalImageUrl: (path: string) => string
  formatFileSize: (bytes: number) => string
}

// LibraryCard组件 - 显示文件夹卡片
function LibraryCard({ task, isExpanded, onToggle, getLocalImageUrl, formatFileSize }: LibraryCardProps) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isOpus = task.media_type === 'opus'
  const hasMultipleVideos = !isOpus && task.meta?.file_count > 1
  const hasCover = task.cover && task.cover.trim()
  const coverUrl = task.cover ? getLocalImageUrl(task.cover) : ''

  // AI 笔记状态
  const [isLocalAsrReady, setIsLocalAsrReady] = useState(true)
  const [showAiNoteModal, setShowAiNoteModal] = useState(false)
  const [existingNote, setExistingNote] = useState<NoteResponse | null>(null)

  const folderPath = task.meta?.folder_path
  const bvid = task.meta?.nfo_data?.bvid
  const videoIdForNote = bvid || folderPath

  // 仅对可识别的 B 站视频提供 AI 笔记（统一使用 BV 号进行查找/触发分析）
  const canUseAiNote = Boolean(videoIdForNote) && !isOpus
  const lookup = useAiNoteLookup(canUseAiNote ? videoIdForNote : null)
  const noteForStatus = lookup.note
  const aiNoteButtonStatus = noteForStatus?.status === 'completed' ? 'completed' : 'none'

  useEffect(() => {
    if (noteForStatus) {
      setExistingNote(noteForStatus)
    }
  }, [noteForStatus])

  useEffect(() => {
    let cancelled = false
    if (isOpus) return
    localAsrModelService.checkReady().then(result => {
      if (!cancelled) {
        setIsLocalAsrReady(result.ready)
      }
    }).catch(() => {
      if (!cancelled) setIsLocalAsrReady(false)
    })
    return () => {
      cancelled = true
    }
  }, [isOpus])

  const handleAiNoteClick = () => {
    if (!isLocalAsrReady && !isOpus) {
      showToast('请先在 AI 笔记设置中下载并启用本地 ASR 模型', 'warning')
      return
    }
    setShowAiNoteModal(true)
  }

  const handleAiNoteComplete = (note: NoteResponse) => {
    setExistingNote(note)
  }

  // 点击卡片跳转到详情页
  const handleCardClick = () => {
    const route = getMediaLibraryRoute(task)
    if (route) {
      navigate(route)
    }
  }
  
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

  // 格式化时长
  const formatDuration = (duration: string | number): string => {
    if (!duration) return '--:--'
    
    // 如果是字符串格式（MM:SS），直接返回
    if (typeof duration === 'string') {
      return duration
    }
    
    // 如果是数字格式（秒数），转换为MM:SS格式
    if (typeof duration === 'number') {
      if (duration === 0) return '--:--'
      const hours = Math.floor(duration / 3600)
      const minutes = Math.floor((duration % 3600) / 60)
      const seconds = Math.floor(duration % 60)
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    
    return '--:--'
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
    <div className="library-folder-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
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
                {isOpus ? (
                  <FileText size={32} color="var(--color-primary-500)" />
                ) : (
                  <Film size={32} color="var(--color-primary-500)" />
                )}
              </div>
            )}
            
            {/* 时长显示 */}
            {!isOpus && task.meta?.runtime && (
              <div className="library-folder-duration">
                {formatDuration(task.meta.runtime)}
              </div>
            )}
            
            {/* 评分显示 */}
            {!isOpus && task.meta?.rating && (
              <div className="library-folder-rating">
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <span>{task.meta.rating}</span>
              </div>
            )}

            {isOpus && (
              <div className="library-folder-duration" style={{ background: 'var(--color-primary-600)' }}>
                图文
              </div>
            )}
            
            {hasMultipleVideos && (
              <div className="library-folder-expand-icon" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
                <span className="library-folder-video-count">{task.meta?.file_count || 0}</span>
                <Film size={20} color="white" />
              </div>
            )}

            {/* AI 笔记按钮 - 仅视频显示，有本地文件 */}
            {!isOpus && canUseAiNote && (
            <AiNoteButton
                status={aiNoteButtonStatus}
                onClick={handleAiNoteClick}
                disabled={!isLocalAsrReady}
                style={{ left: '8px', top: '8px', zIndex: 30 }}
              />
            )}
          </div>

        {/* 文件夹信息 */}
        <div className="library-folder-info">
          {/* 标题行：标题 + 创建时间 */}
          <div className="library-folder-title-row">
            <h4 
              className="library-folder-title" 
              title={task.meta?.nfo_data?.plot ? `${task.meta.nfo_data.plot.substring(0, 200)}${task.meta.nfo_data.plot.length > 200 ? '...' : ''}` : task.title}
            >
              {task.title}
            </h4>
            
            {/* 创建时间 */}
            <div className="library-folder-created-time">
              <Calendar size={12} />
              <span>{formatDate(task.created_at).date}</span>
              <span>{formatDate(task.created_at).time}</span>
            </div>
          </div>

          {/* 元数据行：统计数据 + 标签 */}
          <div className="library-folder-meta-row">
            {/* 统计数据 */}
            {task.meta?.statistics && (
              <div className="library-folder-stats">
                {!isOpus && (
                  <>
                    <Eye size={12} />
                    <span>{formatNumber(task.meta.statistics.play)}</span>
                  </>
                )}
                <ThumbsUp size={12} />
                <span>{formatNumber(task.meta.statistics.like)}</span>
                <Coins size={12} />
                <span>{formatNumber(task.meta.statistics.coin)}</span>
                <Star size={12} />
                <span>{formatNumber(task.meta.statistics.favorite)}</span>
                {task.meta.statistics.share !== undefined && (
                  <>
                    <Share2 size={12} />
                    <span>{formatNumber(task.meta.statistics.share)}</span>
                  </>
                )}
                {!isOpus && task.meta.statistics.danmaku !== undefined && (
                  <>
                    <MessageSquare size={12} />
                    <span>{formatNumber(task.meta.statistics.danmaku)}</span>
                  </>
                )}
                {task.meta.statistics.reply !== undefined && (
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
          </div>

          {/* 作者行：作者 + 上传时间 */}
          <div className="library-folder-author-row">
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
            
            {/* 上传时间 */}
            {task.meta?.premiered && (
              <div className="library-folder-premiered-inline">
                <Calendar size={12} />
                <span>{task.meta.premiered}</span>
              </div>
            )}
          </div>

          {/* 大小行：文件大小 */}
          <div className="library-folder-size-row">
            <div className="library-folder-size">
              {formatFileSize(task.meta.total_size)}
              {task.meta.metadata_size > 0 && task.meta.primary_size > 0 && ' | '}
              {task.meta.primary_size > 0 && `${task.meta.primary_size_label}: ${formatFileSize(task.meta.primary_size)}`}
              {task.meta.metadata_size > 0 && ` | 元数据: ${formatFileSize(task.meta.metadata_size)}`}
            </div>
          </div>
        </div>
      </div>

      {/* 展开的视频列表（仅多视频文件夹） */}
      {hasMultipleVideos && isExpanded && task.meta?.files && (
        <div className="library-folder-videos">
          {task.meta.files.map((file: MediaLibraryFile, index: number) => (
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

      {showAiNoteModal && canUseAiNote && (
        <AiNoteModal
          videoId={videoIdForNote}
          videoTitle={task.title}
          existingNote={existingNote}
          isOpen={showAiNoteModal}
          onClose={() => setShowAiNoteModal(false)}
          onComplete={handleAiNoteComplete}
        />
      )}
    </div>
  )
}

export default function VideoLibrary() {
  const { connected } = useNewQueueStore()
  const { settings } = useSettingsStore()
  const { showToast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [order, setOrder] = useState('created')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [isUpdatingNfo, setIsUpdatingNfo] = useState(false)
  const [nfoUpdateProgress, setNfoUpdateProgress] = useState({ success: 0, failed: 0, total: 0 })

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
    return `${getApiBaseUrl()}/api/library/image?file_path=${encodeURIComponent(filePath)}`
  }

  // 排序函数
  const sortTasks = (tasks: Task[]): Task[] => {
    const sorted = [...tasks]
    
    switch (order) {
      case 'size':
        // 按大小排序
        sorted.sort((a, b) => {
          const sizeA = a.meta?.total_size || 0
          const sizeB = b.meta?.total_size || 0
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
      case 'author':
        // 按作者名排序
        sorted.sort((a, b) => {
          const authorA = a.meta?.studio?.toLowerCase() || ''
          const authorB = b.meta?.studio?.toLowerCase() || ''
          return sortDirection === 'desc' 
            ? authorB.localeCompare(authorA, 'zh')
            : authorA.localeCompare(authorB, 'zh')
        })
        break
      case 'premiered':
        // 按上传时间排序
        sorted.sort((a, b) => {
          const premieredA = a.meta?.premiered || ''
          const premieredB = b.meta?.premiered || ''
          // 如果上传时间相同或缺失，则按创建时间排序
          if (!premieredA || !premieredB) {
            const timeA = a.created_at || 0
            const timeB = b.created_at || 0
            return sortDirection === 'desc' ? timeB - timeA : timeA - timeB
          }
          const result = premieredA.localeCompare(premieredB)
          return sortDirection === 'desc' ? -result : result
        })
        break
      case 'duration':
        // 按时长排序
        sorted.sort((a, b) => {
          const getDurationSeconds = (task: Task): number => {
            if (!task.meta?.runtime) return 0
            const runtime = task.meta.runtime
            if (typeof runtime === 'number') return runtime
            // 如果是字符串格式 "MM:SS"，转换为秒数
            if (typeof runtime === 'string') {
              const parts = runtime.split(':')
              if (parts.length === 2) {
                return parseInt(parts[0]) * 60 + parseInt(parts[1])
              }
            }
            return 0
          }
          const durationA = getDurationSeconds(a)
          const durationB = getDurationSeconds(b)
          return sortDirection === 'desc' ? durationB - durationA : durationA - durationB
        })
        break
      case 'views':
        // 按播放量排序
        sorted.sort((a, b) => {
          const viewsA = a.media_type === 'opus' ? 0 : (a.meta?.statistics?.play || 0)
          const viewsB = b.media_type === 'opus' ? 0 : (b.meta?.statistics?.play || 0)
          return sortDirection === 'desc' ? viewsB - viewsA : viewsA - viewsB
        })
        break
      case 'likes':
        // 按点赞量排序
        sorted.sort((a, b) => {
          const likesA = a.meta?.statistics?.like || 0
          const likesB = b.meta?.statistics?.like || 0
          return sortDirection === 'desc' ? likesB - likesA : likesA - likesB
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

  // 扫描媒体库
  const scanLibrary = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/library/scan`, {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        setScanResult(result.data)
        
        // 转换为Task格式
        const convertedTasks = convertScanDataToMediaTasks(result.data)
        setTasks(convertedTasks)
        
        return result.data
      }
      throw new Error('扫描失败')
    } catch (error) {
      console.error('扫描媒体库失败:', error)
      throw error
    }
  }

  // 刷新媒体库（优先NFO更新，然后扫描）
  const handleRefreshLibrary = async () => {
    if (isRefreshing || isUpdatingNfo) return
    
    const downloadPath = settings?.storage?.download_path || './downloads'
    const batchSize = 20 // 每批处理20个文件
    
    // 第一阶段：分批轮询执行NFO更新
    setIsUpdatingNfo(true)
    setNfoUpdateProgress({ success: 0, failed: 0, total: 0 })
    
    try {
      showToast('开始更新NFO元数据...', 'info')
      
      let totalSuccess = 0
      let totalFailed = 0
      let totalProcessed = 0
      let hasMore = true
      let batchIndex = 0
      
      // 轮询处理，直到所有文件都被处理
      while (hasMore) {
        batchIndex++
        const response = await fetch(`${getApiBaseUrl()}/api/library/nfo/batch-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            directory: downloadPath,
            limit: batchSize,
            offset: totalProcessed // 添加偏移量，跳过已处理的文件
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          
          if (result.success) {
            totalSuccess += result.success_count
            totalFailed += result.failed_count
            totalProcessed += result.total
            
            // 更新进度
            setNfoUpdateProgress({
              success: totalSuccess,
              failed: totalFailed,
              total: totalProcessed
            })
            
            // 检查是否还有更多文件需要处理
            hasMore = result.total === batchSize
            
            // 如果这批处理的文件少于批次大小，说明已经处理完了
            if (result.total < batchSize) {
              hasMore = false
            }
          } else {
            // API返回失败，停止处理
            hasMore = false
          }
        } else {
          // 请求失败，停止处理
          hasMore = false
        }
        
        // 如果还有更多文件，短暂延迟后继续下一批
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100)) // 100ms延迟
        }
      }
      
      // 所有批次处理完成，显示最终结果
      setTimeout(() => {
        showToast(`NFO更新完成：成功${totalSuccess}个，失败${totalFailed}个`, 
                  totalFailed > 0 ? 'warning' : 'success')
      }, 500)
      
    } catch (error) {
      console.error('NFO更新失败:', error)
      showToast('NFO更新失败，继续扫描媒体库...', 'warning')
    } finally {
      setIsUpdatingNfo(false)
    }
    
    // 第二阶段：执行扫描
    setIsRefreshing(true)
    try {
      showToast('开始扫描媒体库...', 'info')
      
      const result = await scanLibrary()
      
      if (result) {
        // 刷新媒体库缓存
        try {
          await videoLibraryService.refreshCache()
          console.log('[VideoLibrary] 媒体库缓存已刷新')
        } catch (error) {
          console.warn('[VideoLibrary] 刷新缓存失败:', error)
        }
        
        // 延迟2秒后显示扫描结果
        setTimeout(() => {
          showToast(`媒体库刷新完成！${result.folder_count} 个目录，${result.total_files} 个视频文件`, 'success')
        }, 2000)
      }
    } catch (error) {
      showToast(`刷新媒体库失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
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

  // 监听下载完成事件，延迟刷新媒体库
  useEffect(() => {
    if (!connected) return

    const handleDownloadComplete = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        
        // 监听任务完成事件
        if (data.type === 'task_completed' || data.type === 'task.state' && data.state === 'completed') {
          console.log('检测到下载完成，5秒后刷新媒体库')
          
          // 延迟5秒后刷新媒体库
          const timer = setTimeout(() => {
            console.log('刷新媒体库')
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
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-warning-700)', background: 'var(--color-warning-50)', borderRadius: '8px', fontSize: '14px' }}>
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

              { value: 'premiered', label: '按上传时间' },

              { value: 'size', label: '按大小' },

              { value: 'name', label: '按命名首字母' },

              { value: 'author', label: '按作者' },

              { value: 'duration', label: '按时长' },

              { value: 'views', label: '按播放量' },

              { value: 'likes', label: '按点赞量' }

            ]}

            seriesCount={tasks.length}

            videoCount={totalFiles}

            totalSize={totalSize}

            onRefresh={handleRefreshLibrary}

            isRefreshing={isRefreshing}

            isUpdatingNfo={isUpdatingNfo}

            nfoUpdateProgress={nfoUpdateProgress}

            formatFileSize={formatFileSize}

          />

        )}

  

        {/* 空状态 */}

        {!hasTasks && (

          <div className="empty-state">

            <EmptyIcon size={48} color="var(--color-text-secondary)" />

            <p>暂无媒体文件</p>

            <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>

              点击刷新按钮扫描本地媒体库

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

                <EmptyIcon size={48} color="var(--color-text-secondary)" />

                <p>未找到匹配的媒体</p>

                <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>

                  请尝试其他关键词或清除搜索条件

                </p>

              </div>

            )}

          </div>

        )}
    </div>
  )
}
