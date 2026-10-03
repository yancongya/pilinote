import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'


type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

const mocks = vi.hoisted(() => ({
  authUser: null as null | { sessdata: string },
  getVideoDetail: vi.fn(),
  getLocalPlaybackMap: vi.fn(),
  getLocalOpusContent: vi.fn(),
  parseDownloadUrl: vi.fn(),
  getLocalFile: vi.fn(),
  readDetailCache: vi.fn(),
  writeDetailCache: vi.fn(),
  checkBeforeAdd: vi.fn(),
  queueStore: {
    tasks: {},
    forceClearCache: vi.fn(),
    fetchTasks: vi.fn().mockResolvedValue(undefined),
    fetchSchedulers: vi.fn().mockResolvedValue(undefined),
    createTask: vi.fn(),
    createScheduler: vi.fn(),
  },
  playbackController: {
    videoElementRef: { current: null },
    isVideoPlaying: false,
    isVideoPinned: false,
    localVideoDurationSeconds: 0,
    queueSeek: vi.fn(),
    playAt: vi.fn(),
    toggleVideoPinned: vi.fn(),
    handlePlay: vi.fn(),
    handlePause: vi.fn(),
    handleEnded: vi.fn(),
    handleLoadedMetadata: vi.fn(),
    handleDurationChange: vi.fn(),
    resetForPoster: vi.fn(),
  },
}))

vi.mock('../../services/api', () => ({
  apiService: {
    getVideoDetail: mocks.getVideoDetail,
    getLocalPlaybackMap: mocks.getLocalPlaybackMap,
    getLocalOpusContent: mocks.getLocalOpusContent,
    parseDownloadUrl: mocks.parseDownloadUrl,
    getLocalFile: mocks.getLocalFile,
  },
}))

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ user: mocks.authUser }),
}))

vi.mock('../../stores/newQueue', () => ({
  useNewQueueStore: () => mocks.queueStore,
}))

vi.mock('../../hooks/useVideoDownload', () => ({
  useVideoDownload: () => ({ toggleDownload: vi.fn() }),
  getCollectionParts: () => [],
  getDownloadParts: (_summary: unknown, detail: { pages?: unknown[] }) =>
    detail.pages || [],
}))

vi.mock('../../hooks/useLocalVideoPlayback', () => ({
  useLocalVideoPlayback: () => mocks.playbackController,
}))

vi.mock('../../services/videoLibraryService', () => ({
  videoLibraryService: {
    checkBeforeAdd: mocks.checkBeforeAdd,
  },
}))

vi.mock('../../config/api', () => ({
  getAvatarProxyUrl: (value: string) => value,
  getLocalImageUrl: (value: string) => value,
  getLocalVideoUrl: (value: string) => value,
}))

vi.mock('../../components/AlertModal', () => ({
  default: () => null,
}))

vi.mock('../components/VideoDetailPresenters', () => ({
  VideoDetailSkeleton: () => <div data-testid="detail-loading">loading</div>,
  VideoDetailComments: () => null,
  VideoDetailAiNotePanel: ({ markdown }: { markdown: string }) => (
    <div data-testid="ai-note-markdown">{markdown}</div>
  ),
}))

vi.mock('../videoDetailCache', async importOriginal => {
  const actual = await importOriginal<typeof import('../videoDetailCache')>()
  return {
    ...actual,
    readDetailCache: mocks.readDetailCache,
    writeDetailCache: mocks.writeDetailCache,
  }
})

vi.mock('../videoDetailOpus', async importOriginal => {
  const actual = await importOriginal<typeof import('../videoDetailOpus')>()
  return {
    ...actual,
    parseLocalOpusMarkdown: () => [],
  }
})

vi.mock('../videoDetailDownloadPayloads', () => ({
  buildCollectionTaskPayload: () => ({}),
  buildDetailDownloadOptions: () => ({}),
  buildOpusTaskPayload: () => ({}),
  buildSchedulerPayload: () => ({}),
}))

import VideoDetailPage from '../VideoDetailPage'
import { buildDetailCacheKey } from '../videoDetailCache'


function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function videoResponse(id: string) {
  return {
    success: true,
    data: {
      bvid: id,
      aid: id,
      title: `Video ${id}`,
      desc: `Description ${id}`,
      owner: { name: 'Uploader', face: '', mid: 1 },
      stat: {
        view: 1,
        danmaku: 2,
        reply: 3,
        favorite: 4,
        coin: 5,
        share: 6,
        like: 7,
      },
      pubdate: 1,
      duration: 60,
      pic: `${id}.jpg`,
      cid: Number(id.replace(/\D/g, '')) || 1,
      pages: [],
      dimension: null,
      rights: {},
      descV2: [],
      staff: null,
      ugc_season: null,
      comments: [],
    },
  }
}

function cachedVideo(id: string) {
  return {
    video: {
      bvid: id,
      aid: id,
      title: `Cached ${id}`,
      description: '',
      isOpus: false,
      uploader: { name: 'Uploader', avatar: '', mid: 1 },
      view: 0,
      danmaku: 0,
      reply: 0,
      favorite: 0,
      coin: 0,
      share: 0,
      like: 0,
      pubtime: 1,
      duration: 60,
      cover: `${id}.jpg`,
      cid: 1,
      pages: [],
      dimension: null,
      rights: {},
      descV2: [],
      staff: null,
      ugcSeason: null,
      comments: [],
    },
    localOpusContent: null,
    timestamp: Date.now(),
  }
}

function localOpusResponse(id: string) {
  return {
    success: true,
    data: {
      opus_id: id,
      title: `Opus ${id}`,
      markdown_content: `# Opus ${id}`,
      folder_path: `/opus/${id}`,
      cover_path: '',
      avatar_path: '',
      nfo_data: {},
    },
  }
}

function playbackResponse(id: string) {
  return {
    success: true,
    data: {
      bvid: id,
      folder_path: `/library/${id}`,
      entries: [
        {
          cid: Number(id.replace(/\D/g, '')) || 1,
          path: `/library/${id}/${id}.mp4`,
          exists: true,
          title: id,
        },
      ],
    },
  }
}

function Navigation() {
  const navigate = useNavigate()
  return (
    <nav>
      <button type="button" onClick={() => navigate('/video/B2')}>video B</button>
      <button type="button" onClick={() => navigate('/video/A1')}>video A</button>
      <button type="button" onClick={() => navigate('/opus/cvB2')}>opus B</button>
      <button type="button" onClick={() => navigate('/gone')}>leave</button>
    </nav>
  )
}

function renderRoutes(initialEntry = '/video/A1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Navigation />
      <Routes>
        <Route path="/video/:videoId" element={<VideoDetailPage />} />
        <Route path="/opus/:opusId" element={<VideoDetailPage type="opus" />} />
        <Route path="/gone" element={<div>gone</div>} />
      </Routes>
    </MemoryRouter>
  )
}

async function resolveRequest<T>(request: Deferred<T>, value: T) {
  await act(async () => {
    request.resolve(value)
    await request.promise
  })
}

async function rejectRequest<T>(request: Deferred<T>, reason = new Error('failed')) {
  await act(async () => {
    request.reject(reason)
    try {
      await request.promise
    } catch {
      return
    }
  })
}

describe('VideoDetailPage route request ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authUser = null
    mocks.readDetailCache.mockReturnValue(null)
    mocks.getLocalPlaybackMap.mockResolvedValue({ success: false })
    mocks.getLocalOpusContent.mockResolvedValue({ success: false })
    mocks.parseDownloadUrl.mockResolvedValue({ success: false, message: 'missing' })
    mocks.getLocalFile.mockResolvedValue({ success: false, error: 'missing' })
    mocks.checkBeforeAdd.mockResolvedValue({ success: true })
  })

  it('ignores an old successful detail response after a newer route succeeds', async () => {
    const requestA = deferred<ReturnType<typeof videoResponse>>()
    const requestB = deferred<ReturnType<typeof videoResponse>>()
    mocks.getVideoDetail.mockImplementation((id: string) =>
      id === 'A1' ? requestA.promise : requestB.promise
    )

    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: 'video B' }))
    await resolveRequest(requestB, videoResponse('B2'))
    expect(await screen.findByRole('heading', { name: 'Video B2' })).toBeTruthy()

    await resolveRequest(requestA, videoResponse('A1'))

    expect(screen.getByRole('heading', { name: 'Video B2' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Video A1' })).toBeNull()
    expect(mocks.writeDetailCache).not.toHaveBeenCalledWith(
      buildDetailCacheKey('video', 'A1'),
      expect.anything()
    )
  })

  it('ignores an old failed detail response after a newer route succeeds', async () => {
    const requestA = deferred<ReturnType<typeof videoResponse>>()
    const requestB = deferred<ReturnType<typeof videoResponse>>()
    mocks.getVideoDetail.mockImplementation((id: string) =>
      id === 'A1' ? requestA.promise : requestB.promise
    )

    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: 'video B' }))
    await resolveRequest(requestB, videoResponse('B2'))
    await rejectRequest(requestA)

    expect(screen.getByRole('heading', { name: 'Video B2' })).toBeTruthy()
    expect(screen.queryByText('网络请求失败')).toBeNull()
  })

  it('ignores an old unsuccessful detail response after a newer route succeeds', async () => {
    const requestA = deferred<{ success: boolean; message: string }>()
    const requestB = deferred<ReturnType<typeof videoResponse>>()
    mocks.getVideoDetail.mockImplementation((id: string) =>
      id === 'A1' ? requestA.promise : requestB.promise
    )

    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: 'video B' }))
    await resolveRequest(requestB, videoResponse('B2'))
    await resolveRequest(requestA, { success: false, message: 'old failure' })

    expect(screen.getByRole('heading', { name: 'Video B2' })).toBeTruthy()
    expect(screen.queryByText('old failure')).toBeNull()
  })

  it('does not let an old finally finish loading for the current route', async () => {
    const requestA = deferred<ReturnType<typeof videoResponse>>()
    const requestB = deferred<ReturnType<typeof videoResponse>>()
    mocks.getVideoDetail.mockImplementation((id: string) =>
      id === 'A1' ? requestA.promise : requestB.promise
    )
    mocks.readDetailCache.mockImplementation((key: string) =>
      key.endsWith('B2') ? cachedVideo('B2') : null
    )

    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: 'video B' }))
    expect(screen.getByTestId('detail-loading')).toBeTruthy()

    await rejectRequest(requestA)

    expect(screen.getByTestId('detail-loading')).toBeTruthy()
    await resolveRequest(requestB, videoResponse('B2'))
  })

  it('keeps the newest A request during an A-B-A navigation sequence', async () => {
    const firstA = deferred<ReturnType<typeof videoResponse>>()
    const requestB = deferred<ReturnType<typeof videoResponse>>()
    const secondA = deferred<ReturnType<typeof videoResponse>>()
    mocks.getVideoDetail
      .mockImplementationOnce(() => firstA.promise)
      .mockImplementationOnce(() => requestB.promise)
      .mockImplementationOnce(() => secondA.promise)

    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: 'video B' }))
    fireEvent.click(screen.getByRole('button', { name: 'video A' }))
    await resolveRequest(secondA, videoResponse('A3'))
    expect(await screen.findByRole('heading', { name: 'Video A3' })).toBeTruthy()

    await resolveRequest(firstA, videoResponse('A1'))

    expect(screen.getByRole('heading', { name: 'Video A3' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Video A1' })).toBeNull()
    await resolveRequest(requestB, videoResponse('B2'))
  })

  it('does not update state or cache after the page unmounts', async () => {
    const requestA = deferred<ReturnType<typeof videoResponse>>()
    mocks.getVideoDetail.mockReturnValue(requestA.promise)

    renderRoutes()
    fireEvent.click(screen.getByRole('button', { name: 'leave' }))
    expect(screen.getByText('gone')).toBeTruthy()

    await resolveRequest(requestA, videoResponse('A1'))

    expect(mocks.writeDetailCache).not.toHaveBeenCalled()
    expect(screen.getByText('gone')).toBeTruthy()
  })

  it('keeps cached detail visible when its background refresh fails', async () => {
    const requestA = deferred<ReturnType<typeof videoResponse>>()
    mocks.readDetailCache.mockReturnValue(cachedVideo('A1'))
    mocks.getVideoDetail.mockReturnValue(requestA.promise)

    renderRoutes()
    await rejectRequest(requestA)

    expect(screen.getByRole('heading', { name: 'Cached A1' })).toBeTruthy()
    expect(screen.queryByText('网络请求失败')).toBeNull()
  })

  it('does not start a remote opus request when an obsolete local request fails', async () => {
    const localA = deferred<ReturnType<typeof localOpusResponse>>()
    const localB = deferred<ReturnType<typeof localOpusResponse>>()
    mocks.getLocalOpusContent.mockImplementation((id: string) =>
      id === 'cvA1' ? localA.promise : localB.promise
    )

    renderRoutes('/opus/cvA1')
    fireEvent.click(screen.getByRole('button', { name: 'opus B' }))
    await resolveRequest(localB, localOpusResponse('cvB2'))
    expect(await screen.findByRole('heading', { name: 'Opus cvB2' })).toBeTruthy()

    await rejectRequest(localA)

    expect(mocks.parseDownloadUrl).not.toHaveBeenCalledWith('cvA1')
    expect(screen.getByRole('heading', { name: 'Opus cvB2' })).toBeTruthy()
  })

  it('does not let an old playback map replace the current route map', async () => {
    const detailA = deferred<ReturnType<typeof videoResponse>>()
    const detailB = deferred<ReturnType<typeof videoResponse>>()
    const mapA = deferred<ReturnType<typeof playbackResponse>>()
    const mapB = deferred<ReturnType<typeof playbackResponse>>()
    mocks.getVideoDetail.mockImplementation((id: string) =>
      id === 'A1' ? detailA.promise : detailB.promise
    )
    mocks.getLocalPlaybackMap.mockImplementation((id: string) =>
      id === 'A1' ? mapA.promise : mapB.promise
    )

    renderRoutes()
    await resolveRequest(detailA, videoResponse('A1'))
    fireEvent.click(screen.getByRole('button', { name: 'video B' }))
    await resolveRequest(detailB, videoResponse('B2'))
    await resolveRequest(mapB, playbackResponse('B2'))
    await resolveRequest(mapA, playbackResponse('A1'))

    fireEvent.click(screen.getByTitle('点击播放本地视频'))

    expect(screen.getByRole('heading', { name: 'Video B2' })).toBeTruthy()
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      '/library/B2/B2.mp4'
    )
  })

  it('restarts same-video detail and map requests when authentication changes', async () => {
    const oldDetail = deferred<ReturnType<typeof videoResponse>>()
    const newDetail = deferred<ReturnType<typeof videoResponse>>()
    const oldMap = deferred<ReturnType<typeof playbackResponse>>()
    const newMap = deferred<ReturnType<typeof playbackResponse>>()
    mocks.authUser = { sessdata: 'old-session' }
    mocks.readDetailCache.mockReturnValue(cachedVideo('A1'))
    mocks.getVideoDetail
      .mockImplementationOnce(() => oldDetail.promise)
      .mockImplementationOnce(() => newDetail.promise)
    mocks.getLocalPlaybackMap
      .mockImplementationOnce(() => oldMap.promise)
      .mockImplementationOnce(() => newMap.promise)
    mocks.getLocalFile.mockResolvedValue({
      success: true,
      data: '# Existing AI note',
      folder_path: '/library/A1',
    })

    const view = renderRoutes()
    await waitFor(() => expect(mocks.getLocalFile).toHaveBeenCalled())
    await waitFor(() => expect(mocks.getLocalPlaybackMap).toHaveBeenCalledTimes(1))
    mocks.getLocalFile.mockClear()
    mocks.getLocalFile.mockResolvedValue({
      success: true,
      data: '# Authenticated AI note',
      folder_path: '/library/A1',
    })

    mocks.authUser = { sessdata: 'new-session' }
    view.rerender(
      <MemoryRouter initialEntries={['/video/A1']}>
        <Navigation />
        <Routes>
          <Route path="/video/:videoId" element={<VideoDetailPage />} />
          <Route path="/opus/:opusId" element={<VideoDetailPage type="opus" />} />
          <Route path="/gone" element={<div>gone</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(mocks.getVideoDetail).toHaveBeenLastCalledWith('A1', 'new-session')
    )
    await waitFor(() => expect(mocks.getLocalFile).toHaveBeenCalled())
    await waitFor(() => expect(mocks.getLocalPlaybackMap).toHaveBeenCalledTimes(2))
    await resolveRequest(newDetail, videoResponse('A1'))
    await resolveRequest(newMap, playbackResponse('A1-new'))
    await resolveRequest(oldDetail, videoResponse('A1'))
    await resolveRequest(oldMap, playbackResponse('A1-old'))

    expect(await screen.findByText('# Authenticated AI note')).toBeTruthy()
    fireEvent.click(screen.getByTitle('点击播放本地视频'))
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      '/library/A1-new/A1-new.mp4'
    )
  })
})
