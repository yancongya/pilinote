import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLocalVideoPlayback } from '../useLocalVideoPlayback'

const createVideoElement = () => {
  const element = document.createElement('video')
  Object.defineProperty(element, 'currentTime', { configurable: true, value: 0, writable: true })
  return element
}

describe('useLocalVideoPlayback', () => {
  it('clears playback state and queued seek when the poster controller resets', () => {
    const { result } = renderHook(() => useLocalVideoPlayback())

    act(() => {
      result.current.queueSeek(12)
      result.current.toggleVideoPinned()
      result.current.handlePlay()
    })
    act(() => result.current.resetForPoster())

    expect(result.current.isVideoPlaying).toBe(false)
    expect(result.current.isVideoPinned).toBe(false)
    const element = createVideoElement()
    result.current.videoElementRef.current = element
    act(() => result.current.handleLoadedMetadata())
    expect(element.currentTime).toBe(0)
  })

  it('does nothing when seeking without a mounted video element', () => {
    const { result } = renderHook(() => useLocalVideoPlayback())

    expect(() => {
      act(() => {
        result.current.playAt(8)
        result.current.queueSeek(8)
        result.current.handleLoadedMetadata()
      })
    }).not.toThrow()
  })

  it('applies a queued seek when metadata becomes available', () => {
    const { result } = renderHook(() => useLocalVideoPlayback())
    const element = createVideoElement()
    result.current.videoElementRef.current = element

    act(() => {
      result.current.queueSeek(24)
      result.current.handleLoadedMetadata()
    })

    expect(element.currentTime).toBe(24)
    element.currentTime = 0
    act(() => result.current.handleLoadedMetadata())
    expect(element.currentTime).toBe(0)
  })

  it('seeks and ignores rejected play promises', async () => {
    const { result } = renderHook(() => useLocalVideoPlayback())
    const element = createVideoElement()
    const play = vi.fn().mockRejectedValue(new Error('autoplay blocked'))
    Object.defineProperty(element, 'play', { configurable: true, value: play })
    result.current.videoElementRef.current = element

    act(() => result.current.playAt(36))
    await Promise.resolve()

    expect(element.currentTime).toBe(36)
    expect(play).toHaveBeenCalledOnce()
  })

  it('tracks only positive finite durations', () => {
    const { result } = renderHook(() => useLocalVideoPlayback())
    const element = createVideoElement()
    result.current.videoElementRef.current = element

    Object.defineProperty(element, 'duration', { configurable: true, value: 0 })
    act(() => result.current.handleDurationChange())
    expect(result.current.localVideoDurationSeconds).toBeNull()

    Object.defineProperty(element, 'duration', { configurable: true, value: 91.5 })
    act(() => result.current.handleDurationChange())
    expect(result.current.localVideoDurationSeconds).toBe(91.5)

    for (const duration of [NaN, Infinity, -1, 0]) {
      Object.defineProperty(element, 'duration', { configurable: true, value: duration })
      act(() => result.current.handleDurationChange())
      expect(result.current.localVideoDurationSeconds).toBe(91.5)
    }
    act(() => result.current.resetForPoster())
    expect(result.current.localVideoDurationSeconds).toBe(91.5)
  })

  it('consumes a queued seek even when metadata arrives without a mounted element', () => {
    const { result } = renderHook(() => useLocalVideoPlayback())
    act(() => {
      result.current.queueSeek(15)
      result.current.handleLoadedMetadata()
    })
    const element = createVideoElement()
    result.current.videoElementRef.current = element
    act(() => result.current.handleLoadedMetadata())
    expect(element.currentTime).toBe(0)
  })

  it('tracks play, pause and ended independently of the pinned state', () => {
    const { result } = renderHook(() => useLocalVideoPlayback())
    act(() => {
      result.current.toggleVideoPinned()
      result.current.handlePlay()
    })
    expect(result.current.isVideoPlaying).toBe(true)
    act(() => result.current.handlePause())
    expect(result.current.isVideoPlaying).toBe(false)
    act(() => result.current.handlePlay())
    act(() => result.current.handleEnded())
    expect(result.current.isVideoPlaying).toBe(false)
    expect(result.current.isVideoPinned).toBe(true)
  })

  it('ignores a synchronous playback failure after setting the seek time', () => {
    const { result } = renderHook(() => useLocalVideoPlayback())
    const element = createVideoElement()
    Object.defineProperty(element, 'play', {
      configurable: true,
      value: () => { throw new Error('unavailable') },
    })
    result.current.videoElementRef.current = element
    expect(() => act(() => result.current.playAt(42))).not.toThrow()
    expect(element.currentTime).toBe(42)
  })
})
