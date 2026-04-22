import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NoteTab } from './NoteTab'

vi.mock('../../../services/api', () => ({
  apiService: {
    getLocalFile: vi.fn().mockResolvedValue({
      success: true,
      data: '# Title',
      file_path: '/tmp/demo.ai-note.md',
      folder_path: '/tmp',
    }),
    saveLocalFile: vi.fn(),
    getSubtitleFiles: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}))

vi.mock('../../../hooks/useAiRuntimeState', () => ({
  useAiRuntimeState: () => ({
    testedModels: { openai: ['gpt-4.1'] },
    updatedAt: '2026-04-22T00:00:00.000Z',
    source: 'local',
  }),
}))

vi.mock('../../../services/aiRuntimeState', () => ({
  aiRuntimeStateService: {
    refresh: vi.fn().mockResolvedValue({
      testedModels: { openai: ['gpt-4.1'] },
      updatedAt: '2026-04-22T00:00:00.000Z',
      source: 'local',
    }),
  },
}))

vi.mock('../../../stores/settings', () => ({
  useSettingsStore: () => ({
    settings: {
      llm: {
        provider: 'openai',
        model: 'gpt-4.1',
      },
      ai_note: {
        style: {
          custom_styles: [],
        },
      },
    },
  }),
}))

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('../../../components/ai/MarkdownEditor', () => ({
  MarkdownEditor: () => <div data-testid="legacy-markdown-editor" />,
}))

vi.mock('../../../components/ai/MdxNoteEditor', () => ({
  MdxNoteEditor: () => <div data-testid="mdx-note-editor" />,
}))

describe('NoteTab', () => {
  it('renders the MDX note editor after loading', async () => {
    render(<NoteTab videoId="BV1XMdYBHEGp" />)

    expect(await screen.findByTestId('mdx-note-editor')).toBeTruthy()
    expect(screen.queryByTestId('legacy-markdown-editor')).toBeNull()
  })
})
