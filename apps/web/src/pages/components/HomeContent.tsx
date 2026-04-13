import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useDownloadStore } from '../../stores/download'
import { useSettingsStore } from '../../stores/settings'
import { useHistoryStore } from '../../stores/history'
import { Loader2, Eye, Check, Download, MessageSquare, MessageCircle, ThumbsUp, Coins, Star, Share2 } from 'lucide-react'
import { getAvatarProxyUrl } from '../../config/api'
import HistoryList from './HistoryList'

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
  const [error, setError] = useState('')
  const [parseData, setParseData] = useState<ParseResponse | null>(null)
  const navigate = useNavigate()
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const downloadStore = useDownloadStore()
  const settingsStore = useSettingsStore()
  const { settings } = settingsStore
  const authStore = useAuthStore()
  const addToHistory = useHistoryStore((state) => state.addToHistory)

  const handleParseUrl = async () => {
    if (!urlInput.trim()) return

    setLoading(true)
    setError('')
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
        setError(response.message || '解析失败，请检查链接是否正确')
      }
    } catch (err) {
      console.error('解析请求失败:', err)
      setError('网络请求失败，请稍后重试')
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
    setError('')

    try {
      const video = parseData.data.video
      const sessdata = authStore.user?.sessdata

      // 从设置中获取默认质量
      const defaultQuality = settings?.download?.video?.default_quality || 64

      let addedCount = 0
      let skippedCount = 0

      // 多P视频：为每个选中的分P创建下载任务
      if (isMultiPart && downloadOptions.pages) {
        for (const pageNum of selectedPages) {
          const page = downloadOptions.pages.find((p: any) => p.page === pageNum)
          if (!page) continue

          // 检查是否已经有相同的cid在下载列表中
          if (downloadStore.isCidInDownloadList(video.bvid, page.cid)) {
            skippedCount++
            continue
          }

          const downloadData = {
            bvid: video.bvid,
            title: video.title,
            cid: page.cid,
            aid: video.aid,
            quality: defaultQuality,
            output_format: 'mp4',
            thumbnail_url: video.pic,
            duration: page.duration,
            uploader: video.owner.name,
            uploader_mid: video.owner.mid,
            sessdata: sessdata || undefined,
            enable_subtitle: settings?.download?.metadata?.enable_subtitle ?? true,
            enable_nfo: settings?.download?.metadata?.enable_nfo ?? true,
            enable_cover: settings?.download?.metadata?.enable_cover ?? true,
            enable_avatar: settings?.download?.metadata?.enable_avatar ?? false
          }

          const response = await apiService.addToDownloadQueue(downloadData)

          if (!response.success) {
            setError(`添加下载失败: ${response.message}`)
            return
          }

          addedCount++
        }
      } else {
        // 单个视频或图文：直接添加
        const cid = video.cid || (downloadOptions?.pages && downloadOptions.pages[0]?.cid) || 0
        
        // 检查是否已经在下载列表中
        if (downloadStore.isCidInDownloadList(video.bvid, cid)) {
          setError('该视频已在下载列表中')
          setDownloading(false)
          return
        }

        const downloadData = {
          bvid: video.bvid,
          title: video.title,
          cid: cid,
          aid: video.aid,
          quality: defaultQuality,
          output_format: 'mp4',
          thumbnail_url: video.pic,
          duration: video.duration || 0,
          uploader: video.owner.name,
          uploader_mid: video.owner.mid,
          sessdata: sessdata || undefined,
          enable_subtitle: settings?.download?.metadata?.enable_subtitle ?? true,
          enable_nfo: settings?.download?.metadata?.enable_nfo ?? true,
          enable_cover: settings?.download?.metadata?.enable_cover ?? true,
          enable_avatar: settings?.download?.metadata?.enable_avatar ?? false
        }

        const response = await apiService.addToDownloadQueue(downloadData)

        if (!response.success) {
          setError(`添加下载失败: ${response.message}`)
          setDownloading(false)
          return
        }

        addedCount++
      }

      // 清空解析数据
      setParseData(null)
      setSelectedPages(new Set())
      
      // 刷新下载列表
      await downloadStore.syncFromServer()
      
      if (skippedCount > 0) {
        setError(`已添加 ${addedCount} 个视频到下载队列，跳过 ${skippedCount} 个已存在的视频`)
      } else {
        setError(`已成功添加 ${addedCount} 个视频到下载队列`)
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || '添加下载失败，请稍后重试'
      setError(errorMessage)
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
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
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
            height: '180px'
          }}>
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
            {isOpus ? (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                background: '#fb7299',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
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
            minWidth: 0
          }}>
            <h3 className="video-title" style={{
              fontSize: '15px',
              fontWeight: '600',
              lineHeight: '1.4',
              margin: '0',
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
              <img
                src={getProxyImageUrl(videoInfo.owner.face)}
                alt={videoInfo.owner.name}
                className="uploader-avatar"
                style={{ width: '28px', height: '28px', borderRadius: '50%' }}
              />
              <span className="uploader-name" style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#333'
              }}>{videoInfo.owner.name}</span>
            </div>

            {/* 统计信息 */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#666'
            }}>
              {isOpus ? (
                <>
                  {videoInfo.stat.like !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="点赞数">
                      <ThumbsUp size={11} />
                      {formatNumber(videoInfo.stat.like)}
                    </span>
                  )}
                  {videoInfo.stat.favorite !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="收藏数">
                      <Star size={11} />
                      {formatNumber(videoInfo.stat.favorite)}
                    </span>
                  )}
                  {videoInfo.stat.reply !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="评论数">
                      <MessageCircle size={11} />
                      {formatNumber(videoInfo.stat.reply)}
                    </span>
                  )}
                  {videoInfo.stat.share !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="转发数">
                      <Share2 size={11} />
                      {formatNumber(videoInfo.stat.share)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="播放量">
                    <Eye size={11} />
                    {formatNumber(videoInfo.stat.view)}
                  </span>
                  {videoInfo.stat.danmaku !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="弹幕数">
                      <MessageSquare size={11} />
                      {formatNumber(videoInfo.stat.danmaku)}
                    </span>
                  )}
                  {videoInfo.stat.like !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="点赞数">
                      <ThumbsUp size={11} />
                      {formatNumber(videoInfo.stat.like)}
                    </span>
                  )}
                  {videoInfo.stat.coin !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="投币数">
                      <Coins size={11} />
                      {formatNumber(videoInfo.stat.coin)}
                    </span>
                  )}
                  {videoInfo.stat.favorite !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="收藏数">
                      <Star size={11} />
                      {formatNumber(videoInfo.stat.favorite)}
                    </span>
                  )}
                  {videoInfo.stat.reply !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="评论数">
                      <MessageCircle size={11} />
                      {formatNumber(videoInfo.stat.reply)}
                    </span>
                  )}
                  {videoInfo.stat.share !== undefined && (
                    <span className="stat-item" style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="转发数">
                      <Share2 size={11} />
                      {formatNumber(videoInfo.stat.share)}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* 视频简介 - 仅视频显示 */}
            {!isOpus && videoInfo.desc && (
              <p className="video-description" style={{
                fontSize: '12px',
                color: '#666',
                lineHeight: '1.5',
                margin: '0',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>{videoInfo.desc}</p>
            )}

            {/* 分P选择区域 */}
            {isMultiPart && downloadOptions.pages && (
              <div className="video-pages-section" style={{
                background: '#f9f9f9',
                borderRadius: '6px',
                padding: '10px',
                maxHeight: '150px',
                overflowY: 'auto'
              }}>
                <div className="pages-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <h4 className="pages-title" style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    margin: '0'
                  }}>视频章节 ({downloadOptions.pages.length})</h4>
                  <div className="pages-actions" style={{
                    display: 'flex',
                    gap: '6px'
                  }}>
                    <button
                      className="select-all-btn"
                      onClick={(e) => { e.stopPropagation(); selectAllPages(); }}
                      disabled={selectedPages.size === downloadOptions.pages.length}
                      style={{ fontSize: '11px', padding: '3px 6px' }}
                    >
                      全选
                    </button>
                    <button
                      className="deselect-all-btn"
                      onClick={(e) => { e.stopPropagation(); deselectAllPages(); }}
                      disabled={selectedPages.size === 0}
                      style={{ fontSize: '11px', padding: '3px 6px' }}
                    >
                      全不选
                    </button>
                  </div>
                </div>
                <div className="pages-list" role="list" aria-label="视频章节列表">
                  {downloadOptions.pages.map((page) => (
                    <div
                      key={page.page}
                      className={`page-item ${selectedPages.has(page.page) ? 'selected' : ''}`}
                      role="listitem"
                      onClick={(e) => { e.stopPropagation(); togglePageSelection(page.page); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px',
                        background: '#fff',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="page-checkbox">
                        <Check fill={selectedPages.has(page.page) ? "currentColor" : "none"} size={14} />
                      </div>
                      <div className="page-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="page-number" style={{ fontSize: '11px', color: '#999' }}>第 {page.page} 话</div>
                        <div className="page-title" style={{ fontSize: '12px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.part}</div>
                        <div className="page-duration" style={{ fontSize: '10px', color: '#999' }}>{formatDuration(page.duration)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="video-actions" style={{
              marginTop: 'auto',
              paddingTop: '8px'
            }}>
              <button
                className="download-btn primary"
                disabled={downloading || (isMultiPart && selectedPages.size === 0)}
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: (downloading || (isMultiPart && selectedPages.size === 0)) ? '#ccc' : '#fb7299',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: (downloading || (isMultiPart && selectedPages.size === 0)) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {downloading ? (
                  <Loader2 className="loading-icon" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Download size={14} />
                )}
                <span className="btn-text">
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