/**
 * API 配置
 * 用于动态获取 API 基础 URL，支持局域网访问
 */

interface RuntimeConfig {
  apiBaseUrl?: string
  wsBaseUrl?: string
}

declare global {
  interface Window {
    __PILINOTE_RUNTIME__?: RuntimeConfig
  }
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const getRuntimeConfig = (): RuntimeConfig | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }
  return window.__PILINOTE_RUNTIME__
}

/**
 * 获取 API 基础 URL
 * 自动使用当前页面的主机名
 */
export const getApiBaseUrl = (): string => {
  const runtimeConfig = getRuntimeConfig()
  if (runtimeConfig?.apiBaseUrl) {
    return trimTrailingSlash(runtimeConfig.apiBaseUrl)
  }

  const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (envBaseUrl) {
    return trimTrailingSlash(envBaseUrl)
  }

  // 如果已经在生产环境部署，使用相对路径
  if (import.meta.env.PROD) {
    return ''
  }

  // 开发环境：使用当前页面的主机名，端口改为 8000
  const hostname = window.location.hostname === 'localhost' || window.location.hostname === '::1'
    ? '127.0.0.1'
    : window.location.hostname
  return `http://${hostname}:8000`
}

/**
 * 获取完整的 API URL
 */
export const getApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}${path}`
}

/**
 * 获取头像代理 URL
 */
export const getAvatarProxyUrl = (avatarUrl: string): string => {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/api/auth/proxy/avatar?url=${encodeURIComponent(avatarUrl)}`
}

export const getLocalVideoUrl = (filePath: string): string => {
  const baseUrl = getApiBaseUrl()
  const cleanPath = filePath.replace('file://', '')
  return `${baseUrl}/api/library/video?file_path=${encodeURIComponent(cleanPath)}`
}

export const getLocalImageUrl = (filePath: string): string => {
  const baseUrl = getApiBaseUrl()
  const cleanPath = filePath.replace('file://', '')
  return `${baseUrl}/api/library/image?file_path=${encodeURIComponent(cleanPath)}`
}

/**
 * 获取 WebSocket URL
 */
export const getWebSocketUrl = (path: string = '/ws/queue'): string => {
  const runtimeConfig = getRuntimeConfig()
  if (runtimeConfig?.wsBaseUrl) {
    return `${trimTrailingSlash(runtimeConfig.wsBaseUrl)}${path}`
  }

  const envWsBaseUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined
  if (envWsBaseUrl) {
    return `${trimTrailingSlash(envWsBaseUrl)}${path}`
  }

  const hostname = window.location.hostname === 'localhost' || window.location.hostname === '::1'
    ? '127.0.0.1'
    : window.location.hostname
  return `ws://${hostname}:8000${path}`
}
