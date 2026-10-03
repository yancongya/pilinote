export type AiNoteKeypoint = { timestamp: string; seconds: number; title: string }

export const parseTimestampToSeconds = (timestamp: unknown): number | null => {
  if (typeof timestamp !== 'string') return null
  const trimmed = timestamp.trim()
  const match = trimmed.match(/^(\d{1,2}:)?\d{2}:\d{2}$/)
  if (!match) return null
  const parts = trimmed.split(':').map(Number)
  if (parts.some(part => !Number.isFinite(part))) return null
  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return minutes * 60 + seconds
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
  }
  return null
}

export const parseAiNoteKeypoints = (aiNoteMarkdown: string): AiNoteKeypoint[] => {
  if (!aiNoteMarkdown.trim()) return []
  const lines = aiNoteMarkdown.split(/\r?\n/)
  const results: AiNoteKeypoint[] = []
  const seen = new Set<number>()

  const pushPoint = (timestamp: unknown, title: unknown) => {
    const seconds = parseTimestampToSeconds(timestamp)
    if (seconds === null || seconds < 0 || seen.has(seconds)) return
    seen.add(seconds)
    const ts = typeof timestamp === 'string' ? timestamp.trim() : ''
    const tt = typeof title === 'string' ? title.trim() : ''
    if (!ts) return
    results.push({ timestamp: ts, seconds, title: tt })
  }

  const tsHeadingIndex = lines.findIndex(line => /^\s*##\s*时间戳\s*$/.test(line))
  if (tsHeadingIndex >= 0) {
    for (let index = tsHeadingIndex + 1; index < lines.length; index++) {
      const line = lines[index]
      if (/^\s*#{1,6}\s+/.test(line)) break
      const itemMatch = line.match(/^\s*-\s*((?:[0-9]{1,2}:)?[0-9]{2}:[0-9]{2})\s+(.+)\s*$/)
      if (itemMatch) pushPoint(itemMatch[1], itemMatch[2])
    }
  }

  if (results.length === 0) {
    for (const line of lines) {
      const headingMatch = line.match(/^\s*#{2,6}\s*((?:[0-9]{1,2}:)?[0-9]{2}:[0-9]{2})\s+(.+)\s*$/)
      if (headingMatch) pushPoint(headingMatch[1], headingMatch[2])
    }
  }

  results.sort((a, b) => a.seconds - b.seconds)
  return results.slice(0, 18)
}
