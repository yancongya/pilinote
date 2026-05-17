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
  ugc_season?: {
    title?: string
    cover?: string
    sections?: Array<{
      title?: string
      episodes?: Array<{
        bvid?: string
        cid?: number
        title?: string
        cover?: string
        page?: number
        index?: number
        duration?: number
      }>
    }>
  }
}

export interface DownloadPart {
  bvid: string
  cid?: number
  page: number
  title: string
  cover: string
  duration?: number
}

interface DownloadMetadataOptions {
  quality?: number
  output_format?: string
  enable_subtitle?: boolean
  enable_nfo?: boolean
  enable_cover?: boolean
  enable_avatar?: boolean
}

interface EnqueueVideoDownloadParams {
  video: VideoInfo
  detail?: VideoDetail
  sessdata?: string
  selectedPages?: Set<number>
  currentTasks?: Record<string, { media_id: string; state: string; meta?: Record<string, any> }>
  downloadPath?: string
  metadataOptions?: DownloadMetadataOptions
}

interface EnqueueVideoDownloadResult {
  addedCount: number
  skippedCount: number
  taskIds: string[]
  schedulerId?: string
}

interface ToggleDownloadOptions {
  forceRedownload?: boolean
  selectedPages?: Set<number>
}

const buildTargetMatcher = (
  video: VideoInfo,
  selectedPages?: Set<number>
) => {
  if (!selectedPages || selectedPages.size === 0) {
    return (task: { media_id: string; meta?: Record<string, any> }) => task.media_id === video.bvid
  }

  const targetCids = new Set(
    ((video as VideoDetail).pages || [])
      .filter(page => selectedPages.has(page.page))
      .map(page => page.cid)
      .filter((cid): cid is number => typeof cid === 'number')
  )

  return (task: { media_id: string; meta?: Record<string, any> }) => {
    if (task.media_id !== video.bvid) return false
    const taskPage = task.meta?.page
    const taskCid = task.meta?.cid
    if (typeof taskPage === 'number' && selectedPages.has(taskPage)) return true
    if (typeof taskCid === 'number' && targetCids.has(taskCid)) return true
    return false
  }
}

export function getCurrentVideoParts(video: VideoInfo, detail: VideoDetail): DownloadPart[] {
  return (detail.pages || []).map(page => ({
    bvid: video.bvid,
    cid: page.cid,
    page: page.page,
    title: page.part || `${video.title} - P${page.page}`,
    cover: video.pic || video.cover || '',
    duration: page.duration,
  }))
}

export function getCollectionParts(video: VideoInfo, detail: VideoDetail): DownloadPart[] {
  const episodes = detail.ugc_season?.sections?.flatMap(section => section.episodes || []) || []
  return episodes
    .filter(episode => episode.bvid)
    .map((episode, index) => ({
      bvid: episode.bvid!,
      cid: episode.cid,
      page: episode.page || episode.index || index + 1,
      title: episode.title || `${video.title} - P${index + 1}`,
      cover: episode.cover || video.pic || video.cover || detail.ugc_season?.cover || '',
      duration: episode.duration,
    }))
}

export function getDownloadParts(video: VideoInfo, detail: VideoDetail): DownloadPart[] {
  return getCurrentVideoParts(video, detail)
}

const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[\/\\:*?"<>|]/g, '_').trim()
}

const getCollectionEpisode = (video: VideoInfo, detail: VideoDetail) => {
  const episodes = detail.ugc_season?.sections?.flatMap(section => section.episodes || []) || []
  const index = episodes.findIndex(episode => episode.bvid === video.bvid)
  return {
    episode: index >= 0 ? episodes[index] : undefined,
    index: index >= 0 ? index + 1 : undefined,
  }
}

const buildStandardVideoMeta = (
  video: VideoInfo,
  detail: VideoDetail,
  part: DownloadPart,
  metadataOptions: DownloadMetadataOptions = {}
) => {
  const collectionTitle = detail.ugc_season?.title
  const { episode, index } = getCollectionEpisode(video, detail)
  const episodeTitle = episode?.title || video.title
  const outputSubdir = collectionTitle
    ? `P${String(index || part.page).padStart(2, '0')} - ${episodeTitle}`
    : undefined

  return {
    cid: part.cid,
    page: part.page,
    part_title: part.title,
    series_bvid: video.bvid,
    series_title: video.title,
    collection_bvid: collectionTitle ? video.bvid : undefined,
    collection_title: collectionTitle,
    collection_episode_title: collectionTitle ? episodeTitle : undefined,
    output_subdir: outputSubdir,
    pic: part.cover || video.pic || video.cover || detail.ugc_season?.cover,
    quality: metadataOptions.quality,
    output_format: metadataOptions.output_format,
    enable_subtitle: metadataOptions.enable_subtitle,
    enable_nfo: metadataOptions.enable_nfo,
    enable_cover: metadataOptions.enable_cover,
    enable_avatar: metadataOptions.enable_avatar,
  }
}

const isQueuedPart = (
  currentTasks: EnqueueVideoDownloadParams['currentTasks'],
  bvid: string,
  cid?: number,
  page?: number
): boolean => {
  if (!currentTasks) return false
  return Object.values(currentTasks).some(task => {
    if (task.media_id !== bvid || ['completed', 'cancelled'].includes(task.state)) return false
    if (cid !== undefined && task.meta?.cid === cid) return true
    if (page !== undefined && task.meta?.page === page) return true
    return cid === undefined && page === undefined
  })
}

export const enqueueVideoDownload = async ({
  video,
  detail,
  sessdata,
  selectedPages,
  currentTasks,
  downloadPath = '/Users/tanyancong/工作/开发/pilinote/downloads',
  metadataOptions = {},
}: EnqueueVideoDownloadParams): Promise<EnqueueVideoDownloadResult> => {
  const detailData: VideoDetail = detail ?? await apiService.getVideoDetail(video.bvid, sessdata).then(response => {
    if (!response.success || !response.data) {
      throw new Error(response.message || '获取视频详情失败')
    }
    return response.data as VideoDetail
  })

  const parts = getDownloadParts(video, detailData)
  const selectedParts = selectedPages && selectedPages.size > 0
    ? parts.filter(part => selectedPages.has(part.page))
    : parts

  const targetParts = selectedParts.length > 0
    ? selectedParts
    : [{
        bvid: video.bvid,
        cid: detailData.cid || video.cid,
        page: 1,
        title: video.title,
        cover: video.pic || video.cover || '',
        duration: detailData.duration || video.originalDuration || video.durationSeconds,
      }]

  const taskIds: string[] = []
  let skippedCount = 0

  for (const part of targetParts) {
    if (isQueuedPart(currentTasks, part.bvid, part.cid, part.page)) {
      skippedCount++
      continue
    }

    const meta = buildStandardVideoMeta(video, detailData, part, metadataOptions)
    const response = await apiService.submitTask({
      title: part.title,
      media_type: 'video',
      media_id: part.bvid,
      cover: part.cover || video.pic || video.cover || '',
      desc: part.cid ? `CID: ${part.cid}` : '',
      meta,
    })

    if (!response.success || !response.data?.id) {
      throw new Error(response.message || `添加分P失败: ${part.title}`)
    }
    taskIds.push(response.data.id)
  }

  if (taskIds.length === 0) {
    return { addedCount: 0, skippedCount, taskIds }
  }

  let schedulerId: string | undefined
  if (targetParts.length > 1) {
    const schedulerResponse = await apiService.createScheduler({
      title: video.title,
      task_ids: taskIds,
      folder: `${downloadPath}/系列-${sanitizeFilename(video.title)}`,
    })

    if (!schedulerResponse.success || !schedulerResponse.data) {
      throw new Error(schedulerResponse.message || '创建调度器失败')
    }
    schedulerId = schedulerResponse.data.id
  }

  return {
    addedCount: taskIds.length,
    skippedCount,
    taskIds,
    schedulerId,
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
  const toggleDownload = useCallback(async (
    video: VideoInfo,
    e: React.MouseEvent,
    options: ToggleDownloadOptions = {}
  ): Promise<{success: boolean, message: string, shouldNavigateToLibrary?: boolean}> => {
    // 阻止事件冒泡，避免触发父元素的事件
    e.stopPropagation()

    // 防止重复点击
    const button = e.currentTarget as HTMLButtonElement | null
    if (button && button.disabled) {
      return {success: false, message: '操作进行中'}
    }
    if (button) {
      button.disabled = true
    }

    const resetButton = () => {
      if (button) {
        button.disabled = false
      }
    }

    try {
      // 使用新的下载系统
      const sessdata = localStorage.getItem('sessdata')
        const currentTasks = newQueueStore.tasks
        const matchesTargetTask = buildTargetMatcher(video, options.selectedPages)
        const relatedTasks = Object.values(currentTasks).filter(matchesTargetTask)
        
        // 检查是否已经在新系统中（检查未完成的任务）
        const isInNewQueue = relatedTasks.some(task => !['completed', 'cancelled'].includes(task.state))
        
        // 检查是否已下载完成
        // 对详情页指定分P的场景，不再让旧 completed 任务阻止重新加入下载列表。
        // 详情页本地状态已经改为只认本地可播放文件，缺文件时应允许重新入队。
        const shouldBlockCompleted = !options.selectedPages || options.selectedPages.size === 0
        const isDownloaded = shouldBlockCompleted && relatedTasks.some(task => task.state === 'completed')
        const completedTasks = relatedTasks.filter(task => task.state === 'completed')

        if (isInNewQueue) {
          // 从新下载系统移除（标记为取消）
          // 找出所有相同 bvid 的任务（系列视频可能有多个分P）
          const allTasks = relatedTasks.filter(t => !['completed', 'cancelled'].includes(t.state))
          
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
        } else if (isDownloaded && !options.forceRedownload) {
          // 已下载完成，不允许操作
          resetButton()
          return {success: false, message: '视频已下载完成，请到视频库查看'}
        } else {
          // 添加到新下载系统
          try {
            // 详情页指定分P重新加入下载列表时，如果只有旧 completed 记录，
            // 需要先删掉它，否则后端会按身份去重复用旧 completed 任务，
            // 下载列表里仍然看不到新的 backlog 任务。
            if (options.forceRedownload || (!shouldBlockCompleted && completedTasks.length > 0)) {
              await Promise.allSettled(completedTasks.map(task => newQueueStore.deleteTask(task.id)))
            }

            const { useSettingsStore } = await import('../stores/settings')
            const settingsStore = useSettingsStore.getState()
            if (!settingsStore.settings) {
              await settingsStore.fetchSettings()
            }
            const downloadPath = settingsStore.settings?.storage?.download_path || '/Users/tanyancong/工作/开发/pilinote/downloads'
            const result = await enqueueVideoDownload({
              video,
              sessdata: sessdata || undefined,
              currentTasks,
              downloadPath,
              selectedPages: options.selectedPages,
            })

            await newQueueStore.fetchTasks()
            await newQueueStore.fetchSchedulers()
            if (result.addedCount === 0) {
              return {success: false, message: '视频已在下载列表中'}
            }
            return {
              success: true,
              message: result.addedCount > 1 ? `已添加 ${result.addedCount} 个视频到下载列表` : '已添加到下载队列'
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
      if (button) {
        button.disabled = false
      }
    }
  }, [newQueueStore])

  return {
    toggleDownload
  }
}
