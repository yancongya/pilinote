import { describe, expect, it } from 'vitest'

import {
  convertScanDataToMediaTasks,
  getMediaLibraryRoute,
} from '../components/NewDownload/mediaLibrary'

describe('mediaLibrary', () => {
  it('converts opus folders into media library tasks with document and image sizes', () => {
    const tasks = convertScanDataToMediaTasks({
      folders: [
        {
          name: '示例图文',
          title: '示例图文',
          path: '/downloads/示例图文',
          file_count: 0,
          size: 0,
          metadata_size: 1024,
          total_size: 8192,
          size_mb: 0.01,
          size_gb: 0,
          cover_path: '/downloads/示例图文/cover.jpg',
          avatar_path: '/downloads/示例图文/avatar.jpg',
          markdown_path: '/downloads/示例图文/示例图文.md',
          studio: '作者A',
          nfo_data: {
            opus_id: 'cv123456',
            title: '示例图文',
            studio: '作者A',
            statistics: {
              like: 12,
              reply: 3,
              share: 2,
              favorite: 5,
              coin: 1,
            },
          },
          created_time: 1710000000,
        },
      ],
      folder_videos: {},
    })

    expect(tasks).toHaveLength(1)
    expect(tasks[0].media_type).toBe('opus')
    expect(tasks[0].meta.primary_size).toBe(7168)
    expect(tasks[0].meta.metadata_size).toBe(1024)
    expect(tasks[0].meta.primary_size_label).toBe('文档/图片')
    expect(tasks[0].media_id).toBe('cv123456')
  })

  it('keeps video folders as video tasks and routes by bvid', () => {
    const tasks = convertScanDataToMediaTasks({
      folders: [
        {
          name: '示例视频',
          title: '示例视频',
          path: '/downloads/示例视频',
          file_count: 1,
          size: 10000,
          metadata_size: 2000,
          total_size: 12000,
          size_mb: 0.01,
          size_gb: 0,
          cover_path: '/downloads/示例视频/cover.jpg',
          studio: 'UP主A',
          nfo_data: {
            bvid: 'BV1test12345',
            title: '示例视频',
          },
          created_time: 1710000000,
        },
      ],
      folder_videos: {
        示例视频: {
          files: [
            {
              path: '/downloads/示例视频/video.mp4',
              title: '示例视频',
              size: 10000,
              size_mb: 0.01,
              modified_time: 1710000000,
              modified_date: '2024-03-09 12:00:00',
            },
          ],
        },
      },
    })

    expect(tasks).toHaveLength(1)
    expect(tasks[0].media_type).toBe('video')
    expect(tasks[0].meta.primary_size).toBe(10000)
    expect(tasks[0].meta.metadata_size).toBe(2000)
    expect(getMediaLibraryRoute(tasks[0])).toBe('/video/BV1test12345')
  })

  it('routes opus tasks to opus detail pages', () => {
    const [task] = convertScanDataToMediaTasks({
      folders: [
        {
          name: '图文目录',
          title: '图文目录',
          path: '/downloads/图文目录',
          file_count: 0,
          size: 0,
          metadata_size: 0,
          total_size: 4096,
          size_mb: 0,
          size_gb: 0,
          nfo_data: {
            opus_id: 'cv654321',
          },
          created_time: 1710000000,
        },
      ],
      folder_videos: {},
    })

    expect(getMediaLibraryRoute(task)).toBe('/opus/654321')
  })
})
