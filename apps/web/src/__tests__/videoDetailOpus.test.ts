import { describe, expect, it } from 'vitest'

import {
  parseLocalOpusMarkdown,
  resolveLocalMarkdownAssetPath,
} from '../pages/videoDetailOpus'

describe('videoDetailOpus', () => {
  it('resolves local markdown assets against the opus folder', () => {
    expect(
      resolveLocalMarkdownAssetPath('/downloads/示例图文', 'images/a.png')
    ).toBe('/downloads/示例图文/images/a.png')
  })

  it('parses generated opus markdown into heading, paragraphs and local images', () => {
    const blocks = parseLocalOpusMarkdown(
      '# 示例图文\n\n第一段正文\n第二行正文\n\n![图文图片 1](images/a.png)\n',
      '/downloads/示例图文'
    )

    expect(blocks).toEqual([
      { type: 'heading', text: '示例图文' },
      { type: 'paragraph', text: '第一段正文 第二行正文' },
      {
        type: 'image',
        alt: '图文图片 1',
        src: 'http://localhost:8000/api/library/image?file_path=%2Fdownloads%2F%E7%A4%BA%E4%BE%8B%E5%9B%BE%E6%96%87%2Fimages%2Fa.png',
      },
    ])
  })
})
