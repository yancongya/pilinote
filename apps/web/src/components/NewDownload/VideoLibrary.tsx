// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore } from '../../stores/newQueue'
import SchedulerCard from './SchedulerCard'
import { Inbox as EmptyIcon } from 'lucide-react'

export default function VideoLibrary() {
  const { schedulers, fetchSchedulers, connected } = useNewQueueStore()
  
  const schedulerList = Object.values(schedulers)
  const hasSchedulers = schedulerList.length > 0
  
  // 视频库只显示已完成的调度器
  const completedSchedulers = schedulerList.filter(s => s.state === 'completed')
  const hasCompleted = completedSchedulers.length > 0
  
  const handleRefresh = async () => {
    try {
      await fetchSchedulers()
    } catch (error) {
      console.error('Failed to refresh schedulers:', error)
      alert('刷新失败，请重试')
    }
  }
  
  if (!connected) {
    return (
      <div className="video-library">
        <div className="connection-status disconnected">
          <EmptyIcon size={16} />
          <span>WebSocket 未连接，请检查后端服务</span>
        </div>
      </div>
    )
  }
  
  if (!hasCompleted) {
    return (
      <div className="video-library">
        <div className="empty-state">
          <EmptyIcon size={48} color="#94a3b8" />
          <p>暂无已下载的视频</p>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
            已下载完成的系列视频将在此显示
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="video-library">
      {/* 头部信息 */}
      <div className="library-header">
        <h3>已下载的视频</h3>
        <span>共 {completedSchedulers.length} 个合集</span>
      </div>
      
      {/* 刷新按钮 */}
      <button 
        className="refresh-btn"
        onClick={handleRefresh}
        disabled={!connected}
      >
        刷新列表
      </button>
      
      {/* 已完成的调度器 */}
      <div className="scheduler-list">
        {completedSchedulers.map(scheduler => (
          <SchedulerCard key={scheduler.id} scheduler={scheduler} />
        ))}
      </div>
    </div>
  )
}