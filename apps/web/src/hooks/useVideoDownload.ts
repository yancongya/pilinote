import { useCallback } from 'react'
import { apiService } from '../services/api'
import { useNewQueueStore } from '../stores/newQueue'

/**
 * 视频基本信息接口
 * 适用于 FavoritesContent 和 WatchLaterContent 组件中的视频对象
 */
export interface VideoInfo {
  /** 视频 BV 号 */
  bvid: string
  /** 视频标题 */
  title: string
  /** 封面图片 URL（可能存在于 cover 或 pic 字段） */
  cover?: string
  pic?: string
  /** 原始时长（秒） */
  originalDuration?: number
  durationSeconds?: number
  /** 视频分集 CID */
  cid?: number
  /** 视频 AID */
  aid?: number
  /** 视频所有者信息（可能存在于 owner 或 uploader 字段） */
  owner?: {
    name?: string
    mid?: number
  }
  uploader?: {
    name?: string
    mid?: number
  }
}

/**
 * 视频详情接口
 */
export interface VideoDetail {
  aid?: number
  cid?: number
  duration?: number
  pages?: Array<{
    page: number
    cid: number
    part: string
    duration: number
  }>
  owner?: {
    name?: string
    mid?: number
  }
}

/**
 * useVideoDownload Hook
 * 处理单个视频的下载切换逻辑，包括多P视频检测和处理
 *
 * @returns toggleDownload - 切换视频下载状态的函数
 */
export function useVideoDownload() {
  const newQueueStore = useNewQueueStore()

  /**
   * 切换视频下载状态
   * 如果视频在下载列表中，则移除；否则添加到下载列表
   *
   * @param video - 视频信息对象
   * @param e - 鼠标事件（用于阻止事件冒泡）
   * @returns 操作结果 {success: boolean, message: string, shouldNavigateToLibrary?: boolean}
   */
  const toggleDownload = useCallback(async (video: VideoInfo, e: React.MouseEvent): Promise<{success: boolean, message: string, shouldNavigateToLibrary?: boolean}> => {
    // 阻止事件冒泡，避免触发父元素的事件
    e.stopPropagation()

    // 防止重复点击
    const button = e.currentTarget as HTMLButtonElement
    if (button.disabled) return {success: false, message: '操作进行中'}
    button.disabled = true

    const resetButton = () => {
      button.disabled = false
    }

    try {
      // 使用新的下载系统
      const sessdata = localStorage.getItem('sessdata')
        const currentTasks = newQueueStore.tasks
        const existingTask = Object.values(currentTasks).find(t => t.media_id === video.bvid)
        
        // 检查是否已经在新系统中（检查未完成的任务）
        const isInNewQueue = existingTask && !['completed', 'cancelled'].includes(existingTask.state)
        
        // 检查是否已下载完成
        const isDownloaded = existingTask && existingTask.state === 'completed'

        if (isInNewQueue) {
          // 从新下载系统移除（标记为取消）
          // 找出所有相同 bvid 的任务（系列视频可能有多个分P）
          const allTasks = Object.values(currentTasks).filter(t => 
            t.media_id === video.bvid && 
            !['completed', 'cancelled'].includes(t.state)
          )
          
          if (allTasks.length === 0) {
            resetButton()
            return {success: false, message: '任务不存在'}
          }
          
          try {
            // 取消所有相关任务
            for (const task of allTasks) {
              await newQueueStore.controlTask(task.id, 'cancelled')
            }
            // 立即刷新任务列表，确保状态更新
            await newQueueStore.fetchTasks()
            resetButton()
            const message = allTasks.length > 1 
              ? `已从下载列表移除 ${allTasks.length} 个视频` 
              : '已从下载列表移除'
            return {success: true, message}
          } catch (error) {
            console.error('从下载列表移除失败:', error)
            resetButton()
            return {success: false, message: '从下载列表移除失败'}
          }
        } else if (isDownloaded) {
          // 已下载完成，不允许操作
          resetButton()
          return {success: false, message: '视频已下载完成，请到视频库查看'}
        } else {
          // 添加到新下载系统
          try {
            const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)

            if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
              const pages = videoDetailResponse.data.pages
              const videoDetailData = videoDetailResponse.data as VideoDetail

              if (pages.length > 1) {
                // 多P视频：按照BiliTools方案，创建调度器统一管理
                
                // 步骤1：为每个分P创建任务并提交到backlog
                const taskIds: string[] = []
                let addedCount = 0

                for (const page of pages) {
                  try {
                    const taskData = {
                      title: page.part || `${video.title} - P${page.page}`,
                      media_type: 'video',
                      media_id: video.bvid,
                      cover: video.pic || video.cover || '',
                      desc: `CID: ${page.cid}`,
                      meta: {
                        cid: page.cid,
                        page: page.page,
                        part_title: page.part
                      }
                    }

                    const response = await apiService.submitTask(taskData)
                    if (response.success && response.data) {
                      taskIds.push(response.data.id)
                      addedCount++
                    }
                  } catch (error) {
                    console.error(`添加分集任务失败: ${page.part}`, error)
                  }
                }

                if (addedCount === 0) {
                  throw new Error('所有分集添加失败')
                }

                // 步骤2：创建调度器，使用收集到的任务ID
                const folderName = `系列-${video.title.replace(/[\/\\:*?"<>|]/g, '_')}`
                
                // Get user settings to use configured download path
                const { useSettingsStore } = await import('../stores/settings')
                const settingsStore = useSettingsStore.getState()
                
                // Fetch settings if not already loaded
                if (!settingsStore.settings) {
                  await settingsStore.fetchSettings()
                }
                
                // Use download path from settings or fallback to default
                const downloadPath = settingsStore.settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads'
                const folderPath = `${downloadPath}/${folderName}`

                const schedulerResponse = await apiService.createScheduler({
                  title: video.title,
                  task_ids: taskIds,
                  folder: folderPath
                })

                if (!schedulerResponse.success || !schedulerResponse.data) {
                  throw new Error(schedulerResponse.message || '创建调度器失败')
                }

                const _schedulerId = schedulerResponse.data.id
                void _schedulerId

                // 立即刷新任务列表，确保状态更新
                await newQueueStore.fetchTasks()
                return {success: true, message: `已添加 ${addedCount} 个视频到下载列表`}
              } else {
                // 单P视频，使用视频详情API返回的数据（更准确）
                const taskData = {
                  title: video.title,
                  media_type: 'video',
                  media_id: video.bvid,
                  cover: video.pic || video.cover || '',
                  desc: `CID: ${videoDetailData.cid || pages[0]?.cid}`,
                  meta: {
                    cid: videoDetailData.cid || pages[0]?.cid
                  }
                }

                try {
                  const response = await apiService.submitTask(taskData)
                  if (response.success) {
                    // 立即刷新任务列表，确保状态更新
                    await newQueueStore.fetchTasks()
                    return {success: true, message: '已添加到下载队列'}
                  } else {
                    return {success: false, message: '添加到下载队列失败: ' + (response.message || '未知错误')}
                  }
                } catch (error) {
                  console.error('添加任务失败:', error)
                  return {success: false, message: '添加到下载队列失败'}
                }
              }
            } else {
              // 获取视频详情失败，降级为直接添加（使用现有数据）
              console.error('获取视频详情失败，降级为直接添加')

              const taskData = {
                title: video.title,
                media_type: 'video',
                media_id: video.bvid,
                cover: video.pic || video.cover || '',
                desc: video.cid || video.aid ? `CID: ${video.cid || video.aid}` : '',
                meta: video.cid ? { cid: video.cid } : undefined
              }

              try {
                const response = await apiService.submitTask(taskData)
                if (response.success) {
                  // 立即刷新任务列表，确保状态更新
                  await newQueueStore.fetchTasks()
                  return {success: true, message: '已添加到下载队列'}
                } else {
                  return {success: false, message: '添加到下载队列失败: ' + (response.message || '未知错误')}
                }
              } catch (error) {
                console.error('添加任务失败:', error)
                return {success: false, message: '添加到下载队列失败'}
              }
            }
          } catch (error) {
            // 获取视频详情失败，降级为直接添加（使用现有数据）
            console.error('获取视频详情失败，降级为直接添加:', error)

            const taskData = {
              title: video.title,
              media_type: 'video',
              media_id: video.bvid,
              cover: video.pic || video.cover || '',
              desc: video.cid || video.aid ? `CID: ${video.cid || video.aid}` : '',
              meta: video.cid ? { cid: video.cid } : undefined
            }

            try {
              const response = await apiService.submitTask(taskData)
              if (response.success) {
                // 立即刷新任务列表，确保状态更新
                await newQueueStore.fetchTasks()
                return {success: true, message: '已添加到下载队列'}
              } else {
                return {success: false, message: '添加到下载队列失败: ' + (response.message || '未知错误')}
              }
            } catch (error) {
              console.error('添加任务失败:', error)
              return {success: false, message: '添加到下载队列失败'}
            }
          }
      }
    } finally {
      // 恢复按钮状态
      button.disabled = false
    }
  }, [newQueueStore])

  return {
    toggleDownload
  }
}