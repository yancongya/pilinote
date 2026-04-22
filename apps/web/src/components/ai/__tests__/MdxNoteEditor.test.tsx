import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MdxNoteEditor } from '../MdxNoteEditor'

vi.mock('@mdxeditor/editor', () => ({
  MDXEditor: ({ markdown, onChange, readOnly, 'aria-label': ariaLabel }: { markdown: string; onChange: (markdown: string, initialMarkdownNormalize: boolean) => void; readOnly?: boolean; 'aria-label'?: string }) => (
    <textarea
      aria-label={ariaLabel ?? 'MDX 内容'}
      readOnly={readOnly}
      value={markdown}
      onChange={(event) => onChange(event.currentTarget.value, false)}
    />
  ),
  headingsPlugin: vi.fn(() => 'headingsPlugin'),
  codeBlockPlugin: vi.fn(() => 'codeBlockPlugin'),
  listsPlugin: vi.fn(() => 'listsPlugin'),
  quotePlugin: vi.fn(() => 'quotePlugin'),
  thematicBreakPlugin: vi.fn(() => 'thematicBreakPlugin'),
  markdownShortcutPlugin: vi.fn(() => 'markdownShortcutPlugin'),
  linkPlugin: vi.fn(() => 'linkPlugin'),
  imagePlugin: vi.fn(() => 'imagePlugin'),
  tablePlugin: vi.fn(() => 'tablePlugin'),
  diffSourcePlugin: vi.fn(() => 'diffSourcePlugin'),
  toolbarPlugin: vi.fn(() => 'toolbarPlugin'),
  DiffSourceToggleWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UndoRedo: () => <div>UndoRedo</div>,
}))

describe('MdxNoteEditor', () => {
  it('renders editable content in edit mode', () => {
    const handleChange = vi.fn()

    render(
      <MdxNoteEditor
        content="# Title"
        mode="edit"
        onChange={handleChange}
      />,
    )

    const editor = screen.getByRole('textbox', { name: 'MDX 编辑器' })
    expect((editor as HTMLTextAreaElement).value).toBe('# Title')

    fireEvent.change(editor, { target: { value: 'Updated note' } })
    expect(handleChange).toHaveBeenCalledWith('Updated note')
  })

  it.each(['preview', 'split'] as const)('renders the MDX content area in %s mode', (mode) => {
    render(
      <MdxNoteEditor
        content="![截图](images/frame.png)"
        mode={mode}
        onChange={() => {}}
        sourceFolderPath="/downloads/video"
      />,
    )

    if (mode === 'preview') {
      expect(screen.getByRole('textbox', { name: 'MDX 预览' })).toBeTruthy()
      return
    }

    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })
})
