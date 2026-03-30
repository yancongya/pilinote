import { useState } from 'react'
import { apiService } from '../../services/api'
import { useDownloadStore } from '../../stores/download'
import { Loader2, Download } from 'lucide-react'

export default function HomeContent() {
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const downloadStore = useDownloadStore()

  const handleParseAndAdd = async () => {
    if (!urlInput.trim()) return

    setLoading(true)
    setError('')
    setSuccessMessage('')
    
    try {
      const response = await apiService.parseDownloadUrl(urlInput.trim())
      if (response.success && response.data?.video) {
        const video = response.data.video
        const downloadOptions = response.data.download_options
        const sessdata = localStorage.getItem('sessdata')
        
        let addedCount = 0
        let skippedCount = 0
        
        // 如果是多P视频，添加所有分集
        if (downloadOptions.multi_part && downloadOptions.pages) {
          for (const page of downloadOptions.pages) {
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
              quality: 64, // 默认720P
              output_format: 'mp4',
              thumbnail_url: video.pic,
              duration: page.duration,
              uploader: video.owner.name,
              uploader_mid: video.owner.mid,
              sessdata: sessdata || undefined
            }
            
            const addResponse = await apiService.addToDownloadQueue(downloadData)
            
            if (!addResponse.success) {
              setError(`添加下载失败: ${addResponse.message}`)
              return
            }
            
            addedCount++
          }
        } else {
          // 单P视频
          const downloadData = {
            bvid: video.bvid,
            title: video.title,
            cid: video.cid,
            aid: video.aid,
            quality: 64,
            output_format: 'mp4',
            thumbnail_url: video.pic,
            duration: video.duration,
            uploader: video.owner.name,
            uploader_mid: video.owner.mid,
            sessdata: sessdata || undefined
          }
          
          const addResponse = await apiService.addToDownloadQueue(downloadData)
          
          if (!addResponse.success) {
            setError(`添加下载失败: ${addResponse.message}`)
            return
          }
          
          addedCount = 1
        }
        
        // 清空输入框
        setUrlInput('')
        
        // 刷新下载列表
        await downloadStore.fetchDownloads()
        
        if (skippedCount > 0) {
          setSuccessMessage(`已添加 ${addedCount} 个视频到下载队列，跳过 ${skippedCount} 个已存在的视频`)
        } else {
          setSuccessMessage(`已成功添加 ${addedCount} 个视频到下载队列`)
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
      handleParseAndAdd()
    }
  }

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
            onClick={handleParseAndAdd}
            disabled={!urlInput.trim() || loading}
            aria-label="添加到下载列表"
          >
            {loading ? (
              <Loader2 className="loading-spinner" />
            ) : (
              <Download />
            )}
            <span className="btn-text">{loading ? '添加中...' : '添加到下载列表'}</span>
          </button>
        </div>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="success-message" role="status">
            {successMessage}
          </div>
        )}
      </div>
    </section>
  )
}