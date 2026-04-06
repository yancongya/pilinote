import { useEffect, useState } from 'react'
import { useScanStore } from '../../stores/scanStore'
import { RefreshCw, Heart, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react'

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

  useEffect(() => {
    fetchScanRecords()
  }, [])

  const handleTriggerScan = async (sourceType: 'favorite' | 'watch_later') => {
    try {
      setSelectedSource(sourceType)
      await triggerScan(sourceType, 'all')
    } catch (err) {
      console.error('Scan failed:', err)
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('确定要删除这条扫描记录吗？')) {
      return
    }
    
    try {
      await deleteScanRecord(recordId)
    } catch (err) {
      console.error('Delete failed:', err)
      alert('删除失败')
    }
  }

  const handleClearRecords = async () => {
    if (!confirm('确定要清空所有扫描记录吗？')) {
      return
    }
    
    try {
      await clearScanRecords()
    } catch (err) {
      console.error('Clear failed:', err)
      alert('清空失败')
    }
  }

  return (
    <div className="scan-result-content">
      {/* 操作按钮区域 */}
      <div className="scan-actions">
        <button
          className="scan-btn scan-btn-favorite"
          onClick={() => handleTriggerScan('favorite')}
          disabled={scanning}
        >
          <Heart size={16} className={scanning ? 'scanning' : ''} />
          <span>扫描收藏夹</span>
          {scanning && selectedSource === 'favorite' && <RefreshCw size={14} className="spinner" />}
        </button>

        <button
          className="scan-btn scan-btn-watchlater"
          onClick={() => handleTriggerScan('watch_later')}
          disabled={scanning}
        >
          <Clock size={16} className={scanning ? 'scanning' : ''} />
          <span>扫描稍后再看</span>
          {scanning && selectedSource === 'watch_later' && <RefreshCw size={14} className="spinner" />}
        </button>

        <button
          className="scan-btn scan-btn-refresh"
          onClick={() => fetchScanRecords()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'scanning' : ''} />
          <span>刷新记录</span>
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="scan-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={clearError}>关闭</button>
        </div>
      )}

      {/* 最后扫描结果 */}
      {lastScanResult && (
        <div className="scan-last-result">
          <h3>扫描结果</h3>

          {/* 收藏夹详情列表 - 放在最前面 */}
          {lastScanResult.folders && lastScanResult.folders.length > 0 && (
            <div className="folders-list">
              <h4>收藏夹详情</h4>
              <div className="folders-grid">
                {lastScanResult.folders.map((folder) => (
                  <div key={folder.id} className="folder-card">
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
          marginBottom: '16px'
        }}>
          <h3>扫描记录</h3>
          {scanRecords.length > 0 && (
            <button
              className="scan-btn"
              onClick={handleClearRecords}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5'
              }}
            >
              <Trash2 size={14} />
              <span>清空记录</span>
            </button>
          )}
        </div>
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
                        color: '#ef4444',
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