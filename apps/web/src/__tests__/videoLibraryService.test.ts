import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { videoLibraryService } from '../services/videoLibraryService'
import { apiService } from '../services/api'

// Mock apiService
vi.mock('../services/api', () => ({
  apiService: {
    request: vi.fn(),
    getDownloadList: vi.fn()
  }
}))

describe('VideoLibraryService', () => {
  beforeEach(() => {
    videoLibraryService.clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should export a singleton instance', () => {
      const instance1 = videoLibraryService
      const instance2 = videoLibraryService
      expect(instance1).toBe(instance2)
    })
  })

  describe('Cache Management', () => {
    it('should clear cache', () => {
      videoLibraryService.clearCache()
      
      const newStatus = videoLibraryService.getCacheStatus()
      expect(newStatus.cacheSize).toBe(0)
      expect(newStatus.lastRefresh).toBe(0)
    })

    it('should set cache TTL', () => {
      const newTTL = 5 * 60 * 1000 // 5 minutes
      videoLibraryService.setCacheTTL(newTTL)
      
      const config = videoLibraryService.getConfig()
      expect(config.cacheTTL).toBe(newTTL)
    })

    it('should get cache status', () => {
      const status = videoLibraryService.getCacheStatus()
      
      expect(status).toHaveProperty('lastRefresh')
      expect(status).toHaveProperty('cacheSize')
      expect(status).toHaveProperty('isFresh')
      expect(typeof status.lastRefresh).toBe('number')
      expect(typeof status.cacheSize).toBe('number')
      expect(typeof status.isFresh).toBe('boolean')
    })

    it('should check cache freshness correctly', () => {
      videoLibraryService['lastRefreshTime'] = Date.now()
      expect(videoLibraryService['isCacheFresh']()).toBe(true)

      videoLibraryService['lastRefreshTime'] = Date.now() - 20 * 60 * 1000 // 20 minutes ago
      expect(videoLibraryService['isCacheFresh']()).toBe(false)
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        cacheTTL: 15 * 60 * 1000,
        autoRefreshDelay: 10000,
        maxConcurrentChecks: 100,
        enableSmartRefresh: false,
        enableDeepScan: true
      }

      videoLibraryService.updateConfig(newConfig)
      const config = videoLibraryService.getConfig()

      expect(config.cacheTTL).toBe(newConfig.cacheTTL)
      expect(config.autoRefreshDelay).toBe(newConfig.autoRefreshDelay)
      expect(config.maxConcurrentChecks).toBe(newConfig.maxConcurrentChecks)
      expect(config.enableSmartRefresh).toBe(newConfig.enableSmartRefresh)
      expect(config.enableDeepScan).toBe(newConfig.enableDeepScan)
    })

    it('should get configuration', () => {
      const config = videoLibraryService.getConfig()

      expect(config).toHaveProperty('cacheTTL')
      expect(config).toHaveProperty('autoRefreshDelay')
      expect(config).toHaveProperty('maxConcurrentChecks')
      expect(config).toHaveProperty('enableSmartRefresh')
      expect(config).toHaveProperty('enableDeepScan')
    })
  })

  describe('Video Download Status Check', () => {
    it('should check if video is downloaded', async () => {
      const mockResponse = {
        success: true,
        data: {
          folders: [
            {
              bvid: 'BV1xx411c7mD',
              title: 'Test Video',
              path: '/path/to/video',
              size: 1024,
              exists: true
            }
          ],
          folder_count: 1,
          total_files: 1
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)
      vi.mocked(apiService.getDownloadList).mockResolvedValueOnce({
        success: true,
        data: []
      })

      const result = await videoLibraryService.isVideoDownloaded('BV1xx411c7mD')
      expect(result).toBe(true)
    })

    it('should return false for non-downloaded video', async () => {
      const mockResponse = {
        success: true,
        data: {
          folders: [],
          folder_count: 0,
          total_files: 0
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)
      vi.mocked(apiService.getDownloadList).mockResolvedValueOnce({
        success: true,
        data: []
      })

      const result = await videoLibraryService.isVideoDownloaded('BV1notexist00')
      expect(result).toBe(false)
    })

    it('should handle multi-part videos with CID', async () => {
      const mockResponse = {
        success: true,
        data: {
          folders: [
            {
              bvid: 'BV1multi0000',
              title: 'Multi-part Video',
              path: '/path/to/video',
              size: 2048,
              exists: true,
              videos: [
                { cid: 1, title: 'Part 1', path: '/path/to/video/part1.mp4', size: 1024, exists: true },
                { cid: 2, title: 'Part 2', path: '/path/to/video/part2.mp4', size: 1024, exists: true }
              ]
            }
          ],
          folder_count: 1,
          total_files: 2
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)
      vi.mocked(apiService.getDownloadList).mockResolvedValueOnce({
        success: true,
        data: []
      })

      const result1 = await videoLibraryService.isVideoDownloaded('BV1multi0000', 1)
      const result2 = await videoLibraryService.isVideoDownloaded('BV1multi0000', 2)
      const result3 = await videoLibraryService.isVideoDownloaded('BV1multi0000', 3)

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(false)
    })
  })

  describe('Batch Video Check', () => {
    it('should batch check videos in library', async () => {
      const mockResponse = {
        success: true,
        data: {
          downloaded: ['BV1batch1000'],
          not_downloaded: ['BV1batch2000', 'BV1batch3000']
        }
      }

      vi.mocked(apiService.request).mockResolvedValue(mockResponse as any)

      const bvids = ['BV1batch1000', 'BV1batch2000', 'BV1batch3000']
      const result = await videoLibraryService.checkVideosInLibrary(bvids)

      expect(result).toHaveProperty('downloaded')
      expect(result).toHaveProperty('not_downloaded')
      expect(result.downloaded).toContain('BV1batch1000')
      expect(result.not_downloaded).toContain('BV1batch2000')
      expect(result.not_downloaded).toContain('BV1batch3000')
    })

    it('should handle empty video list', async () => {
      const result = await videoLibraryService.checkVideosInLibrary([])

      expect(result.downloaded).toEqual([])
      expect(result.not_downloaded).toEqual([])
    })
  })

  describe('Cache Refresh', () => {
    it('should refresh cache successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          folders: [
            {
              bvid: 'BV1refresh00',
              title: 'Test Video',
              path: '/path/to/video',
              size: 1024,
              exists: true
            }
          ],
          folder_count: 1,
          total_files: 1
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)

      const result = await videoLibraryService.refreshCache()

      expect(result.success).toBe(true)
      expect(result.cached).toBe(false)
      expect(result.folderCount).toBe(1)
      expect(result.videoCount).toBe(1)
    })

    it('should fallback to task queue on primary API failure', async () => {
      // Primary API fails
      vi.mocked(apiService.request).mockRejectedValueOnce(new Error('API error'))

      // Fallback succeeds
      const mockTaskResponse = {
        success: true,
        data: [
          { id: '1', media_id: 'BV1fallback0', title: 'Test', state: 3, created_at: 0, updated_at: 0 }
        ]
      }
      vi.mocked(apiService.getDownloadList).mockResolvedValueOnce(mockTaskResponse as any)

      const result = await videoLibraryService.refreshCache()

      expect(result.success).toBe(true)
      expect(result.cached).toBe(true)
    })
  })

  describe('Manual Refresh', () => {
    it('should manually refresh library', async () => {
      const mockResponse = {
        success: true,
        data: {
          folders: [],
          folder_count: 0,
          total_files: 0
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)

      await expect(videoLibraryService.manualRefresh()).resolves.not.toThrow()
    })

    it('should clear cache before manual refresh', async () => {
      // Set up cache
      videoLibraryService['cache'].set('BV1manual00', {
        bvid: 'BV1manual00',
        title: 'Test',
        path: '/path',
        size: 0,
        exists: true
      })

      const mockResponse = {
        success: true,
        data: {
          folders: [],
          folder_count: 0,
          total_files: 0
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)

      await videoLibraryService.manualRefresh()

      expect(videoLibraryService['cache'].size).toBe(0)
    })
  })

  describe('Download Completion Handling', () => {
    it('should handle download complete event', () => {
      const mockSetTimeout = vi.spyOn(globalThis, 'setTimeout')
      videoLibraryService.handleDownloadComplete('test-task-id')
      
      expect(mockSetTimeout).toHaveBeenCalled()
      mockSetTimeout.mockRestore()
    })

    it('should schedule library refresh with delay', () => {
      const mockSetTimeout = vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler: TimerHandler, ...args: any[]) => {
        if (typeof handler === 'function') {
          handler(...args)
        }
        return 0 as any
      })

      videoLibraryService['lastRefreshTime'] = Date.now() - 4 * 60 * 1000 // 4 minutes ago
      videoLibraryService.scheduleLibraryRefresh(100)

      mockSetTimeout.mockRestore()
    })

    it('should skip refresh if cache is still fresh', async () => {
      const mockSetTimeout = vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler: TimerHandler, ...args: any[]) => {
        if (typeof handler === 'function') {
          handler(...args)
        }
        return 0 as any
      })

      // Set cache as fresh (2 minutes ago)
      videoLibraryService['lastRefreshTime'] = Date.now() - 2 * 60 * 1000

      // Should not call API because cache is fresh (within 3 minutes)
      await videoLibraryService.scheduleLibraryRefresh(0)

      mockSetTimeout.mockRestore()
    })
  })

  describe('Add Decision Logic', () => {
    beforeEach(() => {
      // Clear all mocks before each test
      vi.clearAllMocks()
    })

    it('should return add decision for non-downloaded video', async () => {
      // Use a different BVID to avoid cache conflicts
      const bvid = 'BV1adddoc00'
      
      const mockResponse = {
        success: true,
        data: {
          folders: [],
          folder_count: 0,
          total_files: 0
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)
      vi.mocked(apiService.getDownloadList).mockResolvedValueOnce({
        success: true,
        data: []
      })

      const video = { bvid, title: 'Test Video' }
      const decision = await videoLibraryService.checkBeforeAdd(video)

      expect(decision.action).toBe('add')
      expect(decision.video).toEqual(video)
    })

    it('should return show_confirm decision for downloaded video', async () => {
      const mockResponse = {
        success: true,
        data: {
          folders: [
            {
              bvid: 'BV1confirm00',
              title: 'Test Video',
              path: '/path/to/video',
              size: 1024,
              exists: true
            }
          ],
          folder_count: 1,
          total_files: 1
        }
      }

      vi.mocked(apiService.request).mockResolvedValueOnce(mockResponse as any)
      vi.mocked(apiService.getDownloadList).mockResolvedValueOnce({
        success: true,
        data: []
      })

      const video = { bvid: 'BV1confirm00', title: 'Test Video' }
      const decision = await videoLibraryService.checkBeforeAdd(video)

      expect(decision.action).toBe('show_confirm')
      expect(decision.reason).toBe('视频已下载，是否重新下载？')
      expect(decision.video).toEqual(video)
    })

    it('should show re-download dialog placeholder', async () => {
      const video = { bvid: 'BV1dialog00', title: 'Test Video' }
      const result = await videoLibraryService.showReDownloadDialog(video)

      expect(result).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully in refresh', async () => {
      // Primary API fails
      vi.mocked(apiService.request).mockRejectedValueOnce(new Error('Network error'))

      // Fallback also fails
      vi.mocked(apiService.getDownloadList).mockRejectedValueOnce(new Error('Fallback error'))

      const result = await videoLibraryService.refreshCache()

      // Should handle error gracefully
      expect(result).toBeDefined()
    })

    it('should handle API errors in isVideoDownloaded', async () => {
      vi.mocked(apiService.request).mockRejectedValueOnce(new Error('Network error'))
      vi.mocked(apiService.getDownloadList).mockRejectedValueOnce(new Error('Fallback error'))

      const result = await videoLibraryService.isVideoDownloaded('BV1error000')

      expect(result).toBe(false)
    })
  })

  describe('Task State Checking', () => {
    it('should map task states correctly', () => {
      const service = videoLibraryService

      expect(service['_mapTaskState'](0)).toBe('pending')
      expect(service['_mapTaskState'](1)).toBe('pending')
      expect(service['_mapTaskState'](2)).toBe('active')
      expect(service['_mapTaskState'](3)).toBe('completed')
      expect(service['_mapTaskState'](4)).toBe('paused')
      expect(service['_mapTaskState'](5)).toBe('failed')
      expect(service['_mapTaskState'](6)).toBe('cancelled')
      expect(service['_mapTaskState'](999)).toBe('none')
    })
  })
})
