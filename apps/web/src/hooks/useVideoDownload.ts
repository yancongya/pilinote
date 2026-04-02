import { useCallback } from 'react'
import { apiService } from '../services/api'
import { useDownloadStore } from '../stores/download'
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
 * @param useNewSystem - 是否使用新的下载系统（默认为 false）
 * @returns toggleDownload - 切换视频下载状态的函数
 */
export function useVideoDownload(useNewSystem: boolean = false) {
  const downloadStore = useDownloadStore()
  const newQueueStore = useNewQueueStore()

  /**
   * 切换视频下载状态
   * 如果视频在下载列表中，则移除；否则添加到下载列表
   *
   * @param video - 视频信息对象
   * @param e - 鼠标事件（用于阻止事件冒泡）
   */
  const toggleDownload = useCallback(async (video: VideoInfo, e: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发父元素的事件
    e.stopPropagation()

    // 防止重复点击
    const button = e.currentTarget as HTMLButtonElement
    if (button.disabled) return
    button.disabled = true

    try {
      if (useNewSystem) {
        // 使用新的下载系统
        const sessdata = localStorage.getItem('sessdata')
        const currentTasks = newQueueStore.tasks
        const existingTask = Object.values(currentTasks).find(t => t.media_id === video.bvid)
        
        // 检查是否已经在新系统中（检查未完成的任务）
        const isInNewQueue = existingTask && 
!['completed', 'cancelled'].includes(existingTask.state)

        if (isInNewQueue) {
          // 从新下载系统移除（标记为取消）
          if (existingTask && existingTask.id) {
            try {
              await newQueueStore.controlTask(existingTask.id, 'cancelled')
              alert('已从下载列表移除')
            } catch (error) {
              console.error('从下载列表移除失败:', error)
              alert('从下载列表移除失败')
            }
          }
        } else {
          // 添加到新下载系统
          try {
            const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)

            if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
              const pages = videoDetailResponse.data.pages
              const videoDetailData = videoDetailResponse.data as VideoDetail

              if (pages.length > 1) {
                // 多P视频，添加所有分集
                let addedCount = 0

                // 为每个分集创建下载任务
                const addPromises = pages.map(async (page: any) => {
                  const taskData = {
                    title: page.part || `${video.title} - P${page.page}`,
                    media_type: 'video',
                    media_id: video.bvid,
                    cover: video.pic || video.cover || '',
                    desc: `CID: ${page.cid}`
                  }

                  try {
                    await newQueueStore.submitTask(taskData)
                    return { success: true }
                  } catch (error) {
                    console.error('添加分集任务失败:', error)
                    return { success: false }
                  }
                })

                // 并发执行所有分集的添加操作
                const results = await Promise.all(addPromises)

                // 统计成功的数量
                addedCount = results.filter(r => r.success).length

                // 显示结果提示
                alert(`已添加 ${addedCount} 个分集到下载队列`)
              } else {
                // 单P视频，使用视频详情API返回的数据（更准确）
                const taskData = {
                  title: video.title,
                  media_type: 'video',
                  media_id: video.bvid,
                  cover: video.pic || video.cover || '',
                  desc: `CID: ${videoDetailData.cid || pages[0]?.cid}`
                }

                try {
                  await newQueueStore.submitTask(taskData)
                  alert('已添加到下载队列')
                } catch (error) {
                  console.error('添加任务失败:', error)
                  alert('添加到下载队列失败')
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
                desc: video.cid || video.aid ? `CID: ${video.cid || video.aid}` : ''
              }

              try {
                await newQueueStore.submitTask(taskData)
                alert('已添加到下载队列')
              } catch (error) {
                console.error('添加任务失败:', error)
                alert('添加到下载队列失败')
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
              desc: video.cid || video.aid ? `CID: ${video.cid || video.aid}` : ''
            }

            try {
              await newQueueStore.submitTask(taskData)
              alert('已添加到下载队列')
            } catch (error) {
              console.error('添加任务失败:', error)
              alert('添加到下载队列失败')
            }
          }
        }
      } else {
        // 使用旧的下载系统
        const currentStatus = downloadStore.getDownloadStatus(video.bvid)

        if (currentStatus === 'in_list') {
          // 从下载列表移除
          const success = await downloadStore.removeFromDownloadListByBvid(video.bvid)
          if (!success) {
            alert('从下载列表移除失败')
          }
        } else {
          // 添加到下载列表
          const sessdata = localStorage.getItem('sessdata')

          // 先获取视频详情，检查是否是多P视频
          try {
            const videoDetailResponse = await apiService.getVideoDetail(video.bvid, sessdata || undefined)

            if (videoDetailResponse.success && videoDetailResponse.data?.pages) {
              const pages = videoDetailResponse.data.pages
              const videoDetailData = videoDetailResponse.data as VideoDetail

              if (pages.length > 1) {
                // 多P视频，添加所有分集
                let addedCount = 0
                let skippedCount = 0

                // 为每个分集创建下载任务
                const addPromises = pages.map(async (page: any) => {
                  // 检查是否已经有相同的cid在下载列表中（避免重复下载）
                  if (downloadStore.isCidInDownloadList(video.bvid, page.cid)) {
                    skippedCount++
                    return { success: false, skipped: true }
                  }

                  const downloadData = {
                    bvid: video.bvid,
                    title: page.part || `${video.title} - P${page.page}`,
                    cid: page.cid,
                    aid: videoDetailData.aid || video.aid,
                    quality: 64,
                    output_format: 'mp4',
                    thumbnail_url: video.pic || video.cover,
                    duration: page.duration,
                    uploader: video.owner?.name || video.uploader?.name || videoDetailData.owner?.name || '',
                    uploader_mid: video.owner?.mid || video.uploader?.mid || videoDetailData.owner?.mid || 0,
                    sessdata: sessdata || undefined
                  }

                  return apiService.addToDownloadQueue(downloadData)
                })

                // 并发执行所有分集的添加操作
                const results = await Promise.all(addPromises)

                // 统计成功的数量
                addedCount = results.filter(r => r.success).length

                // 显示结果提示
                if (skippedCount > 0) {
                  alert(`已添加 ${addedCount} 个分集到下载队列，跳过 ${skippedCount} 个已存在的分集`)
                } else {
                  alert(`已添加 ${addedCount} 个分集到下载队列`)
                }
              } else {
                // 单P视频，使用视频详情API返回的数据（更准确）
                const downloadData = {
                  bvid: video.bvid,
                  title: video.title,
                  cid: videoDetailData.cid || pages[0]?.cid,
                  aid: videoDetailData.aid || video.aid,
                  quality: 64,
                  output_format: 'mp4',
                  thumbnail_url: video.pic || video.cover,
                  duration: video.originalDuration || videoDetailData.duration || pages[0]?.duration,
                  uploader: video.owner?.name || video.uploader?.name || videoDetailData.owner?.name || '',
                  uploader_mid: video.owner?.mid || video.uploader?.mid || videoDetailData.owner?.mid || 0,
                  sessdata: sessdata || undefined
                }

                const success = await downloadStore.addToDownloadList(downloadData)
                if (!success) {
                  alert('添加到下载列表失败')
                }
              }
            } else {
              // 获取视频详情失败，降级为直接添加（使用现有数据）
              const downloadData = {
                bvid: video.bvid,
                title: video.title,
                cid: video.cid || video.aid, // 降级使用 aid 作为 cid
                aid: video.aid || video.cid, // 降级使用 cid 作为 aid
                quality: 64,
                output_format: 'mp4',
                thumbnail_url: video.pic || video.cover,
                duration: video.originalDuration || video.durationSeconds,
                uploader: video.owner?.name || video.uploader?.name || '',
                uploader_mid: video.owner?.mid || video.uploader?.mid || 0,
                sessdata: sessdata || undefined
              }

              const success = await downloadStore.addToDownloadList(downloadData)
              if (!success) {
                alert('添加到下载列表失败')
              }
            }
          } catch (error) {
            // 获取视频详情失败，降级为直接添加（使用现有数据）
            console.error('获取视频详情失败，降级为直接添加:', error)

            const downloadData = {
              bvid: video.bvid,
              title: video.title,
              cid: video.cid || video.aid,
              aid: video.aid || video.cid,
              quality: 64,
              output_format: 'mp4',
              thumbnail_url: video.pic || video.cover,
              duration: video.originalDuration || video.durationSeconds,
              uploader: video.owner?.name || video.uploader?.name || '',
              uploader_mid: video.owner?.mid || video.uploader?.mid || 0,
              sessdata: sessdata || undefined
            }

            const success = await downloadStore.addToDownloadList(downloadData)
            if (!success) {
              alert('添加到下载列表失败')
            }
          }
        }
      }
    } finally {
      // 恢复按钮状态
      button.disabled = false
    }
  }, [downloadStore, newQueueStore, useNewSystem])

  return {
    toggleDownload
  }
}