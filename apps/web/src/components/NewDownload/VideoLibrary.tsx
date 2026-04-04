// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore } from '../../stores/newQueue'
import SchedulerCard from './SchedulerCard'
import TaskCard from './TaskCard'
import { Inbox as EmptyIcon } from 'lucide-react'
import { useMemo } from 'react'

export default function VideoLibrary() {
  const { schedulers, tasks, connected } = useNewQueueStore()
  
  const schedulerList = Object.values(schedulers)
  const taskList = Object.values(tasks)
  
  // 使用 useMemo 计算所有已完成的内容
  const completedItems = useMemo(() => {
    // 获取所有已完成的调度器ID
    const completedSchedulerIds = new Set(
      schedulerList
        .filter(s => s.state === 'completed')
        .map(s => s.id)
    )
    
    // 获取已完成的单个任务（不属于任何已完成调度器的已完成任务）
    const completedTasks = taskList.filter(t => 
      t.state === 'completed' && 
      !t.schedulerId && 
      !completedSchedulerIds.has(t.schedulerId || '')
    )
    
    // 获取已完成的调度器
    const completedSchedulers = schedulerList.filter(s => s.state === 'completed')
    
    // 合并所有已完成的项目
    return [
      ...completedTasks.map(task => ({ type: 'task' as const, data: task })),
      ...completedSchedulers.map(scheduler => ({ type: 'scheduler' as const, data: scheduler }))
    ]
  }, [schedulerList, taskList])
  
  const hasCompleted = completedItems.length > 0
  
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
            已下载完成的视频将在此显示
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
        <span>共 {completedItems.length} 个视频</span>
      </div>
      
      {/* 已完成的项目列表 */}
      <div className="scheduler-list">
        {completedItems.map((item, index) => {
          if (item.type === 'task') {
            return <TaskCard key={`task-${item.data.id}-${index}`} task={item.data} />
          } else {
            return <SchedulerCard key={`scheduler-${item.data.id}-${index}`} scheduler={item.data} />
          }
        })}
      </div>
    </div>
  )
}