import type { DownloadPart } from '../hooks/useVideoDownload'

export interface CollectionTaskPayloadInput {
  part: DownloadPart
  episodeTitle: string
  collectionTitle: string
  collectionBvid: string
  episodePage: number
  episodeCover?: string
}

export interface VideoTaskPayload {
  title: string
  media_type: 'video' | 'opus'
  media_id: string
  cover?: string
  desc: string
  meta: Record<string, unknown>
}

export interface SchedulerPayload {
  title: string
  task_ids: string[]
  folder: string
}

export interface DetailDownloadOptions {
  selectedPages: Set<number> | undefined
  forceRedownload: boolean | undefined
}

export const buildCollectionTaskPayload = ({
  part,
  episodeTitle,
  collectionTitle,
  collectionBvid,
  episodePage,
  episodeCover,
}: CollectionTaskPayloadInput): VideoTaskPayload => ({
  title: part.title,
  media_type: 'video',
  media_id: part.bvid,
  cover: part.cover || episodeCover,
  desc: `合集：${collectionTitle}`,
  meta: {
    cid: part.cid,
    page: part.page,
    part_title: part.title,
    collection_bvid: collectionBvid,
    collection_title: collectionTitle,
    collection_episode_title: episodeTitle,
    output_subdir: `P${String(episodePage).padStart(2, '0')} - ${episodeTitle}`,
  },
})

export const buildOpusTaskPayload = (input: {
  mediaId: string
  title: string
  cover?: string
}): VideoTaskPayload => ({
  title: input.title,
  media_type: 'opus',
  media_id: /^cv/i.test(input.mediaId) ? input.mediaId : `cv${input.mediaId}`,
  cover: input.cover || '',
  desc: '图文下载任务',
  meta: {},
})

export const buildSchedulerPayload = (
  title: string,
  taskIds: string[],
  folder: string,
): SchedulerPayload => ({ title, task_ids: taskIds, folder })

export const buildDetailDownloadOptions = (
  selectedPages: Set<number> | undefined,
  forceRedownload: boolean | undefined,
): DetailDownloadOptions => ({ selectedPages, forceRedownload })
