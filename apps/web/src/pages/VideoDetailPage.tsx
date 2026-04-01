import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useDownloadStore } from '../stores/download'
import { ArrowLeft, Film, User } from 'lucide-react'

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const downloadStore = useDownloadStore()
  const [video, setVideo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [downloadedCids, setDownloadedCids] = useState<Set<number>>(new Set())
  const { user } = useAuthStore()
  const sessdata = user?.sessdata

  // 获取代理图片URL
  const getProxyImageUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return `http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(url)}`
  }

  useEffect(() => {
    async function fetchVideoDetail() {
      if (!videoId) return
      
      setLoading(true)
      setError('')
      
      try {
        const response = await apiService.getVideoDetail(videoId, sessdata || undefined)
        
        if (response.success && response.data) {
          const data = response.data
          setVideo({
            bvid: data.bvid,
            aid: data.aid,
            title: data.title,
            description: data.desc,
            uploader: {
              name: data.owner.name,
              avatar: data.owner.face,
              mid: data.owner.mid
            },
            view: data.stat.view,
            danmaku: data.stat.danmaku,
            reply: data.stat.reply,
            favorite: data.stat.favorite,
            coin: data.stat.coin,
            share: data.stat.share,
            like: data.stat.like,
            pubtime: data.pubdate,
            duration: data.duration,
            cover: data.pic,
            cid: data.cid,
            pages: data.pages || [],
            dimension: data.dimension || null,
            rights: data.rights || {},
            descV2: data.descV2 || [],
            staff: data.staff || null,
            ugcSeason: data.ugcSeason || null
          })
          // 默认选中所有分P
          if (data.pages && data.pages.length > 0) {
            setSelectedPages(new Set(data.pages.map((p: any) => p.cid)))
          }
        } else {
          setError(response.message || '获取视频详情失败')
        }
      } catch (err) {
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchVideoDetail()
  }, [videoId, sessdata])

  // 检查哪些分P已经在下载列表中
  useEffect(() => {
    if (!video || !video.pages) return
    
    const cidsInList = new Set<number>()
    video.pages.forEach((page: any) => {
      if (downloadStore.isCidInDownloadList(video.bvid, page.cid)) {
        cidsInList.add(page.cid)
      }
    })
    setDownloadedCids(cidsInList)
  }, [video, downloadStore])

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toString()
  }

  const formatTime = (timestamp: number | string): string => {
    if (!timestamp) return ''

    try {
      let date: Date

      // 如果是字符串（如 "2026-03-28"），直接解析
      if (typeof timestamp === 'string') {
        date = new Date(timestamp)
      } else {
        // 如果是数字（时间戳），转换为毫秒
        if (timestamp === 0) return ''
        date = new Date(timestamp * 1000)
      }

      // 检查日期是否有效
      if (isNaN(date.getTime())) return ''

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

      // 如果只有日期没有时间，只返回日期部分
      const hours = date.getHours()
      const minutes = date.getMinutes()

      // 如果是 00:00，可能是只有日期的情况，只返回日期
      if (hours === 0 && minutes === 0) {
        return `${year}-${month}-${day}`
      }

      return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    } catch (error) {
      console.error('格式化时间失败:', error)
      return ''
    }
  }

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 解析文本中的URL并转换为可点击的链接
  const parseLinks = (text: string): React.ReactNode => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#fb7299',
              textDecoration: 'underline',
              wordBreak: 'break-all'
            }}
          >
            {part}
          </a>
        )
      }
      return part
    })
  }

  // 处理分P选择
  const handlePageSelect = (cid: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(cid)) {
        newSet.delete(cid)
      } else {
        newSet.add(cid)
      }
      return newSet
    })
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (!video?.pages) return
    const allCids: Set<number> = new Set(video.pages.map((p: any) => Number(p.cid)))
    if (selectedPages.size === video.pages.length) {
      setSelectedPages(new Set())
    } else {
      setSelectedPages(allCids)
    }
  }

  // 计算选中的分P中已添加的数量
  const getAddedCount = () => {
    let count = 0
    selectedPages.forEach(cid => {
      if (downloadedCids.has(cid)) {
        count++
      }
    })
    return count
  }

  // 判断是否所有选中的分P都已添加
  const allSelectedAdded = selectedPages.size > 0 && getAddedCount() === selectedPages.size

  // 获取按钮文本
  const getButtonText = () => {
    if (downloading) return '添加中...'
    
    const addedCount = getAddedCount()
    
    if (video?.pages && video.pages.length > 1) {
      // 多P视频
      if (addedCount > 0) {
        return `已添加 ${addedCount}/${selectedPages.size}`
      }
      return '添加到列表'
    } else {
      // 单个视频
      return addedCount > 0 ? '已在列表中' : '添加到列表'
    }
  }

  // 添加到下载队列
  const handleAddToDownload = async () => {
    if (!video || selectedPages.size === 0) return
    
    setDownloading(true)
    try {
      // 获取用户SESSDATA
      const sessdata = localStorage.getItem('sessdata')
      
      const pagesToAdd: any[] = []
      let skippedCount = 0
      
      // 收集所有需要添加的分P
      for (const cid of selectedPages) {
        const page = video.pages?.find((p: any) => p.cid === cid)
        if (!page) continue
        
        // 检查是否已经有相同的cid在下载列表中
        if (downloadStore.isCidInDownloadList(video.bvid, page.cid)) {
          skippedCount++
          continue
        }
        
        pagesToAdd.push(page)
      }
      
      if (pagesToAdd.length === 0) {
        if (skippedCount > 0) {
          alert(`跳过 ${skippedCount} 个已存在的视频`)
        }
        return
      }
      
      // 并行添加所有分P
      const addPromises = pagesToAdd.map(async (page) => {
        const downloadData = {
          bvid: video.bvid,
          title: page.part || `${video.title} - P${page.page}`,
          cid: page.cid,
          aid: video.aid,
          quality: 64, // 默认720P
          output_format: 'mp4',
          thumbnail_url: video.cover,
          duration: page.duration,
          uploader: video.uploader?.name,
          uploader_mid: video.uploader?.mid,
          sessdata: sessdata || undefined
        }
        
        return apiService.addToDownloadQueue(downloadData)
      })
      
      const results = await Promise.all(addPromises)
      
      const addedCount = results.filter(r => r.success).length
      const failedCount = results.length - addedCount
      
      // 更新已下载的分P列表
      const newlyAddedCids = pagesToAdd.filter((_, index) => results[index].success).map((page) => page.cid)
      if (newlyAddedCids.length > 0) {
        setDownloadedCids(prev => new Set([...prev, ...newlyAddedCids]))
      }
      
      if (failedCount > 0) {
        const failedResult = results.find(r => !r.success)
        alert(`添加成功 ${addedCount} 个，失败 ${failedCount} 个。失败原因: ${failedResult?.message || '未知错误'}`)
      } else if (skippedCount > 0) {
        alert(`已添加 ${addedCount} 个视频到下载队列，跳过 ${skippedCount} 个已存在的视频`)
      } else {
        alert(`已添加 ${addedCount} 个视频到下载队列`)
      }
    } catch (error) {
      console.error('添加下载失败:', error)
      alert('添加下载失败')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: '#999'
      }}>
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        color: '#999'
      }}>
        <div>{error}</div>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '8px 16px',
            background: '#fb7299',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          返回
        </button>
      </div>
    )
  }

  if (!video) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: '#999'
      }}>
        视频不存在
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '100vh',
      background: '#fff',
      paddingBottom: '60px'
    }}>
      {/* 顶部导航 */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #f0f0f0',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ArrowLeft />
        </button>
        <h1 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a1a1a',
          margin: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {video.title}
        </h1>
      </div>

      {/* 视频封面区域 */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '56.25%', // 16:9 比例
        background: '#f5f5f5',
        overflow: 'hidden'
      }}>
        {video.cover ? (
          <img 
            src={getProxyImageUrl(video.cover)} 
            alt={video.title}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#999'
          }}>
            <Film />
          </div>
        )}

        {/* 时长标签 */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          textAlign: 'right',
          lineHeight: '1.3'
        }}>
          {formatDuration(video.duration)}
        </div>
      </div>

      {/* 视频信息 */}
      <div style={{ padding: '16px' }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1a1a1a',
          margin: '0 0 12px 0',
          lineHeight: '1.4'
        }}>
          {video.title}
        </h2>

        {/* UP主信息 */}
        <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#f0f0f0',
                    overflow: 'hidden'
                  }}>
                    {video.uploader.avatar ? (
                      <img 
                        src={getProxyImageUrl(video.uploader.avatar)} 
                        alt={video.uploader.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <User />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1a1a1a',
                                marginBottom: '4px'
                              }}>
                                {video.uploader.name}
                              </div>
                            </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center'
                    }}>
                      <span>{formatNumber(video.view)}播放</span>
                      <span>{formatNumber(video.danmaku)}弹幕</span>
                      <span>{formatTime(video.pubtime)}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center'
                    }}>
                      <span>❤️ {formatNumber(video.like)}点赞</span>
                      <span>🪙 {formatNumber(video.coin)}硬币</span>
                      <span>⭐ {formatNumber(video.favorite)}收藏</span>
                      <span>💬 {formatNumber(video.reply)}评论</span>
                      <span>🔗 {formatNumber(video.share)}分享</span>
                    </div>
                  </div>
                          </div>        
                {/* 分P信息 */}
                {video.pages && video.pages.length > 1 && (
                  <div style={{
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#666'
                  }}>
                    共{video.pages.length}个视频，总时长：{formatDuration(video.pages.reduce((total: number, p: any) => total + p.duration, 0))}
                  </div>
                )}

        {/* 视频简介 */}
        {(video.description && video.description !== '-' && video.description.trim()) ? (
          <div style={{
            background: '#f9f9f9',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '14px',
            color: '#333',
            lineHeight: '1.6',
            marginBottom: '16px',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text'
          }}>
            {parseLinks(video.description)}
          </div>
        ) : null}

        {/* 下载区域 */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '12px'
          }}>
            下载选项
          </h3>

          {/* 多P视频下载选项 */}
          {video.pages && video.pages.length > 1 ? (
            <>
              {/* 全选按钮 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                padding: '8px',
                background: '#f9f9f9',
                borderRadius: '6px'
              }}>
                <button
                  onClick={handleSelectAll}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#666',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPages.size === video.pages.length}
                    readOnly
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>{selectedPages.size === video.pages.length ? '取消全选' : '全选'}</span>
                </button>
                <span style={{ fontSize: '12px', color: '#999' }}>
                  已选择 {selectedPages.size} / {video.pages.length} 个视频
                </span>
              </div>

              {/* 分P列表 */}
              <div style={{
                background: '#f9f9f9',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {video.pages.map((page: any, index: number) => {
                  const isInList = downloadedCids.has(page.cid)
                  return (
                    <div
                      key={page.cid || index}
                      onClick={() => handlePageSelect(page.cid)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        background: selectedPages.has(page.cid) ? '#fff' : '#f9f9f9',
                        borderRadius: '6px',
                        marginBottom: index < video.pages.length - 1 ? '8px' : '0',
                        cursor: 'pointer',
                        border: selectedPages.has(page.cid) ? '1px solid #fb7299' : '1px solid transparent',
                        opacity: isInList && !selectedPages.has(page.cid) ? 0.6 : 1
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPages.has(page.cid)}
                        readOnly
                        style={{ width: '16px', height: '16px', marginRight: '10px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: '#333', marginBottom: '4px' }}>
                          P{page.page}: {page.part || `第${page.page}个视频`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {formatDuration(page.duration)}
                        </div>
                      </div>
                      {isInList && (
                        <span style={{
                          fontSize: '11px',
                          color: '#fb7299',
                          background: '#fff5f8',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginLeft: '8px'
                        }}>
                          已添加
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 下载按钮 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleAddToDownload}
                  disabled={downloading || selectedPages.size === 0 || allSelectedAdded}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: downloading || selectedPages.size === 0 || allSelectedAdded ? '#ccc' : '#fb7299',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: downloading || selectedPages.size === 0 || allSelectedAdded ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {getButtonText()}
                </button>
              </div>
            </>
          ) : (
            /* 单个视频下载 - 只显示添加到列表按钮 */
            <button
              onClick={handleAddToDownload}
              disabled={downloading || allSelectedAdded}
              style={{
                width: '100%',
                padding: '14px',
                background: downloading || allSelectedAdded ? '#ccc' : '#fb7299',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: downloading || allSelectedAdded ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!downloading && !allSelectedAdded) {
                  e.currentTarget.style.background = '#ff5c8d'
                }
              }}
              onMouseLeave={(e) => {
                if (!downloading && !allSelectedAdded) {
                  e.currentTarget.style.background = '#fb7299'
                }
              }}
            >
              {getButtonText()}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}