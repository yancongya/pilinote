import { describe, expect, it } from 'vitest'
import { getSchedulerCoverSource } from '../components/NewDownload/SchedulerCard'
import type { Task } from '../stores/newQueue'

describe('SchedulerCard', () => {
  it('uses task metadata image as the scheduler cover when task cover is empty', () => {
    const tasks = [
      {
        id: 'task-1',
        ts: 0,
        seq: 0,
        title: 'P1',
        cover: '',
        desc: '',
        duration: 0,
        pubtime: 0,
        media_type: 'video',
        url: '',
        media_id: 'BV1multi',
        state: 'pending',
        status: {
          progress: 0,
          speed: 0,
          eta: 0,
          stage: 'preparing',
          downloaded: 0,
          total: 0,
        },
        meta: {
          pic: 'https://example.com/series-cover.jpg',
        },
        prepare: {},
        subtasks: [],
        subtaskStatus: {},
        created_at: 100,
        updated_at: 100,
      } as Task,
    ]

    expect(getSchedulerCoverSource(tasks)).toBe('https://example.com/series-cover.jpg')
  })
})
