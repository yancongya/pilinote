import { describe, expect, it } from 'vitest'

import {
  buildSeriesEpisodeStates,
  calculateSeriesQueueSummary,
  deriveSeriesEpisodeSelection,
  sortSeriesEpisodes,
} from '../components/ai/seriesAnalysis'

describe('seriesAnalysis', () => {
  it('defaults to selecting available episodes only', () => {
    const selection = deriveSeriesEpisodeSelection([
      { id: 'ep1', title: '第 1 集', available: true, order: 1 },
      { id: 'ep2', title: '第 2 集', available: false, order: 2 },
      { id: '', title: '无效集数', available: true, order: 3 },
    ])

    expect(Array.from(selection)).toEqual(['ep1'])
  })

  it('sorts episodes by order first and title second', () => {
    const sorted = sortSeriesEpisodes([
      { id: 'c', title: 'C 集', order: 2 },
      { id: 'a', title: 'A 集', order: 1 },
      { id: 'b', title: 'B 集', order: 1 },
    ])

    expect(sorted.map(item => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('builds default states with available episodes selected', () => {
    const states = buildSeriesEpisodeStates([
      { id: 'ep1', title: '第 1 集', available: true, order: 1 },
      { id: 'ep2', title: '第 2 集', available: false, order: 2 },
    ])

    expect(states).toEqual([
      expect.objectContaining({ id: 'ep1', selected: true, status: 'idle', progress: 0 }),
      expect.objectContaining({ id: 'ep2', selected: false, status: 'idle', progress: 0 }),
    ])
  })

  it('summarizes queue progress from completed and failed items', () => {
    const summary = calculateSeriesQueueSummary([
      { id: 'ep1', title: '第 1 集', available: true, selected: true, status: 'completed', progress: 100, trace: [] },
      { id: 'ep2', title: '第 2 集', available: true, selected: true, status: 'failed', progress: 38, trace: [] },
      { id: 'ep3', title: '第 3 集', available: true, selected: false, status: 'idle', progress: 0, trace: [] },
    ])

    expect(summary).toMatchObject({
      total: 3,
      available: 3,
      selected: 2,
      completed: 1,
      failed: 1,
      progress: 100,
    })
  })
})
