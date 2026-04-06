import { useEffect, useState } from 'react'
import { useScanStore } from '../../stores/scanStore'
import { RefreshCw, Heart, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

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
        <h3>扫描记录</h3>
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
                  <div className="record-status">
                    {record.status === 'success' ? (
                      <CheckCircle size={14} className="success" />
                    ) : (
                      <XCircle size={14} className="error" />
                    )}
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