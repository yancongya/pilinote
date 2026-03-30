import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Download, Clock, AlertCircle, Play, Trash, RefreshCw } from 'lucide-react'
import { useDownloadStore } from '../stores/download'
import { apiService } from '../services/api'

export default function DownloadDetailPage() {
  const { bvid } = useParams<{ bvid: string }>()
  const navigate = useNavigate()
  const downloadStore = useDownloadStore()
  
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startingBatch, setStartingBatch] = useState(false)
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set())
  const [seriesName, setSeriesName] = useState<string>('')

  useEffect(() => {
    if (bvid) {
      fetchDownloads()
      fetchSeriesName()
    }
  }, [bvid])

  // 获取真实的系列名
  const fetchSeriesName = async () => {
    if (!bvid) return
    try {
      const videoResponse = await apiService.getVideoDetail(bvid)
      if (videoResponse.success && videoResponse.data) {
        setSeriesName(videoResponse.data.title)
      }
    } catch (error) {
      console.error('获取视频详情失败:', error)
    }
  }

  // 默认选中所有分P
  useEffect(() => {
    if (downloads.length > 0 && selectedPages.size === 0) {
      setSelectedPages(new Set(downloads.map(d => d.id)))
    }
  }, [downloads])

  const fetchDownloads = async () => {
    setLoading(true)
    setError('')
    
    try {
      // 先尝试从本地store获取
      let downloadsByBvid = downloadStore.getDownloadsByBvid(bvid || '')
      
      // 如果本地没有，从服务器获取
      if (downloadsByBvid.length === 0) {
        const response = await fetch(`http://localhost:8000/api/download/bvid/${bvid}`)
        const data = await response.json()
        if (data.success && data.downloads) {
          downloadsByBvid = data.downloads
          // 同步到本地store
          downloadsByBvid.forEach((item: any) => {
            downloadStore.addDownload(item)
          })
        }
      }
      
      setDownloads(downloadsByBvid)
    } catch (err) {
      setError('获取下载信息失败')
      console.error('获取下载信息失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '未知'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '未知'
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`
    }
    return `${bytes} B`
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    if (!bytesPerSecond) return '0 KB/s'
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  }

  const formatETA = (seconds: number): string => {
    if (!seconds || seconds === 0) return '计算中...'
    if (seconds < 60) return `${Math.ceil(seconds)}秒`
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}分钟`
    return `${Math.ceil(seconds / 3600)}小时`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} />
      case 'queued':
        return <Clock size={16} />
      case 'downloading':
        return <Download size={16} />
      case 'processing':
        return <Download size={16} />
      case 'completed':
        return <Check size={16} />
      case 'failed':
        return <AlertCircle size={16} />
      case 'cancelled':
        return <AlertCircle size={16} />
      default:
        return <Clock size={16} />
    }
  }

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending':
        return '等待中'
      case 'queued':
        return '排队中'
      case 'downloading':
        return '下载中'
      case 'processing':
        return '处理中'
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      case 'cancelled':
        return '已取消'
      default:
        return '未知'
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return '#9e9e9e'
      case 'queued':
        return '#9e9e9e'
      case 'downloading':
        return '#fb7299'
      case 'processing':
        return '#fb7299'
      case 'completed':
        return '#52c41a'
      case 'failed':
        return '#ff4d4f'
      case 'cancelled':
        return '#ff4d4f'
      default:
        return '#9e9e9e'
    }
  }

const handleStartBatch = async () => {
    setStartingBatch(true)
    try {
      const downloadIds = downloads.map(d => d.id)
      const success = await downloadStore.startBatchDownloads(downloadIds)
      if (!success) {
        alert('批量开始下载失败')
      } else {
        await fetchDownloads()
      }
    } finally {
      setStartingBatch(false)
    }
  }

  const handleStartSelected = async () => {
    if (selectedPages.size === 0) {
      alert('请先选择要下载的分P')
      return
    }
    
    setStartingBatch(true)
    try {
      const downloadIds = Array.from(selectedPages)
      const success = await downloadStore.startBatchDownloads(downloadIds)
      if (!success) {
        alert('批量开始下载失败')
      } else {
        await fetchDownloads()
        setSelectedPages(new Set())
      }
    } finally {
      setStartingBatch(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedPages.size === 0) {
      alert('请先选择要删除的分P')
      return
    }
    
    if (!confirm(`确定要删除选中的 ${selectedPages.size} 个下载任务吗？`)) {
      return
    }
    
    setStartingBatch(true)
    try {
      const downloadIds = Array.from(selectedPages)
      
      for (const id of downloadIds) {
        await fetch(`http://localhost:8000/api/download/${id}`, { method: 'DELETE' })
      }
      
      // 立即从前端列表中移除已删除的项
      setDownloads(prev => prev.filter(d => !selectedPages.has(d.id)))
      setSelectedPages(new Set())
    } catch (err) {
      console.error('删除失败:', err)
      alert('删除失败')
    } finally {
      setStartingBatch(false)
    }
  }

  const handleRefresh = async () => {
    if (!bvid) return
    
    setStartingBatch(true)
    try {
      // 先获取当前列表
      await fetchDownloads()
      const currentDownloads = [...downloads]
      
      // 获取视频详情
      const videoResponse = await apiService.getVideoDetail(bvid)
      if (!videoResponse.success || !videoResponse.data || !videoResponse.data.pages) {
        alert('获取视频详情失败')
        return
      }
      
      const pages = videoResponse.data.pages
      const existingCids = new Set(currentDownloads.map(d => d.cid))
      
      // 找出需要恢复的分P
      const pagesToRestore = pages.filter((page: any) => !existingCids.has(page.cid))
      
      if (pagesToRestore.length > 0) {
        if (!confirm(`发现 ${pagesToRestore.length} 个未下载的分P，是否添加到下载列表？`)) {
          // 用户取消，只刷新现有列表
          await fetchSeriesName()
          setSelectedPages(new Set(downloads.map(d => d.id)))
          return
        }
        
        // 批量添加到下载列表
        const sessdata = localStorage.getItem('sessdata')
        for (const page of pagesToRestore) {
          await apiService.addToDownloadQueue({
            bvid: bvid,
            title: page.part,
            cid: page.cid,
            aid: videoResponse.data.aid,
            thumbnail_url: videoResponse.data.pic,
            duration: page.duration,
            uploader: videoResponse.data.owner.name,
            uploader_mid: videoResponse.data.owner.mid,
            sessdata: sessdata || undefined
          })
        }
        
        // 刷新列表
        await fetchDownloads()
        await fetchSeriesName()
        setSelectedPages(new Set(downloads.map(d => d.id)))
        alert(`已恢复 ${pagesToRestore.length} 个分P`)
      } else {
        // 没有需要恢复的分P，只刷新现有列表
        await fetchSeriesName()
        setSelectedPages(new Set(downloads.map(d => d.id)))
      }
    } catch (err) {
      console.error('刷新失败:', err)
      alert('刷新失败')
    } finally {
      setStartingBatch(false)
    }
  }

  const handleStartSingle = async (downloadId: string) => {
    setStartingBatch(true)
    try {
      const success = await downloadStore.startBatchDownloads([downloadId])
      if (!success) {
        alert('开始下载失败')
      } else {
        await fetchDownloads()
      }
    } finally {
      setStartingBatch(false)
    }
  }

  const handleDeleteSingle = async (downloadId: string) => {
    if (!confirm('确定要删除这个下载任务吗？')) {
      return
    }
    
    try {
      await fetch(`http://localhost:8000/api/download/${downloadId}`, { method: 'DELETE' })
      // 立即从前端列表中移除
      setDownloads(prev => prev.filter(d => d.id !== downloadId))
    } catch (err) {
      console.error('删除失败:', err)
      alert('删除失败')
    }
  }

  const handleSelectAll = () => {
    setSelectedPages(new Set(downloads.map(d => d.id)))
  }

  const handleDeselectAll = () => {
    setSelectedPages(new Set())
  }

  const handleInvertSelection = () => {
    const allIds = new Set(downloads.map(d => d.id))
    const newSelected = new Set<string>()
    allIds.forEach(id => {
      if (!selectedPages.has(id)) {
        newSelected.add(id)
      }
    })
    setSelectedPages(newSelected)
  }

  const anyDownloading = downloads.some(d => d.status === 'downloading' || d.status === 'processing')
  const canStart = downloads.some(d => d.status === 'pending' || d.status === 'queued' || d.status === 'failed')

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#999' }}>加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#ff4d4f' }}>{error}</div>
      </div>
    )
  }

  if (downloads.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#999' }}>暂无下载任务</div>
      </div>
    )
  }

  const videoInfo = downloads[0]

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* 固定顶部 */}
      <div style={{ 
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#f5f5f5',
        paddingBottom: '20px',
        marginBottom: '24px'
      }}>
        {/* 头部 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <button 
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: 0,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {seriesName || videoInfo.title}
          </h1>
          {canStart && (
            <>
              <button
                onClick={handleSelectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '12px',
                  color: '#666',
                  borderRadius: '4px'
                }}
                title="全选"
              >
                全选
              </button>
              <button
                onClick={handleDeselectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '12px',
                  color: '#666',
                  borderRadius: '4px'
                }}
                title="取消全选"
              >
                取消全选
              </button>
              <button
                onClick={handleInvertSelection}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '12px',
                  color: '#666',
                  borderRadius: '4px'
                }}
                title="反选"
              >
                反选
              </button>
              {selectedPages.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={startingBatch}
                  style={{
                    background: 'none',
                    color: startingBatch ? '#ccc' : '#ff4d4f',
                    border: 'none',
                    cursor: startingBatch ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '8px'
                  }}
                  title={`删除选中 (${selectedPages.size})`}
                >
                  <Trash size={16} />
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={startingBatch}
                style={{
                  background: 'none',
                  color: startingBatch ? '#ccc' : '#666',
                  border: 'none',
                  cursor: startingBatch ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="刷新列表"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={handleStartBatch}
                disabled={startingBatch || anyDownloading}
                style={{
                  background: 'none',
                  color: startingBatch || anyDownloading ? '#ccc' : '#52c41a',
                  border: 'none',
                  cursor: startingBatch || anyDownloading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="开始全部下载"
              >
                <Play size={16} />
              </button>
            </>
          )}
        </div>

        {/* 下载进度概览 */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            width: '100%'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>总进度</div>
              <div style={{ color: '#333', fontSize: '20px', fontWeight: '600' }}>
                {Math.round(downloads.reduce((sum, d) => sum + d.progress, 0) / downloads.length)}%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>已完成</div>
              <div style={{ color: '#52c41a', fontSize: '20px', fontWeight: '600' }}>
                {downloads.filter(d => d.status === 'completed').length} / {downloads.length}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>下载中</div>
              <div style={{ color: '#fb7299', fontSize: '20px', fontWeight: '600' }}>
                {downloads.filter(d => d.status === 'downloading' || d.status === 'processing').length}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>总大小</div>
              <div style={{ color: '#333', fontSize: '16px', fontWeight: '500' }}>
                {formatFileSize(downloads.reduce((sum, d) => sum + (d.total_bytes || 0), 0))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 下载列表 */}
      <div>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '16px'
        }}>
          分P列表
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {downloads.map((download) => (
            <div 
              key={download.id}
              style={{
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              {/* 复选框 */}
              <button
                onClick={() => {
                  const newSelected = new Set(selectedPages)
                  if (newSelected.has(download.id)) {
                    newSelected.delete(download.id)
                  } else {
                    newSelected.add(download.id)
                  }
                  setSelectedPages(newSelected)
                }}
                style={{
                  background: selectedPages.has(download.id) ? '#fb7299' : '#f0f0f0',
                  border: '2px solid',
                  borderColor: selectedPages.has(download.id) ? '#fb7299' : '#e0e0e0',
                  cursor: 'pointer',
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {selectedPages.has(download.id) && <Check size={14} color="white" />}
              </button>

              {/* 状态图标 */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: getStatusColor(download.status),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}>
                {getStatusIcon(download.status)}
              </div>

              {/* 下载信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    flex: 1,
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#333',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {download.title}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    flexShrink: 0
                  }}>
                    {download.duration && formatDuration(download.duration)}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: getStatusColor(download.status),
                    flexShrink: 0,
                    fontWeight: '500'
                  }}>
                    {getStatusText(download.status)}
                  </div>
                </div>

                {/* 进度条 */}
                {download.status === 'downloading' || download.status === 'processing' ? (
                  <div style={{
                    background: '#f0f0f0',
                    borderRadius: '4px',
                    height: '8px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div 
                      style={{
                        background: getStatusColor(download.status),
                        height: '100%',
                        width: `${download.progress}%`,
                        transition: 'width 0.3s ease'
                      }}
                    ></div>
                  </div>
                ) : (
                  <div style={{
                    background: '#f0f0f0',
                    borderRadius: '4px',
                    height: '8px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div 
                      style={{
                        background: download.status === 'completed' ? '#52c41a' : '#e8e8e8',
                        height: '100%',
                        width: `${download.progress}%`,
                        transition: 'width 0.3s ease'
                      }}
                    ></div>
                  </div>
                )}

                {/* 下载详情 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  {download.downloaded_bytes && download.total_bytes && (
                    <span>
                      {formatFileSize(download.downloaded_bytes)} / {formatFileSize(download.total_bytes)}
                    </span>
                  )}
                  {download.download_speed > 0 && (
                    <span>
                      速度: {formatSpeed(download.download_speed)}
                    </span>
                  )}
                  {download.eta > 0 && (
                    <span>
                      剩余: {formatETA(download.eta)}
                    </span>
                  )}
                  {download.error_message && (
                    <span style={{ color: '#ff4d4f' }}>
                      {download.error_message}
                    </span>
                  )}
                  {/* 右下角操作按钮 */}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    {(download.status === 'pending' || download.status === 'failed') && (
                      <button
                        onClick={() => handleStartSingle(download.id)}
                        style={{
                          padding: '6px',
                          background: 'none',
                          color: '#52c41a',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="开始下载"
                      >
                        <Play size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSingle(download.id)}
                      style={{
                        padding: '6px',
                        background: 'none',
                        color: '#ff4d4f',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                      title="删除"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}