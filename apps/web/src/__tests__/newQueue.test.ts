import { describe, expect, it } from 'vitest'
import { normalizeScheduler, normalizeTask, normalizeTaskState, normalizeTaskStatus } from '../stores/newQueue'

describe('newQueue normalization', () => {
  it('fills missing task status and nested defaults', () => {
    const task = normalizeTask({
      id: 'task-1',
      title: '示例任务',
      media_type: 'video',
      media_id: 'BV1test',
      state: 2,
      scheduler_id: 'scheduler-1',
      meta: null,
      prepare: undefined,
      subtasks: undefined,
      subtaskStatus: undefined,
    })

    expect(task.id).toBe('task-1')
    expect(task.state).toBe('active')
    expect(task.schedulerId).toBe('scheduler-1')
    expect(task.status).toEqual({
      progress: 0,
      speed: 0,
      eta: 0,
      stage: 'preparing',
      downloaded: 0,
      total: 0,
    })
    expect(task.subtaskStatus).toEqual({})
    expect(task.meta).toEqual({})
    expect(task.prepare).toEqual({})
    expect(task.subtasks).toEqual([])
  })

  it('preserves task progress fields when status exists', () => {
    expect(
      normalizeTaskStatus({
        progress: 88,
        speed: 1024,
        eta: 12,
        stage: 'downloading',
        downloaded: 2048,
        total: 4096,
      })
    ).toEqual({
      progress: 88,
      speed: 1024,
      eta: 12,
      stage: 'downloading',
      downloaded: 2048,
      total: 4096,
    })
  })

  it('normalizes enum-like task states', () => {
    expect(normalizeTaskState('TaskState.ACTIVE')).toBe('active')
    expect(normalizeTaskState('3')).toBe('completed')
    expect(normalizeTaskState('unknown')).toBe('backlog')
  })

  it('deduplicates scheduler task ids while preserving order', () => {
    const scheduler = normalizeScheduler({
      id: 'scheduler-1',
      title: '系列任务',
      list: ['task-1', 'task-2', 'task-1', '', 'task-3', 'task-2'],
      count: 6,
      queue_type: 'pending',
      state: 0,
      folder: '/downloads/series',
      created_at: 100,
      updated_at: 200,
    })

    expect(scheduler.list).toEqual(['task-1', 'task-2', 'task-3'])
    expect(scheduler.count).toBe(3)
    expect(scheduler.queueType).toBe('pending')
    expect(scheduler.state).toBe('idle')
  })
})
