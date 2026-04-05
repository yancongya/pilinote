// components/NewDownload/VideoLibrary.tsx
import { useNewQueueStore } from '../../stores/newQueue'
import SchedulerCard from './SchedulerCard'
import TaskCard from './TaskCard'
import { Inbox as EmptyIcon } from 'lucide-react'
import { useMemo, useEffect } from 'react'
import { getApiUrl } from '../../config/api'

export default function VideoLibrary() {
  const { schedulers, tasks, connected, fetchTasks } = useNewQueueStore()

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

  // 获取所有已完成任务的实时文件大小
  useEffect(() => {
    const fetchTaskFileSizes = async () => {
      const completedTaskIds = completedItems
        .filter(item => item.type === 'task')
        .map(item => item.data.id)

      if (completedTaskIds.length === 0) return

      try {
        // 并行获取所有任务的文件大小
        const promises = completedTaskIds.map(taskId =>
          fetch(getApiUrl(`/api/queue/tasks/${taskId}/file-size`))
            .catch(error => {
              console.error(`Failed to fetch file size for task ${taskId}:`, error)
              return null
            })
        )

        const responses = await Promise.all(promises)

        // 检查是否有任何一个响应成功
        const hasSuccess = responses.some(response => response && response.ok)

        if (hasSuccess) {
          // 重新获取任务列表以更新缓存
          await fetchTasks()
        }
      } catch (error) {
        console.error('Failed to fetch task file sizes:', error)
      }
    }

    if (hasCompleted) {
      fetchTaskFileSizes()
    }
  }, [hasCompleted, completedItems, fetchTasks])

  // 计算统计信息
  const stats = useMemo(() => {
    const totalVideos = completedItems.reduce((acc, item) => {
      if (item.type === 'task') {
        return acc + 1
      } else {
        return acc + item.data.list.length
      }
    }, 0)

    const totalSize = completedItems.reduce((acc, item) => {
      if (item.type === 'task') {
        return acc + (item.data.meta?.totalSize || 0)
      } else {
        // 计算调度器的总大小
        return acc + item.data.list.reduce((sum, taskId) => {
          const task = tasks[taskId]
          return sum + (task?.meta?.totalSize || 0)
        }, 0)
      }
    }, 0)

    const totalCollections = completedItems.filter(item => item.type === 'scheduler').length
    const totalSingleVideos = completedItems.filter(item => item.type === 'task').length

    return {
      totalVideos,
      totalSize,
      totalCollections,
      totalSingleVideos
    }
  }, [completedItems, tasks])

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
        <div className="library-stats">
          <span>{stats.totalVideos} 个视频</span>
          {stats.totalSize > 0 && (
            <>
              <span className="stats-divider">·</span>
              <span>{formatFileSize(stats.totalSize)}</span>
            </>
          )}
        </div>
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