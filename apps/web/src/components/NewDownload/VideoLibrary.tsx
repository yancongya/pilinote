// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore, Task } from '../../stores/newQueue'
import { useSettingsStore } from '../../stores/settings'
import { useToast } from '../../components/Toast'
import { videoLibraryService } from '../../services/videoLibraryService'
import { apiService } from '../../services/api'
import { Inbox as EmptyIcon, RefreshCw, Calendar, Film, Eye, ThumbsUp, Coins, Star, Hash, Share2, MessageSquare, MessageCircle, FileText, FolderTree, List, LayoutGrid, LayoutList } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
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
  onLayoutChanged: () => Promise<void>
}

const formatSeriesEpisodeSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const buildSubtitleFilename = (videoPath: string): string => {
  const lastSlash = videoPath.lastIndexOf('/')
  const fileName = lastSlash >= 0 ? videoPath.slice(lastSlash + 1) : videoPath
  const stem = fileName.replace(/\.[^.]+$/, '')
  return `${stem}.srt`
}

const getDisplayFileName = (file: SizeSegmentFile): string => {
  const source = file.name || file.path || ''
  const normalized = source.replace(/\\/g, '/')
  const lastSegment = normalized.split('/').pop()
  return lastSegment || source
}

type SizeSegmentFile = {
  name: string
  path?: string
  size: number
}

type SizeSegment = {
  key: string
  label: string
  value: number
  ratio: number
  files: SizeSegmentFile[]
}

type SizeTooltipState = {
  segment: SizeSegment
  left: number
  ownerKey: string
  width: number
} | null

function TooltipFileName({ name }: { name: string }) {
  const outerRef = useRef<HTMLSpanElement | null>(null)
  const innerRef = useRef<HTMLSpanElement | null>(null)
  const [overflowOffset, setOverflowOffset] = useState(0)

  useEffect(() => {
    const measure = () => {
      const outer = outerRef.current
      const inner = innerRef.current
      if (!outer || !inner) return
      const offset = Math.max(inner.scrollWidth - outer.clientWidth, 0)
      setOverflowOffset(offset)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [name])

  return (
    <span
      ref={outerRef}
      className={`library-folder-size-tooltip-file-name${overflowOffset > 0 ? ' is-overflowing' : ''}`}
      title={name}
      style={{ ['--tooltip-name-overflow' as string]: `${overflowOffset}px` }}
    >
      <span ref={innerRef} className="library-folder-size-tooltip-file-name-inner">
        {name}
      </span>
    </span>
  )
}

const buildSizeSegments = (task: Task): SizeSegment[] => {
  const total = Math.max(task.meta?.total_size || 0, 0)
  const primary = Math.max(task.meta?.primary_size || 0, 0)
  const metadataBreakdown = (task.meta?.metadata_breakdown || {}) as Record<string, number>
  const metadataFilesByType = (task.meta?.metadata_files_by_type || {}) as Record<string, SizeSegmentFile[]>
  const audio = Math.max(metadataBreakdown.audio || 0, 0)
  const image = Math.max(metadataBreakdown.image || 0, 0)
  const subtitle = Math.max(metadataBreakdown.subtitle || 0, 0)
  const note = Math.max(metadataBreakdown.note || 0, 0)
  const nfo = Math.max(metadataBreakdown.nfo || 0, 0)
  const metadataOther = Math.max(metadataBreakdown.other || 0, 0)

  if (total <= 0) return []

  const primarySourceFiles = (task.media_type === 'opus'
    ? (task.meta?.content_files || [])
    : (task.meta?.files || [])) as MediaLibraryFile[]

  const primaryFiles = primarySourceFiles.map((file) => ({
    name: file.title || file.path.split('/').pop() || file.path,
    path: file.path,
    size: file.size
  }))

  const segments = [
    { key: 'primary', label: task.meta?.primary_size_label || '主文件', value: primary, ratio: primary / total, files: primaryFiles },
    { key: 'audio', label: '音频', value: audio, ratio: audio / total, files: metadataFilesByType.audio || [] },
    { key: 'image', label: '图片', value: image, ratio: image / total, files: metadataFilesByType.image || [] },
    { key: 'subtitle', label: '字幕', value: subtitle, ratio: subtitle / total, files: metadataFilesByType.subtitle || [] },
    { key: 'note', label: '笔记', value: note, ratio: note / total, files: metadataFilesByType.note || [] },
    { key: 'nfo', label: 'NFO', value: nfo, ratio: nfo / total, files: metadataFilesByType.nfo || [] },
    { key: 'other', label: '其他', value: metadataOther, ratio: metadataOther / total, files: metadataFilesByType.other || [] }
  ].filter(segment => segment.value > 0)

  const covered = segments.reduce((sum, segment) => sum + segment.value, 0)
  const remainder = Math.max(total - covered, 0)
  if (remainder > 0) {
    segments.push({ key: 'other', label: '其他', value: remainder, ratio: remainder / total, files: [] })
  }

  return segments
}

const buildFileSizeSegments = (file: MediaLibraryFile): SizeSegment[] => {
  const primary = Math.max(file.size || 0, 0)
  const metadataBreakdown = (file.metadata_breakdown || {}) as Record<string, number>
  const metadataFilesByType = (file.metadata_files_by_type || {}) as Record<string, SizeSegmentFile[]>
  const total = primary + Object.values(metadataBreakdown).reduce((sum, value) => sum + Math.max(value || 0, 0), 0)

  if (total <= 0) return []

  const primaryFiles = [{
    name: file.title || file.path.split('/').pop() || file.path,
    path: file.path,
    size: file.size
  }]

  return [
    { key: 'primary', label: '视频', value: primary, ratio: primary / total, files: primaryFiles },
    { key: 'audio', label: '音频', value: Math.max(metadataBreakdown.audio || 0, 0), ratio: Math.max(metadataBreakdown.audio || 0, 0) / total, files: metadataFilesByType.audio || [] },
    { key: 'image', label: '图片', value: Math.max(metadataBreakdown.image || 0, 0), ratio: Math.max(metadataBreakdown.image || 0, 0) / total, files: metadataFilesByType.image || [] },
    { key: 'subtitle', label: '字幕', value: Math.max(metadataBreakdown.subtitle || 0, 0), ratio: Math.max(metadataBreakdown.subtitle || 0, 0) / total, files: metadataFilesByType.subtitle || [] },
    { key: 'note', label: '笔记', value: Math.max(metadataBreakdown.note || 0, 0), ratio: Math.max(metadataBreakdown.note || 0, 0) / total, files: metadataFilesByType.note || [] },
    { key: 'nfo', label: 'NFO', value: Math.max(metadataBreakdown.nfo || 0, 0), ratio: Math.max(metadataBreakdown.nfo || 0, 0) / total, files: metadataFilesByType.nfo || [] },
    { key: 'other', label: '其他', value: Math.max(metadataBreakdown.other || 0, 0), ratio: Math.max(metadataBreakdown.other || 0, 0) / total, files: metadataFilesByType.other || [] },
  ].filter(segment => segment.value > 0)
}

// LibraryCard组件 - 显示文件夹卡片
function LibraryCard({ task, isExpanded, onToggle, getLocalImageUrl, formatFileSize, onLayoutChanged }: LibraryCardProps) {
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
  const cvId = task.meta?.nfo_data?.cv_id || task.meta?.nfo_data?.id
  // 支持视频和笔记类型统一使用ID进行AI分析
  const videoIdForNote = isOpus ? (cvId || folderPath) : (bvid || folderPath)
  const seriesLayoutMode = useMemo(() => {
    if (isOpus || !folderPath || !task.meta?.files?.length) return 'unknown'
    const files = task.meta.files as MediaLibraryFile[]
    const flatCount = files.filter(file => {
      const normalized = file.path.replace(/\\/g, '/')
      const parent = normalized.slice(0, normalized.lastIndexOf('/'))
      return parent === folderPath.replace(/\\/g, '/')
    }).length
    if (flatCount === files.length) return 'flat'
    if (flatCount === 0) return 'folder'
    return 'mixed'
  }, [folderPath, isOpus, task.meta?.files])
  const canSwitchSeriesLayout = !isOpus && hasMultipleVideos && Boolean(folderPath)
  const [switchingLayout, setSwitchingLayout] = useState(false)
  const seriesEpisodes = useMemo(() => {
    if (isOpus || !task.meta?.files || task.meta.files.length === 0) {
      return undefined
    }

    return task.meta.files.map((file: MediaLibraryFile, index: number) => ({
      id: file.path,
      title: file.title || `第 ${index + 1} 集`,
      available: Boolean(file.path),
      subtitle: `${formatSeriesEpisodeSize(file.size)} · ${file.modified_date}`,
      subtitleFilename: buildSubtitleFilename(file.path),
      order: index,
    }))
  }, [isOpus, task.meta?.files])
  const sizeSegments = useMemo(() => buildSizeSegments(task), [task])
  const [sizeTooltip, setSizeTooltip] = useState<SizeTooltipState>(null)

  const renderSizeTooltip = (segment: SizeSegment) => {
    const tooltipFiles = segment.key === 'other'
      ? [{ name: task.title, size: segment.value }]
      : segment.files
    const previewFiles = tooltipFiles.slice(0, 6)
    return (
      <div className="library-folder-size-tooltip" role="tooltip">
        <div className="library-folder-size-tooltip-title">
          <span>{segment.label}</span>
          <strong>{formatFileSize(segment.value)}</strong>
        </div>
        {previewFiles.length > 0 ? (
          <div className="library-folder-size-tooltip-files">
            {previewFiles.map((file, index) => (
              <div key={`${segment.key}-${file.path || file.name}-${index}`} className="library-folder-size-tooltip-file">
                <TooltipFileName name={getDisplayFileName(file)} />
                <span className="library-folder-size-tooltip-file-size">{formatFileSize(file.size)}</span>
              </div>
            ))}
            {tooltipFiles.length > previewFiles.length && (
              <div className="library-folder-size-tooltip-more">
                还有 {tooltipFiles.length - previewFiles.length} 个文件
              </div>
            )}
          </div>
        ) : (
          <div className="library-folder-size-tooltip-empty">没有可展示的文件清单</div>
        )}
      </div>
    )
  }

  const handleSizeSegmentEnter = (event: MouseEvent<HTMLSpanElement>, segment: SizeSegment, ownerKey: string) => {
    const segmentRect = event.currentTarget.getBoundingClientRect()
    const barRect = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!barRect) return

    const tooltipWidth = Math.min(260, Math.max(180, barRect.width * 0.42))
    const desiredLeft = segmentRect.left - barRect.left + segmentRect.width / 2
    const clampedLeft = Math.min(Math.max(desiredLeft, tooltipWidth / 2 + 8), barRect.width - tooltipWidth / 2 - 8)

    setSizeTooltip({
      segment,
      left: clampedLeft,
      ownerKey,
      width: tooltipWidth
    })
  }

  // 对可识别的B站视频或笔记提供AI笔记功能
  const canUseAiNote = Boolean(videoIdForNote)
  const lookup = useAiNoteLookup(canUseAiNote ? videoIdForNote : null)
  const noteForStatus = existingNote || lookup.note
  const persistentAiNoteStatus = task.meta?.ai_note_status === 'completed'
  const aiNoteButtonStatus =
    noteForStatus?.status === 'completed' || persistentAiNoteStatus
      ? 'completed'
      : 'none'

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

  const handleSwitchSeriesLayout = async (event: MouseEvent, targetMode: 'flat' | 'folder') => {
    event.stopPropagation()
    if (!folderPath || switchingLayout) return
    if (seriesLayoutMode === targetMode) return

    setSwitchingLayout(true)
    try {
      const planResponse = await apiService.switchSeriesLayout({
        folder_path: folderPath,
        target_mode: targetMode,
        dry_run: true
      })
      const plan = planResponse.data
      if (!planResponse.success || !plan) {
        throw new Error(planResponse.message || '生成整理计划失败')
      }
      if (plan.move_count === 0) {
        showToast('当前目录已经是目标整理模式', 'info')
        return
      }
      if (plan.conflicts?.length) {
        throw new Error(`目标路径存在冲突，未执行移动：${plan.conflicts.length} 个文件`)
      }

      const targetLabel = targetMode === 'flat' ? '根目录平铺' : '分P子目录'
      const confirmed = window.confirm(`将「${task.title}」切换为「${targetLabel}」模式，并真实移动 ${plan.move_count} 个文件。是否继续？`)
      if (!confirmed) return

      const applyResponse = await apiService.switchSeriesLayout({
        folder_path: folderPath,
        target_mode: targetMode,
        dry_run: false
      })
      if (!applyResponse.success) {
        throw new Error(applyResponse.message || '切换目录模式失败')
      }

      showToast(applyResponse.message || `已切换为${targetLabel}模式`, 'success')
      await onLayoutChanged()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '切换目录模式失败', 'error')
    } finally {
      setSwitchingLayout(false)
    }
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
            {task.meta?.rating && (
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

            {/* AI 笔记按钮 - 支持视频和笔记类型 */}
            {canUseAiNote && (
            <AiNoteButton
                status={aiNoteButtonStatus}
                onClick={handleAiNoteClick}
                disabled={!isOpus && !isLocalAsrReady}
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
              <div className="library-folder-studio" title={task.meta.studio}>
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
            
            <div className="library-folder-author-actions" onClick={(event) => event.stopPropagation()}>
              <div className="library-folder-size">
                <span>{formatFileSize(task.meta.total_size)}</span>
              </div>
              {canSwitchSeriesLayout && (
                <div className="library-folder-layout-switch" aria-label="系列目录模式">
                  <button
                    type="button"
                    className={`library-layout-mode-btn ${seriesLayoutMode === 'flat' ? 'active' : ''}`}
                    onClick={(event) => handleSwitchSeriesLayout(event, 'flat')}
                    disabled={switchingLayout || seriesLayoutMode === 'flat'}
                    title="根目录平铺模式"
                    aria-label="根目录平铺模式"
                  >
                    <List size={14} />
                  </button>
                  <button
                    type="button"
                    className={`library-layout-mode-btn ${seriesLayoutMode === 'folder' ? 'active' : ''}`}
                    onClick={(event) => handleSwitchSeriesLayout(event, 'folder')}
                    disabled={switchingLayout || seriesLayoutMode === 'folder'}
                    title="分P子目录模式"
                    aria-label="分P子目录模式"
                  >
                    <FolderTree size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="library-folder-size-row">
        <div className="library-folder-size-stack">
              {sizeSegments.length > 0 && (
                <div className="library-folder-size-bar" aria-hidden="true">
                  {sizeSegments.map(segment => (
                    <span
                      key={`${segment.key}-${segment.value}`}
                      className={`library-folder-size-bar-segment library-folder-size-bar-segment--${segment.key}`}
                      style={{ width: `${Math.max(segment.ratio * 100, 4)}%` }}
                      aria-label={`${segment.label}: ${formatFileSize(segment.value)}`}
                      onMouseEnter={(event) => handleSizeSegmentEnter(event, segment, `folder-${task.id}`)}
                      onMouseLeave={() => setSizeTooltip(null)}
                    >
                    </span>
                  ))}
                  {sizeTooltip?.ownerKey === `folder-${task.id}` && (
                    <div
                      className="library-folder-size-tooltip-anchor"
                      style={{ left: `${sizeTooltip.left}px`, ['--library-tooltip-width' as string]: `${sizeTooltip.width}px` }}
                      onMouseEnter={() => setSizeTooltip(sizeTooltip)}
                      onMouseLeave={() => setSizeTooltip(null)}
                    >
                      {renderSizeTooltip(sizeTooltip.segment)}
                    </div>
                  )}
                </div>
              )}
        </div>
      </div>

      {/* 展开的视频列表（仅多视频文件夹） */}
      {hasMultipleVideos && isExpanded && task.meta?.files && (
        <div className="library-folder-videos">
          {task.meta.files.map((file: MediaLibraryFile, index: number) => (
            <div key={`${file.path}-${index}`} className="library-folder-video-item">
              <div className="library-video-cover">
                {file.cover_path ? (
                  <img src={getLocalImageUrl(file.cover_path)} alt="" loading="lazy" />
                ) : (
                  <Film size={18} />
                )}
              </div>
              <div className="library-video-info">
                <div className="library-video-title">{file.title}</div>
                <div className="library-video-meta">
                  <span>{formatFileSize(file.size)}</span>
                  <span className="stats-divider">·</span>
                  <span>{file.modified_date}</span>
                </div>
                {buildFileSizeSegments(file).length > 0 && (
                  <div className="library-video-size-row">
                    <div className="library-folder-size-bar" aria-hidden="true">
                      {buildFileSizeSegments(file).map(segment => (
                        <span
                          key={`${file.path}-${segment.key}-${segment.value}`}
                          className={`library-folder-size-bar-segment library-folder-size-bar-segment--${segment.key}`}
                          style={{ width: `${Math.max(segment.ratio * 100, 4)}%` }}
                          aria-label={`${segment.label}: ${formatFileSize(segment.value)}`}
                          onMouseEnter={(event) => handleSizeSegmentEnter(event, segment, `file-${file.path}`)}
                          onMouseLeave={() => setSizeTooltip(null)}
                        />
                      ))}
                      {sizeTooltip?.ownerKey === `file-${file.path}` && (
                        <div
                          className="library-folder-size-tooltip-anchor"
                          style={{ left: `${sizeTooltip.left}px`, ['--library-tooltip-width' as string]: `${sizeTooltip.width}px` }}
                          onMouseEnter={() => setSizeTooltip(sizeTooltip)}
                          onMouseLeave={() => setSizeTooltip(null)}
                        >
                          {renderSizeTooltip(sizeTooltip.segment)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canUseAiNote && (
        <AiNoteModal
          videoId={videoIdForNote}
          videoTitle={task.title}
          existingNote={existingNote}
          pipelineModeOverride={isOpus ? 'image_text' : undefined}
          aiRoutePath={isOpus ? `/opus/${encodeURIComponent(String(videoIdForNote))}/ai` : `/video/${encodeURIComponent(String(videoIdForNote))}/ai`}
          seriesEpisodes={seriesEpisodes}
          isOpen={showAiNoteModal}
          onClose={() => setShowAiNoteModal(false)}
          onComplete={handleAiNoteComplete}
        />
      )}
    </div>
  )
}

function AlbumCard({ task, getLocalImageUrl, formatFileSize }: {
  task: Task
  getLocalImageUrl: (path: string) => string
  formatFileSize: (bytes: number) => string
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isOpus = task.media_type === 'opus'
  const hasMultipleVideos = !isOpus && task.meta?.file_count > 1
  const hasCover = task.cover && task.cover.trim()
  const coverUrl = task.cover ? getLocalImageUrl(task.cover) : ''

  const [isLocalAsrReady, setIsLocalAsrReady] = useState(true)
  const [showAiNoteModal, setShowAiNoteModal] = useState(false)
  const [existingNote, setExistingNote] = useState<NoteResponse | null>(null)

  const folderPath = task.meta?.folder_path
  const bvid = task.meta?.nfo_data?.bvid
  const cvId = task.meta?.nfo_data?.cv_id || task.meta?.nfo_data?.id
  const videoIdForNote = isOpus ? (cvId || folderPath) : (bvid || folderPath)
  const canUseAiNote = Boolean(videoIdForNote)
  const lookup = useAiNoteLookup(canUseAiNote ? videoIdForNote : null)
  const noteForStatus = existingNote || lookup.note
  const persistentAiNoteStatus = task.meta?.ai_note_status === 'completed'
  const aiNoteButtonStatus = noteForStatus?.status === 'completed' || persistentAiNoteStatus ? 'completed' : 'none'

  useEffect(() => {
    if (noteForStatus) setExistingNote(noteForStatus)
  }, [noteForStatus])

  useEffect(() => {
    let cancelled = false
    if (isOpus) return
    localAsrModelService.checkReady().then(result => {
      if (!cancelled) setIsLocalAsrReady(result.ready)
    }).catch(() => {
      if (!cancelled) setIsLocalAsrReady(false)
    })
    return () => { cancelled = true }
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

  const handleCardClick = () => {
    const route = getMediaLibraryRoute(task)
    if (route) navigate(route)
  }

  const formatDuration = (duration: string | number): string => {
    if (!duration) return '--:--'
    if (typeof duration === 'string') return duration
    if (typeof duration === 'number') {
      if (duration === 0) return '--:--'
      const hours = Math.floor(duration / 3600)
      const minutes = Math.floor((duration % 3600) / 60)
      const seconds = Math.floor(duration % 60)
      if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    return '--:--'
  }

  const formatDateTime = (): string => {
    if (task.created_at) {
      const d = new Date(task.created_at)
      if (!isNaN(d.getTime())) {
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        return `${ds} ${ts}`
      }
    }
    return task.meta?.premiered || ''
  }

  return (
    <div className="album-card" onClick={handleCardClick}>
      <div className="album-card-cover">
        {hasCover ? (
          <img
            src={coverUrl}
            alt={task.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const placeholder = e.currentTarget.parentElement?.querySelector('.album-cover-placeholder')
              if (placeholder) (placeholder as HTMLElement).style.display = 'flex'
            }}
          />
        ) : null}
        <div className="album-cover-placeholder" style={{ display: hasCover ? 'none' : 'flex' }}>
          {isOpus ? <FileText size={28} /> : <Film size={28} />}
        </div>

        {!isOpus && task.meta?.runtime && (
          <div className="album-card-duration">{formatDuration(task.meta.runtime)}</div>
        )}

        {isOpus && (
          <div className="album-card-duration album-card-duration--opus">图文</div>
        )}

        {task.meta?.rating && (
          <div className="album-card-rating">
            <Star size={10} fill="#f59e0b" color="#f59e0b" />
            <span>{task.meta.rating}</span>
          </div>
        )}

        {hasMultipleVideos && (
          <div className="album-card-multi">
            <Film size={14} />
            <span>{task.meta?.file_count || 0}</span>
          </div>
        )}

        {canUseAiNote && (
          <div style={{ position: 'absolute', left: '8px', top: '8px', zIndex: 30 }} onClick={(e) => e.stopPropagation()}>
            <AiNoteButton
              status={aiNoteButtonStatus}
              onClick={handleAiNoteClick}
              disabled={!isOpus && !isLocalAsrReady}
            />
          </div>
        )}
      </div>

      <div className="album-card-info">
        <div className="album-card-title-wrap">
          <span className="album-card-title">{task.title}</span>
        </div>
        <div className="album-card-meta-row">
          {task.meta?.studio && (
            <div className="album-card-author">
              {task.meta.avatar_path && (
                <img
                  src={getLocalImageUrl(task.meta.avatar_path)}
                  alt={task.meta.studio}
                  className="album-author-avatar"
                />
              )}
              <span>{task.meta.studio}</span>
            </div>
          )}
          {formatDateTime() && (
            <span className="album-card-size">{formatDateTime()}</span>
          )}
        </div>
      </div>

      {canUseAiNote && (
        <AiNoteModal
          videoId={videoIdForNote}
          videoTitle={task.title}
          existingNote={existingNote}
          pipelineModeOverride={isOpus ? 'image_text' : undefined}
          aiRoutePath={isOpus ? `/opus/${encodeURIComponent(String(videoIdForNote))}/ai` : `/video/${encodeURIComponent(String(videoIdForNote))}/ai`}
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
  const [viewMode, setViewMode] = useState<'detailed' | 'album'>('detailed')
  const [grouped, setGrouped] = useState(false)

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
      case 'type':
        sorted.sort((a, b) => {
          const getType = (t: Task): number => {
            if (t.media_type === 'opus') return 1
            if ((t.meta?.file_count || 1) > 1) return 2
            return 0
          }
          const typeA = getType(a)
          const typeB = getType(b)
          return sortDirection === 'desc' ? typeB - typeA : typeA - typeB
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

    const timeGroupGranularity = (() => {
      if (order !== 'premiered' && order !== 'created') return null
      let min: number | null = null
      let max: number | null = null
      for (const t of tasks) {
        const ts = order === 'premiered' ? (t.meta?.premiered ? new Date(t.meta.premiered).getTime() : null) : t.created_at
        if (ts === null || ts === undefined || isNaN(ts)) continue
        if (min === null || ts < min) min = ts
        if (max === null || ts > max) max = ts
      }
      if (min === null || max === null) return 'year'
      const minD = new Date(min), maxD = new Date(max)
      if (minD.getFullYear() !== maxD.getFullYear()) return 'year'
      if (minD.getMonth() !== maxD.getMonth()) return 'month'
      return 'day'
    })()

    const getGroupKey = (task: Task): string => {
      switch (order) {
        case 'type': {
          if (task.media_type === 'opus') return '图文'
          if ((task.meta?.file_count || 1) > 1) return '系列视频'
          return '单个视频'
        }
        case 'premiered': {
          const p = task.meta?.premiered
          if (!p) return '未知日期'
          if (timeGroupGranularity === 'day') return p
          if (timeGroupGranularity === 'month') return p.substring(0, 7)
          return p.substring(0, 4)
        }
        case 'created': {
          if (!task.created_at) return '未知时间'
          const d = new Date(task.created_at)
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          if (timeGroupGranularity === 'day') return `${y}-${m}-${day}`
          if (timeGroupGranularity === 'month') return `${y}-${m}`
          return `${y}`
        }
        case 'name': {
          const name = task.title || ''
          const first = name.trim().charAt(0)
          if (!first) return '#'
          if (/[a-zA-Z]/.test(first)) return first.toUpperCase()
          if (/[\u4e00-\u9fff]/.test(first)) return first
          return '#'
        }
        case 'author':
          return task.meta?.studio || '未知作者'
        default:
          return ''
      }
    }

    const getGroupLabel = (key: string): string => {
      if (timeGroupGranularity === 'year') return `${key}年`
      return key
    }

    const groupedEntries = !grouped ? null : Array.from(
      filteredTasks.reduce((map, task) => {
        const key = getGroupKey(task)
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(task)
        return map
      }, new Map<string, Task[]>())
    )

  

    return (

      <div className="video-library">

        {/* 搜索排序和视图切换 */}

        {hasTasks && (

          <div className="library-controls-row">
            <div className="library-controls-row-main">
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

                  { value: 'likes', label: '按点赞量' },

                  { value: 'type', label: '按类型' }

                ]}

                seriesCount={tasks.length}

                videoCount={totalFiles}

                totalSize={totalSize}

                onRefresh={handleRefreshLibrary}

                isRefreshing={isRefreshing}

                isUpdatingNfo={isUpdatingNfo}

                nfoUpdateProgress={nfoUpdateProgress}

                formatFileSize={formatFileSize}

                showGroupToggle={viewMode === 'album'}
                grouped={grouped}
                onGroupToggle={() => setGrouped(g => !g)}

              />
            </div>

            <button
              className="view-mode-toggle"
              onClick={() => setViewMode(m => m === 'detailed' ? 'album' : 'detailed')}
              title={viewMode === 'detailed' ? '影集模式' : '详细模式'}
              aria-label={viewMode === 'detailed' ? '切换到影集模式' : '切换到详细模式'}
            >
              {viewMode === 'detailed' ? <LayoutGrid size={18} /> : <LayoutList size={18} />}
            </button>
          </div>

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

        {/* 详细模式 - 列表 */}

        {hasTasks && viewMode === 'detailed' && (

          <div className="task-list">

            {filteredTasks.map((task) => (

              <LibraryCard

                key={task.id}

                task={task}

                isExpanded={expandedFolders.has(task.id)}

                onToggle={() => toggleFolder(task.id)}

                getLocalImageUrl={getLocalImageUrl}

                formatFileSize={formatFileSize}

                onLayoutChanged={scanLibrary}

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

        {/* 影集模式 - 网格 */}
        {hasTasks && viewMode === 'album' && (
          <>
            {grouped && groupedEntries ? (
              groupedEntries.map(([key, tasks]) => (
                <div key={key} className="album-group-section">
                  <div className="album-group-header" data-group-count={tasks.length}>
                    <h3>{getGroupLabel(key)}</h3>
                    <span className="album-group-count">{tasks.length}</span>
                  </div>
                  <div className="album-grid">
                    {tasks.map((task) => (
                      <AlbumCard
                        key={task.id}
                        task={task}
                        getLocalImageUrl={getLocalImageUrl}
                        formatFileSize={formatFileSize}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="album-grid">
                {filteredTasks.map((task) => (
                  <AlbumCard
                    key={task.id}
                    task={task}
                    getLocalImageUrl={getLocalImageUrl}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            )}
            {filteredTasks.length === 0 && keyword && (
              <div className="empty-state">
                <EmptyIcon size={48} color="var(--color-text-secondary)" />
                <p>未找到匹配的媒体</p>
                <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                  请尝试其他关键词或清除搜索条件
                </p>
              </div>
            )}
          </>
        )}
    </div>
  )
}
