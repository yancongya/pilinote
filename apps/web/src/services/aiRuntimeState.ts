import { getApiUrl } from '../config/api'

export interface AiRuntimeState {
  testedModels: Record<string, string[]>
  updatedAt: string
  source: 'remote' | 'local'
}

interface StoredAiRuntimeState {
  testedModels?: Record<string, string[]>
  updatedAt?: string
  source?: 'remote' | 'local'
}

const STORAGE_KEY = 'pilinote_ai_runtime_state'

type Listener = () => void

const listeners = new Set<Listener>()

const defaultState = (): AiRuntimeState => ({
  testedModels: {},
  updatedAt: '',
  source: 'local',
})

const normalizeTestedModels = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== 'object') return {}

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>((acc, [provider, models]) => {
    if (!Array.isArray(models)) return acc
    const normalized = models.map(item => String(item).trim()).filter(Boolean)
    if (normalized.length > 0) {
      acc[provider] = Array.from(new Set(normalized))
    }
    return acc
  }, {})
}

const readStoredState = (): AiRuntimeState => {
  if (typeof window === 'undefined') {
    return defaultState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as StoredAiRuntimeState
    return {
      testedModels: normalizeTestedModels(parsed.testedModels),
      updatedAt: parsed.updatedAt || '',
      source: parsed.source || 'local',
    }
  } catch {
    return defaultState()
  }
}

const writeStoredState = (state: AiRuntimeState) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const emit = () => {
  listeners.forEach(listener => {
    try {
      listener()
    } catch {
      // noop
    }
  })
}

const readRemoteRuntimeState = async (): Promise<AiRuntimeState | null> => {
  try {
    const response = await fetch(getApiUrl('/api/ai/runtime-state'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null)
    const runtimePayload = payload?.state || payload?.data?.state || payload
    const testedModels = normalizeTestedModels(
      runtimePayload?.testedModels || runtimePayload?.tested_models || payload?.data?.testedModels || payload?.data?.tested_models,
    )
    if (!Object.keys(testedModels).length) return null
    return {
      testedModels,
      updatedAt: String(
        runtimePayload?.updatedAt || runtimePayload?.updated_at || payload?.updatedAt || payload?.updated_at || new Date().toISOString(),
      ),
      source: 'remote',
    }
  } catch {
    return null
  }
}

const normalizeState = (state: Partial<AiRuntimeState> | null | undefined): AiRuntimeState => ({
  testedModels: normalizeTestedModels(state?.testedModels),
  updatedAt: state?.updatedAt || new Date().toISOString(),
  source: state?.source || 'local',
})

let cachedState = readStoredState()

export const aiRuntimeStateService = {
  getState(): AiRuntimeState {
    return cachedState
  },

  async refresh(): Promise<AiRuntimeState> {
    const remote = await readRemoteRuntimeState()
    if (remote) {
      cachedState = normalizeState(remote)
      writeStoredState(cachedState)
      emit()
      return cachedState
    }

    let nextState = readStoredState()

    cachedState = normalizeState(nextState)
    writeStoredState(cachedState)
    emit()
    return cachedState
  },

  async recordTestedModel(provider: string, model: string): Promise<AiRuntimeState> {
    const current = normalizeState(cachedState)
    const nextModels = new Set([...(current.testedModels[provider] || []), model].filter(Boolean))
    cachedState = {
      testedModels: {
        ...current.testedModels,
        [provider]: Array.from(nextModels),
      },
      updatedAt: new Date().toISOString(),
      source: 'local',
    }
    writeStoredState(cachedState)
    emit()
    return cachedState
  },

  async setTestedModels(testedModels: Record<string, string[]>): Promise<AiRuntimeState> {
    cachedState = {
      testedModels: normalizeTestedModels(testedModels),
      updatedAt: new Date().toISOString(),
      source: 'local',
    }
    writeStoredState(cachedState)
    emit()
    return cachedState
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
