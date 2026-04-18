import { useEffect, useState } from 'react'
import { aiNoteService, type NoteResponse } from '../services/aiNote'

type LookupUiStatus = 'none' | 'processing' | 'completed' | 'failed'

interface UseAiNoteLookupResult {
  status: LookupUiStatus
  note: NoteResponse | null
  isLoading: boolean
}

function mapLookupStatus(note: NoteResponse | null): LookupUiStatus {
  if (!note) return 'none'
  if (note.status === 'processing' || note.status === 'pending') return 'processing'
  if (note.status === 'completed') return 'completed'
  if (note.status === 'failed') return 'failed'
  return 'none'
}

export function useAiNoteLookup(videoId?: string | null): UseAiNoteLookupResult {
  const [status, setStatus] = useState<LookupUiStatus>('none')
  const [note, setNote] = useState<NoteResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!videoId) {
        setStatus('none')
        setNote(null)
        return
      }

      setIsLoading(true)
      try {
        const lookup = await aiNoteService.lookupNoteByVideo(videoId)
        if (cancelled) return

        if (!lookup.success || !lookup.found || !lookup.note) {
          setStatus('none')
          setNote(null)
          return
        }

        setNote(lookup.note)
        setStatus(mapLookupStatus(lookup.note))
      } catch {
        if (cancelled) return
        setStatus('none')
        setNote(null)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [videoId])

  return { status, note, isLoading }
}
