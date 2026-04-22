import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MarkdownEditor } from '../MarkdownEditor'

describe('MarkdownEditor', () => {
  it('renders edit mode with a textarea and mode buttons', () => {
    const handleChange = vi.fn()
    const handleModeChange = vi.fn()

    render(
      <MarkdownEditor
        content="# 标题"
        mode="edit"
        onChange={handleChange}
        onModeChange={handleModeChange}
      />,
    )

    const textarea = screen.getByRole('textbox')
    expect((textarea as HTMLTextAreaElement).value).toBe('# 标题')
    expect(screen.getByRole('button', { name: '编辑' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '分屏' })).toBeTruthy()

    fireEvent.change(textarea, { target: { value: '新的内容' } })
    expect(handleChange).toHaveBeenCalledWith('新的内容')

    fireEvent.click(screen.getByRole('button', { name: '预览' }))
    expect(handleModeChange).toHaveBeenCalledWith('preview')
  })

  it('renders preview mode without a textarea', () => {
    render(
      <MarkdownEditor
        content={`# 标题\n\n![截图](images/frame.png)`}
        mode="preview"
        onChange={() => {}}
        onModeChange={() => {}}
        sourceFolderPath="/downloads/video"
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '截图' }).getAttribute('src')).toBe(
      'http://localhost:8000/api/library/image?file_path=%2Fdownloads%2Fvideo%2Fimages%2Fframe.png',
    )
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('renders split mode with both editor and preview panes', () => {
    render(
      <MarkdownEditor
        content="# Split"
        mode="split"
        onChange={() => {}}
        onModeChange={() => {}}
      />,
    )

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Split' })).toBeTruthy()
  })
})
