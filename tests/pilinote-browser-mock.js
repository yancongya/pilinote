async (page) => {
const context = page.context()
const mockState = {
  requests: [],
  blocked: [],
  unmocked: [],
  errors: [],
  delays: { detail: {}, playback: {} },
  counts: { detail: {}, playback: {} },
  tasks: [],
  schedulers: [],
  nextTask: 1,
  nextScheduler: 1,
}
page.on('pageerror', (error) => mockState.errors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') mockState.errors.push(message.text())
})
await page.exposeFunction('__pilinoteReadMockState', () => mockState)
await page.exposeFunction('__pilinoteConfigureMock', (configuration) => {
  if (configuration.delays) mockState.delays = configuration.delays
  if (configuration.resetCounts) mockState.counts = { detail: {}, playback: {} }
  if (configuration.clearRequests) mockState.requests = []
  if (configuration.clearTasks) {
    mockState.tasks = []
    mockState.schedulers = []
  }
  return true
})

await context.addInitScript(() => {
  window.__PILINOTE_WS_DISABLED__ = true
  window.WebSocket = class DisabledWebSocket {
    constructor(url) {
      this.url = String(url)
      this.readyState = 3
      this.onopen = null
      this.onclose = null
      this.onerror = null
      this.onmessage = null
    }
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  }
})

const primaryVideo = {
  bvid: 'BV1TEST001',
  aid: 900001,
  title: '隔离回归样例：双分P合集投稿',
  desc: '由本地浏览器夹具模拟，不访问真实服务。',
  owner: { name: 'Mock 作者', mid: 9001, face: '' },
  stat: { view: 12345, danmaku: 45, reply: 12, favorite: 67, coin: 8, share: 9, like: 456 },
  pubdate: 1780000000,
  duration: 780,
  pic: '',
  cid: 91001,
  pages: [
    { page: 1, cid: 91001, part: '第一分P：准备', duration: 360 },
    { page: 2, cid: 91002, part: '第二分P：验证', duration: 420 },
  ],
  ugc_season: {
    title: '隔离回归合集',
    cover: '',
    sections: [{
      title: '测试章节',
      episodes: [
        { bvid: 'BV1TEST001', cid: 91001, title: '双分P合集投稿', page: 1, duration: 780 },
        { bvid: 'BV1TEST002', cid: 92001, title: '单视频合集投稿', page: 2, duration: 240 },
      ],
    }],
  },
}

const downloadedVideo = {
  bvid: 'BV1DOWN001',
  aid: 900002,
  title: '隔离回归样例：已下载确认',
  desc: '用于验证重新下载确认，不含真实媒体。',
  owner: { name: 'Mock 作者', mid: 9001, face: '' },
  stat: { view: 32, danmaku: 2, reply: 1, favorite: 3, coin: 0, share: 0, like: 7 },
  pubdate: 1780000000,
  duration: 90,
  pic: '',
  cid: 93001,
  pages: [{ page: 1, cid: 93001, part: '已下载视频', duration: 90 }],
}

const settings = {
  download: { default_quality: 80, audio_bitrate: 128, codec: 'avc', output_format: 'mp4', max_concurrent: 2, speed_limit: 0, metadata: { enable_nfo: false, enable_subtitle: false, enable_cover: false, enable_avatar: false } },
  storage: { download_path: '/mock/downloads', temp_path: '/mock/temp', auto_cleanup: false, keep_failed: true, sidecar: { ffmpeg: '', aria2c: '' } },
  general: { theme: 'dark', language: 'zh-CN', auto_download: false, clipboard_monitor: false },
  video_library: { cacheTTL: 10, autoRefreshDelay: 5, maxConcurrentChecks: 5, enableSmartRefresh: true },
  auto_download: { enabled: false, trigger_type: 'interval', scan_interval: 60, cron_expression: '', concurrent_limit: { video: 1, page: 1 }, custom_scan: { enabled: false, folder_list: [] }, watch_later_max: 10, auto_start_after_scan: false, storage_threshold_gb: 0 },
  llm: { provider: 'mock', base_url: '', model: 'mock', api_key: '', temperature: 0, providers: [] },
  ai_note: { llm: { provider: 'mock', base_url: '', model: 'mock', api_key: '', temperature: 0 }, style: { style: 'detailed', length: 1 }, format: { format: 'markdown', include_timestamp: true }, auto_analyze: false },
}

const markdown = '# 本地模拟 AI 笔记\n\n仅用于隔离浏览器回归。\n\n## 00:12 核心步骤\n\n验证预览与面板的本地 Markdown 渲染。'

const apiResponse = (data) => ({ success: true, data })
const wait = (milliseconds) => page.waitForTimeout(milliseconds)

const delayedRaceResponse = async (kind, id) => {
  const counts = mockState.counts[kind]
  counts[id] = (counts[id] || 0) + 1
  const configured = mockState.delays[kind][id]
  const milliseconds = typeof configured === 'number'
    ? configured
    : id === 'BV1RACEA' && counts[id] === 1
      ? 1500
      : 0
  if (milliseconds > 0) await wait(milliseconds)
  return milliseconds
}

await context.unroute('**/*')
await context.route('**/*', async (route) => {
  const json = (data, status = 200) => route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(data),
  })
  const request = route.request()
  const url = new URL(request.url())
  const requestRecord = {
    method: request.method(),
    url: request.url(),
    postData: request.postData(),
    action: '',
  }

  if (url.origin === 'http://127.0.0.1:5178' && !url.pathname.startsWith('/api')) {
    requestRecord.action = 'local-static-allowed'
    mockState.requests.push(requestRecord)
    await route.continue()
    return
  }

  if (url.pathname.startsWith('/api')) {
    requestRecord.action = 'mocked-api'
    mockState.requests.push(requestRecord)

    if (url.pathname === '/api/auth/status') {
      await json(apiResponse({ is_logged_in: false, user: null }))
      return
    }
    if (url.pathname === '/api/ai/runtime-state') {
      await json({ testedModels: { mock: ['mock'] }, updatedAt: '2026-10-03T08:00:00Z' })
      return
    }
    if (url.pathname === '/api/settings/') {
      await json(settings)
      return
    }
    if (url.pathname === '/api/queue/tasks' && request.method() === 'GET') {
      await json(apiResponse(mockState.tasks))
      return
    }
    if (url.pathname === '/api/queue/schedulers' && request.method() === 'GET') {
      await json(apiResponse(mockState.schedulers))
      return
    }
    if (url.pathname === '/api/queue/tasks' && request.method() === 'POST') {
      const task = JSON.parse(request.postData() || '{}')
      const id = `mock-task-${mockState.nextTask++}`
      mockState.tasks.push({ id, state: 'pending', ...task })
      await json(apiResponse({ id }))
      return
    }
    if (url.pathname === '/api/queue/schedulers' && request.method() === 'POST') {
      const scheduler = JSON.parse(request.postData() || '{}')
      const id = `mock-scheduler-${mockState.nextScheduler++}`
      mockState.schedulers.push({ id, ...scheduler })
      await json(apiResponse({ id }))
      return
    }
    if (url.pathname === '/api/video-library/refresh') {
      await json(apiResponse({ folders: [{ bvid: 'BV1DOWN001', title: '已下载测试视频', exists: true, videos: [{ cid: 93001, exists: true }] }], downloaded_bvids: ['BV1DOWN001'], folder_count: 1, total_files: 1 }))
      return
    }
    if (url.pathname.startsWith('/api/video-library/playback/')) {
      const id = decodeURIComponent(url.pathname.split('/').pop() || '')
      const delayMs = await delayedRaceResponse('playback', id)
      requestRecord.delayMs = delayMs
      const entries = id === 'BV1RACEA'
        ? [{ cid: 94001, path: '/mock/race-a/P1.mp4', exists: true, title: 'A stale map P1' }]
        : id === 'BV1RACEB'
          ? [{ cid: 94002, path: '/mock/race-b/P1.mp4', exists: true, title: 'B current map P1' }]
          : []
      await json(apiResponse({ bvid: id, entries }))
      requestRecord.resolvedAt = Date.now()
      return
    }
    if (url.pathname.startsWith('/api/video-library/check-batch')) {
      await json(apiResponse({ downloaded: ['BV1DOWN001'], not_downloaded: ['BV1TEST001', 'BV1TEST002'], details: {} }))
      return
    }
    if (url.pathname.startsWith('/api/local/versions/')) {
      await json(apiResponse(url.pathname.includes('subtitle-files')
        ? [{ name: 'mock.zh.srt', language: 'zh' }]
        : { versions: [], current: '' }))
      return
    }
    if (url.pathname.startsWith('/api/local/file/')) {
      const content = url.searchParams.get('file_type') === 'subtitle'
        ? '1\n00:00:00,000 --> 00:00:03,000\n隔离字幕样例\n'
        : markdown
      await json({ success: true, data: content, file_path: '/mock/downloads/BV1TEST001.ai-note.md', folder_path: '/mock/downloads' })
      return
    }
    if (url.pathname.startsWith('/api/video/')) {
      const id = decodeURIComponent(url.pathname.split('/').pop() || '')
      const delayMs = await delayedRaceResponse('detail', id)
      requestRecord.delayMs = delayMs
      const raceVideo = id === 'BV1RACEA' || id === 'BV1RACEB'
        ? {
            ...downloadedVideo,
            bvid: id,
            aid: id === 'BV1RACEA' ? 900004 : 900005,
            cid: id === 'BV1RACEA' ? 94001 : 94002,
            title: id === 'BV1RACEA' ? '竞态 A 迟到详情' : '竞态 B 当前详情',
            duration: 60,
            pages: [{ page: 1, cid: id === 'BV1RACEA' ? 94001 : 94002, part: id === 'BV1RACEA' ? 'A 单页' : 'B 单页', duration: 60 }],
          }
        : null
      const video = raceVideo || (id === 'BV1DOWN001' ? downloadedVideo : id === 'BV1TEST002'
        ? { ...primaryVideo, bvid: 'BV1TEST002', aid: 900003, title: '单视频合集投稿', cid: 92001, duration: 240, pages: [{ page: 1, cid: 92001, part: '单视频合集投稿', duration: 240 }], ugc_season: null }
        : primaryVideo)
      await json(apiResponse(video))
      requestRecord.resolvedAt = Date.now()
      return
    }

    requestRecord.action = 'unmocked-api-blocked'
    mockState.unmocked.push({ method: request.method(), url: request.url() })
    await json({ success: false, message: `No mock fixture for ${request.method()} ${url.pathname}` }, 501)
    return
  }

  requestRecord.action = 'external-blocked'
  mockState.blocked.push(requestRecord)
  await route.abort('blockedbyclient')
})
return { installed: true }
}
