import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import AiNotePanel from '../index'

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
  it('renders the mindmap tab entry', async () => {
    render(
      <MemoryRouter initialEntries={['/video/BV1x/ai-note']}>
        <Routes>
          <Route path="/video/:videoId/ai-note" element={<AiNotePanel />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '导图' })).toBeTruthy()
  })
})
