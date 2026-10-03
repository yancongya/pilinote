import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueVideoDownload, getCollectionParts, getDownloadParts, useVideoDownload, type VideoInfo, type VideoDetail } from '../hooks/useVideoDownload'
import { useNewQueueStore } from '../stores/newQueue'

const { submitTask, createScheduler, deleteTask, fetchTasks, fetchSchedulers, getVideoDetail } = vi.hoisted(() => ({
  submitTask: vi.fn(),
  createScheduler: vi.fn(),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(),
  fetchSchedulers: vi.fn(),
  getVideoDetail: vi.fn(),
}))

vi.mock('../services/api', () => ({
  apiService: { submitTask, createScheduler, getVideoDetail },
}))

vi.mock('../stores/settings', () => ({
  useSettingsStore: {
    getState: () => ({
      settings: { storage: { download_path: '/downloads' } },
      fetchSettings: vi.fn(),
    }),
  },
}))

const video: VideoInfo = {
  bvid: 'BV-current',
  title: '当前视频',
  cover: 'https://example.com/current.jpg',
}

const detail: VideoDetail = {
  pages: [
    { page: 1, cid: 101, part: '当前 P1', duration: 10 },
    { page: 2, cid: 102, part: '当前 P2', duration: 20 },
  ],
  ugc_season: {
    title: '合集标题',
    cover: 'https://example.com/series.jpg',
    sections: [{ episodes: [
      { bvid: 'BV-1', cid: 201, title: '合集 1', cover: 'https://example.com/1.jpg' },
      { bvid: 'BV-2', cid: 202, title: '合集 2', cover: 'https://example.com/2.jpg' },
    ] }],
  },
}

const createEvent = () => ({
  stopPropagation: vi.fn(),
  currentTarget: { disabled: false },
}) as unknown as React.MouseEvent

const createQueueTask = (id: string, state: string, meta: Record<string, unknown> = {}) => ({
  id,
  media_id: video.bvid,
  state,
  meta,
})

describe('getDownloadParts', () => {
  it('uses current submission pages while keeping collection episodes separate', () => {
    expect(getDownloadParts(video, detail)).toEqual([
      { bvid: 'BV-current', cid: 101, page: 1, title: '当前 P1', cover: 'https://example.com/current.jpg', duration: 10 },
      { bvid: 'BV-current', cid: 102, page: 2, title: '当前 P2', cover: 'https://example.com/current.jpg', duration: 20 },
    ])
    expect(getCollectionParts(video, detail).map(part => part.bvid)).toEqual(['BV-1', 'BV-2'])
  })
})

describe('getDownloadParts fixtures', () => {
  const fixtureVideo: VideoInfo = {
    bvid: 'BV-current',
    title: '当前视频',
    cover: 'https://example.com/current.jpg',
  }
  const fixtureDetail: VideoDetail = {
    pages: [
      { page: 1, cid: 101, part: '当前 P1', duration: 10 },
      { page: 2, cid: 102, part: '当前 P2', duration: 10 },
    ],
    ugc_season: {
      title: '合集标题',
      cover: 'https://example.com/series.jpg',
      sections: [{
        title: '正片',
        episodes: [
          { bvid: 'BV-1', cid: 201, title: '合集 1', cover: 'https://example.com/1.jpg' },
          { bvid: 'BV-2', cid: 202, title: '合集 2', cover: 'https://example.com/2.jpg' },
          { bvid: 'BV-3', cid: 203, title: '合集 3', cover: 'https://example.com/3.jpg' },
        ],
      }],
    },
  }

  it('returns all current submission pages with their full metadata', () => {
    expect(getDownloadParts(fixtureVideo, fixtureDetail)).toEqual([
      { bvid: 'BV-current', cid: 101, page: 1, title: '当前 P1', cover: 'https://example.com/current.jpg', duration: 10 },
      { bvid: 'BV-current', cid: 102, page: 2, title: '当前 P2', cover: 'https://example.com/current.jpg', duration: 10 },
    ])
  })

  it('returns all collection episodes with their full metadata', () => {
    expect(getCollectionParts(fixtureVideo, fixtureDetail)).toEqual([
      { bvid: 'BV-1', cid: 201, page: 1, title: '合集 1', cover: 'https://example.com/1.jpg', duration: undefined },
      { bvid: 'BV-2', cid: 202, page: 2, title: '合集 2', cover: 'https://example.com/2.jpg', duration: undefined },
      { bvid: 'BV-3', cid: 203, page: 3, title: '合集 3', cover: 'https://example.com/3.jpg', duration: undefined },
    ])
  })

  it('falls back to current pages for a non-collection video', () => {
    const nonCollectionVideo: VideoInfo = {
      bvid: 'BV-single',
      title: '普通多P',
      cover: 'https://example.com/single.jpg',
    }
    const nonCollectionDetail: VideoDetail = {
      pages: [
        { page: 1, cid: 301, part: 'P1', duration: 20 },
        { page: 2, cid: 302, part: 'P2', duration: 30 },
      ],
    }

    expect(getDownloadParts(nonCollectionVideo, nonCollectionDetail)).toEqual([
      { bvid: 'BV-single', cid: 301, page: 1, title: 'P1', cover: 'https://example.com/single.jpg', duration: 20 },
      { bvid: 'BV-single', cid: 302, page: 2, title: 'P2', cover: 'https://example.com/single.jpg', duration: 30 },
    ])
  })
})

describe('enqueueVideoDownload', () => {
  it('uses only selected pages and forwards metadata options', async () => {
    submitTask.mockResolvedValueOnce({ success: true, data: { id: 'task-p2' } })

    const result = await enqueueVideoDownload({
      video,
      detail,
      selectedPages: new Set([2]),
      metadataOptions: {
        quality: 80,
        output_format: 'mp4',
        enable_subtitle: true,
        enable_nfo: false,
        enable_cover: true,
        enable_avatar: false,
      },
    })

    expect(result).toMatchObject({ addedCount: 1, skippedCount: 0, taskIds: ['task-p2'] })
    expect(submitTask).toHaveBeenCalledTimes(1)
    expect(submitTask).toHaveBeenCalledWith(expect.objectContaining({
      title: '当前 P2',
      media_type: 'video',
      media_id: 'BV-current',
      meta: expect.objectContaining({
        cid: 102,
        page: 2,
        quality: 80,
        output_format: 'mp4',
        enable_subtitle: true,
        enable_nfo: false,
        enable_cover: true,
        enable_avatar: false,
        collection_title: '合集标题',
        output_subdir: 'P02 - 当前视频',
      }),
    }))
  })

  it('skips existing non-completed matching pages', async () => {
    submitTask.mockClear()
    const result = await enqueueVideoDownload({
      video,
      detail,
      selectedPages: new Set([2]),
      currentTasks: { existing: createQueueTask('existing', 'active', { page: 2, cid: 102 }) },
    })

    expect(result).toMatchObject({ addedCount: 0, skippedCount: 1, taskIds: [] })
    expect(submitTask).not.toHaveBeenCalled()
  })
})

describe('useVideoDownload.toggleDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useNewQueueStore.setState({ tasks: {}, fetchTasks, fetchSchedulers, deleteTask } as never)
    localStorage.setItem('sessdata', 'test-sessdata')
    submitTask.mockResolvedValue({ success: true, data: { id: 'new-task' } })
    createScheduler.mockResolvedValue({ success: true, data: { id: 'scheduler-1' } })
  })

  it('blocks a completed whole-video task unless forceRedownload is set', async () => {
    useNewQueueStore.setState({ tasks: { completed: createQueueTask('completed', 'completed') } } as never)
    const { result } = renderHook(() => useVideoDownload())

    let blockedResult: Awaited<ReturnType<typeof result.current.toggleDownload>>
    await act(async () => {
      blockedResult = await result.current.toggleDownload(video, createEvent())
    })

    expect(blockedResult!.success).toBe(false)
    expect(submitTask).not.toHaveBeenCalled()
  })

  it('deletes the completed task and submits again for forceRedownload', async () => {
    useNewQueueStore.setState({
      tasks: { completed: createQueueTask('completed', 'completed') },
      deleteTask,
    } as never)
    const { result } = renderHook(() => useVideoDownload())

    await act(async () => {
      await result.current.toggleDownload(video, createEvent(), { forceRedownload: true })
    })

    expect(deleteTask).toHaveBeenCalledWith('completed')
    expect(submitTask).toHaveBeenCalledWith(expect.objectContaining({ media_type: 'video', media_id: video.bvid }))
  })

  it('allows a selected completed page to be re-enqueued after deleting the old task', async () => {
    getVideoDetail.mockResolvedValue({ success: true, data: detail })
    useNewQueueStore.setState({
      tasks: { completed: createQueueTask('completed', 'completed', { page: 2, cid: 102 }) },
      deleteTask,
    } as never)
    const { result } = renderHook(() => useVideoDownload())

    await act(async () => {
      await result.current.toggleDownload({ ...video, pages: detail.pages } as VideoInfo & VideoDetail, createEvent(), { selectedPages: new Set([2]) })
    })

    expect(deleteTask).toHaveBeenCalledWith('completed')
    expect(submitTask).toHaveBeenCalledWith(expect.objectContaining({
      title: '当前 P2',
      media_type: 'video',
      media_id: video.bvid,
      meta: expect.objectContaining({ cid: 102, page: 2 }),
    }))
  })
})
