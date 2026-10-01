import type { LocalOpusContent } from './videoDetailOpus'

export type DetailMediaType = 'video' | 'opus'

export interface VideoDetailData {
  bvid: string;
  aid: string | number;
  title: string;
  description: string;
  isOpus: boolean;
  uploader: { name: string; avatar: string; mid: number };
  view: number;
  danmaku: number;
  reply: number;
  favorite: number;
  coin: number;
  share: number;
  like: number;
  pubtime: number | string;
  duration: number;
  cover: string;
  cid: number;
  pages: any[];
  opusParagraphs?: any[];
  opusImages?: string[];
  dimension?: any;
  rights?: any;
  descV2?: any[];
  staff?: any;
  ugcSeason?: any;
  comments?: Array<{
    type: string;
    content: string;
    like: number;
    reply: number;
    author: string;
    time: number;
  }>;
  localOpus?: LocalOpusContent | null;
}

export interface VideoDetailCacheEntry {
  video: VideoDetailData
  localOpusContent: LocalOpusContent | null
  timestamp: number
}

const DETAIL_CACHE_PREFIX = 'video-detail-cache-v3'
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000
const detailPageMemoryCache = new Map<string, VideoDetailCacheEntry>()

const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

export const buildDetailCacheKey = (type: DetailMediaType, mediaId: string) =>
  `${DETAIL_CACHE_PREFIX}:${type}:${mediaId}`

export const readDetailCache = (cacheKey: string): VideoDetailCacheEntry | null => {
  const memoryEntry = detailPageMemoryCache.get(cacheKey)
  if (memoryEntry && Date.now() - memoryEntry.timestamp <= DETAIL_CACHE_TTL_MS) {
    return memoryEntry
  }

  if (!canUseSessionStorage()) {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    if (!raw) return null

    const parsed = JSON.parse(raw) as VideoDetailCacheEntry
    if (!parsed?.video || Date.now() - parsed.timestamp > DETAIL_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey)
      return null
    }

    detailPageMemoryCache.set(cacheKey, parsed)
    return parsed
  } catch {
    try {
      window.sessionStorage.removeItem(cacheKey)
    } catch {
    }
    return null
  }
}

export const writeDetailCache = (cacheKey: string, entry: VideoDetailCacheEntry) => {
  detailPageMemoryCache.set(cacheKey, entry)

  if (!canUseSessionStorage()) {
    return
  }

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(entry))
  } catch {
  }
}
