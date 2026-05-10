import { describe, expect, it } from 'vitest'
import { getSchedulerCoverSource, getTaskCoverSource, groupSchedulerTasks } from '../components/NewDownload/SchedulerCard'
import type { Task } from '../stores/newQueue'

describe('SchedulerCard', () => {
  const createTask = (overrides: Partial<Task> = {}): Task => ({
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
    meta: {},
    prepare: {},
    subtasks: [],
    subtaskStatus: {},
    created_at: 100,
    updated_at: 100,
    ...overrides,
  } as Task)

  it('uses task metadata image as the scheduler cover when task cover is empty', () => {
    const tasks = [
      createTask({
        meta: {
          pic: 'https://example.com/series-cover.jpg',
        },
      }),
    ]

    expect(getSchedulerCoverSource(tasks)).toBe('https://example.com/series-cover.jpg')
  })

  it('prefers task cover and falls back to metadata cover for task rows', () => {
    expect(getTaskCoverSource(createTask({ cover: ' https://example.com/task.jpg ' }))).toBe('https://example.com/task.jpg')
    expect(getTaskCoverSource(createTask({ meta: { pic: 'https://example.com/meta-pic.jpg' } }))).toBe('https://example.com/meta-pic.jpg')
    expect(getTaskCoverSource(createTask({ meta: { cover: 'https://example.com/meta-cover.jpg' } }))).toBe('https://example.com/meta-cover.jpg')
  })

  it('groups collection episode parts by output subdir', () => {
    const tasks = [
      createTask({
        id: 'part-1',
        title: '图层分离插件助力2d动画',
        cover: 'https://example.com/episode.jpg',
        meta: {
          page: 1,
          part_title: '图层分离插件助力2d动画',
          collection_title: 'webui-forge-neo-v3新分支整合包教程',
          output_subdir: 'P21 - 图层拆分插件：人物拆分',
        },
      }),
      createTask({
        id: 'part-2',
        title: 'klein模型背景补全',
        media_id: 'BV1multi',
        meta: {
          page: 2,
          part_title: 'klein模型背景补全',
          collection_title: 'webui-forge-neo-v3新分支整合包教程',
          output_subdir: 'P21 - 图层拆分插件：人物拆分',
        },
      }),
      createTask({
        id: 'single',
        title: '独立视频',
        media_id: 'BV1single',
      }),
    ]

    const groups = groupSchedulerTasks(tasks)

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      key: 'collection:P21 - 图层拆分插件：人物拆分',
      title: '图层拆分插件：人物拆分',
      cover: 'https://example.com/episode.jpg',
      isCollectionGroup: true,
    })
    expect(groups[0].tasks.map(task => task.id)).toEqual(['part-1', 'part-2'])
    expect(groups[1]).toMatchObject({
      key: 'task:single',
      title: '独立视频',
      isCollectionGroup: false,
    })
  })

  it('groups reused collection tasks by collection title and media id when output subdir is missing', () => {
    const tasks = [
      createTask({
        id: 'part-1',
        title: '图层分离插件助力2d动画',
        media_id: 'BV1JA9wBqEbi',
        cover: 'https://example.com/episode.jpg',
        meta: {
          page: 1,
          part_title: '图层分离插件助力2d动画',
          collection_title: 'webui-forge-neo-v3新分支整合包教程',
          collection_episode_title: '图层拆分插件：人物拆分',
        },
      }),
      createTask({
        id: 'part-2',
        title: 'klein模型背景补全',
        media_id: 'BV1JA9wBqEbi',
        meta: {
          page: 2,
          part_title: 'klein模型背景补全',
          collection_title: 'webui-forge-neo-v3新分支整合包教程',
          collection_episode_title: '图层拆分插件：人物拆分',
        },
      }),
    ]

    const groups = groupSchedulerTasks(tasks)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      key: 'collection:webui-forge-neo-v3新分支整合包教程:BV1JA9wBqEbi',
      title: '图层拆分插件：人物拆分',
      cover: 'https://example.com/episode.jpg',
      isCollectionGroup: true,
    })
    expect(groups[0].tasks.map(task => task.id)).toEqual(['part-1', 'part-2'])
  })
})
