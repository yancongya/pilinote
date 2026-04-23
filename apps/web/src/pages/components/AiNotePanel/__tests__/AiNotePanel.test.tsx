import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import AiNotePanel, { getAiNoteTabFromHash, getAiNoteTabHash } from '../index'

vi.mock('../../../../services/api', () => ({
  apiService: {
    getLocalFile: vi.fn().mockResolvedValue({
      success: true,
      data: '# Note Title',
      file_path: '/tmp/demo.ai-note.md',
      folder_path: '/tmp',
    }),
  },
}))

vi.mock('../../../../services/aiNote', () => ({
  aiNoteService: {
    lookupNoteByVideo: vi.fn().mockResolvedValue({
      success: true,
      found: false,
      note: null,
    }),
  },
}))

vi.mock('../TranscriptTab', () => ({
  TranscriptTab: () => <div data-testid="subtitle-tab" />,
}))

vi.mock('../NoteTab', () => ({
  NoteTab: () => <div data-testid="note-tab" />,
}))

vi.mock('../MindMapTab', () => ({
  MindMapTab: () => <div data-testid="mindmap-tab" />,
}))

describe('AiNotePanel', () => {
  it('maps only supported hashes to tabs', () => {
    expect(getAiNoteTabFromHash('#subtitle')).toBe('subtitle')
    expect(getAiNoteTabFromHash('#note')).toBe('note')
    expect(getAiNoteTabFromHash('#mindmap')).toBe('mindmap')
    expect(getAiNoteTabFromHash('#something-else')).toBe('subtitle')
    expect(getAiNoteTabHash('subtitle')).toBe('#subtitle')
    expect(getAiNoteTabHash('note')).toBe('#note')
    expect(getAiNoteTabHash('mindmap')).toBe('#mindmap')
  })

  it('renders the mindmap tab entry', async () => {
    render(
      <MemoryRouter initialEntries={['/video/BV1x/ai']}>
        <Routes>
          <Route path="/video/:videoId/ai" element={<AiNotePanel />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '导图' })).toBeTruthy()
  })
})
