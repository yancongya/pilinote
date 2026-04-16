import { useEffect } from 'react'
import { useNewQueueStore } from '../stores/newQueue'

/**
 * 下载列表同步 Hook
 * 自动同步下载列表，每30秒同步一次
 * 已迁移到新的队列系统
 */
export function useDownloadSync() {
  const fetchTasks = useNewQueueStore((state) => state.fetchTasks)
  const fetchSchedulers = useNewQueueStore((state) => state.fetchSchedulers)

  useEffect(() => {
    // 初始同步
    fetchTasks()
    fetchSchedulers()

    // 每30秒同步一次
    const interval = setInterval(() => {
      fetchTasks()
      fetchSchedulers()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchTasks, fetchSchedulers])
}