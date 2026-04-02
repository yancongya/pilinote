import { useCallback } from 'react'
import { useNewQueueStore } from '../stores/newQueue'

/**
 * 检查视频是否在新下载系统中
 */
export function useNewDownloadStatus() {
  const { tasks } = useNewQueueStore()

  /**
   * 检查视频是否已添加到新下载系统
   * @param bvid - 视频BV号
   * @returns 'in_list' 或 'not_in_list'
   */
  const getNewDownloadStatus = useCallback((bvid: string): 'in_list' | 'not_in_list' => {
    // 检查是否有未完成的任务
    const hasTask = Object.values(tasks).some(
      task => task.media_id === bvid && 
!['completed', 'cancelled'].includes(task.state)
    )
    return hasTask ? 'in_list' : 'not_in_list'
  }, [tasks])

  return {
    getNewDownloadStatus
  }
}