export function extractMindMapSource(markdown: string): string {
  if (!markdown.trim()) return ''

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const output: string[] = []
  let inFence = false

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, '')
    const trimmed = line.trim()

    if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) {
      inFence = !inFence
      continue
    }

    if (inFence) continue
    if (!trimmed) {
      if (output.length > 0 && output[output.length - 1] !== '') {
        output.push('')
      }
      continue
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      output.push(trimmed)
      continue
    }

    const listMatch = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line)
    if (listMatch) {
      const indent = listMatch[1] || ''
      const content = listMatch[3].trim()
      if (content) {
        output.push(`${indent}- ${content}`)
      }
      continue
    }
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildMindMapData(markdown: string): string {
  return extractMindMapSource(markdown)
}

export function formatMindMapExportName(title: string | undefined | null): string {
  const normalized = (title || '').trim().replace(/[\\/:*?"<>|]/g, '_')
  return normalized || 'mindmap'
}

export type MindMapCycleDirection = 'expand' | 'collapse'

export interface MindMapCycleState {
  depth: number
  maxDepth: number
  direction: MindMapCycleDirection
}

export function getNextMindMapCycleState(state: MindMapCycleState): MindMapCycleState {
  const maxDepth = Math.max(1, Math.floor(state.maxDepth))
  const currentDepth = Math.min(Math.max(1, Math.floor(state.depth)), maxDepth)

  if (maxDepth === 1) {
    return {
      depth: 1,
      maxDepth: 1,
      direction: 'expand',
    }
  }

  if (state.direction === 'expand') {
    if (currentDepth >= maxDepth) {
      return {
        depth: maxDepth - 1,
        maxDepth,
        direction: 'collapse',
      }
    }

    const nextDepth = currentDepth + 1
    return {
      depth: nextDepth,
      maxDepth,
      direction: nextDepth >= maxDepth ? 'collapse' : 'expand',
    }
  }

  if (currentDepth <= 1) {
    return {
      depth: 2,
      maxDepth,
      direction: 'expand',
    }
  }

  const nextDepth = currentDepth - 1
  return {
    depth: nextDepth,
    maxDepth,
    direction: nextDepth <= 1 ? 'expand' : 'collapse',
  }
}

export function cloneMindMapTree<T extends { payload?: Record<string, unknown>; children?: T[] }>(node: T): T {
  if (!node) return node

  const cloned: T = {
    ...(node as Record<string, unknown>),
    payload: node.payload ? { ...node.payload } : undefined,
  } as T

  if (cloned.payload && 'fold' in cloned.payload) {
    delete cloned.payload.fold
  }

  if (Array.isArray(node.children)) {
    cloned.children = node.children.map((child) => cloneMindMapTree(child))
  }

  return cloned
}
