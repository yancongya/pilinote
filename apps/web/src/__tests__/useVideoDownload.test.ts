import { describe, expect, it } from 'vitest'
import { getCollectionParts, getDownloadParts, type VideoInfo, type VideoDetail } from '../hooks/useVideoDownload'

describe('getDownloadParts', () => {
  const video: VideoInfo = {
    bvid: 'BV-current',
    title: '当前视频',
    cover: 'https://example.com/current.jpg',
  }
  const detail: VideoDetail = {
    pages: [
      { page: 1, cid: 101, part: '当前 P1', duration: 10 },
      { page: 2, cid: 102, part: '当前 P2', duration: 10 },
    ],
    ugc_season: {
      title: '合集标题',
      cover: 'https://example.com/series.jpg',
      sections: [
        {
          title: '正片',
          episodes: [
            { bvid: 'BV-1', cid: 201, title: '合集 1', cover: 'https://example.com/1.jpg' },
            { bvid: 'BV-2', cid: 202, title: '合集 2', cover: 'https://example.com/2.jpg' },
            { bvid: 'BV-3', cid: 203, title: '合集 3', cover: 'https://example.com/3.jpg' },
          ],
        },
      ],
    },
  }

  it('uses the current submission pages for the default download action', () => {
    expect(getDownloadParts(video, detail)).toEqual([
      { bvid: 'BV-current', cid: 101, page: 1, title: '当前 P1', cover: 'https://example.com/current.jpg', duration: 10 },
      { bvid: 'BV-current', cid: 102, page: 2, title: '当前 P2', cover: 'https://example.com/current.jpg', duration: 10 },
    ])
  })

  it('keeps Bilibili collection episodes available as a separate action source', () => {
    expect(getCollectionParts(video, detail)).toEqual([
      { bvid: 'BV-1', cid: 201, page: 1, title: '合集 1', cover: 'https://example.com/1.jpg', duration: undefined },
      { bvid: 'BV-2', cid: 202, page: 2, title: '合集 2', cover: 'https://example.com/2.jpg', duration: undefined },
      { bvid: 'BV-3', cid: 203, page: 3, title: '合集 3', cover: 'https://example.com/3.jpg', duration: undefined },
    ])
  })

  it('falls back to current pages when a video is not in a collection', () => {
    const video: VideoInfo = {
      bvid: 'BV-single',
      title: '普通多P',
      cover: 'https://example.com/single.jpg',
    }
    const detail: VideoDetail = {
      pages: [
        { page: 1, cid: 301, part: 'P1', duration: 20 },
        { page: 2, cid: 302, part: 'P2', duration: 30 },
      ],
    }

    expect(getDownloadParts(video, detail)).toEqual([
      { bvid: 'BV-single', cid: 301, page: 1, title: 'P1', cover: 'https://example.com/single.jpg', duration: 20 },
      { bvid: 'BV-single', cid: 302, page: 2, title: 'P2', cover: 'https://example.com/single.jpg', duration: 30 },
    ])
  })
})
