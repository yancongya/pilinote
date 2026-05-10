export interface LocalPlaybackEntry {
  cid?: number
  path: string
  exists: boolean
  title?: string
}

export interface LocalPlaybackMap {
  bvid: string
  entries: LocalPlaybackEntry[]
}

export interface VideoPageEntry {
  cid: number
  part?: string
  page: number
  duration: number
}

export interface PlayablePageEntry extends VideoPageEntry {
  playable: boolean
  localPath: string | null
}

const isPlayableEntry = (entry: LocalPlaybackEntry): boolean =>
  entry.exists && Boolean(entry.path && entry.path.trim())

const parsePageNumberFromEntry = (entry: LocalPlaybackEntry): number | null => {
  const text = `${entry.title || ''} ${entry.path || ''}`
  const match = text.match(/(?:^|[\\/\\s_-])P?0*(\d{1,3})(?=\s|[.、．_-]|$)/i)
  if (!match) return null
  const page = Number(match[1])
  return Number.isFinite(page) && page > 0 ? page : null
}

export const getPlayableEntries = (
  playbackMap: LocalPlaybackMap | null | undefined
): LocalPlaybackEntry[] => {
  if (!playbackMap?.entries?.length) {
    return []
  }

  return playbackMap.entries
    .filter(isPlayableEntry)
    .sort((left, right) => {
      const leftPage = parsePageNumberFromEntry(left)
      const rightPage = parsePageNumberFromEntry(right)

      if (leftPage && rightPage && leftPage !== rightPage) {
        return leftPage - rightPage
      }
      if (leftPage && !rightPage) {
        return -1
      }
      if (!leftPage && rightPage) {
        return 1
      }

      return left.path.localeCompare(right.path, 'zh-CN')
    })
}

export const selectInitialPlayableEntry = (
  playbackMap: LocalPlaybackMap | null | undefined,
  currentCid?: number
): LocalPlaybackEntry | null => {
  const playableEntries = getPlayableEntries(playbackMap)
  if (playableEntries.length === 0) {
    return null
  }

  if (currentCid) {
    const currentEntry = playableEntries.find(entry => entry.cid === currentCid)
    if (currentEntry) {
      return currentEntry
    }
  }

  const hasCidBoundEntries = playableEntries.some(entry => typeof entry.cid === 'number')
  if (!hasCidBoundEntries) {
    return playableEntries[0]
  }

  return playableEntries[0]
}

export const buildPlayablePages = (
  pages: VideoPageEntry[],
  playbackMap: LocalPlaybackMap | null | undefined
): PlayablePageEntry[] => {
  const playableEntriesByCid = new Map<number, LocalPlaybackEntry>()
  const playableEntriesByPage = new Map<number, LocalPlaybackEntry>()

  getPlayableEntries(playbackMap).forEach(entry => {
    if (typeof entry.cid === 'number') {
      playableEntriesByCid.set(entry.cid, entry)
    }
    const pageNumber = parsePageNumberFromEntry(entry)
    if (pageNumber && !playableEntriesByPage.has(pageNumber)) {
      playableEntriesByPage.set(pageNumber, entry)
    }
  })

  return pages.map(page => {
    const matchedEntry = playableEntriesByCid.get(page.cid) || playableEntriesByPage.get(page.page)

    return {
      ...page,
      playable: Boolean(matchedEntry),
      localPath: matchedEntry?.path || null
    }
  })
}
