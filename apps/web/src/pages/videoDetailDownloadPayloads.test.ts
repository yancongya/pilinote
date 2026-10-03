import { describe, expect, it } from 'vitest'
import {
  buildCollectionTaskPayload,
  buildDetailDownloadOptions,
  buildOpusTaskPayload,
  buildSchedulerPayload,
} from './videoDetailDownloadPayloads'

describe('video detail download payloads', () => {
  it('preserves split-part identifiers and metadata', () => {
    expect(buildCollectionTaskPayload({
      part: { bvid: 'BV-part', cid: 202, page: 2, title: '第二P', cover: 'part.jpg' },
      episodeTitle: '投稿标题',
      collectionTitle: '合集标题',
      collectionBvid: 'BV-collection',
      episodePage: 3,
      episodeCover: 'episode.jpg',
    })).toEqual({
      title: '第二P',
      media_type: 'video',
      media_id: 'BV-part',
      cover: 'part.jpg',
      desc: '合集：合集标题',
      meta: {
        cid: 202,
        page: 2,
        part_title: '第二P',
        collection_bvid: 'BV-collection',
        collection_title: '合集标题',
        collection_episode_title: '投稿标题',
        output_subdir: 'P03 - 投稿标题',
      },
    })
  })

  it('falls back to the episode cover and omits a missing cover when serialized', () => {
    const baseInput = {
      part: { bvid: 'BV-part', cid: 202, page: 2, title: '第二P', cover: '' },
      episodeTitle: '投稿标题',
      collectionTitle: '合集标题',
      collectionBvid: 'BV-collection',
      episodePage: 3,
    }
    expect(buildCollectionTaskPayload({ ...baseInput, episodeCover: 'episode.jpg' }).cover)
      .toBe('episode.jpg')
    expect(JSON.stringify(buildCollectionTaskPayload(baseInput))).not.toContain('"cover"')
  })

  it('preserves collection scheduler shape', () => {
    expect(buildSchedulerPayload('合集标题', ['task-1', 'task-2'], '/downloads/合集标题'))
      .toEqual({ title: '合集标题', task_ids: ['task-1', 'task-2'], folder: '/downloads/合集标题' })
  })

  it('normalizes opus ids and preserves the page task shape', () => {
    expect(buildOpusTaskPayload({ mediaId: '12345', title: '图文标题', cover: 'cover.jpg' }))
      .toEqual({
        title: '图文标题',
        media_type: 'opus',
        media_id: 'cv12345',
        cover: 'cover.jpg',
        desc: '图文下载任务',
        meta: {},
      })
    expect(buildOpusTaskPayload({ mediaId: 'cv12345', title: '图文标题' }).media_id).toBe('cv12345')
  })

  it('retains selected pages and explicit redownload flag', () => {
    const selectedPages = new Set([2, 4])
    expect(buildDetailDownloadOptions(selectedPages, true)).toEqual({
      selectedPages,
      forceRedownload: true,
    })
    expect(buildDetailDownloadOptions(undefined, false)).toEqual({
      selectedPages: undefined,
      forceRedownload: false,
    })
    expect(buildDetailDownloadOptions(undefined, undefined)).toEqual({
      selectedPages: undefined,
      forceRedownload: undefined,
    })
  })
})
