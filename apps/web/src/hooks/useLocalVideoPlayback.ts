import { useCallback, useRef, useState } from 'react'

export function useLocalVideoPlayback() {
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const pendingSeekSecondsRef = useRef<number | null>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isVideoPinned, setIsVideoPinned] = useState(false)
  const [localVideoDurationSeconds, setLocalVideoDurationSeconds] = useState<number | null>(null)

  const queueSeek = (seconds: number) => {
    pendingSeekSecondsRef.current = seconds
  }

  const playAt = (seconds: number) => {
    const element = videoElementRef.current
    if (!element) return

    try {
      element.currentTime = seconds
      const maybePromise = element.play()
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        void (maybePromise as Promise<void>).catch(() => {})
      }
    } catch {
    }
  }

  const handleLoadedMetadata = () => {
    const pending = pendingSeekSecondsRef.current
    if (pending === null) return
    pendingSeekSecondsRef.current = null
    if (!videoElementRef.current) return
    try {
      videoElementRef.current.currentTime = pending
    } catch {
    }
  }

  const handleDurationChange = () => {
    const element = videoElementRef.current
    if (!element) return
    const duration = Number(element.duration)
    if (Number.isFinite(duration) && duration > 0) {
      setLocalVideoDurationSeconds(duration)
    }
  }

  const resetForPoster = useCallback(() => {
    setIsVideoPlaying(false)
    setIsVideoPinned(false)
    pendingSeekSecondsRef.current = null
  }, [])

  return {
    videoElementRef,
    isVideoPlaying,
    isVideoPinned,
    localVideoDurationSeconds,
    queueSeek,
    playAt,
    toggleVideoPinned: () => setIsVideoPinned((previous) => !previous),
    handlePlay: () => setIsVideoPlaying(true),
    handlePause: () => setIsVideoPlaying(false),
    handleEnded: () => setIsVideoPlaying(false),
    handleLoadedMetadata,
    handleDurationChange,
    resetForPoster,
  }
}
