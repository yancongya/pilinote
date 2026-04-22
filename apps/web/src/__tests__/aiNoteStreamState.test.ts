import { describe, expect, it } from 'vitest'

import { applyAiNoteStreamEvent, createAiNoteStreamState } from '../services/aiNoteStreamState'

describe('applyAiNoteStreamEvent', () => {
  it('stores live log text under the matching stage and keeps the last completed snapshot', () => {
    const initial = {
      activeStage: null,
      stages: {},
    }

    const processing = applyAiNoteStreamEvent(initial, {
      stage: 'video.NFO.READ',
      status: 'processing',
      data: { summary: '正在读取 NFO' },
    })

    const completed = applyAiNoteStreamEvent(processing, {
      stage: 'video.NFO.READ',
      status: 'completed',
      data: { summary: 'NFO 读取完成' },
    })

    expect(completed.activeStage).toBe('video.NFO.READ')
    expect(completed.stages['video.NFO.READ'].logs).toEqual([
      '正在读取 NFO',
      'NFO 读取完成',
    ])
    expect(completed.stages['video.NFO.READ'].status).toBe('completed')
  })

  it('prefers the human summary from full trace payloads over raw JSON', () => {
    const next = applyAiNoteStreamEvent(createAiNoteStreamState(), {
      stage: 'video.PROMPT.BUILD',
      status: 'completed',
      data: {
        stage: 'video.PROMPT.BUILD',
        title: 'Prompt 生成完成',
        summary: '正在按固定顺序拼装最终 prompt',
        detail: { prompt_length: 10548 },
      },
    })

    expect(next.stages['video.PROMPT.BUILD'].logs).toEqual([
      '正在按固定顺序拼装最终 prompt',
    ])
    expect(next.trace[0].summary).toBe('正在按固定顺序拼装最终 prompt')
    expect(next.trace[0].detail).toEqual({ prompt_length: 10548 })
  })
})
