import { describe, expect, it } from 'vitest'

import {
  buildMindMapData,
  cloneMindMapTree,
  extractMindMapSource,
  formatMindMapExportName,
  getNextMindMapCycleState,
} from '../mindmapUtils'

describe('mindmapUtils', () => {
  it('keeps headings and lists only', () => {
    const markdown = `# Root

## One
- A
- B

Some paragraph

\`\`\`ts
const x = 1
\`\`\`

![img](./a.png)`

    const source = extractMindMapSource(markdown)

    expect(source).toContain('# Root')
    expect(source).toContain('## One')
    expect(source).toContain('- A')
    expect(source).toContain('- B')
    expect(source).not.toContain('Some paragraph')
    expect(source).not.toContain('const x = 1')
    expect(source).not.toContain('![img]')
  })

  it('returns the same extracted data through buildMindMapData', () => {
    const markdown = '# Root\n\n- A'
    expect(buildMindMapData(markdown)).toBe(extractMindMapSource(markdown))
  })

  it('formats export names safely', () => {
    expect(formatMindMapExportName('')).toBe('mindmap')
    expect(formatMindMapExportName('My Note')).toBe('My Note')
    expect(formatMindMapExportName('A/B:C')).toBe('A_B_C')
  })

  it('cycles mindmap depth forward then backward', () => {
    expect(getNextMindMapCycleState({ depth: 1, maxDepth: 4, direction: 'expand' })).toEqual({
      depth: 2,
      maxDepth: 4,
      direction: 'expand',
    })
    expect(getNextMindMapCycleState({ depth: 4, maxDepth: 4, direction: 'expand' })).toEqual({
      depth: 3,
      maxDepth: 4,
      direction: 'collapse',
    })
    expect(getNextMindMapCycleState({ depth: 2, maxDepth: 4, direction: 'collapse' })).toEqual({
      depth: 1,
      maxDepth: 4,
      direction: 'expand',
    })
  })

  it('clones mindmap trees without preserving fold state', () => {
    const source = {
      content: 'root',
      payload: { fold: 1 },
      children: [
        {
          content: 'child',
          payload: { fold: 1 },
          children: [],
        },
      ],
    }

    const cloned = cloneMindMapTree(source as any)

    expect(cloned).not.toBe(source)
    expect(cloned.payload).not.toBe(source.payload)
    expect(cloned.payload?.fold).toBeUndefined()
    expect(cloned.children?.[0]?.payload?.fold).toBeUndefined()
  })
})
