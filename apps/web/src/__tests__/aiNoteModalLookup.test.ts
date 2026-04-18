import { describe, expect, it } from 'vitest'

import { deriveAiNoteModalStateFromLookup } from '../components/ai/AiNoteModal'
import type { NoteLookupResponse, NoteResponse } from '../services/aiNote'

function makeNote(partial: Partial<NoteResponse> = {}): NoteResponse {
  return {
    success: true,
    id: 'note_1',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  }
}

describe('deriveAiNoteModalStateFromLookup', () => {
  it('treats found=false as explicit absence (config view), not an error', () => {
    const lookup: NoteLookupResponse = {
      success: true,
      found: false,
      note: null,
    }

    expect(deriveAiNoteModalStateFromLookup(lookup)).toEqual({
      viewState: 'config',
      note: null,
      errorMessage: null,
      shouldPoll: false,
    })
  })

  it('maps processing to loading + polling', () => {
    const lookup: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'processing' }),
    }

    expect(deriveAiNoteModalStateFromLookup(lookup)).toEqual({
      viewState: 'loading',
      note: lookup.note,
      errorMessage: null,
      shouldPoll: true,
    })
  })

  it('maps pending to loading + polling (type consistency)', () => {
    const lookup: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'pending' }),
    }

    expect(deriveAiNoteModalStateFromLookup(lookup)).toEqual({
      viewState: 'loading',
      note: lookup.note,
      errorMessage: null,
      shouldPoll: true,
    })
  })

  it('maps completed/failed to result without polling', () => {
    const completed: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'completed', content: 'hello' }),
    }
    const failed: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'failed', error: 'boom' }),
    }

    expect(deriveAiNoteModalStateFromLookup(completed)).toEqual({
      viewState: 'result',
      note: completed.note,
      errorMessage: null,
      shouldPoll: false,
    })
    expect(deriveAiNoteModalStateFromLookup(failed)).toEqual({
      viewState: 'result',
      note: failed.note,
      errorMessage: null,
      shouldPoll: false,
    })
  })

  it('does not treat success=false (including HTTP 404 wrapped by apiService) as absence', () => {
    // `aiNoteService.lookupNoteByVideo` can return an ApiResponse-like object cast to NoteLookupResponse.
    // We must *not* interpret this as "not found" just because `found` is missing.
    const apiErrorLike = {
      success: false,
      message: 'Not Found',
      code: 404,
    }

    expect(deriveAiNoteModalStateFromLookup(apiErrorLike)).toEqual({
      viewState: 'result',
      note: null,
      errorMessage: 'Not Found',
      shouldPoll: false,
    })
  })
})

