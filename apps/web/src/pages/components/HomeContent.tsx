import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useNewQueueStore } from '../../stores/newQueue'
import { useSettingsStore } from '../../stores/settings'
import { useHistoryStore } from '../../stores/history'
import { videoLibraryService } from '../../services/videoLibraryService'
import { Loader2, Eye, Check, Download, MessageSquare, MessageCircle, ThumbsUp, Coins, Star, Share2 } from 'lucide-react'
import { getAvatarProxyUrl } from '../../config/api'
import HistoryList from './HistoryList'
import { buildDetailTaskPayload, normalizeOpusMediaId } from '../videoDetailMedia'
import { enqueueVideoDownload } from '../../hooks/useVideoDownload'
import { useToast } from '../../components/Toast'

interface VideoInfo {
  bvid: string
  aid: number
  title: string
  desc: string
  pic: string
  duration: number
  cid?: number
  owner: {
    mid: number
    name: string
    face: string
  }
  stat: {
    view: number
    danmaku: number
    reply: number
    like: number
    coin: number
    favorite: number
    share: number
  }
}

interface VideoPage {
  page: number
  cid: number
  part: string
  duration: number
}

interface DownloadOptions {
  multi_part: boolean
  pages?: VideoPage[]
}

interface ParseResponse {
  success: boolean
  data?: {
    video: VideoInfo
    download_options: DownloadOptions
  }
  message?: string
}

export default function HomeContent() {
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [parseData, setParseData] = useState<ParseResponse | null>(null)
  const navigate = useNavigate()
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const newQueueStore = useNewQueueStore()
  const settingsStore = useSettingsStore()
  const { settings } = settingsStore
  const addToHistory = useHistoryStore((state) => state.addToHistory)
  const { showToast } = useToast()

  const handleParseUrl = async () => {
    if (!urlInput.trim()) return

    setLoading(true)
    setParseData(null)
    setSelectedPages(new Set())

    try {
      const response = await apiService.parseDownloadUrl(urlInput.trim())
      if (response.success && response.data?.video) {
        setParseData(response)
        setUrlInput('')
        // 默认选中所有页面
        if (response.data.download_options.multi_part && response.data.download_options.pages) {
          setSelectedPages(new Set(response.data.download_options.pages.map((p: any) => p.page)))
        }

        // 添加到历史记录
        const video = response.data.video
        const parsedId = (response.data as any)?.parsed_id
        
        if (parsedId && video) {
          try {
            addToHistory({
              id: parsedId.id,
              type: parsedId.type === 'opus' ? 'opus' : 'video',
              title: video.title,
              cover: video.pic,
              duration: video.duration || 0,
              uploader: video.owner.name,
              uploader_mid: video.owner.mid,
              timestamp: Date.now()
            })
          } catch (historyError) {
            console.error('添加历史记录失败:', historyError)
            // 不影响主流程，只记录错误
          }
        }
      } else {
        showToast(response.message || '解析失败，请检查链接是否正确', 'error')
      }
    } catch (err) {
      console.error('解析请求失败:', err)
      showToast('网络请求失败，请稍后重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleParseUrl()
    }
  }

  const togglePageSelection = (pageNum: number) => {
    const newSelected = new Set(selectedPages)
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum)
    } else {
      newSelected.add(pageNum)
    }
    setSelectedPages(newSelected)
  }

  const selectAllPages = () => {
    if (parseData?.data?.download_options.pages) {
      setSelectedPages(new Set(parseData.data.download_options.pages.map(p => p.page)))
    }
  }

  const deselectAllPages = () => {
    setSelectedPages(new Set())
  }

  const handleDownload = async () => {
    if (!parseData?.data?.video) return

    setDownloading(true)

    try {
      const video = parseData.data.video

      // 从设置中获取默认质量
      const defaultQuality = settings?.download?.video?.default_quality || 64

      let addedCount = 0
      let skippedCount = 0
      let librarySkippedCount = 0

      if (!isOpus) {
        const result = await enqueueVideoDownload({
          video: {
            bvid: video.bvid,
            title: video.title,
            pic: video.pic,
            cover: video.pic,
            cid: video.cid,
            aid: video.aid,
            durationSeconds: video.duration,
            owner: video.owner,
          },
          detail: {
            aid: video.aid,
            cid: video.cid,
            duration: video.duration,
            pages: downloadOptions?.pages || [],
            owner: video.owner,
          },
          selectedPages: isMultiPart ? selectedPages : undefined,
          currentTasks: newQueueStore.tasks,
          downloadPath: settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads',
          metadataOptions: {
            quality: defaultQuality,
            output_format: 'mp4',
            enable_subtitle: settings?.download?.metadata?.enable_subtitle ?? true,
            enable_nfo: settings?.download?.metadata?.enable_nfo ?? true,
            enable_cover: settings?.download?.metadata?.enable_cover ?? true,
            enable_avatar: settings?.download?.metadata?.enable_avatar ?? false,
          },
        })

        setParseData(null)
        setSelectedPages(new Set())
        await newQueueStore.fetchTasks()
        await newQueueStore.fetchSchedulers()

        if (result.addedCount === 0) {
          showToast(result.skippedCount > 0 ? '所选视频已在下载列表中' : '没有可添加的视频', 'warning')
        } else {
          const skippedMessage = result.skippedCount > 0 ? `，跳过 ${result.skippedCount} 个已在列表中的视频` : ''
          showToast(`已成功添加 ${result.addedCount} 个视频到下载队列${skippedMessage}`, 'success')
        }
        return
      }

      // 多P视频：为每个选中的分P创建下载任务
      if (isMultiPart && downloadOptions.pages) {
        for (const pageNum of selectedPages) {
          const page = downloadOptions.pages.find((p: any) => p.page === pageNum)
          if (!page) continue

          // 检查是否已经有相同的cid在下载列表中
          const existingTask = Object.values(newQueueStore.tasks).find(
            t => t.media_id === video.bvid && 
            t.meta?.cid === page.cid && 
            !['completed', 'cancelled'].includes(t.state)
          )
          if (existingTask) {
            skippedCount++
            continue
          }

          // 检查视频是否已在视频库中
          try {
            const isDownloaded = await videoLibraryService.isVideoDownloaded(video.bvid, page.cid)
            if (isDownloaded) {
              librarySkippedCount++
              continue
            }
          } catch (error) {
            console.warn('[HomeContent] 视频库检查失败:', error)
          }

          const taskData = {
            title: video.title,
            media_type: 'video',
            media_id: video.bvid,
            cover: video.pic,
            desc: `CID: ${page.cid}`,
            meta: {
              cid: page.cid,
              page: page.page,
              part_title: page.part,
              quality: defaultQuality,
              output_format: 'mp4',
              enable_subtitle: settings?.download?.metadata?.enable_subtitle ?? true,
              enable_nfo: settings?.download?.metadata?.enable_nfo ?? true,
              enable_cover: settings?.download?.metadata?.enable_cover ?? true,
              enable_avatar: settings?.download?.metadata?.enable_avatar ?? false
            }
          }

          const response = await apiService.submitTask(taskData)

          if (!response.success) {
            showToast(`添加下载失败: ${response.message}`, 'error')
            return
          }

          addedCount++
        }
      } else {
        // 单个视频或图文：直接添加
        const cid = video.cid || (downloadOptions?.pages && downloadOptions.pages[0]?.cid) || 0
        const opusMediaId = normalizeOpusMediaId((parseData?.data as any)?.parsed_id?.id || String(video.aid || ''))
        const taskMediaId = isOpus ? opusMediaId : video.bvid
        
        // 检查是否已经在下载列表中
        const existingTask = Object.values(newQueueStore.tasks).find(
          t => t.media_id === taskMediaId && 
          t.meta?.cid === cid && 
          !['completed', 'cancelled'].includes(t.state)
        )
        if (existingTask) {
          showToast(isOpus ? '该图文已在下载列表中' : '该视频已在下载列表中', 'warning')
          setDownloading(false)
          return
        }

        if (!isOpus) {
          // 检查视频是否已在视频库中
          try {
            const isDownloaded = await videoLibraryService.isVideoDownloaded(video.bvid, cid)
            if (isDownloaded) {
              showToast('该视频已在视频库中', 'warning')
              setDownloading(false)
              return
            }
          } catch (error) {
            console.warn('[HomeContent] 视频库检查失败:', error)
          }
        }

        const taskData = isOpus
          ? buildDetailTaskPayload({
              type: 'opus',
              mediaId: opusMediaId,
              title: video.title,
              cover: video.pic
            })
          : {
              title: video.title,
              media_type: 'video',
              media_id: video.bvid,
              cover: video.pic,
              desc: `CID: ${cid}`,
              meta: {
                cid: cid,
                quality: defaultQuality,
                output_format: 'mp4',
                enable_subtitle: settings?.download?.metadata?.enable_subtitle ?? true,
                enable_nfo: settings?.download?.metadata?.enable_nfo ?? true,
                enable_cover: settings?.download?.metadata?.enable_cover ?? true,
                enable_avatar: settings?.download?.metadata?.enable_avatar ?? false
              }
            }

        const response = await apiService.submitTask(taskData)

        if (!response.success) {
          showToast(`添加下载失败: ${response.message}`, 'error')
          setDownloading(false)
          return
        }

        addedCount++
      }

      // 清空解析数据
      setParseData(null)
      setSelectedPages(new Set())
      
      // 刷新下载列表
      await newQueueStore.fetchTasks()
      await newQueueStore.fetchSchedulers()
      
      const skippedTotal = skippedCount + librarySkippedCount
      if (skippedTotal > 0) {
        let message = `已添加 ${addedCount} 个视频到下载队列，跳过 ${skippedTotal} 个已存在的视频`
        if (librarySkippedCount > 0) {
          message += `（其中 ${librarySkippedCount} 个已在视频库中）`
        }
        showToast(message, 'success')
      } else {
        showToast(`已成功添加 ${addedCount} 个视频到下载队列`, 'success')
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || '添加下载失败，请稍后重试'
      showToast(errorMessage, 'error')
    } finally {
      setDownloading(false)
    }
  }

const formatDuration = (seconds: any) => {
    if (!seconds || seconds === undefined || seconds === null) return ''
    const s = typeof seconds === 'object' ? seconds.duration || seconds.value || 0 : Number(seconds)
    if (isNaN(s) || s <= 0) return ''
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatNumber = (num: any) => {
    if (num === undefined || num === null) return '0'
    const n = typeof num === 'object' ? num.count || num.value || 0 : Number(num)
    if (isNaN(n)) return '0'
    if (n >= 10000) {
      return `${(n / 10000).toFixed(1)}万`
    }
    return n.toString()
  }

  const getProxyImageUrl = (url: string): string => {
    if (!url) return ''
    return getAvatarProxyUrl(url)
  }

  const videoInfo = parseData?.data?.video
  const downloadOptions = parseData?.data?.download_options
  const parsedType = (parseData?.data as any)?.parsed_id?.type
  const isOpus = parsedType === 'opus'
  const isMultiPart = downloadOptions?.multi_part && downloadOptions.pages && downloadOptions.pages.length > 1

  return (
    <section
      id="home-panel"
      role="tabpanel"
      aria-labelledby="home-tab"
      className="content-section"
    >
      <div className="home-input-section">
        <div className="url-input-container">
          <label htmlFor="url-input" className="visually-hidden">
            视频链接
          </label>
          <input
            id="url-input"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="粘贴B站视频链接，如：https://www.bilibili.com/video/BV..."
            className="url-input"
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            className="add-url-btn"
            onClick={handleParseUrl}
            disabled={!urlInput.trim() || loading}
            aria-label="解析链接"
          >
            {loading ? (
              <Loader2 className="loading-spinner" />
            ) : (
              <Download />
            )}
            <span className="btn-text">{loading ? '解析中...' : '解析'}</span>
          </button>
        </div>
      </div>

      {/* 历史记录区域 */}
      <HistoryList />

      {videoInfo && (
        <div
          className="video-info-card"
          onClick={() => {
            if (isOpus) {
              // 图文跳转到应用内图文详情页
              const opusId = (parseData?.data as any)?.parsed_id?.id?.replace('cv', '') || videoInfo.aid
              navigate(`/opus/${opusId}`)
            } else if (videoInfo.bvid) {
              navigate(`/video/${videoInfo.bvid}`)
            }
          }}
          style={{
            flexDirection: 'row',
            gap: '0'
          }}
        >
          {/* 封面区域 */}
          <div className="video-cover" style={{
            position: 'relative',
            width: '320px',
            flexShrink: 0,
            height: '180px',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}>
            {videoInfo.pic && (
              <img
                src={getProxyImageUrl(videoInfo.pic)}
                alt={videoInfo.title}
                className="video-cover-image"
                style={{
                  width: '100%',
                  height: '180px',
                  objectFit: 'cover'
                }}
              />
            )}
            {isOpus ? (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-white)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                图文
              </div>
            ) : (
              <div className="video-duration">{formatDuration(videoInfo.duration)}</div>
            )}
          </div>

          {/* 详情区域 */}
          <div className="video-details" style={{
            flex: '1',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '0',
            backgroundColor: 'var(--color-bg-primary)'
          }}>
            <h3 className="video-title" style={{
              fontSize: '15px',
              fontWeight: '600',
              lineHeight: '1.4',
              margin: '0',
              color: 'var(--color-text-primary)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>{videoInfo.title}</h3>
            
            {/* UP主信息 */}
            <div className="video-uploader" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {videoInfo.owner.face && (
                <img
                  src={getProxyImageUrl(videoInfo.owner.face)}
                  alt={videoInfo.owner.name}
                  className="uploader-avatar"
                  style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-bg-tertiary)'
                  }}
                />
              )}
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-text-primary)'
              }}>{videoInfo.owner.name}</span>
            </div>

            {/* 统计信息 */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)'
            }}>
              {isOpus ? (
                <>
                  {videoInfo.stat.like !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="点赞数">
                      <ThumbsUp size={11} />
                      {formatNumber(videoInfo.stat.like)}
                    </span>
                  )}
                  {videoInfo.stat.favorite !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="收藏数">
                      <Star size={11} />
                      {formatNumber(videoInfo.stat.favorite)}
                    </span>
                  )}
                  {videoInfo.stat.reply !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="评论数">
                      <MessageCircle size={11} />
                      {formatNumber(videoInfo.stat.reply)}
                    </span>
                  )}
                  {videoInfo.stat.share !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="转发数">
                      <Share2 size={11} />
                      {formatNumber(videoInfo.stat.share)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="播放量">
                    <Eye size={11} />
                    {formatNumber(videoInfo.stat.view)}
                  </span>
                  {videoInfo.stat.danmaku !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="弹幕数">
                      <MessageSquare size={11} />
                      {formatNumber(videoInfo.stat.danmaku)}
                    </span>
                  )}
                  {videoInfo.stat.like !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="点赞数">
                      <ThumbsUp size={11} />
                      {formatNumber(videoInfo.stat.like)}
                    </span>
                  )}
                  {videoInfo.stat.coin !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="投币数">
                      <Coins size={11} />
                      {formatNumber(videoInfo.stat.coin)}
                    </span>
                  )}
                  {videoInfo.stat.favorite !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="收藏数">
                      <Star size={11} />
                      {formatNumber(videoInfo.stat.favorite)}
                    </span>
                  )}
                  {videoInfo.stat.reply !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="评论数">
                      <MessageCircle size={11} />
                      {formatNumber(videoInfo.stat.reply)}
                    </span>
                  )}
                  {videoInfo.stat.share !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="转发数">
                      <Share2 size={11} />
                      {formatNumber(videoInfo.stat.share)}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* 视频简介 - 仅视频显示 */}
            {!isOpus && videoInfo.desc && (
              <p style={{
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                lineHeight: '1.5',
                margin: '0',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                backgroundColor: 'var(--color-bg-secondary)',
                padding: '12px',
                borderRadius: '8px'
              }}>{videoInfo.desc}</p>
            )}

            {/* 分P选择区域 */}
            {isMultiPart && downloadOptions.pages && (
              <div style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                padding: '10px',
                maxHeight: '150px',
                overflowY: 'auto'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <h4 style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    margin: '0',
                    color: 'var(--color-text-primary)'
                  }}>视频章节 ({downloadOptions.pages.length})</h4>
                  <div style={{
                    display: 'flex',
                    gap: '6px'
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); selectAllPages(); }}
                      disabled={selectedPages.size === downloadOptions.pages.length}
                      style={{ 
                        fontSize: '11px', 
                        padding: '3px 6px',
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        cursor: selectedPages.size === downloadOptions.pages.length ? 'not-allowed' : 'pointer',
                        opacity: selectedPages.size === downloadOptions.pages.length ? 0.5 : 1
                      }}
                    >
                      全选
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deselectAllPages(); }}
                      disabled={selectedPages.size === 0}
                      style={{ 
                        fontSize: '11px', 
                        padding: '3px 6px',
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                        cursor: selectedPages.size === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedPages.size === 0 ? 0.5 : 1
                      }}
                    >
                      全不选
                    </button>
                  </div>
                </div>
                <div role="list" aria-label="视频章节列表">
                  {downloadOptions.pages.map((page) => (
                    <div
                      key={page.page}
                      role="listitem"
                      onClick={(e) => { e.stopPropagation(); togglePageSelection(page.page); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px',
                        backgroundColor: selectedPages.has(page.page) ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        cursor: 'pointer',
                        border: selectedPages.has(page.page) ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        backgroundColor: selectedPages.has(page.page) ? 'var(--color-primary)' : 'var(--color-border)',
                        borderRadius: '2px'
                      }}>
                        <Check 
                          fill={selectedPages.has(page.page) ? "white" : "none"} 
                          size={12} 
                          color={selectedPages.has(page.page) ? "white" : "var(--color-text-tertiary)"}
                        />
                      </div>
                      <div style={{ flex: '1', minWidth: '0' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--color-text-tertiary)',
                          marginBottom: '2px'
                        }}>第 {page.page} 话</div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '2px'
                        }}>{page.part}</div>
                        <div style={{ 
                          fontSize: '10px', 
                          color: 'var(--color-text-tertiary)'
                        }}>{formatDuration(page.duration)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{
              marginTop: 'auto',
              paddingTop: '8px'
            }}>
              <button
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: downloading || (isMultiPart && selectedPages.size === 0) ? 'var(--color-text-disabled)' : 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: downloading || (isMultiPart && selectedPages.size === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                disabled={downloading || (isMultiPart && selectedPages.size === 0)}
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              >
                {downloading ? (
                  <Loader2 style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Download size={14} />
                )}
                <span>
                  {downloading ? '添加中...' : (isMultiPart ? `添加到列表 (${selectedPages.size})` : '添加到列表')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
