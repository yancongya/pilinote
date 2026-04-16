import { getLocalImageUrl } from '../config/api'

export interface LocalOpusContent {
  opus_id: string
  title: string
  folder_path: string
  markdown_path: string
  markdown_content: string
  cover_path?: string | null
  avatar_path?: string | null
  nfo_data?: Record<string, any>
}

export type OpusBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; alt: string; src: string }

export function resolveLocalMarkdownAssetPath(folderPath: string, assetPath: string): string {
  if (!assetPath) return ''
  if (/^https?:\/\//.test(assetPath)) return assetPath

  const cleanFolder = folderPath.replace(/\/$/, '')
  const cleanAsset = assetPath.replace(/^\.\//, '').replace(/^\//, '')
  return `${cleanFolder}/${cleanAsset}`
}

export function parseLocalOpusMarkdown(markdown: string, folderPath: string): OpusBlock[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: OpusBlock[] = []
  let paragraphBuffer: string[] = []

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return
    const text = paragraphBuffer.join(' ').trim()
    if (text) {
      blocks.push({ type: 'paragraph', text })
    }
    paragraphBuffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      continue
    }

    if (line.startsWith('# ')) {
      flushParagraph()
      blocks.push({ type: 'heading', text: line.slice(2).trim() })
      continue
    }

    const imageMatch = line.match(/^!\[(.*)\]\((.+)\)$/)
    if (imageMatch) {
      flushParagraph()
      blocks.push({
        type: 'image',
        alt: imageMatch[1] || '图文图片',
        src: getLocalImageUrl(resolveLocalMarkdownAssetPath(folderPath, imageMatch[2])),
      })
      continue
    }

    paragraphBuffer.push(line)
  }

  flushParagraph()
  return blocks
}
