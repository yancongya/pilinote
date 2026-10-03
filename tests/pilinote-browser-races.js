async (page) => {
  const waitForMockState = async (predicate) => {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const state = await page.evaluate(() => window.__pilinoteReadMockState())
      if (predicate(state)) return state
      await page.waitForTimeout(50)
    }
    throw new Error('Timed out waiting for mock response state')
  }
  const navigate = async (path) => page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)

  await page.evaluate(() => {
    sessionStorage.removeItem('video-detail-cache-v3:video:BV1RACEA')
    sessionStorage.removeItem('video-detail-cache-v3:video:BV1RACEB')
  })
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => window.__pilinoteConfigureMock({
      resetCounts: true,
      clearRequests: true,
      delays: { detail: { BV1RACEA: 2000 }, playback: { BV1RACEA: 0 } },
  }))
  await navigate('/video/BV1RACEA')
  await waitForMockState(state => state.counts.detail.BV1RACEA === 1)
  await navigate('/video/BV1RACEB')
  await page.waitForFunction(() => document.querySelector('header h1')?.textContent === '竞态 B 当前详情')
  await waitForMockState(state => {
    const late = state.requests.find(request => request.url.endsWith('/api/video/BV1RACEA'))
    const current = state.requests.find(request => request.url.endsWith('/api/video/BV1RACEB'))
    return Boolean(late?.resolvedAt && current?.resolvedAt)
  })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const detailState = await page.evaluate(async () => ({
    title: document.querySelector('header h1')?.textContent,
    staleCache: sessionStorage.getItem('video-detail-cache-v3:video:BV1RACEA'),
    state: await window.__pilinoteReadMockState(),
  }))
  if (detailState.title !== '竞态 B 当前详情' || detailState.staleCache !== null) {
    throw new Error('Late detail overwrote the current page or cache')
  }
  const lateDetail = detailState.state.requests.find(request => request.url.endsWith('/api/video/BV1RACEA'))
  const currentDetail = detailState.state.requests.find(request => request.url.endsWith('/api/video/BV1RACEB'))
  if (!(lateDetail.resolvedAt > currentDetail.resolvedAt)) {
    throw new Error('Detail responses did not arrive out of order: ' + JSON.stringify({ lateDetail, currentDetail }))
  }

  await page.evaluate(() => window.__pilinoteConfigureMock({
    resetCounts: true,
    delays: { detail: { BV1RACEA: 0 }, playback: { BV1RACEA: 2000 } },
  }))
  await navigate('/video/BV1RACEA')
  await page.waitForFunction(() => document.querySelector('header h1')?.textContent === '竞态 A 迟到详情')
  await waitForMockState(state => state.counts.playback.BV1RACEA === 1)
  await navigate('/video/BV1RACEB')
  await waitForMockState(state => {
    const maps = state.requests.filter(request => request.url.includes('/api/video-library/playback/BV1RACE'))
    const late = maps.filter(request => request.url.endsWith('BV1RACEA')).at(-1)
    const current = maps.filter(request => request.url.endsWith('BV1RACEB')).at(-1)
    return Boolean(late?.resolvedAt && current?.resolvedAt)
  })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await waitForMockState(state => {
    const notes = state.requests.filter(request => request.url.includes('/api/local/file/'))
    return decodeURIComponent(notes.at(-1)?.url || '').includes('/mock/race-b/P1.mp4')
  })
  const finalState = await page.evaluate(async () => ({
    title: document.querySelector('header h1')?.textContent,
    state: await window.__pilinoteReadMockState(),
  }))
  const maps = finalState.state.requests.filter(request => request.url.includes('/api/video-library/playback/BV1RACE'))
  const lateMap = maps.filter(request => request.url.endsWith('BV1RACEA')).at(-1)
  const currentMap = maps.filter(request => request.url.endsWith('BV1RACEB')).at(-1)
  if (finalState.title !== '竞态 B 当前详情' || !(lateMap.resolvedAt > currentMap.resolvedAt)) {
    throw new Error('Playback-map race was not correctly exercised')
  }
  if (finalState.state.errors.length || finalState.state.unmocked.length) {
    throw new Error(JSON.stringify({ errors: finalState.state.errors, unmocked: finalState.state.unmocked }))
  }
  return {
    passed: ['late detail cannot write current page or cache', 'late playback map cannot replace current file'],
    detailOrder: { current: currentDetail.resolvedAt, late: lateDetail.resolvedAt },
    playbackOrder: { current: currentMap.resolvedAt, late: lateMap.resolvedAt },
    title: finalState.title,
  }
}
