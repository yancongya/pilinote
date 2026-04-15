import { useEffect, useState } from 'react'
import { useScanStore } from '../../stores/scanStore'
import { RefreshCw, Heart, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react'
import ConfirmModal from '../ConfirmModal'

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`
  return date.toLocaleDateString('zh-CN')
}

export default function ScanResultContent() {
  const {
    loading,
    scanning,
    scanRecords,
    lastScanResult,
    error,
    fetchScanRecords,
    triggerScan,
    deleteScanRecord,
    clearScanRecords,
    clearError
  } = useScanStore()

  const [selectedSource, setSelectedSource] = useState<'favorite' | 'watch_later'>('favorite')
  const [retentionDays, setRetentionDays] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; recordId?: string }>({ show: false })
  const [clearConfirm, setClearConfirm] = useState(false)
  const [currentFolderIndex, setCurrentFolderIndex] = useState(0)
  const [isScanAnimating, setIsScanAnimating] = useState(false)
  const [scanningFolders, setScanningFolders] = useState<number[]>([])

  useEffect(() => {
    fetchScanRecords()
    
    // 自动清理旧记录
    const saved = localStorage.getItem('scan_record_retention_days')
    if (saved && saved !== 'unlimited') {
      const days = parseInt(saved)
      clearScanRecords(undefined, days).catch(err => {
        console.error('Auto cleanup failed:', err)
      })
    }
  }, [])

  // 定时清理：每小时检查一次
  useEffect(() => {
    const saved = localStorage.getItem('scan_record_retention_days')
    if (saved && saved !== 'unlimited') {
      const days = parseInt(saved)
      const interval = setInterval(() => {
        clearScanRecords(undefined, days).catch(err => {
          console.error('Scheduled cleanup failed:', err)
        })
      }, 3600000) // 每小时
      
      return () => clearInterval(interval)
    }
  }, [])

  const handleTriggerScan = async (sourceType: 'favorite' | 'watch_later') => {
    try {
      setSelectedSource(sourceType)
      setIsScanAnimating(true)
      setCurrentFolderIndex(0)
      setScanningFolders([])
      
      // 模拟扫描动画
      const animInterval = setInterval(() => {
        setScanningFolders(prev => [...prev, prev.length])
      }, 800) // 每800ms扫描一个收藏夹
      
      await triggerScan(sourceType, 'all')
      
      clearInterval(animInterval)
      setIsScanAnimating(false)
    } catch (err) {
      console.error('Scan failed:', err)
      setIsScanAnimating(false)
      setScanningFolders([])
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    setDeleteConfirm({ show: true, recordId })
  }

  const confirmDelete = async () => {
    if (deleteConfirm.recordId) {
      try {
        await deleteScanRecord(deleteConfirm.recordId)
        setDeleteConfirm({ show: false })
      } catch (err) {
        console.error('Delete failed:', err)
        alert('删除失败')
      }
    }
  }

  const handleClearRecords = () => {
    setClearConfirm(true)
  }

  const confirmClear = async () => {
    try {
      await clearScanRecords()
      setClearConfirm(false)
    } catch (err) {
      console.error('Clear failed:', err)
      alert('清空失败')
    }
  }

  const handleRetentionDaysChange = async (days: number | null) => {
    setRetentionDays(days)
    
    try {
      // 清理指定天数之前的记录
      if (days !== null) {
        await clearScanRecords(undefined, days)
      }
      
      // 保存偏好到localStorage
      localStorage.setItem('scan_record_retention_days', days?.toString() || 'unlimited')
    } catch (err) {
      console.error('Failed to update retention days:', err)
    }
  }

  // 初始化时加载用户偏好
  useEffect(() => {
    const saved = localStorage.getItem('scan_record_retention_days')
    if (saved && saved !== 'unlimited') {
      setRetentionDays(parseInt(saved))
    }
  }, [])

  // 逐层显示扫描结果
  useEffect(() => {
    if (lastScanResult && lastScanResult.folders && lastScanResult.folders.length > 0 && !isScanAnimating) {
      setCurrentFolderIndex(0)
      const interval = setInterval(() => {
        setCurrentFolderIndex(prev => {
          if (prev < lastScanResult.folders!.length - 1) {
            return prev + 1
          }
          clearInterval(interval)
          return prev
        })
      }, 150) // 每150ms显示一个收藏夹
      
      return () => clearInterval(interval)
    }
  }, [lastScanResult, isScanAnimating])

  return (
    <div className="scan-result-content">
      {/* 操作按钮区域 */}
      <div className="scan-actions">
        <button
          className="scan-btn scan-btn-favorite"
          onClick={() => handleTriggerScan('favorite')}
          disabled={scanning}
        >
          <Heart size={16} />
          <span>{scanning && selectedSource === 'favorite' ? '扫描中...' : '扫描收藏夹'}</span>
        </button>

        <button
          className="scan-btn scan-btn-watchlater"
          onClick={() => handleTriggerScan('watch_later')}
          disabled={scanning}
        >
          <Clock size={16} />
          <span>扫描稍后再看</span>
        </button>

        <button
          className="scan-btn scan-btn-refresh"
          onClick={() => fetchScanRecords()}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw size={16} className="spinner" />
          ) : (
            <RefreshCw size={16} />
          )}
          <span>刷新记录</span>
        </button>
      </div>

      {/* 扫描中动画显示 */}
      {isScanAnimating && selectedSource === 'favorite' && (
        <div className="scan-last-result scan-animating">
          <h3>扫描中...</h3>
          <div className="folders-list">
            <h4>正在扫描收藏夹</h4>
            <div className="folders-grid">
              {scanningFolders.map((_, index) => (
                <div 
                  key={index} 
                  className="folder-card folder-card-scanning"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="folder-header">
                    <Heart size={14} />
                    <span className="folder-title">收藏夹 {index + 1}</span>
                    <RefreshCw size={14} className="spinner scanning-icon" />
                  </div>
                  <div className="folder-stats">
                    <div className="folder-stat">
                      <span className="folder-stat-label">扫描中</span>
                      <span className="folder-stat-value">...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="scan-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={clearError}>关闭</button>
        </div>
      )}

      {/* 最后扫描结果 */}
      {lastScanResult && !isScanAnimating && (
        <div className="scan-last-result">
          <h3>扫描结果</h3>

          {/* 收藏夹详情列表 - 放在最前面 */}
          {lastScanResult.folders && lastScanResult.folders.length > 0 && (
            <div className="folders-list">
              <h4>收藏夹详情</h4>
              <div className="folders-grid">
                {lastScanResult.folders.slice(0, currentFolderIndex + 1).map((folder, index) => (
                  <div 
                    key={folder.id} 
                    className="folder-card folder-card-animating"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <div className="folder-header">
                      <Heart size={14} />
                      <span className="folder-title">{folder.title}</span>
                    </div>
                    <div className="folder-stats">
                      <div className="folder-stat">
                        <span className="folder-stat-label">视频数</span>
                        <span className="folder-stat-value">{folder.video_count}</span>
                      </div>
                      <div className="folder-stat">
                        <span className="folder-stat-label">新视频</span>
                        <span className="folder-stat-value new">{folder.new_count}</span>
                      </div>
                      <div className="folder-stat">
                        <span className="folder-stat-label">总计</span>
                        <span className="folder-stat-value">{folder.media_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 总体统计 - 放在底部 */}
          <div className="result-stats">
            <div className="stat-item">
              <span className="stat-label">总视频数</span>
              <span className="stat-value">{lastScanResult.total}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">新视频</span>
              <span className="stat-value new">{lastScanResult.new}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">已添加</span>
              <span className="stat-value added">{lastScanResult.added}</span>
            </div>
          </div>
        </div>
      )}

      {/* 扫描记录列表 */}
      <div className="scan-records">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h3 style={{ flex: 1, minWidth: 'auto' }}>扫描记录</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={retentionDays === null ? '' : retentionDays}
              onChange={(e) => handleRetentionDaysChange(e.target.value ? parseInt(e.target.value) : null)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                minWidth: '120px'
              }}
              title="设置记录保留时间"
            >
              <option value="">不限制</option>
              <option value={7}>保留7天</option>
              <option value={30}>保留30天</option>
              <option value={90}>保留90天</option>
              <option value={180}>保留180天</option>
            </select>
            {scanRecords.length > 0 && (
              <button
                className="scan-btn"
                onClick={handleClearRecords}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'transparent',
                  color: 'var(--color-error-600)',
                  border: '1px solid transparent',
                  minWidth: 'auto',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error-50)'
                  e.currentTarget.style.borderColor = 'var(--color-error-300)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                <Trash2 size={14} />
                <span className="desktop-only">清空记录</span>
                <span className="mobile-only" style={{ display: 'none' }}>清空</span>
              </button>
            )}
          </div>
        </div>
        
        {/* 确认对话框 */}
        <ConfirmModal
          isOpen={deleteConfirm.show}
          onClose={() => setDeleteConfirm({ show: false })}
          onConfirm={confirmDelete}
          title="删除扫描记录"
          message="确定要删除这条扫描记录吗？"
          confirmText="删除"
          confirmVariant="danger"
        />
        
        <ConfirmModal
          isOpen={clearConfirm}
          onClose={() => setClearConfirm(false)}
          onConfirm={confirmClear}
          title="清空扫描记录"
          message="确定要清空所有扫描记录吗？此操作不可恢复。"
          confirmText="清空"
          confirmVariant="danger"
        />

        {scanRecords.length === 0 ? (
          <div className="scan-empty">
            <AlertCircle size={32} />
            <p>暂无扫描记录</p>
            <p className="hint">点击上方按钮开始扫描</p>
          </div>
        ) : (
          <div className="records-list">
            {scanRecords.map((record) => (
              <div key={record.id} className="record-item">
                <div className="record-header">
                  <div className="record-source">
                    {record.source_type === 'favorite' ? (
                      <Heart size={14} />
                    ) : (
                      <Clock size={14} />
                    )}
                    <span>
                      {record.source_type === 'favorite' ? '收藏夹' : '稍后再看'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="record-status">
                      {record.status === 'success' ? (
                        <CheckCircle size={14} className="success" />
                      ) : (
                        <XCircle size={14} className="error" />
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      style={{
                        padding: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--color-error-500)',
                        cursor: 'pointer',
                        opacity: 0.7,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                      title="删除此记录"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="record-stats">
                  <div className="record-stat">
                    <span className="label">总视频数</span>
                    <span className="value">{record.total_videos}</span>
                  </div>
                  <div className="record-stat">
                    <span className="label">新视频</span>
                    <span className="value new">{record.new_videos}</span>
                  </div>
                  <div className="record-stat">
                    <span className="label">已添加</span>
                    <span className="value added">{record.added_to_queue}</span>
                  </div>
                </div>

                <div className="record-time">
                  {formatRelativeTime(record.last_scan_time)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}