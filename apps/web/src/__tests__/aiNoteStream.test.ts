import { beforeEach, describe, expect, it, vi } from 'vitest'

import { aiNoteService } from '../services/aiNote'

describe('aiNoteService.analyzeStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses SSE data lines and forwards events in order', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"stage":"A","status":"processing"}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"stage":"B","status":"completed"}\n\n'))
        controller.close()
      },
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body,
    })
    vi.stubGlobal('fetch', fetchMock)

    const events: Array<{ stage: string; status: string }> = []
    await aiNoteService.analyzeStream(
      '/api/test/stream',
      { hello: 'world' },
      event => events.push({ stage: event.stage, status: event.status }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/test/stream'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      }),
    )
    expect(events).toEqual([
      { stage: 'A', status: 'processing' },
      { stage: 'B', status: 'completed' },
    ])
  })
})
