// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore } from '../../stores/newQueue'
import SchedulerCard from './SchedulerCard'
import { Inbox as EmptyIcon } from 'lucide-react'

export default function VideoLibrary() {
  const { schedulers, fetchSchedulers, connected } = useNewQueueStore()
  
  const schedulerList = Object.values(schedulers)
  const hasSchedulers = schedulerList.length > 0
  
  // 按状态分组
  const groupedSchedulers = {
    active: schedulerList.filter(s => s.state === 'running'), // 执行中
    paused: schedulerList.filter(s => s.state === 'paused'), // 已暂停
    completed: schedulerList.filter(s => s.state === 'completed'), // 已完成
    other: schedulerList.filter(s => !['running', 'paused', 'completed'].includes(s.state)) // 其他状态
  }
  
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
  
  if (!hasSchedulers) {
    return (
      <div className="video-library">
        <div className="empty-state">
          <EmptyIcon size={48} color="#94a3b8" />
          <p>暂无调度器</p>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
            添加系列视频到下载列表后，调度器将在此显示
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="video-library">
      {/* 头部信息 */}
      <div className="library-header">
        <h3>调度器列表</h3>
        <span>共 {schedulerList.length} 个调度器</span>
      </div>
      
      {/* 刷新按钮 */}
      <button 
        className="refresh-btn"
        onClick={handleRefresh}
        disabled={!connected}
      >
        刷新列表
      </button>
      
      {/* 执行中的调度器 */}
      {groupedSchedulers.active.length > 0 && (
        <div className="folder-section">
          <div className="folder-title">
            执行中 ({groupedSchedulers.active.length})
          </div>
          <div className="scheduler-list">
            {groupedSchedulers.active.map(scheduler => (
              <SchedulerCard key={scheduler.id} scheduler={scheduler} />
            ))}
          </div>
        </div>
      )}
      
      {/* 已暂停的调度器 */}
      {groupedSchedulers.paused.length > 0 && (
        <div className="folder-section">
          <div className="folder-title">
            已暂停 ({groupedSchedulers.paused.length})
          </div>
          <div className="scheduler-list">
            {groupedSchedulers.paused.map(scheduler => (
              <SchedulerCard key={scheduler.id} scheduler={scheduler} />
            ))}
          </div>
        </div>
      )}
      
      {/* 已完成的调度器 */}
      {groupedSchedulers.completed.length > 0 && (
        <div className="folder-section">
          <div className="folder-title">
            已完成 ({groupedSchedulers.completed.length})
          </div>
          <div className="scheduler-list">
            {groupedSchedulers.completed.map(scheduler => (
              <SchedulerCard key={scheduler.id} scheduler={scheduler} />
            ))}
          </div>
        </div>
      )}
      
      {/* 其他状态的调度器 */}
      {groupedSchedulers.other.length > 0 && (
        <div className="folder-section">
          <div className="folder-title">
            其他 ({groupedSchedulers.other.length})
          </div>
          <div className="scheduler-list">
            {groupedSchedulers.other.map(scheduler => (
              <SchedulerCard key={scheduler.id} scheduler={scheduler} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}