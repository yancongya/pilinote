import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'

import { MarkdownPreview } from '../MarkdownPreview'
import {
  createHeadingIdGenerator,
  extractMarkdownText,
  resolveMarkdownImageUrl,
} from '../markdownPreviewUtils'

describe('markdownPreviewUtils', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('resolves local image paths against the source folder', () => {
    expect(resolveMarkdownImageUrl('images/frame.png', '/downloads/video')).toBe(
      'http://localhost:8000/api/library/image?file_path=%2Fdownloads%2Fvideo%2Fimages%2Fframe.png',
    )
  })

  it('keeps remote image urls untouched', () => {
    expect(resolveMarkdownImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })

  it('generates stable unique heading ids', () => {
    const nextHeadingId = createHeadingIdGenerator()
    expect(nextHeadingId('章节一')).toBe('章节一')
    expect(nextHeadingId('章节一')).toBe('章节一-2')
    expect(nextHeadingId('  Hello World!  ')).toBe('hello-world')
  })

  it('extracts text from nested markdown children', () => {
    expect(extractMarkdownText(['Title ', 'Part'])).toBe('Title Part')
  })
})

describe('MarkdownPreview', () => {
  it('renders headings, lists, links, code, quotes, and images', () => {
    render(
      <MarkdownPreview
        content={`# 标题

- 第一项
1. 第二项

> 引用文本

[外链](https://example.com)

![截图](images/frame.png)

\`\`\`ts
const answer = 42;
\`\`\`
`}
        sourceFolderPath="/downloads/video"
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: '标题' }).id).toBe('标题')
    expect(screen.getByText('第一项')).not.toBeNull()
    expect(screen.getByText('第二项')).not.toBeNull()
    expect(screen.getByText('引用文本')).not.toBeNull()
    expect(screen.getByRole('link', { name: '外链' }).getAttribute('href')).toBe('https://example.com')
    expect(screen.getByRole('img', { name: '截图' }).getAttribute('src')).toBe(
      'http://localhost:8000/api/library/image?file_path=%2Fdownloads%2Fvideo%2Fimages%2Fframe.png',
    )
    expect(screen.getByText('const answer = 42;')).not.toBeNull()
  })

  it('scrolls to internal headings when clicked', () => {
    render(<MarkdownPreview content="# 目标章节" />)

    fireEvent.click(screen.getByRole('heading', { level: 1, name: '目标章节' }))

    expect(window.location.hash).toBe('')
  })
})
