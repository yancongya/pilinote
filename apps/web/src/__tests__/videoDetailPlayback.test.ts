import { describe, expect, it } from 'vitest'

import {
  buildPlayablePages,
  selectInitialPlayableEntry,
  type LocalPlaybackMap,
  type VideoPageEntry
} from '../pages/videoDetailPlayback'

describe('videoDetailPlayback', () => {
  const pages: VideoPageEntry[] = [
    { cid: 101, part: 'P1', page: 1, duration: 60 },
    { cid: 102, part: 'P2', page: 2, duration: 120 }
  ]

  it('selects the current cid when the current part is playable', () => {
    const playbackMap: LocalPlaybackMap = {
      bvid: 'BV1test',
      entries: [
        { cid: 101, path: '/downloads/p1.mp4', exists: true, title: 'P1' },
        { cid: 102, path: '/downloads/p2.mp4', exists: true, title: 'P2' }
      ]
    }

    expect(selectInitialPlayableEntry(playbackMap, 102)).toEqual(
      playbackMap.entries[1]
    )
  })

  it('does not auto-pick another part when current cid is missing in a series', () => {
    const playbackMap: LocalPlaybackMap = {
      bvid: 'BV1test',
      entries: [
        { cid: 101, path: '/downloads/p1.mp4', exists: true, title: 'P1' }
      ]
    }

    expect(selectInitialPlayableEntry(playbackMap, 102)).toBeNull()
  })

  it('falls back to the first playable file for a single-video entry without cid', () => {
    const playbackMap: LocalPlaybackMap = {
      bvid: 'BV1single',
      entries: [
        { path: '/downloads/video.mp4', exists: true, title: 'Main Video' }
      ]
    }

    expect(selectInitialPlayableEntry(playbackMap, 999)).toEqual(
      playbackMap.entries[0]
    )
  })

  it('marks which pages are locally playable for multi-part videos', () => {
    const playbackMap: LocalPlaybackMap = {
      bvid: 'BV1test',
      entries: [
        { cid: 102, path: '/downloads/p2.mp4', exists: true, title: 'P2' }
      ]
    }

    expect(buildPlayablePages(pages, playbackMap)).toEqual([
      {
        cid: 101,
        part: 'P1',
        page: 1,
        duration: 60,
        playable: false,
        localPath: null
      },
      {
        cid: 102,
        part: 'P2',
        page: 2,
        duration: 120,
        playable: true,
        localPath: '/downloads/p2.mp4'
      }
    ])
  })
})
