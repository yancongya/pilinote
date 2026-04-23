import type { AiNotePipelineMode, AiTraceStep, NoteResponse } from './aiNote'
import type { AiNoteStreamState } from './aiNoteStreamState'
import type { SeriesEpisodeState, SeriesQueueSummary } from '../components/ai/seriesAnalysis'

export interface AiNoteModalBaseCacheSnapshot {
  version: 1
  kind: 'single' | 'series'
  videoId: string
  pipelineMode: AiNotePipelineMode
  seriesFingerprint?: string
  updatedAt: number
  viewState: 'config' | 'result'
  note: NoteResponse | null
  error: string | null
  trace: AiTraceStep[]
  streamState: AiNoteStreamState
  controlState: 'running' | 'paused' | 'cancelled' | 'completed'
  activeNoteId: string | null
  selectedTraceItemId: string | null
}

export interface AiNoteModalSingleCacheSnapshot extends AiNoteModalBaseCacheSnapshot {
  kind: 'single'
}

export interface AiNoteModalSeriesCacheSnapshot extends AiNoteModalBaseCacheSnapshot {
  kind: 'series'
  seriesEpisodeStates: SeriesEpisodeState[]
  seriesEpisodeRuntimeStates: Record<string, AiNoteStreamState>
  seriesRunSummary: SeriesQueueSummary
  activeSeriesEpisodeId: string | null
}

export type AiNoteModalCacheSnapshot =
  | AiNoteModalSingleCacheSnapshot
  | AiNoteModalSeriesCacheSnapshot

export interface AiNotePanelCacheSnapshot {
  version: 1
  kind: 'panel'
  videoId: string
  pipelineMode: AiNotePipelineMode
  updatedAt: number
  activeTab: 'subtitle' | 'note' | 'mindmap'
  noteMarkdown: string
  noteTitle: string
  resolvedFileId: string
  selectedSubtitleFilename: string
}

export interface BuildAiNoteModalCacheKeyInput {
  videoId: string
  pipelineMode: AiNotePipelineMode
  seriesFingerprint?: string
}

const STORAGE_PREFIX = 'pilinote_ai_note_modal_cache'
const PANEL_STORAGE_PREFIX = 'pilinote_ai_note_panel_cache'
const MEMORY_CACHE = new Map<string, AiNoteModalCacheSnapshot>()
const PANEL_MEMORY_CACHE = new Map<string, AiNotePanelCacheSnapshot>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

export const buildAiNoteModalCacheKey = (input: BuildAiNoteModalCacheKeyInput): string => {
  const parts = [
    STORAGE_PREFIX,
    input.pipelineMode,
    input.videoId,
    input.seriesFingerprint || 'single',
  ].map(part => encodeURIComponent(part))
  return parts.join(':')
}

export const buildAiNotePanelCacheKey = (input: BuildAiNoteModalCacheKeyInput): string => {
  const parts = [
    PANEL_STORAGE_PREFIX,
    input.pipelineMode,
    input.videoId,
    input.seriesFingerprint || 'single',
  ].map(part => encodeURIComponent(part))
  return parts.join(':')
}

const isCacheFresh = <T extends { updatedAt: number }>(snapshot: T): boolean => {
  return Date.now() - snapshot.updatedAt <= CACHE_TTL_MS
}

const readFromStorage = (cacheKey: string): AiNoteModalCacheSnapshot | null => {
  const memoryEntry = MEMORY_CACHE.get(cacheKey)
  if (memoryEntry && isCacheFresh(memoryEntry)) {
    return memoryEntry
  }

  if (!canUseSessionStorage()) {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    if (!raw) return null

    const parsed = JSON.parse(raw) as AiNoteModalCacheSnapshot
    if (!parsed || parsed.version !== 1 || !isCacheFresh(parsed)) {
      window.sessionStorage.removeItem(cacheKey)
      MEMORY_CACHE.delete(cacheKey)
      return null
    }

    MEMORY_CACHE.set(cacheKey, parsed)
    return parsed
  } catch {
    try {
      window.sessionStorage.removeItem(cacheKey)
    } catch {
      // ignore
    }
    MEMORY_CACHE.delete(cacheKey)
    return null
  }
}

const readPanelFromStorage = (cacheKey: string): AiNotePanelCacheSnapshot | null => {
  const memoryEntry = PANEL_MEMORY_CACHE.get(cacheKey)
  if (memoryEntry && isCacheFresh(memoryEntry)) {
    return memoryEntry
  }

  if (!canUseSessionStorage()) {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    if (!raw) return null

    const parsed = JSON.parse(raw) as AiNotePanelCacheSnapshot
    if (!parsed || parsed.version !== 1 || !isCacheFresh(parsed)) {
      window.sessionStorage.removeItem(cacheKey)
      PANEL_MEMORY_CACHE.delete(cacheKey)
      return null
    }

    PANEL_MEMORY_CACHE.set(cacheKey, parsed)
    return parsed
  } catch {
    try {
      window.sessionStorage.removeItem(cacheKey)
    } catch {
      // ignore
    }
    PANEL_MEMORY_CACHE.delete(cacheKey)
    return null
  }
}

const writeToStorage = (cacheKey: string, snapshot: AiNoteModalCacheSnapshot) => {
  MEMORY_CACHE.set(cacheKey, snapshot)

  if (!canUseSessionStorage()) {
    return
  }

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(snapshot))
  } catch {
    // storage may be unavailable or full; ignore and keep memory cache
  }
}

export const readAiNoteModalCache = (cacheKey: string): AiNoteModalCacheSnapshot | null => {
  return readFromStorage(cacheKey)
}

export const writeAiNoteModalCache = (cacheKey: string, snapshot: AiNoteModalCacheSnapshot): void => {
  writeToStorage(cacheKey, snapshot)
}

export const clearAiNoteModalCache = (cacheKey: string): void => {
  MEMORY_CACHE.delete(cacheKey)
  if (!canUseSessionStorage()) {
    return
  }
  try {
    window.sessionStorage.removeItem(cacheKey)
  } catch {
    // ignore
  }
}

export const readAiNotePanelCache = (cacheKey: string): AiNotePanelCacheSnapshot | null => {
  return readPanelFromStorage(cacheKey)
}

export const writeAiNotePanelCache = (cacheKey: string, snapshot: AiNotePanelCacheSnapshot): void => {
  PANEL_MEMORY_CACHE.set(cacheKey, snapshot)

  if (!canUseSessionStorage()) {
    return
  }

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(snapshot))
  } catch {
    // ignore
  }
}

export const clearAiNotePanelCache = (cacheKey: string): void => {
  PANEL_MEMORY_CACHE.delete(cacheKey)
  if (!canUseSessionStorage()) {
    return
  }
  try {
    window.sessionStorage.removeItem(cacheKey)
  } catch {
    // ignore
  }
}
