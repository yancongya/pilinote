import type { Task } from '../../stores/newQueue'

export interface MediaLibraryFile {
  path: string
  title: string
  size: number
  size_mb: number
  cover_path?: string
  modified_time: number
  modified_date: string
}

export interface MediaLibraryFolderMetadata {
  name: string
  title: string
  path: string
  file_count: number
  size: number
  content_size?: number
  metadata_size: number
  total_size: number
  size_mb: number
  size_gb: number
  cover?: string
  cover_path?: string
  avatar?: string
  avatar_path?: string
  studio?: string
  markdown_path?: string
  nfo_data?: Record<string, any>
  created_time: number
}

export interface MediaLibraryScanData {
  folders?: MediaLibraryFolderMetadata[]
  folder_videos?: Record<string, { files?: MediaLibraryFile[] }>
}

export function getMediaLibraryItemType(folder: MediaLibraryFolderMetadata): 'video' | 'opus' {
  return folder.nfo_data?.opus_id ? 'opus' : 'video'
}

export function getMediaPrimarySize(folder: MediaLibraryFolderMetadata, mediaType: 'video' | 'opus'): number {
  if (mediaType === 'opus') {
    if (typeof folder.content_size === 'number') {
      return folder.content_size
    }
    return Math.max((folder.total_size || 0) - (folder.metadata_size || 0), 0)
  }
  return folder.size || 0
}

export function getMediaMetadataSize(folder: MediaLibraryFolderMetadata, mediaType: 'video' | 'opus'): number {
  if (mediaType === 'opus') {
    const totalSize = folder.total_size || 0
    const primarySize = getMediaPrimarySize(folder, mediaType)
    return Math.max(totalSize - primarySize, 0)
  }
  return folder.metadata_size || 0
}

export function getMediaTotalSize(folder: MediaLibraryFolderMetadata, mediaType: 'video' | 'opus'): number {
  const primarySize = getMediaPrimarySize(folder, mediaType)
  const metadataSize = getMediaMetadataSize(folder, mediaType)
  return primarySize + metadataSize
}

export function getMediaLibraryRoute(task: Task): string | null {
  const opusId = task.meta?.nfo_data?.opus_id
  if (opusId) {
    return `/opus/${String(opusId).replace(/^cv/i, '')}`
  }

  const bvid = task.meta?.nfo_data?.bvid
  if (bvid) {
    return `/video/${bvid}`
  }

  return null
}

export function convertScanDataToMediaTasks(scanData: MediaLibraryScanData): Task[] {
  const tasks: Task[] = []

  if (!scanData?.folders) {
    return tasks
  }

  scanData.folders.forEach((folder) => {
    const mediaType = getMediaLibraryItemType(folder)
    const folderVideos = scanData.folder_videos?.[folder.name]?.files || []

    if (mediaType === 'video' && folderVideos.length === 0) {
      return
    }

    const primarySize = getMediaPrimarySize(folder, mediaType)
    const metadataSize = getMediaMetadataSize(folder, mediaType)
    const totalSize = getMediaTotalSize(folder, mediaType)

    const task: Task = {
      id: `folder-${folder.name}`,
      ts: Date.now(),
      seq: 0,
      title: folder.title,
      cover: folder.cover_path || '',
      desc: folder.nfo_data?.plot || '',
      duration: 0,
      pubtime: folder.created_time * 1000,
      media_type: mediaType,
      url: '',
      media_id: folder.nfo_data?.opus_id || folder.nfo_data?.bvid || folder.name,
      schedulerId: undefined,
      state: 'completed',
      status: {
        progress: 100,
        speed: 0,
        eta: 0,
        stage: 'completed',
        downloaded: totalSize,
        total: totalSize
      },
      meta: {
        folder_name: folder.name,
        folder_path: folder.path,
        file_count: folder.file_count,
        total_size: totalSize,
        metadata_size: metadataSize,
        primary_size: primarySize,
        primary_size_label: mediaType === 'opus' ? '文档/图片' : '视频',
        media_type: mediaType,
        studio: folder.studio,
        cover_path: folder.cover_path,
        avatar_path: folder.avatar_path,
        markdown_path: folder.markdown_path,
        nfo_data: folder.nfo_data,
        files: folderVideos,
        statistics: folder.nfo_data?.statistics,
        tags: folder.nfo_data?.tags || [],
        runtime: mediaType === 'video' ? folder.nfo_data?.runtime : undefined,
        rating: mediaType === 'video' ? folder.nfo_data?.rating : undefined,
        premiered: folder.nfo_data?.premiered
      },
      prepare: {},
      subtasks: [],
      subtaskStatus: {},
      created_at: folder.created_time * 1000,
      updated_at: Date.now()
    }

    tasks.push(task)
  })

  return tasks
}
