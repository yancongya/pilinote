import { describe, expect, it } from 'vitest'

import {
  buildDetailTaskPayload,
  normalizeOpusMediaId
} from '../pages/videoDetailMedia'

describe('videoDetailMedia', () => {
  it('keeps an opus id with cv prefix unchanged', () => {
    expect(normalizeOpusMediaId('cv1119055528585068562')).toBe('cv1119055528585068562')
  })

  it('adds cv prefix when opus route param is numeric only', () => {
    expect(normalizeOpusMediaId('1119055528585068562')).toBe('cv1119055528585068562')
  })

  it('builds an opus task payload for detail page downloads', () => {
    expect(buildDetailTaskPayload({
      type: 'opus',
      mediaId: 'cv1119055528585068562',
      title: '图文标题',
      cover: 'https://example.com/cover.jpg'
    })).toEqual({
      title: '图文标题',
      media_type: 'opus',
      media_id: 'cv1119055528585068562',
      cover: 'https://example.com/cover.jpg',
      desc: '图文下载任务',
      meta: {}
    })
  })

  it('builds a video task payload with cid metadata', () => {
    expect(buildDetailTaskPayload({
      type: 'video',
      mediaId: 'BV1xFSfBwE9R',
      title: '视频标题',
      cover: 'https://example.com/cover.jpg',
      cid: 123456
    })).toEqual({
      title: '视频标题',
      media_type: 'video',
      media_id: 'BV1xFSfBwE9R',
      cover: 'https://example.com/cover.jpg',
      desc: 'CID: 123456',
      meta: {
        cid: 123456
      }
    })
  })
})
