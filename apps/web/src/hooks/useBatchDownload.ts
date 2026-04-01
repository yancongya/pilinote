import { useState } from 'react'
import { apiService } from '../services/api'
import { useDownloadStore } from '../stores/download'

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
  const downloadStore = useDownloadStore()

  // Batch selection mode state
  const [batchMode, setBatchMode] = useState(false)

  // Selected videos state (Set of video IDs)
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())

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
   * Iterates through selected videos and adds them to the download queue.
   * Handles duplicates, syncs with server, and starts batch downloads.
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
      let successCount = 0
      let failCount = 0
      let duplicateCount = 0

      // Batch add to download queue
      for (const video of videos) {
        if (!selectedVideos.has(video.id)) continue

        // Check if video is already in download list
        if (downloadStore.isBvidInDownloadList(video.bvid)) {
          duplicateCount++
          console.log(`Video already in download list: ${video.title}`)
          continue
        }

        try {
          // Debug: print video object structure
          console.log('Batch adding video:', video.title, video)

          const response = await apiService.addToDownloadQueue({
            bvid: video.bvid || '',
            title: video.title || '',
            cid: video.cid,
            aid: video.aid,
            thumbnail_url: video.cover || video.pic || '',
            duration: video.originalDuration || video.duration,
            uploader: video.uploader || video.owner?.name || '未知',
            uploader_mid: video.uploader_mid || video.owner?.mid || 0
          })

          if (response.success) {
            successCount++
          } else {
            failCount++
            console.error(`Failed to add to download list: ${video.title}`, response.message)
          }
        } catch (err) {
          failCount++
          console.error(`Failed to add to download list: ${video.title}`, err)
        }
      }

      if (successCount > 0 || duplicateCount > 0) {
        // Sync download list
        await downloadStore.syncFromServer()

        // Start batch downloads
        if (successCount > 0) {
          await downloadStore.startBatchDownloads()
        }

        let message = `成功添加 ${successCount} 个视频到下载列表`
        if (duplicateCount > 0) {
          message += `，跳过 ${duplicateCount} 个已在列表中的视频`
        }
        if (failCount > 0) {
          message += `，失败 ${failCount} 个`
        }

        alert(message)
        // Exit batch mode
        clearSelection()
      } else {
        throw new Error('所有视频添加失败')
      }

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
    setBatchMode,
    selectedVideos,
    toggleVideoSelection,
    toggleSelectAll,
    batchDownloadSelected,
    clearSelection
  }
}