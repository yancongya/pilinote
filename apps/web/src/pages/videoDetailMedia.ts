export interface DetailTaskPayloadInput {
  type: 'video' | 'opus'
  mediaId: string
  title: string
  cover?: string
  cid?: number
}

export interface DetailTaskPayload {
  title: string
  media_type: 'video' | 'opus'
  media_id: string
  cover: string
  desc: string
  meta: Record<string, unknown>
}

export const normalizeOpusMediaId = (mediaId: string): string => {
  if (!mediaId) {
    return ''
  }

  return /^cv/i.test(mediaId) ? mediaId : `cv${mediaId}`
}

export const buildDetailTaskPayload = (
  input: DetailTaskPayloadInput
): DetailTaskPayload => {
  if (input.type === 'opus') {
    return {
      title: input.title,
      media_type: 'opus',
      media_id: normalizeOpusMediaId(input.mediaId),
      cover: input.cover || '',
      desc: '图文下载任务',
      meta: {}
    }
  }

  return {
    title: input.title,
    media_type: 'video',
    media_id: input.mediaId,
    cover: input.cover || '',
    desc: input.cid ? `CID: ${input.cid}` : '',
    meta: input.cid ? { cid: input.cid } : {}
  }
}
