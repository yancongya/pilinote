import { useState } from 'react'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useDownloadStore } from '../../stores/download'
import { useSettingsStore } from '../../stores/settings'
import { Loader2, Eye, Check, Download, MessageSquare, MessageCircle, ThumbsUp, Coins, Star, Share2 } from 'lucide-react'
import { getAvatarProxyUrl } from '../../config/api'

interface VideoInfo {
  bvid: string
  aid: number
  title: string
  desc: string
  pic: string
  duration: number
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
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const downloadStore = useDownloadStore()
  const settingsStore = useSettingsStore()
  const { settings } = settingsStore

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
      } else {
        setError(response.message || '解析失败，请检查链接是否正确')
      }
    } catch (err) {
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
    if (!parseData?.data?.video || selectedPages.size === 0) return
    
    setDownloading(true)
    setError('')
    
    try {
      const video = parseData.data.video
      const { user } = useAuthStore()
      const sessdata = user?.sessdata
      
      // 从设置中获取默认质量
      const defaultQuality = settings?.download?.video?.default_quality || 64
      
      let addedCount = 0
      let skippedCount = 0
      
      // 为每个选中的分P创建下载任务
      for (const pageNum of selectedPages) {
        const page = parseData.data.download_options.pages?.find((p: any) => p.page === pageNum)
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
    } catch (err) {
      setError('添加下载失败，请稍后重试')
    } finally {
      setDownloading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toString()
  }

  const getProxyImageUrl = (url: string): string => {
    if (!url) return ''
    return getAvatarProxyUrl(url)
  }

  const videoInfo = parseData?.data?.video
  const downloadOptions = parseData?.data?.download_options
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

      {videoInfo && (
        <div className="video-info-card">
          <div className="video-cover">
            <img
              src={getProxyImageUrl(videoInfo.pic)}
              alt={videoInfo.title}
              className="video-cover-image"
            />
            <div className="video-duration">{formatDuration(videoInfo.duration)}</div>
          </div>
          <div className="video-details">
            <h3 className="video-title">{videoInfo.title}</h3>
            <div className="video-meta">
              <div className="video-uploader">
                <img
                  src={getProxyImageUrl(videoInfo.owner.face)}
                  alt={videoInfo.owner.name}
                  className="uploader-avatar"
                />
                <span className="uploader-name">{videoInfo.owner.name}</span>
                <span className="stat-item" title="播放量">
                  <Eye />
                  {formatNumber(videoInfo.stat.view)}
                </span>
                {videoInfo.stat.danmaku !== undefined && (
                  <span className="stat-item" title="弹幕数">
                    <MessageSquare />
                    {formatNumber(videoInfo.stat.danmaku)}
                  </span>
                )}
                {videoInfo.stat.reply !== undefined && (
                  <span className="stat-item" title="评论数">
                    <MessageCircle />
                    {formatNumber(videoInfo.stat.reply)}
                  </span>
                )}
                {videoInfo.stat.like !== undefined && (
                  <span className="stat-item" title="点赞数">
                    <ThumbsUp />
                    {formatNumber(videoInfo.stat.like)}
                  </span>
                )}
                {videoInfo.stat.coin !== undefined && (
                  <span className="stat-item" title="投币数">
                    <Coins />
                    {formatNumber(videoInfo.stat.coin)}
                  </span>
                )}
                {videoInfo.stat.favorite !== undefined && (
                  <span className="stat-item" title="收藏数">
                    <Star />
                    {formatNumber(videoInfo.stat.favorite)}
                  </span>
                )}
                {videoInfo.stat.share !== undefined && (
                  <span className="stat-item" title="转发数">
                    <Share2 />
                    {formatNumber(videoInfo.stat.share)}
                  </span>
                )}
              </div>
            </div>
            <p className="video-description">{videoInfo.desc}</p>

            {isMultiPart && downloadOptions.pages && (
              <div className="video-pages-section">
                <div className="pages-header">
                  <h4 className="pages-title">视频章节 ({downloadOptions.pages.length})</h4>
                  <div className="pages-actions">
                    <button
                      className="select-all-btn"
                      onClick={selectAllPages}
                      disabled={selectedPages.size === downloadOptions.pages.length}
                    >
                      全选
                    </button>
                    <button
                      className="deselect-all-btn"
                      onClick={deselectAllPages}
                      disabled={selectedPages.size === 0}
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
                      onClick={() => togglePageSelection(page.page)}
                    >
                      <div className="page-checkbox">
                        <Check fill={selectedPages.has(page.page) ? "currentColor" : "none"} />
                      </div>
                      <div className="page-info">
                        <div className="page-number">第 {page.page} 话</div>
                        <div className="page-title">{page.part}</div>
                        <div className="page-duration">{formatDuration(page.duration)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="video-actions">
              <button 
                className="download-btn primary" 
                disabled={selectedPages.size === 0 || downloading}
                onClick={handleDownload}
              >
                {downloading ? (
                  <Loader2 className="loading-icon" />
                ) : (
                  <Download />
                )}
                <span className="btn-text">
                  {downloading ? '添加中...' : (isMultiPart ? `下载 ${selectedPages.size} 个视频` : '下载视频')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}