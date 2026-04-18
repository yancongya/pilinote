import { useSyncExternalStore } from 'react'
import { aiRuntimeStateService, type AiRuntimeState } from '../services/aiRuntimeState'

export function useAiRuntimeState(): AiRuntimeState {
  return useSyncExternalStore(
    aiRuntimeStateService.subscribe,
    () => aiRuntimeStateService.getState(),
    () => aiRuntimeStateService.getState(),
  )
}

