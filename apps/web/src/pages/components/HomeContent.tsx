import { useState } from 'react'
import { apiService } from '../../services/api'

interface VideoInfo {
  bvid: string
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
          setSelectedPages(new Set(response.data.download_options.pages.map(p => p.page)))
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
      const sessdata = localStorage.getItem('sessdata')
      
      // 为每个选中的分P创建下载任务
      for (const pageNum of selectedPages) {
        const page = parseData.data.download_options.pages?.find((p: any) => p.page === pageNum)
        if (!page) continue
        
        const downloadData = {
          bvid: video.bvid,
          title: video.title,
          cid: page.cid,
          aid: video.aid,
          quality: 64, // 默认720P
          output_format: 'mp4',
          thumbnail_url: video.pic,
          duration: page.duration,
          uploader: video.owner.name,
          uploader_mid: video.owner.mid,
          sessdata: sessdata || undefined
        }
        
        const response = await apiService.startDownload(downloadData)
        
        if (!response.success) {
          setError(`添加下载失败: ${response.message}`)
          return
        }
      }
      
      // 清空解析数据
      setParseData(null)
      setSelectedPages(new Set())
      
      alert(`已添加 ${selectedPages.size} 个视频到下载队列`)
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
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
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
              <svg className="loading-spinner" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3"/>
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
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
              </div>
              <div className="video-stats">
                <span className="stat-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  {formatNumber(videoInfo.stat.view)}
                </span>
                <span className="stat-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {formatNumber(videoInfo.stat.danmaku)}
                </span>
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
                        <svg viewBox="0 0 24 24" fill={selectedPages.has(page.page) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
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
                  <svg className="loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <polyline points="4.93 4.93 7.76 7.76 4.93 9.17" />
                    <polyline points="4.93 19.07 7.76 16.24 4.93 14.83" />
                    <polyline points="19.07 4.93 16.24 7.76 19.07 9.17" />
                    <polyline points="19.07 19.07 16.24 16.24 19.07 14.83" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
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