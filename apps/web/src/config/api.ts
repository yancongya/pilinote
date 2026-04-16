/**
 * API 配置
 * 用于动态获取 API 基础 URL，支持局域网访问
 */

/**
 * 获取 API 基础 URL
 * 自动使用当前页面的主机名
 */
export const getApiBaseUrl = (): string => {
  // 如果已经在生产环境部署，使用相对路径
  if (import.meta.env.PROD) {
    return '';
  }
  
  // 开发环境：使用当前页面的主机名，端口改为 8000
  const hostname = window.location.hostname;
  return `http://${hostname}:8000`;
};

/**
 * 获取完整的 API URL
 */
export const getApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path}`;
};

/**
 * 获取头像代理 URL
 */
export const getAvatarProxyUrl = (avatarUrl: string): string => {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/auth/proxy/avatar?url=${encodeURIComponent(avatarUrl)}`;
};

export const getLocalVideoUrl = (filePath: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanPath = filePath.replace('file://', '');
  return `${baseUrl}/api/library/video?file_path=${encodeURIComponent(cleanPath)}`;
};

export const getLocalImageUrl = (filePath: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanPath = filePath.replace('file://', '');
  return `${baseUrl}/api/library/image?file_path=${encodeURIComponent(cleanPath)}`;
};

/**
 * 获取 WebSocket URL
 */
export const getWebSocketUrl = (path: string = '/ws/queue'): string => {
  const hostname = window.location.hostname;
  return `ws://${hostname}:8000${path}`;
};
