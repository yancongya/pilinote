// components/NewDownload/DownloadsList.tsx
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useNewQueueStore } from '../../stores/newQueue'
import TaskCard from './TaskCard'
import SchedulerCard from './SchedulerCard'

export default function DownloadsList() {
  const { filterStatus, setFilterStatus, getFilteredTasks, fetchTasks, fetchSchedulers, schedulers } = useNewQueueStore()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const filteredTasks = getFilteredTasks()

  // 按调度器分组
  const schedulerTasks = filteredTasks.filter(t => t.schedulerId)
  const independentTasks = filteredTasks.filter(t => !t.schedulerId)

  const groupedByScheduler = schedulerTasks.reduce((acc, task) => {
    const sid = task.schedulerId!
    if (!acc[sid]) acc[sid] = []
    acc[sid].push(task)
    return acc
  }, {} as Record<string, typeof schedulerTasks>)

  // 刷新任务列表
  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchTasks(),
        fetchSchedulers()
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  // 清除缓存
  const handleClearCache = () => {
    if (!confirm('确定要清除本地缓存吗？这将重新从服务器加载所有数据。')) {
      return
    }
    localStorage.removeItem('new-queue-storage')
    window.location.reload()
  }

  return (
    <div className="downloads-list">
      {/* 过滤器 */}
      <div className="filter-bar">
        <label htmlFor="status-filter" className="sr-only">筛选状态</label>
        <select
          id="status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="all">全部</option>
          <option value="backlog">待处理</option>
          <option value="active">下载中</option>
          <option value="paused">已暂停</option>
          <option value="failed">失败</option>
          <option value="completed">已完成</option>
        </select>

        {/* 刷新按钮 */}
        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="刷新任务列表"
          title="刷新任务列表"
        >
          <RefreshCw size={16} className={isRefreshing ? 'rotating' : ''} />
          <span>刷新</span>
        </button>

        {/* 清除缓存按钮 */}
        <button
          className="refresh-button"
          onClick={handleClearCache}
          aria-label="清除本地缓存"
          title="清除本地缓存数据"
          style={{ marginLeft: '8px' }}
        >
          <span>清除缓存</span>
        </button>
      </div>

      {/* 调度器任务 */}
      {Object.entries(groupedByScheduler).map(([sid]) => {
        const scheduler = schedulers[sid]
        if (!scheduler) return null
        return (
          <SchedulerCard key={sid} scheduler={scheduler} />
        )
      })}

      {/* 独立任务 */}
      {independentTasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}

      {filteredTasks.length === 0 && (
        <div className="empty-state" role="status">
          <p>暂无下载任务</p>
        </div>
      )}
    </div>
  )
}
