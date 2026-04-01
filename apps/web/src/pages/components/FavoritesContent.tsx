import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../services/api'
import { useAuthStore } from '../../stores/auth'
import { useCacheStore } from '../../stores/cache'
import { useDownloadStore } from '../../stores/download'
import { ArrowLeft, Folder, CheckSquare, X, Download as DownloadIcon } from 'lucide-react'
import VideoListCard from './VideoListCard'

// 格式化时长（秒转为 MM:SS）
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 格式化数字（播放量、评论数）
const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`
  }
  return num.toString()
}

// 格式化时间戳为具体日期时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export default function FavoritesContent() {
  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [batchMode, setBatchMode] = useState(false) // 批量选择模式
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set()) // 选中的视频
  
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const downloadStore = useDownloadStore()
  const { 
    getFoldersCache, 
    setFoldersCache
  } = useCacheStore()
  const { 
    getDownloadStatus,
    addToDownloadList, 
    removeFromDownloadListByBvid,
    syncFromServer 
  } = downloadStore

  // 调试：打印用户状态
  useEffect(() => {
  }, [user])

  // 处理收藏夹选择，更新路由
  const handleSelectFolder = (folder: any) => {
    setSelectedFolder(folder)
    navigate(`/favorites/${folder.id}`, { replace: true })
  }

  // 处理返回收藏夹列表，更新路由
  const handleBackToFolders = () => {
    setSelectedFolder(null)
    navigate('/favorites', { replace: true })
  }

  // 批量下载收藏夹（使用新系统API）
  const batchDownloadFavorite = async () => {
    if (!selectedFolder || !user?.mid) {
      alert('无法批量下载：缺少必要信息')
      return
    }

    if (!confirm(`确定要批量下载收藏夹"${selectedFolder.title}"中的所有视频吗？`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. 使用新API获取收藏夹媒体信息
      const mediaResponse = await apiService.getFavoriteMedia(selectedFolder.id.toString(), user.mid.toString())
      if (!mediaResponse.success || !mediaResponse.data) {
        throw new Error(mediaResponse.message || '获取收藏夹信息失败')
      }

      const mediaInfo = mediaResponse.data
      const videoList = mediaInfo.list || []

      if (videoList.length === 0) {
        alert('收藏夹中没有视频可下载')
        setLoading(false)
        return
      }

      // 2. 创建调度器
      const folderName = `收藏夹-${selectedFolder.title.replace(/[\/\\:*?"<>|]/g, '_')}`
      const folderPath = `/Users/tanyancong/工作/开发/pilinote/apps/api/downloads/${folderName}`

      const schedulerResponse = await apiService.createScheduler({
        title: `收藏夹下载: ${selectedFolder.title}`,
        list: [],
        queue_type: 1, // PENDING
        folder: folderPath
      })

      if (!schedulerResponse.success || !schedulerResponse.data) {
        throw new Error(schedulerResponse.message || '创建调度器失败')
      }

      const schedulerId = schedulerResponse.data.id

      // 3. 批量提交任务
      const taskIds: string[] = []
      let successCount = 0

      for (const video of videoList) {
        try {
          const taskResponse = await apiService.submitTask({
            media_type: 'video',
            media_id: video.bvid || '',
            title: video.title || '',
            cover: video.cover || '',
            desc: video.desc || '',
            meta: {
              aid: video.aid,
              cid: video.cid,
              duration: video.duration,
              uploader: video.uploader?.name || '',
              uploader_mid: video.uploader?.mid || 0
            }
          })

          if (taskResponse.success && taskResponse.data) {
            taskIds.push(taskResponse.data.id)
            successCount++
          }
        } catch (err) {
          console.error(`提交任务失败: ${video.title}`, err)
        }
      }

      // 4. 更新调度器的任务列表
      // 注意：这里需要调用updateScheduler或者直接通过scheduler的list字段更新
      // 由于新系统API可能不直接支持更新list，我们可能需要先获取scheduler，然后更新
      // 暂时跳过这一步，直接启动调度器

      // 5. 启动调度器
      const startResponse = await apiService.startScheduler(schedulerId)

      if (startResponse.success) {
        alert(`批量下载已启动！\n成功提交 ${successCount}/${videoList.length} 个任务\n保存路径: ${folderPath}`)
        // 切换到下载页面
        navigate('/downloads')
      } else {
        throw new Error(startResponse.message || '启动调度器失败')
      }

    } catch (err) {
      console.error('批量下载失败:', err)
      setError(`批量下载失败: ${err instanceof Error ? err.message : '未知错误'}`)
      alert(`批量下载失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 批量下载选中的视频
  const batchDownloadSelected = async () => {
    if (selectedVideos.size === 0) {
      alert('请先选择要下载的视频')
      return
    }

    if (!confirm(`确定要添加选中的 ${selectedVideos.size} 个视频到下载列表吗？`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      let successCount = 0
      let failCount = 0

      // 批量添加到下载队列
      for (const video of videos) {
        if (!selectedVideos.has(video.id)) continue

        try {
          const response = await apiService.addToDownloadQueue({
            bvid: video.bvid || '',
            title: video.title || '',
            cid: video.cid,
            aid: video.aid,
            thumbnail_url: video.cover || '',
            duration: video.originalDuration || video.duration,
            uploader: video.owner?.name || video.uploader?.name || '',
            uploader_mid: video.owner?.mid || video.uploader?.mid || 0
          })

          if (response.success) {
            successCount++
          } else {
            failCount++
            console.error(`添加到下载列表失败: ${video.title}`, response.message)
          }
        } catch (err) {
          failCount++
          console.error(`添加到下载列表失败: ${video.title}`, err)
        }
      }

      if (successCount > 0) {
        alert(`成功添加 ${successCount} 个视频到下载列表${failCount > 0 ? `，失败 ${failCount} 个` : ''}`)
        // 退出批量模式
        setBatchMode(false)
        setSelectedVideos(new Set())
        // 刷新下载列表
        downloadStore.fetchDownloads()
      } else {
        throw new Error('所有视频添加失败')
      }

    } catch (err) {
      console.error('批量添加失败:', err)
      setError(`批量添加失败: ${err instanceof Error ? err.message : '未知错误'}`)
      alert(`批量添加失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 切换视频选中状态
  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideos)
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId)
    } else {
      newSelected.add(videoId)
    }
    setSelectedVideos(newSelected)
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      // 全部取消选中
      setSelectedVideos(new Set())
    } else {
      // 全部选中
      setSelectedVideos(new Set(videos.map(v => v.id)))
    }
  }

  // 监听路由变化，支持通过URL直接访问收藏夹详情
  useEffect(() => {
    const currentPath = window.location.pathname
    const favoritesMatch = currentPath.match(/^\/favorites\/(\d+)$/)
    if (favoritesMatch && folders.length > 0) {
      const folderId = parseInt(favoritesMatch[1])
      const folder = folders.find(f => f.id === folderId)
      if (folder) {
        setSelectedFolder(folder)
      }
    }
  }, [folders])

  // 获取收藏夹列表（带缓存）
  useEffect(() => {
    const fetchFolders = async () => {
      if (!user?.sessdata || !user?.mid) return
      
      // 先检查缓存
      const cachedFolders = getFoldersCache()
      if (cachedFolders) {
        setFolders(cachedFolders)
        return
      }
      
      setLoading(true)
      setError('')
      
      try {
        const response = await apiService.getFolders(user.sessdata, user.mid)
        if (response.success && response.data) {
          setFolders(response.data)
          setFoldersCache(response.data) // 保存到缓存
        } else {
          setError(response.message || '获取收藏夹列表失败')
        }
      } catch (err) {
        setError('网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchFolders()
  }, [user, getFoldersCache, setFoldersCache])

  // 获取收藏夹详情（视频列表，移除缓存）
  const fetchVideos = useCallback(async (page: number = 1, isLoadMore: boolean = false, pageSize: number = 10) => {
    if (!selectedFolder || !user?.sessdata) return
    
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError('')
    
    try {
      const response = await apiService.getFolderDetail(selectedFolder.id, user.sessdata, page, pageSize)
      if (response.success && response.data) {
        const medias = response.data.medias || []
        // 格式化视频数据
        const formattedVideos = medias.map((video: any) => ({
          id: video.id,
          bvid: video.bvid,
          title: video.title,
          cover: video.cover,
          duration: formatDuration(video.duration),
          uploader: video.uploader?.name || '未知',
          views: formatNumber(video.view),
          danmaku: video.danmaku ? formatNumber(video.danmaku) : '0',
          comments: video.comment ? formatNumber(video.comment) : '0',
          likes: video.like ? formatNumber(video.like) : '0',
          coins: video.coin ? formatNumber(video.coin) : '0',
          favorites: video.favorite ? formatNumber(video.favorite) : '0',
          shares: video.share ? formatNumber(video.share) : '0',
          time: formatTime(video.pubtime),
          // 保留原始数据用于下载
          cid: video.cid,
          aid: video.aid,
          pic: video.cover,
          originalDuration: video.duration,
          owner: video.uploader,
          pubtime: video.pubtime
        }))
        
        if (isLoadMore) {
          setVideos(prev => {
            const pageSize = response.data.page_size || 10
            setHasMore(formattedVideos.length === pageSize)
            return [...prev, ...formattedVideos]
          })
        } else {
          setVideos(formattedVideos)
          const pageSize = response.data.page_size || 10
          setHasMore(formattedVideos.length === pageSize)
        }
      } else {
        setError(response.message || '获取视频列表失败')
      }
    } catch (err) {
      setError('网络请求失败')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [selectedFolder, user])

  // 当选中的收藏夹改变时，重新加载视频列表
  useEffect(() => {
    if (selectedFolder) {
      fetchVideos(1, false, 10)
      setCurrentPage(1)
    }
  }, [selectedFolder, fetchVideos])

  // 使用Intersection Observer实现无限滚动
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading || loadingMore || !selectedFolder) return

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && !loading && !loadingMore && hasMore) {
          const nextPage = currentPage + 1
          fetchVideos(nextPage, true, 10)
          setCurrentPage(nextPage)
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    observer.observe(loadMoreRef.current)
    observerRef.current = observer

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [currentPage, loading, loadingMore, hasMore, selectedFolder, fetchVideos])

  // 同步下载列表
  useEffect(() => {
    // 初始同步
    syncFromServer()
    
    // 每30秒同步一次
    const interval = setInterval(() => {
      syncFromServer()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [syncFromServer])

  const toggleDownload = async (video: any, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const currentStatus = getDownloadStatus(video.bvid)
    
    // 防止重复点击
    const button = e.currentTarget as HTMLButtonElement
    if (button.disabled) return
    button.disabled = true
    
    try {
      if (currentStatus === 'in_list') {
        // 从下载列表移除
        const success = await removeFromDownloadListByBvid(video.bvid)
        if (!success) {
          alert('从下载列表移除失败')
        }
      } else {
        const sessdata = localStorage.getItem('sessdata')
        
        // 先获取视频详情，检查是否是多P视频
        try {
          const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)
          
          if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
            const pages = videoDetailResponse.data.pages
            const videoDetailData = videoDetailResponse.data
            
            if (pages.length > 1) {
              // 多P视频，添加所有分集
              let addedCount = 0
              let skippedCount = 0
              
              const addPromises = pages.map(async (page: any) => {
                // 检查是否已经有相同的cid在下载列表中
                if (downloadStore.isCidInDownloadList(video.bvid, page.cid)) {
                  skippedCount++
                  return { success: false, skipped: true }
                }
                
                const downloadData = {
                  bvid: video.bvid,
                  title: page.part || `${video.title} - P${page.page}`,
                  cid: page.cid,
                  aid: videoDetailData.aid || video.aid,
                  quality: 64,
                  output_format: 'mp4',
                  thumbnail_url: video.pic,
                  duration: page.duration,
                  uploader: video.owner?.name || '',
                  uploader_mid: video.owner?.mid || 0,
                  sessdata: sessdata || undefined
                }
                
                return apiService.addToDownloadQueue(downloadData)
              })
              
              const results = await Promise.all(addPromises)
              
              addedCount = results.filter(r => r.success).length
              
              if (skippedCount > 0) {
                alert(`已添加 ${addedCount} 个分集到下载队列，跳过 ${skippedCount} 个已存在的分集`)
              } else {
                alert(`已添加 ${addedCount} 个分集到下载队列`)
              }
            } else {
              // 单P视频，使用视频详情API返回的数据
              const downloadData = {
                bvid: video.bvid,
                title: video.title,
                cid: videoDetailData.cid || pages[0]?.cid,
                aid: videoDetailData.aid || video.aid,
                quality: 64,
                output_format: 'mp4',
                thumbnail_url: video.pic,
                duration: video.originalDuration || videoDetailData.duration || pages[0]?.duration,
                uploader: video.owner?.name || '',
                uploader_mid: video.owner?.mid || 0,
                sessdata: sessdata || undefined
              }
              
              const success = await addToDownloadList(downloadData)
              if (!success) {
                alert('添加到下载列表失败')
              }
            }
          } else {
            // 获取视频详情失败，降级为直接添加
            const downloadData = {
              bvid: video.bvid,
              title: video.title,
              cid: video.cid || video.id,
              aid: video.aid || video.id,
              quality: 64,
              output_format: 'mp4',
              thumbnail_url: video.pic,
              duration: video.originalDuration || video.durationSeconds,
              uploader: video.owner?.name || '',
              uploader_mid: video.owner?.mid || 0,
              sessdata: sessdata || undefined
            }
            
            const success = await addToDownloadList(downloadData)
            if (!success) {
              alert('添加到下载列表失败')
            }
          }
        } catch (error) {
          // 获取视频详情失败，降级为直接添加
          console.error('获取视频详情失败，降级为直接添加:', error)
          
          const downloadData = {
            bvid: video.bvid,
            title: video.title,
            cid: video.cid || video.id,
            aid: video.aid || video.id,
            quality: 64,
            output_format: 'mp4',
            thumbnail_url: video.pic,
            duration: video.originalDuration || video.durationSeconds,
            uploader: video.owner?.name || '',
            uploader_mid: video.owner?.mid || 0,
            sessdata: sessdata || undefined
          }
          
          const success = await addToDownloadList(downloadData)
          if (!success) {
            alert('添加到下载列表失败')
          }
        }
      }
    } finally {
      // 恢复按钮状态
      button.disabled = false
    }
  }

  if (!user?.sessdata) {
    return (
      <section className="content-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#999', fontSize: '16px' }}>请先登录以查看收藏夹</p>
      </section>
    )
  }

  return (
    <section
      id="favorites-panel"
      role="tabpanel"
      aria-labelledby="favorites-tab"
      className="content-section"
    >
<div className="section-header">
        <div className="section-title">
          {selectedFolder && (
            <button
              className="back-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleBackToFolders()
              }}
              aria-label="返回收藏夹列表"
            >
              <ArrowLeft />
            </button>
          )}
          <h2>{selectedFolder ? selectedFolder.title : '我的收藏'}</h2>
          <span className="video-count">
            {selectedFolder
              ? `共${selectedFolder.media_count}条视频`
              : `${folders.length}个收藏夹`}
          </span>
          {selectedFolder && videos.length > 0 && (
            <div className="batch-actions">
              {!batchMode ? (
                <button
                  className="batch-download-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setBatchMode(true)
                  }}
                  disabled={loading}
                  aria-label="进入批量选择模式"
                >
                  <CheckSquare size={14} />
                  批量下载
                </button>
              ) : (
                <>
                  <button
                    className="batch-cancel-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setBatchMode(false)
                      setSelectedVideos(new Set())
                    }}
                    aria-label="取消批量选择"
                  >
                    <X size={14} />
                    取消
                  </button>
                  {selectedVideos.size > 0 && (
                    <button
                      className="batch-start-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        batchDownloadSelected()
                      }}
                      disabled={loading}
                      aria-label={`下载选中的 ${selectedVideos.size} 个视频`}
                    >
                      <DownloadIcon size={14} />
                      下载 ({selectedVideos.size})
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4444' }}>{error}</div>
      )}

      {!loading && !error && !selectedFolder && (
        <div className="fav-folder-list" role="list" aria-label="收藏夹列表">
          {folders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>暂无收藏夹</div>
          ) : (
            folders.map(folder => (
              <article
                key={folder.id}
                className="fav-folder-item"
                onClick={() => handleSelectFolder(folder)}
                role="listitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectFolder(folder)
                  }
                }}
              >
                <div className="fav-folder-cover">
                  <div className="fav-folder-thumbnail">
                    {folder.cover ? (
                      <img src={`http://localhost:8000/api/auth/proxy/avatar?url=${encodeURIComponent(folder.cover)}`} alt={folder.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Folder />
                    )}
                  </div>
                </div>
                <div className="fav-folder-info">
                  <h3>{folder.title}</h3>
                  <div className="fav-folder-meta">
                    <span className="fav-folder-count">{folder.media_count}个内容</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {!loading && !error && selectedFolder && (
        <div className="video-list" role="list" aria-label="视频列表">
          {batchMode && (
            <div className="batch-select-header">
              <button
                className="select-all-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSelectAll()
                }}
              >
                {selectedVideos.size === videos.length ? '取消全选' : '全选'}
              </button>
              <span className="selected-count">
                已选择 {selectedVideos.size} / {videos.length} 个视频
              </span>
            </div>
          )}
          {videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>暂无视频</div>
          ) : (
            <>
              {videos.map(video => (
                <VideoListCard
                  key={video.id}
                  {...video}
                  onDownloadToggle={toggleDownload}
                  downloadStatus={getDownloadStatus(video.bvid)}
                  batchMode={batchMode}
                  selected={selectedVideos.has(video.id)}
                  onToggleSelect={() => toggleVideoSelection(video.id)}
                  clickable={!batchMode}
                />
              ))}
              {loadingMore && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>加载中...</div>
              )}
              {!hasMore && videos.length > 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>没有更多视频了</div>
              )}
              {hasMore && <div ref={loadMoreRef} style={{ height: '1px', visibility: 'hidden' }} />}
            </>
          )}
        </div>
      )}
    </section>
  )
}