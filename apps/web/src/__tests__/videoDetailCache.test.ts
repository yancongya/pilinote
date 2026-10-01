import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildDetailCacheKey,
  readDetailCache,
  writeDetailCache,
  type VideoDetailCacheEntry,
} from '../pages/videoDetailCache'

const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000

const createEntry = (timestamp = Date.now()): VideoDetailCacheEntry => ({
  video: {
    bvid: 'BV1test', aid: 1, title: 'Test video', description: '', isOpus: false,
    uploader: { name: 'Tester', avatar: '', mid: 1 }, view: 0, danmaku: 0, reply: 0,
    favorite: 0, coin: 0, share: 0, like: 0, pubtime: 0, duration: 0, cover: '', cid: 1, pages: [],
  },
  localOpusContent: null,
  timestamp,
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  sessionStorage.clear()
})

describe('video detail cache', () => {
  it('returns a fresh memory entry without reading session storage', () => {
    const key = buildDetailCacheKey('video', 'memory-hit')
    const entry = createEntry()
    const getItem = vi.spyOn(Storage.prototype, 'getItem')

    writeDetailCache(key, entry)

    expect(readDetailCache(key)).toBe(entry)
    expect(getItem).not.toHaveBeenCalled()
  })

  it('treats the TTL boundary as fresh and later entries as expired', () => {
    vi.useFakeTimers()
    const now = new Date('2026-10-01T00:00:00.000Z')
    vi.setSystemTime(now)
    const boundaryKey = buildDetailCacheKey('video', 'ttl-boundary')
    const expiredKey = buildDetailCacheKey('video', 'ttl-expired')

    sessionStorage.setItem(boundaryKey, JSON.stringify(createEntry(now.getTime() - DETAIL_CACHE_TTL_MS)))
    sessionStorage.setItem(expiredKey, JSON.stringify(createEntry(now.getTime() - DETAIL_CACHE_TTL_MS - 1)))

    expect(readDetailCache(boundaryKey)?.timestamp).toBe(now.getTime() - DETAIL_CACHE_TTL_MS)
    expect(readDetailCache(expiredKey)).toBeNull()
    expect(sessionStorage.getItem(expiredKey)).toBeNull()
  })

  it('removes malformed session storage data and returns no entry', () => {
    const key = buildDetailCacheKey('video', 'bad-json')
    sessionStorage.setItem(key, '{')

    expect(readDetailCache(key)).toBeNull()
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  it('returns no entry when session storage reads throw', () => {
    const key = buildDetailCacheKey('video', 'read-failure')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')

    expect(readDetailCache(key)).toBeNull()
    expect(removeItem).toHaveBeenCalledWith(key)
  })

  it('propagates session storage getter failures', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked') })

    expect(() => readDetailCache(buildDetailCacheKey('video', 'getter-failure'))).toThrow('blocked')
  })

  it('keeps video and opus cache keys isolated', () => {
    const videoKey = buildDetailCacheKey('video', '123')
    const opusKey = buildDetailCacheKey('opus', '123')
    writeDetailCache(videoKey, createEntry())

    expect(videoKey).not.toBe(opusKey)
    expect(readDetailCache(opusKey)).toBeNull()
  })

  it('retains a memory entry when session storage writes throw', () => {
    const key = buildDetailCacheKey('video', 'write-failure')
    const entry = createEntry()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })

    writeDetailCache(key, entry)

    expect(readDetailCache(key)).toBe(entry)
  })

  it('replaces expired memory with fresh stored data and promotes it to memory', () => {
    vi.useFakeTimers()
    const now = Date.now()
    const key = buildDetailCacheKey('video', 'storage-refresh')
    writeDetailCache(key, createEntry(now - DETAIL_CACHE_TTL_MS - 1))
    const storedEntry = createEntry(now)
    sessionStorage.setItem(key, JSON.stringify(storedEntry))

    const restoredEntry = readDetailCache(key)
    expect(restoredEntry).toEqual(storedEntry)
    sessionStorage.removeItem(key)
    expect(readDetailCache(key)).toBe(restoredEntry)
  })

  it('keeps memory entries when session storage is unavailable', () => {
    const key = buildDetailCacheKey('video', 'storage-absent')
    const entry = createEntry()
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(undefined as unknown as Storage)

    expect(readDetailCache(key)).toBeNull()
    writeDetailCache(key, entry)
    expect(readDetailCache(key)).toBe(entry)
  })

  it('returns no entry even when malformed-data cleanup fails', () => {
    const key = buildDetailCacheKey('video', 'cleanup-failure')
    sessionStorage.setItem(key, '{')
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })

    expect(readDetailCache(key)).toBeNull()
  })
})
