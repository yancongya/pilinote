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

export const getPlayableEntries = (
  playbackMap: LocalPlaybackMap | null | undefined
): LocalPlaybackEntry[] => {
  if (!playbackMap?.entries?.length) {
    return []
  }

  return playbackMap.entries.filter(isPlayableEntry)
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

  return null
}

export const buildPlayablePages = (
  pages: VideoPageEntry[],
  playbackMap: LocalPlaybackMap | null | undefined
): PlayablePageEntry[] => {
  const playableEntriesByCid = new Map<number, LocalPlaybackEntry>()

  getPlayableEntries(playbackMap).forEach(entry => {
    if (typeof entry.cid === 'number') {
      playableEntriesByCid.set(entry.cid, entry)
    }
  })

  return pages.map(page => {
    const matchedEntry = playableEntriesByCid.get(page.cid)

    return {
      ...page,
      playable: Boolean(matchedEntry),
      localPath: matchedEntry?.path || null
    }
  })
}
