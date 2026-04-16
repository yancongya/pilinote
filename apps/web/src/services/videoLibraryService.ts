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
  taskState?: string
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

interface TaskState {
  id: string
  state: number
  status: string
  created_at: number
  updated_at: number
}

type TaskStateValue = 'none' | 'pending' | 'active' | 'completed' | 'paused' | 'failed' | 'cancelled'

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

  // Task cache
  private taskCache: Map<string, TaskState> = new Map()
  private taskCacheTTL: number = 5 * 60 * 1000 // 5 minutes
  private lastTaskRefreshTime: number = 0

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

    // 2. Check library cache
    const inLibrary = this.checkLibraryCache(bvid, cid)
    if (inLibrary) {
      return true
    }

    // 3. Check task queue (supplementary check)
    const taskState = await this.checkTaskState(bvid, cid)
    return taskState === 'completed'
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
        inQueue: false,
        taskState: undefined
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
      // Try to use video library API
      const response = await apiService.request<any>('/api/video-library/refresh', {
        method: 'GET'
      })

      if (response && response.success && response.data) {
        this.lastRefreshTime = Date.now()
        
        // Update totals based on new logic
        this.totalVideos = response.data.downloaded_tasks || 0
        this.totalFolders = response.data.folder_count || 0
        
        // Build cache from downloaded_bvids
        this.cache.clear()
        for (const bvid of response.data.downloaded_bvids || []) {
          this.cache.set(bvid, {
            bvid,
            title: '',
            path: '',
            size: 0,
            exists: true
          })
        }

        console.log('[VideoLibrary] Cache refreshed successfully')

        return {
          success: true,
          cached: false,
          folderCount: response.data.folder_count,
          videoCount: response.data.downloaded_tasks
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
    
    // Clear task cache to force refresh
    this.taskCache.clear()
    
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
    const isDownloaded = await this.isVideoDownloaded(video.bvid, video.cid)

    if (isDownloaded) {
      return {
        action: 'show_confirm',
        reason: '视频已下载，是否重新下载？',
        video
      }
    }

    // Check if already in queue
    const inQueue = await this.checkTaskState(video.bvid, video.cid)
    if (inQueue === 'active' || inQueue === 'pending') {
      return {
        action: 'skip',
        reason: '视频已在下载队列中',
        video
      }
    }

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
    this.taskCache.clear()
    this.lastRefreshTime = 0
    this.lastTaskRefreshTime = 0
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
    const folder = this.cache.get(bvid)
    
    if (!folder) {
      return false
    }

    // Single-part video: folder exists
    if (!cid) {
      return folder.exists
    }

    // Multi-part video: check specific video
    if (folder.videos && folder.videos.length > 0) {
      return folder.videos.some(v => v.cid === cid && v.exists)
    }

    // Fallback: assume folder exists
    return folder.exists
  }

  /**
   * Check task state for video
   * @param bvid - Video BVID
   * @param cid - Optional CID for multi-part videos
   */
  private async checkTaskState(bvid: string, cid?: number): Promise<TaskStateValue> {
    // Check task cache first
    const cacheKey = cid ? `${bvid}_${cid}` : bvid
    if (this.taskCache.has(cacheKey)) {
      const task = this.taskCache.get(cacheKey)!
      if (Date.now() - task.updated_at < this.taskCacheTTL) {
        return this._mapTaskState(task.state)
      }
    }

    // Refresh task cache if needed
    if (Date.now() - this.lastTaskRefreshTime > this.taskCacheTTL) {
      await this._refreshTaskCache()
    }

    // Check again
    if (this.taskCache.has(cacheKey)) {
      const task = this.taskCache.get(cacheKey)!
      return this._mapTaskState(task.state)
    }

    return 'none'
  }

  /**
   * Refresh task cache
   */
  private async _refreshTaskCache(): Promise<void> {
    try {
      const response = await apiService.getDownloadList()

      if (response && response.success && response.data) {
        this.taskCache.clear()

        for (const task of response.data) {
          const key = task.meta?.cid 
            ? `${task.media_id}_${task.meta.cid}` 
            : task.media_id

          this.taskCache.set(key, {
            id: task.id,
            state: task.state,
            status: task.status,
            created_at: task.created_at,
            updated_at: task.updated_at
          })
        }

        this.lastTaskRefreshTime = Date.now()
      }
    } catch (error) {
      console.error('[VideoLibrary] Failed to refresh task cache:', error)
    }
  }

  /**
   * Map task state number to string
   */
  private _mapTaskState(state: number): TaskStateValue {
    const stateMap: Record<number, TaskStateValue> = {
      0: 'pending',    // BACKLOG
      1: 'pending',    // PENDING
      2: 'active',     // ACTIVE
      3: 'completed',  // COMPLETED
      4: 'paused',     // PAUSED
      5: 'failed',     // FAILED
      6: 'cancelled'   // CANCELLED
    }

    return stateMap[state] || 'none'
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
  TaskState,
  TaskStateValue,
  VideoLibraryConfig,
  VideoInfo
}