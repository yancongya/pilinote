import { apiService } from './api'

// ============== Type Definitions ==============

interface VideoFileMeta {
  bvid: string
  cid?: number
  title: string
  path: string
  size: number
  exists: boolean
  videos?: VideoFileMeta[]
}

interface CheckResult {
  downloaded: string[]
  not_downloaded: string[]
  details?: Map<string, VideoCheckDetail>
}

interface VideoCheckDetail {
  bvid: string
  downloaded: boolean
  inLibrary: boolean
  inQueue: boolean
}

interface RefreshResult {
  success: boolean
  cached: boolean
  folderCount?: number
  videoCount?: number
  message?: string
}

interface AddDecision {
  action: 'add' | 'show_confirm' | 'skip'
  reason?: string
  video?: any
}

interface VideoLibraryConfig {
  cacheTTL: number
  autoRefreshDelay: number
  maxConcurrentChecks: number
  enableSmartRefresh: boolean
  enableDeepScan: boolean
}

interface VideoInfo {
  bvid: string
  cid?: number
  title: string
  [key: string]: any
}

// ============== VideoLibraryService ==============

class VideoLibraryService {
  // Cache management
  private cache: Map<string, VideoFileMeta> = new Map()
  private lastRefreshTime: number = 0
  private isRefreshing: boolean = false
  private refreshLock: Promise<RefreshResult> | null = null
  private totalVideos: number = 0
  private totalFolders: number = 0

  // Configuration
  private config: VideoLibraryConfig = {
    cacheTTL: 10 * 60 * 1000,
    autoRefreshDelay: 5000,
    maxConcurrentChecks: 50,
    enableSmartRefresh: true,
    enableDeepScan: false
  }

  // ============== Core Methods ==============

  /**
   * Check if a video is downloaded in the library
   * @param bvid - Video BVID
   * @param cid - Optional CID for multi-part videos
   * @returns Promise<boolean> - true if downloaded
   */
  async isVideoDownloaded(bvid: string, cid?: number): Promise<boolean> {
    // 1. Check if cache is fresh
    if (!this.isCacheFresh()) {
      await this.ensureCacheLoaded()
    }

    // 2. Check library cache (direct check)
    return this.checkLibraryCache(bvid, cid)
  }

  /**
   * Check multiple videos in library
   * @param bvids - Array of video BVIDs
   * @returns Promise<CheckResult> - Result with downloaded and not_downloaded arrays
   */
  async checkVideosInLibrary(bvids: string[]): Promise<CheckResult> {
    // Show progress for large batches
    if (bvids.length > 50) {
      console.log(`[VideoLibrary] Checking ${bvids.length} videos...`)
    }

    // Ensure cache is loaded
    if (!this.isCacheFresh()) {
      await this.ensureCacheLoaded()
    }

    const downloaded: string[] = []
    const not_downloaded: string[] = []
    const details = new Map<string, VideoCheckDetail>()

    // Use batch check API if available
    if (bvids.length > 1) {
      try {
        const batchResult = await this._batchCheckVideos(bvids)
        return batchResult
      } catch (error) {
        console.warn('[VideoLibrary] Batch check failed, falling back to individual checks', error)
      }
    }

    // Individual checks
    for (const bvid of bvids) {
      const isDownloaded = this.cache.has(bvid)
      
      if (isDownloaded) {
        downloaded.push(bvid)
      } else {
        not_downloaded.push(bvid)
      }

      details.set(bvid, {
        bvid,
        downloaded: isDownloaded,
        inLibrary: isDownloaded,
        inQueue: false
      })
    }

    if (bvids.length > 50) {
      console.log(`[VideoLibrary] Check complete: ${downloaded.length} downloaded, ${not_downloaded.length} not downloaded`)
    }

    return { downloaded, not_downloaded, details }
  }

  // ============== Cache Refresh ==============

  /**
   * Refresh the video library cache
   * @returns Promise<RefreshResult> - Result with success status
   */
  async refreshCache(): Promise<RefreshResult> {
    // If already refreshing, wait for completion
    if (this.refreshLock) {
      return await this.refreshLock
    }

    // Acquire refresh lock
    this.refreshLock = this._doRefresh()

    try {
      return await this.refreshLock
    } finally {
      this.refreshLock = null
    }
  }

  /**
   * Internal refresh implementation
   */
  private async _doRefresh(): Promise<RefreshResult> {
    this.isRefreshing = true
    console.log('[VideoLibrary] Starting cache refresh...')

    try {
      // Use video library API
      const response = await apiService.request<any>('/api/video-library/refresh', {
        method: 'GET'
      })

      if (response && response.success && response.data) {
        this.lastRefreshTime = Date.now()
        
        // Extract data from file system scan
        const folders = response.data.folders || []
        const downloadedBvids = response.data.downloaded_bvids || []
        
        // Update totals
        this.totalFolders = response.data.folder_count || 0
        this.totalVideos = response.data.total_files || 0
        
        // Build cache from file system data
        this.cache.clear()
        
        // Build from folders (preferred method - contains full metadata)
        for (const folder of folders) {
          const nfoData = folder.nfo_data
          if (nfoData && nfoData.bvid) {
            this.cache.set(nfoData.bvid, {
              bvid: nfoData.bvid,
              title: folder.title || folder.name,
              path: folder.path,
              size: folder.size || 0,
              exists: true
            })
          }
        }
        
        // Fallback: build from downloaded_bvids if folders not available
        if (folders.length === 0 && downloadedBvids.length > 0) {
          for (const bvid of downloadedBvids) {
            this.cache.set(bvid, {
              bvid,
              title: '',
              path: '',
              size: 0,
              exists: true
            })
          }
        }

        console.log('[VideoLibrary] Cache refreshed successfully')

        return {
          success: true,
          cached: false,
          folderCount: this.totalFolders,
          videoCount: this.totalVideos
        }
      } else {
        throw new Error(response?.message || 'Refresh failed')
      }
    } catch (error) {
      console.error('[VideoLibrary] Primary refresh failed, falling back to task queue', error)
      
      // Fallback to task queue
      return await this._fallbackToTaskQueue()
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Fallback refresh using task queue
   */
  private async _fallbackToTaskQueue(): Promise<RefreshResult> {
    try {
      const response = await apiService.getDownloadList()

      if (response && response.success && response.data) {
        const completedTasks = response.data.filter((task: any) => task.state === 3)

        // Build cache from completed tasks
        this.cache.clear()
        for (const task of completedTasks) {
          this.cache.set(task.media_id, {
            bvid: task.media_id,
            title: task.title,
            path: '',
            size: 0,
            exists: true
          })
        }

        this.lastRefreshTime = Date.now()
        this.totalVideos = completedTasks.length
        this.totalFolders = completedTasks.length

        console.log(`[VideoLibrary] Fallback refresh: ${completedTasks.length} completed tasks`)

        return {
          success: true,
          cached: true,
          folderCount: completedTasks.length,
          videoCount: completedTasks.length
        }
      }

      return {
        success: false,
        cached: true,
        message: 'Failed to refresh from task queue'
      }
    } catch (error) {
      console.error('[VideoLibrary] Fallback refresh failed', error)
      return {
        success: false,
        cached: true,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get video library status
   * @returns Promise with cache status information
   */
  async getLibraryStatus(): Promise<{
    cached: boolean
    is_fresh: boolean
    video_count: number
    folder_count: number
    last_refresh: number
  }> {
    const cached = this.cache.size > 0
    const isFresh = this.isCacheFresh()
    
    return {
      cached,
      is_fresh: isFresh,
      video_count: this.totalVideos,
      folder_count: this.totalFolders,
      last_refresh: this.lastRefreshTime
    }
  }

  /**
   * Batch check videos using API
   */
  private async _batchCheckVideos(bvids: string[]): Promise<CheckResult> {
    try {
      const response = await apiService.request<any>('/api/video-library/check-batch', {
        method: 'POST',
        body: JSON.stringify({ bvids })
      })

      if (response && response.success && response.data) {
        const downloaded = response.data.downloaded || []
        const not_downloaded = response.data.not_downloaded || []

        // Update cache with results
        for (const bvid of downloaded) {
          if (!this.cache.has(bvid)) {
            this.cache.set(bvid, {
              bvid,
              title: '',
              path: '',
              size: 0,
              exists: true
            })
          }
        }

        return { downloaded, not_downloaded }
      }

      throw new Error(response?.message || 'Batch check failed')
    } catch (error) {
      console.error('[VideoLibrary] Batch check error:', error)
      throw error
    }
  }

  /**
   * Schedule a library refresh with delay
   * @param delay - Delay in milliseconds (default 5000)
   */
  scheduleLibraryRefresh(delay: number = 5000): void {
    console.log(`[VideoLibrary] Scheduling refresh in ${delay}ms`)

    setTimeout(async () => {
      // Skip if cache is still fresh
      if (this.config.enableSmartRefresh && this.isCacheFresh(180000)) { // 3 minutes
        console.log('[VideoLibrary] Cache is still fresh, skipping refresh')
        return
      }

      await this.refreshCache()
    }, delay)
  }

  /**
   * Handle download completion event
   * @param taskId - Task ID that completed
   */
  handleDownloadComplete(taskId: string): void {
    console.log(`[VideoLibrary] Task ${taskId} completed, scheduling library refresh`)
    
    // Schedule refresh
    this.scheduleLibraryRefresh(this.config.autoRefreshDelay)
  }

  // ============== Duplicate Check ==============

  /**
   * Check if video can be added to download queue
   * @param video - Video information
   * @returns Promise<AddDecision> - Decision on how to proceed
   */
  async checkBeforeAdd(video: VideoInfo): Promise<AddDecision> {
    // Check if video is in library (based on file system)
    const isDownloaded = await this.isVideoDownloaded(video.bvid, video.cid)

    if (isDownloaded) {
      return {
        action: 'show_confirm',
        reason: '视频已下载，是否重新下载？',
        video
      }
    }

    // Video can be added
    return { action: 'add', video }
  }

  /**
   * Show re-download confirmation dialog
   * @param video - Video information
   * @returns Promise<boolean> - User's decision
   */
  async showReDownloadDialog(video: VideoInfo): Promise<boolean> {
    // This method will be implemented in UI layer
    // For now, return false to skip re-download
    console.log('[VideoLibrary] Re-download dialog not implemented yet for video:', video.bvid)
    return false
  }

  // ============== User Control ==============

  /**
   * Manually refresh the video library
   */
  async manualRefresh(): Promise<void> {
    console.log('[VideoLibrary] Manual refresh requested')
    
    // Clear cache to force refresh
    this.cache.clear()
    this.lastRefreshTime = 0
    
    await this.refreshCache()
  }

  /**
   * Set cache TTL
   * @param ttl - TTL in milliseconds
   */
  setCacheTTL(ttl: number): void {
    this.config.cacheTTL = ttl
    console.log(`[VideoLibrary] Cache TTL set to ${ttl}ms`)
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
    this.lastRefreshTime = 0
    this.totalVideos = 0
    this.totalFolders = 0
    console.log('[VideoLibrary] Cache cleared')
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { lastRefresh: number; cacheSize: number; isFresh: boolean } {
    return {
      lastRefresh: this.lastRefreshTime,
      cacheSize: this.cache.size,
      isFresh: this.isCacheFresh()
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VideoLibraryConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('[VideoLibrary] Configuration updated:', this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): VideoLibraryConfig {
    return { ...this.config }
  }

  // ============== Private Helper Methods ==============

  /**
   * Check if cache is fresh
   * @param threshold - Custom threshold in milliseconds
   */
  private isCacheFresh(threshold?: number): boolean {
    const effectiveThreshold = threshold || this.config.cacheTTL
    return Date.now() - this.lastRefreshTime < effectiveThreshold
  }

  /**
   * Ensure cache is loaded
   */
  private async ensureCacheLoaded(): Promise<void> {
    if (this.isRefreshing) {
      // Wait for refresh to complete
      while (this.isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } else if (!this.isCacheFresh()) {
      await this.refreshCache()
    }
  }

  /**
   * Check library cache for specific video
   * @param bvid - Video BVID
   * @param cid - Optional CID for multi-part videos
   */
  private checkLibraryCache(bvid: string, cid?: number): boolean {
    // Direct check: if bvid exists in cache, video is downloaded
    return this.cache.has(bvid)
  }
}

// Export singleton
export const videoLibraryService = new VideoLibraryService()

// Export types
export type {
  VideoFileMeta,
  CheckResult,
  VideoCheckDetail,
  RefreshResult,
  AddDecision,
  VideoLibraryConfig,
  VideoInfo
}