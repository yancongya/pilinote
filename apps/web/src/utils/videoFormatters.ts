/**
 * 视频相关格式化工具函数
 */

/**
 * 格式化时长（秒转为 MM:SS）
 * @param seconds 秒数
 * @returns 格式化的时长字符串，例如 "4:55", "81:15"
 */
export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 格式化数字（播放量、评论数等）
 * @param num 数字
 * @returns 格式化的数字字符串，例如 "1.2w", "5.4k", "543"
 */
export const formatNumber = (num: number): string => {
  if (num === undefined || num === null) return '0'
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}w`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

/**
 * 格式化观看进度（秒转为百分比）
 * @param progress 当前进度（秒）
 * @param duration 总时长（秒）
 * @returns 格式化的进度字符串，例如 "75%", "未观看"
 */
export const formatProgress = (progress: number, duration: number): string => {
  if (progress === -1 || !duration || duration === 0) return '未观看'
  const percent = Math.floor((progress / duration) * 100)
  return `${percent}%`
}

/**
 * 格式化时间戳为具体日期时间
 * @param timestamp Unix时间戳（秒）
 * @returns 格式化的日期时间字符串，例如 "2024-01-15 14:30"
 */
export const formatTime = (timestamp: number): string => {
  if (!timestamp || timestamp === 0) return ''
  try {
    const date = new Date(timestamp * 1000)
    // 检查日期是否有效
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    console.error('格式化时间失败:', error)
    return ''
  }
}