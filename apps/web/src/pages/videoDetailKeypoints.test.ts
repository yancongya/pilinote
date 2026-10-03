import { describe, expect, it } from 'vitest'
import { parseAiNoteKeypoints, parseTimestampToSeconds } from './videoDetailKeypoints'

describe('parseTimestampToSeconds', () => {
  it('parses both supported timestamp shapes', () => {
    expect(parseTimestampToSeconds(' 12:34 ')).toBe(754)
    expect(parseTimestampToSeconds('1:02:03')).toBe(3723)
  })

  it('rejects malformed values but does not validate minute/second ranges', () => {
    expect(parseTimestampToSeconds(12)).toBeNull()
    expect(parseTimestampToSeconds('1:2')).toBeNull()
    expect(parseTimestampToSeconds('99:99')).toBe(6039)
    expect(parseTimestampToSeconds('1:99:99')).toBe(9639)
  })
})

describe('parseAiNoteKeypoints', () => {
  it('prefers entries in the timestamp section', () => {
    expect(parseAiNoteKeypoints([
      '## 时间戳',
      '- 00:20 section item',
      '## 00:01 heading item',
    ].join('\n'))).toEqual([
      { timestamp: '00:20', seconds: 20, title: 'section item' },
    ])
  })

  it('deduplicates alternate timestamp spellings with the same elapsed seconds', () => {
    expect(parseAiNoteKeypoints([
      '## 时间戳',
      '- 01:00 minute form',
      '- 0:01:00 hour form',
    ].join('\r\n'))).toEqual([
      { timestamp: '01:00', seconds: 60, title: 'minute form' },
    ])
  })

  it('ignores timestamp list entries after the timestamp section ends', () => {
    expect(parseAiNoteKeypoints([
      '## 时间戳',
      '- 00:10 in section',
      '### Other section',
      '- 00:20 outside section',
    ].join('\r\n'))).toEqual([
      { timestamp: '00:10', seconds: 10, title: 'in section' },
    ])
  })

  it('falls back to headings when timestamp section entries are invalid', () => {
    expect(parseAiNoteKeypoints([
      '## 时间戳',
      '- 1:2 invalid item',
      '## 00:30 fallback heading',
    ].join('\r\n'))).toEqual([
      { timestamp: '00:30', seconds: 30, title: 'fallback heading' },
    ])
  })

  it('falls back to timestamped headings if the section has no entries', () => {
    expect(parseAiNoteKeypoints([
      '## 时间戳',
      'not a list item',
      '## 00:12  First heading',
      '### 01:00 Second heading',
    ].join('\n'))).toEqual([
      { timestamp: '00:12', seconds: 12, title: 'First heading' },
      { timestamp: '01:00', seconds: 60, title: 'Second heading' },
    ])
  })

  it('deduplicates, sorts, and keeps at most 18 points', () => {
    const markdown = [
      '## 时间戳',
      ...Array.from({ length: 20 }, (_, index) => `- ${String(19 - index).padStart(2, '0')}:00 Point ${index}`),
      '- 00:00 Duplicate',
    ].join('\n')
    const points = parseAiNoteKeypoints(markdown)

    expect(points).toHaveLength(18)
    expect(points.map(point => point.seconds)).toEqual(Array.from({ length: 18 }, (_, index) => index * 60))
    expect(points[0].title).toBe('Point 19')
  })

  it('returns an empty list for blank notes', () => {
    expect(parseAiNoteKeypoints(' \n ')).toEqual([])
  })
})
