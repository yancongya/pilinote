import { isValidElement, type ReactNode } from 'react'

import { getLocalImageUrl } from '../../config/api'

export type HeadingIdGenerator = (text: string) => string

function normalizePathSegment(segment: string): string {
  return segment.replace(/\\/g, '/').trim()
}

function stripFileProtocol(path: string): string {
  return path.replace(/^file:\/\//i, '')
}

function isSpecialUrl(path: string): boolean {
  return /^(?:https?:|blob:|data:|mailto:|tel:)/i.test(path)
}

function normalizeSlugText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function joinLocalPath(basePath: string, relativePath: string): string {
  const base = normalizePathSegment(stripFileProtocol(basePath)).replace(/\/$/, '')
  const relative = normalizePathSegment(stripFileProtocol(relativePath))
  const combined = `${base}/${relative}`
  const segments = combined.split('/')
  const output: string[] = []

  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (output.length > 0) {
        output.pop()
      }
      continue
    }
    output.push(segment)
  }

  return combined.startsWith('/') ? `/${output.join('/')}` : output.join('/')
}

export function extractMarkdownText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(extractMarkdownText).join('')
  }

  if (isValidElement(node)) {
    return extractMarkdownText((node.props as { children?: ReactNode }).children)
  }

  return ''
}

export function createHeadingIdGenerator(): HeadingIdGenerator {
  const seen = new Map<string, number>()

  return (text: string) => {
    const slug = normalizeSlugText(text) || 'heading'
    const nextIndex = (seen.get(slug) || 0) + 1
    seen.set(slug, nextIndex)
    return nextIndex === 1 ? slug : `${slug}-${nextIndex}`
  }
}

export function resolveMarkdownImageUrl(src: string, sourceFolderPath?: string | null): string {
  const cleanedSrc = stripFileProtocol(src.trim())
  if (!cleanedSrc) {
    return ''
  }

  if (isSpecialUrl(cleanedSrc) || cleanedSrc.startsWith('/api/library/image')) {
    return cleanedSrc
  }

  const resolvedPath =
    sourceFolderPath && !cleanedSrc.startsWith('/')
      ? joinLocalPath(sourceFolderPath, cleanedSrc)
      : cleanedSrc

  return getLocalImageUrl(resolvedPath)
}
