import { describe, expect, it, vi, beforeEach } from 'vitest'

import { buildTraceDotItemsForNote, deriveAiNoteModalStateFromLookup } from '../components/ai/AiNoteModal'
import { aiNoteService } from '../services/aiNote'
import type { NoteLookupResponse, NoteResponse } from '../services/aiNote'

vi.mock('../services/api', () => {
  return {
    apiService: {
      request: vi.fn(),
    },
  }
})

function makeNote(partial: Partial<NoteResponse> = {}): NoteResponse {
  return {
    success: true,
    id: 'note_1',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  }
}

describe('buildTraceDotItemsForNote', () => {
  it('uses the video pipeline by default', () => {
    const dots = buildTraceDotItemsForNote(makeNote(), [])

    expect(dots.map(dot => dot.stage)).toEqual([
      'AUDIO.FETCH',
      'SUBTITLE.GENERATE',
      'NFO.READ',
      'PROMPT.BUILD',
      'LLM.ANALYZE',
      'CONTENT.GENERATE',
      'DONE',
      'ERROR',
    ])
  })

  it('uses the series pipeline when meta.pipeline_mode is series', () => {
    const note = makeNote({
      meta: { pipeline_mode: 'series' },
    })

    const dots = buildTraceDotItemsForNote(note, [
      { stage: 'AUDIO.FETCH', title: '番剧信息读取', summary: 'ok' },
    ])

    expect(dots[0]).toMatchObject({
      stage: 'AUDIO.FETCH',
      title: '番剧信息读取',
      shortLabel: '获取',
      status: 'running',
    })
  })

  it('uses the image_text pipeline when meta.pipeline_mode is image_text', () => {
    const note = makeNote({
      meta: { pipeline_mode: 'image_text' },
    })

    const dots = buildTraceDotItemsForNote(note, [])

    expect(dots.map(dot => dot.title)).toEqual([
      '图片识别',
      '文字提取',
      '结构整理',
      'Prompt 构建',
      'AI 分析',
      '生成内容',
      '完成',
      '错误',
    ])
  })

  it('treats prefixed error stages as errors, not running', () => {
    const note = makeNote({
      pipeline_mode: 'video',
    })

    const dots = buildTraceDotItemsForNote(note, [
      {
        stage: 'video.ERROR',
        title: '分析失败',
        summary: '转写异常',
        progress: 35,
      },
    ])

    expect(dots[dots.length - 1]).toMatchObject({
      stage: 'ERROR',
      status: 'error',
      statusLabel: '错误',
    })
  })

  it('normalizes semantic stages and legacy prefixed stages', () => {
    const note = makeNote({
      pipeline_mode: 'video',
    })

    const dots = buildTraceDotItemsForNote(note, [
      {
        stage: 'video.SUBTITLE.GENERATE',
        title: '字幕生成',
        summary: 'ok',
        progress: 48,
      },
      {
        stage: 'video.NFO.READ',
        title: 'NFO 读取',
        summary: 'ok',
        progress: 70,
      },
    ])

    expect(dots[1]).toMatchObject({
      stage: 'SUBTITLE.GENERATE',
      title: '字幕生成',
      status: 'running',
    })
    expect(dots[2]).toMatchObject({
      stage: 'NFO.READ',
      title: 'NFO 读取',
      status: 'running',
    })
  })
})

describe('aiNoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts the selected resume stage to the new endpoint', async () => {
    const { apiService } = await import('../services/api')
    const request = vi.mocked(apiService.request)
    request.mockResolvedValue({
      success: true,
      data: { success: true, message: 'ok' },
    } as any)

    await aiNoteService.resumeFromStage('note_1', 'SUBTITLE.GENERATE')

    expect(request).toHaveBeenCalledWith('/api/note/resume-from-stage/note_1', {
      method: 'POST',
      body: JSON.stringify({ resume_from_stage: 'SUBTITLE.GENERATE' }),
    })
  })
})

describe('deriveAiNoteModalStateFromLookup', () => {
  it('treats found=false as explicit absence (config view), not an error', () => {
    const lookup: NoteLookupResponse = {
      success: true,
      found: false,
      note: null,
    }

    expect(deriveAiNoteModalStateFromLookup(lookup)).toEqual({
      viewState: 'config',
      note: null,
      errorMessage: null,
      shouldPoll: false,
    })
  })

  it('maps processing to config + polling', () => {
    const lookup: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'processing' }),
    }

    expect(deriveAiNoteModalStateFromLookup(lookup)).toEqual({
      viewState: 'config',
      note: lookup.note,
      errorMessage: null,
      shouldPoll: true,
    })
  })

  it('maps pending to config + polling (type consistency)', () => {
    const lookup: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'pending' }),
    }

    expect(deriveAiNoteModalStateFromLookup(lookup)).toEqual({
      viewState: 'config',
      note: lookup.note,
      errorMessage: null,
      shouldPoll: true,
    })
  })

  it('maps completed/failed to config without polling', () => {
    const completed: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'completed', content: 'hello' }),
    }
    const failed: NoteLookupResponse = {
      success: true,
      found: true,
      note: makeNote({ status: 'failed', error: 'boom' }),
    }

    expect(deriveAiNoteModalStateFromLookup(completed)).toEqual({
      viewState: 'config',
      note: completed.note,
      errorMessage: null,
      shouldPoll: false,
    })
    expect(deriveAiNoteModalStateFromLookup(failed)).toEqual({
      viewState: 'config',
      note: failed.note,
      errorMessage: 'boom',
      shouldPoll: false,
    })
  })

  it('does not treat success=false (including HTTP 404 wrapped by apiService) as absence', () => {
    const apiErrorLike = {
      success: false,
      message: 'Not Found',
      code: 404,
    }

    expect(deriveAiNoteModalStateFromLookup(apiErrorLike)).toEqual({
      viewState: 'config',
      note: null,
      errorMessage: 'Not Found',
      shouldPoll: false,
    })
  })
})
