import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  VideoDetailAiNotePanel,
  VideoDetailComments,
  VideoDetailSkeleton,
} from './VideoDetailPresenters'

describe('VideoDetail presenters', () => {
  it('renders the existing skeleton structure and classes', () => {
    const { container } = render(<VideoDetailSkeleton />)
    expect(container.querySelector('.video-detail-page')).not.toBeNull()
    expect(container.querySelector('.video-detail-skeleton-media')).not.toBeNull()
    expect(container.querySelectorAll('.video-detail-skeleton-comment')).toHaveLength(2)
  })

  it('renders up to three comments and delegates display formatting', () => {
    const getAvatarImage = vi.fn((_author: string, index: number) => `/avatar/${index}.png`)
    const formatTime = vi.fn((time: number | string) => `time-${time}`)
    render(
      <VideoDetailComments
        comments={[1, 2, 3, 4].map((number) => ({
          type: number === 1 ? 'top' : 'normal',
          content: `评论${number}`,
          like: number,
          reply: number === 2 ? 1 : 0,
          author: `用户${number}`,
          time: number,
        }))}
        getAvatarImage={getAvatarImage}
        formatTime={formatTime}
      />,
    )

    expect(document.querySelectorAll('.video-detail-comment-item')).toHaveLength(3)
    expect(screen.getByText('置顶')).not.toBeNull()
    expect(screen.queryByText('评论4')).toBeNull()
    expect(getAvatarImage).toHaveBeenCalledWith('用户1', 0)
    expect(formatTime).toHaveBeenCalledWith(1)
  })

  it('renders the AI empty state and forwards refresh, open, and seek callbacks', () => {
    const onRefresh = vi.fn()
    const onOpenPanel = vi.fn()
    const onSeekToSeconds = vi.fn()
    const { rerender } = render(
      <VideoDetailAiNotePanel
        isOpus={false}
        cardPadding="12px"
        cardRadius="8px"
        smallFontSize="12px"
        keypoints={[]}
        durationSeconds={60}
        loading={false}
        error={null}
        markdown=""
        folderPath={null}
        onRefresh={onRefresh}
        onOpenPanel={onOpenPanel}
        onSeekToSeconds={onSeekToSeconds}
      />,
    )

    expect(screen.getByText('当前分P暂无笔记')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '刷新' }))
    fireEvent.click(screen.getByRole('button', { name: '打开面板' }))
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onOpenPanel).toHaveBeenCalledOnce()

    rerender(
      <VideoDetailAiNotePanel
        isOpus={false}
        cardPadding="12px"
        cardRadius="8px"
        smallFontSize="12px"
        keypoints={[{ timestamp: '00:10', seconds: 10, title: '关键点' }]}
        durationSeconds={60}
        loading={false}
        error={null}
        markdown=""
        folderPath={null}
        onRefresh={onRefresh}
        onOpenPanel={onOpenPanel}
        onSeekToSeconds={onSeekToSeconds}
      />,
    )
    fireEvent.click(screen.getByRole('listitem', { name: '00:10 关键点' }))
    expect(onSeekToSeconds).toHaveBeenCalledWith(10)
  })

  it('renders no AI panel for opus content', () => {
    const { container } = render(
      <VideoDetailAiNotePanel
        isOpus
        cardPadding="12px"
        cardRadius="8px"
        smallFontSize="12px"
        keypoints={[]}
        durationSeconds={0}
        loading={false}
        error={null}
        markdown=""
        folderPath={null}
        onRefresh={vi.fn()}
        onOpenPanel={vi.fn()}
        onSeekToSeconds={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })
})
