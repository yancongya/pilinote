import { useState } from 'react'
import { apiService } from '../services/api'
import { useNewQueueStore } from '../stores/newQueue'

/**
 * Video type definition for batch download
 */
export interface Video {
  id: string
  bvid: string
  title: string
  cid?: number
  aid?: number
  cover?: string
  pic?: string
  originalDuration?: number
  duration?: number
  uploader?: string
  uploader_mid?: number
  owner?: {
    name?: string
    mid?: number
  }
}

/**
 * Parameters for useBatchDownload hook
 */
export interface UseBatchDownloadParams {
  videos: Video[]
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
}

/**
 * Return type for useBatchDownload hook
 */
export interface UseBatchDownloadReturn {
  batchMode: boolean
  setBatchMode: (mode: boolean) => void
  selectedVideos: Set<string>
  toggleVideoSelection: (videoId: string) => void
  toggleSelectAll: () => void
  batchDownloadSelected: () => Promise<void>
  clearSelection: () => void
}

/**
 * Custom hook for batch download functionality
 *
 * Provides state management and functions for batch selecting and downloading videos.
 * Uses the new queue system (Task and Scheduler) instead of the old download system.
 * Used in FavoritesContent and WatchLaterContent components.
 *
 * @param params - Hook parameters
 * @param params.videos - Array of videos to select from
 * @param params.setLoading - Function to set loading state
 * @param params.setError - Function to set error message
 *
 * @returns Object containing batch download state and functions
 *
 * @example
 * ```typescript
 * const {
 *   batchMode,
 *   setBatchMode,
 *   selectedVideos,
 *   toggleVideoSelection,
 *   toggleSelectAll,
 *   batchDownloadSelected,
 *   clearSelection
 * } = useBatchDownload({
 *   videos: videoList,
 *   setLoading: setLoading,
 *   setError: setError
 * })
 * ```
 */
export function useBatchDownload({
  videos,
  setLoading,
  setError
}: UseBatchDownloadParams): UseBatchDownloadReturn {
  const newQueueStore = useNewQueueStore()

  // Batch selection mode state
  const [batchMode, setBatchMode] = useState(false)

  // Selected videos state (Set of video IDs)
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())

  // Custom setBatchMode with auto-selection
  const setBatchModeWithAutoSelect = (mode: boolean) => {
    setBatchMode(mode)

    // When entering batch mode, auto-select videos already in queue
    if (mode) {
      const tasks = Object.values(newQueueStore.tasks)
      const videoIdsInQueue = new Set<string>()

      for (const video of videos) {
        const exists = tasks.some(task =>
          task.media_id === video.bvid &&
          !['completed', 'cancelled'].includes(task.state)
        )
        if (exists) {
          videoIdsInQueue.add(video.id)
        }
      }

      if (videoIdsInQueue.size > 0) {
        setSelectedVideos(videoIdsInQueue)
        console.log(`Auto-selected ${videoIdsInQueue.size} videos that are already in queue`)
      }
    }
  }

  /**
   * Toggle selection of a single video
   * @param videoId - ID of the video to toggle
   */
  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideos)
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId)
    } else {
      newSelected.add(videoId)
    }
    setSelectedVideos(newSelected)
  }

  /**
   * Toggle select all / deselect all videos
   */
  const toggleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      // Deselect all
      setSelectedVideos(new Set())
    } else {
      // Select all
      setSelectedVideos(new Set(videos.map(v => v.id)))
    }
  }

  /**
   * Clear selection and exit batch mode
   */
  const clearSelection = () => {
    setBatchMode(false)
    setSelectedVideos(new Set())
  }

  /**
   * Batch download selected videos
   *
   * Iterates through selected videos and adds them to the new queue system.
   * - For single-part videos: creates individual tasks
   * - For multi-part videos: creates scheduler with all parts
   * Tasks are added to backlog state (not auto-activated)
   */
  const batchDownloadSelected = async () => {
    console.log('batchDownloadSelected called', { selectedVideos, videos })

    if (selectedVideos.size === 0) {
      alert('请先选择要下载的视频')
      return
    }

    if (!confirm(`确定要添加选中的 ${selectedVideos.size} 个视频到下载列表吗？`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      let videoSuccessCount = 0
      let videoFailCount = 0
      let videoDuplicateCount = 0
      let partSuccessCount = 0
      let schedulerCount = 0

      // Import auth store to get user sessdata
      const { useAuthStore } = await import('../stores/auth')
      const user = useAuthStore.getState().user

      // Process each selected video
      for (const video of videos) {
        if (!selectedVideos.has(video.id)) continue

        // Check if video (any part) is already in queue
        const tasks = Object.values(newQueueStore.tasks)
        const exists = tasks.some(task => 
          task.media_id === video.bvid && 
          !['completed', 'cancelled'].includes(task.state)
        )
        
        if (exists) {
          videoDuplicateCount++
          console.log(`Video already in queue: ${video.title}`)
          continue
        }

        try {
          // Get video details to check if it's multi-part
          const videoDetailResponse = await apiService.getVideoDetail(video.bvid, user?.sessdata)

          if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
            const pages = videoDetailResponse.data.pages
            const videoDetailData = videoDetailResponse.data

            if (pages.length > 1) {
              // Multi-part video: create scheduler
              console.log(`Multi-part video detected: ${video.title} with ${pages.length} parts`)

              const taskIds: string[] = []
              let addedParts = 0

              // Create task for each part
              for (const page of pages) {
                try {
                  const taskData = {
                    title: page.part || `${video.title} - P${page.page}`,
                    media_type: 'video',
                    media_id: video.bvid,
                    cover: video.pic || video.cover || '',
                    desc: `CID: ${page.cid}`
                  }

                  const response = await apiService.submitTask(taskData)
                  if (response.success && response.data) {
                    taskIds.push(response.data.id)
                    addedParts++
                    partSuccessCount++
                  }
                } catch (error) {
                  console.error(`Failed to add part ${page.page}:`, error)
                }
              }

              if (addedParts === 0) {
                throw new Error(`视频 "${video.title}" 的所有分集添加失败`)
              }

              // Create scheduler for multi-part video
              const folderName = `系列-${video.title.replace(/[\/\\:*?"<>|]/g, '_')}`
              const folderPath = `/Users/tanyancong/工作/开发/pilinote/apps/api/downloads/${folderName}`

              const schedulerResponse = await apiService.createScheduler({
                title: video.title,
                task_ids: taskIds,
                folder: folderPath
              })

              if (!schedulerResponse.success) {
                throw new Error(schedulerResponse.message || '创建调度器失败')
              }

              schedulerCount++
              videoSuccessCount++
              console.log(`Created scheduler for multi-part video: ${video.title}`)
            } else {
              // Single-part video
              const taskData = {
                title: video.title,
                media_type: 'video',
                media_id: video.bvid,
                cover: video.pic || video.cover || '',
                desc: `CID: ${videoDetailData.cid || pages[0]?.cid}`
              }

              const response = await apiService.submitTask(taskData)
              if (response.success) {
                videoSuccessCount++
              } else {
                throw new Error(response.message || '添加任务失败')
              }
            }
          } else {
            // Failed to get video details, fallback to basic task
            console.warn(`Failed to get video details for ${video.bvid}, using basic task`)

            const taskData = {
              media_type: 'video',
              media_id: video.bvid || '',
              title: video.title || '',
              cover: video.cover || video.pic || '',
              meta: {
                bvid: video.bvid,
                aid: video.aid,
                cid: video.cid,
                duration: video.originalDuration || video.duration,
                owner: video.owner,
                uploader: video.uploader,
                uploader_mid: video.uploader_mid
              }
            }

            const response = await apiService.submitTask(taskData)
            if (response.success) {
              videoSuccessCount++
            } else {
              throw new Error(response.message || '添加任务失败')
            }
          }
        } catch (err) {
          videoFailCount++
          console.error(`Failed to add video: ${video.title}`, err)
        }
      }

      // Sync tasks and schedulers from server
      await newQueueStore.fetchTasks()
      await newQueueStore.fetchSchedulers()

      // Build result message
      let message = `成功添加 ${videoSuccessCount} 个视频`
      if (partSuccessCount > 0) {
        message += ` (${partSuccessCount} 个分集)`
      }
      if (schedulerCount > 0) {
        message += `，创建了 ${schedulerCount} 个系列调度器`
      }
      if (videoDuplicateCount > 0) {
        message += `，跳过 ${videoDuplicateCount} 个已在列表中的视频`
      }
      if (videoFailCount > 0) {
        message += `，失败 ${videoFailCount} 个`
      }

      alert(message)
      clearSelection()

    } catch (err) {
      console.error('Batch add failed:', err)
      setError(`批量添加失败: ${err instanceof Error ? err.message : '未知错误'}`)
      alert(`批量添加失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  return {
    batchMode,
    setBatchMode: setBatchModeWithAutoSelect,
    selectedVideos,
    toggleVideoSelection,
    toggleSelectAll,
    batchDownloadSelected,
    clearSelection
  }
}