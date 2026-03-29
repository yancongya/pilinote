import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import { useAuthStore } from '../stores/auth'

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const [video, setVideo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [downloadTasks, setDownloadTasks] = useState<any[]>([])
  const { sessdata } = useAuthStore()

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
          
          // 检查是否已下载
          checkIfDownloaded(data.bvid)
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

  // 检查视频是否已下载
  const checkIfDownloaded = async (bvid: string) => {
    try {
      const response = await fetch('http://localhost:8000/api/download/list')
      const data = await response.json()
      
      if (data.success && data.downloads) {
        // 只显示已完成的下载任务
        const completedDownloads = data.downloads.filter((d: any) => 
          d.bvid === bvid && d.status === 'completed'
        )
        
        if (completedDownloads.length > 0) {
          setIsDownloaded(true)
          setDownloadTasks(completedDownloads)
        } else {
          setIsDownloaded(false)
          setDownloadTasks([])
        }
      }
    } catch (err) {
      console.error('检查下载状态失败:', err)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toString()
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
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
    const allCids = new Set(video.pages.map((p: any) => p.cid))
    if (selectedPages.size === video.pages.length) {
      setSelectedPages(new Set())
    } else {
      setSelectedPages(allCids)
    }
  }

  // 添加到下载队列
  const handleAddToDownload = async () => {
    if (!video || selectedPages.size === 0) return
    
    setDownloading(true)
    try {
      // 获取用户SESSDATA
      const sessdata = localStorage.getItem('sessdata')
      
      // 为每个选中的分P创建下载任务
      for (const pageNum of selectedPages) {
        const page = video.pages?.find((p: any) => p.page === pageNum)
        if (!page) continue
        
        const downloadData = {
          bvid: video.bvid,
          title: video.title,
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
        
        const response = await apiService.startDownload(downloadData)
        
        if (!response.success) {
          alert(`添加下载失败: ${response.message}`)
          return
        }
      }
      
      alert(`已添加 ${selectedPages.size} 个视频到下载队列`)
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
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
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
              <line x1="7" y1="2" x2="7" y2="22"/>
              <line x1="17" y1="2" x2="17" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <line x1="2" y1="7" x2="7" y2="7"/>
              <line x1="2" y1="17" x2="7" y2="17"/>
              <line x1="17" y1="17" x2="22" y2="17"/>
              <line x1="17" y1="7" x2="22" y2="7"/>
            </svg>
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
          {isDownloaded && downloadTasks.length > 0 ? (
            <>
              <div>共{downloadTasks.length}{video.pages && video.pages.length > 1 && `/${video.pages.length}`}个视频</div>
              <div>总时长：{formatDuration(
                downloadTasks.reduce((total: number, task: any) => total + (task.duration || 0), 0)
              )}</div>
            </>
          ) : (
            formatDuration(video.duration)
          )}
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
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
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
                    gap: '12px',
                    fontSize: '12px',
                    color: '#999'
                  }}>
                    {!isDownloaded && (
                      <>
                        <span>{formatNumber(video.view)}播放</span>
                        <span>{formatNumber(video.danmaku)}弹幕</span>
                        <span>{formatTime(video.pubtime)}</span>
                      </>
                    )}
                  </div>
                          </div>        
                {/* 分P信息 */}
                {!isDownloaded && video.pages && video.pages.length > 1 && (
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

        {/* 下载区域 - 仅在未下载时显示 */}
        {!isDownloaded && (
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
                {video.pages.map((page: any, index: number) => (
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
                      border: selectedPages.has(page.cid) ? '1px solid #fb7299' : '1px solid transparent'
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
                  </div>
                ))}
              </div>

              {/* 下载按钮 */}
              <button
                onClick={handleAddToDownload}
                disabled={downloading || selectedPages.size === 0}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: downloading || selectedPages.size === 0 ? '#ccc' : '#fb7299',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: downloading || selectedPages.size === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {downloading ? '添加中...' : `下载 ${selectedPages.size} 个视频`}
              </button>
            </>
          ) : (
            /* 单个视频下载 */
            <button
              onClick={handleAddToDownload}
              disabled={downloading}
              style={{
                width: '100%',
                padding: '14px',
                background: downloading ? '#ccc' : '#fb7299',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: downloading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {downloading ? '添加中...' : '下载视频'}
            </button>
          )}
        </div>
        )}

        {/* 下载任务列表 - 仅在已下载时显示 */}
        {isDownloaded && downloadTasks.length > 0 && (
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
            视频列表
          </h3>

          {downloadTasks.map((task) => (
            <div key={task.id} style={{
              background: '#f9f9f9',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* 状态标识 */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: task.status === 'completed' ? '#4CAF50' : 
                           task.status === 'downloading' ? '#fb7299' : 
                           task.status === 'failed' ? '#ef5350' : '#9e9e9e'
              }}></div>

              {/* 任务信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#333'
                }}>
                  <div style={{ 
                    flex: 1, 
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {task.title}
                  </div>
                  {task.duration && task.duration > 0 && (
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      flexShrink: 0,
                      marginLeft: 'auto'
                    }}>
                      {formatDuration(task.duration)}
                    </span>
                  )}
                </div>
                {task.status === 'completed' && task.file_path && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#4CAF50', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    marginTop: '4px'
                  }}>
                    <span>✓</span>
                    <span>已下载</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}