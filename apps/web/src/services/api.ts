import { getApiBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  code?: number;
  error_type?: string;
  hint?: string;
}

export interface QrcodeData {
  url: string;
  qrcode_key: string | null;
}

export interface UserInfo {
  mid: number;
  username: string;
  avatar?: string;
  level?: number;
  vip_status?: boolean;
}

export interface SessdataRequest {
  sessdata: string;
}

export interface PasswordRequest {
  username: string;
  password: string;
  token?: string;
  challenge?: string;
  validate?: string;
  seccode?: string;
}

export interface SmsCodeRequest {
  phone: string;
}

export interface SmsLoginRequest {
  phone: string;
  code: string;
  captcha_key?: string;
}

class ApiService {
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      // 如果HTTP状态码不是2xx，检查是否有detail字段
      if (!response.ok) {
        // FastAPI的HTTPException会返回detail字段
        if (data.detail) {
          // 如果detail是字符串
          if (typeof data.detail === 'string') {
            return {
              success: false,
              message: data.detail
            };
          }
          // 如果detail是对象（包含message、code等）
          if (typeof data.detail === 'object') {
            return {
              success: false,
              message: data.detail.message || '请求失败',
              code: data.detail.code
            };
          }
        }
        // 如果没有detail字段，返回整个data
        return {
          success: false,
          message: data.message || '请求失败',
          code: data.code
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '网络请求失败',
      };
    }
  }

  async getQrcode(): Promise<ApiResponse<QrcodeData>> {
    return this.request<QrcodeData>('/api/auth/qrcode', { method: 'GET' });
  }

  async queryQrcodeStatus(qrcodeKey: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/auth/qrcode/status/${qrcodeKey}`, {
      method: 'GET',
    });
  }

  async loginBySessdata(
    sessdata: string
  ): Promise<ApiResponse<UserInfo>> {
    return this.request<UserInfo>('/api/auth/sessdata', {
      method: 'POST',
      body: JSON.stringify({ sessdata }),
    });
  }

  async loginByPassword(
    request: PasswordRequest
  ): Promise<ApiResponse<UserInfo>> {
    return this.request<UserInfo>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async sendSmsCode(phone: string): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/sms/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async loginBySms(
    request: SmsLoginRequest
  ): Promise<ApiResponse<UserInfo>> {
    return this.request<UserInfo>('/api/auth/sms/login', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getUserInfo(sessdata: string): Promise<ApiResponse<UserInfo>> {
    return this.request<UserInfo>(
      `/api/auth/user-info?sessdata=${encodeURIComponent(sessdata)}`,
      { method: 'GET' }
    );
  }

// 收藏夹相关API
  async getFolders(page: number = 1, pageSize: number = 20): Promise<ApiResponse<any>> {
    return this.request<any>(
      `/api/favorites/folders?page=${page}&page_size=${pageSize}`,
      { method: 'GET' }
    );
  }

  async getFolderDetail(
    folderId: number,
    page: number = 1,
    pageSize: number = 20,
    keyword: string = '',
    order: string = 'mtime',
    sortDirection: string = 'desc'
  ): Promise<ApiResponse<any>> {
    return this.request<any>(
      `/api/favorites/folders/${folderId}?page=${page}&page_size=${pageSize}&keyword=${keyword}&order=${order}&sort_direction=${sortDirection}`,
      { method: 'GET' }
    );
  }

  // 视频详情相关API
  async getVideoDetail(
    videoId: string,
    sessdata?: string
  ): Promise<ApiResponse<any>> {
    const url = sessdata 
      ? `/api/video/${videoId}?sessdata=${encodeURIComponent(sessdata)}`
      : `/api/video/${videoId}`;
    return this.request<any>(url, { method: 'GET' });
  }

  // 稍后再看相关API
  async getWatchLaterList(
    pn: number = 1,
    ps: number = 20,
    keyword: string = '',
    order: string = 'default',
    sortDirection: 'desc' | 'asc' = 'desc'
  ): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      pn: pn.toString(),
      ps: ps.toString()
    })
    
    if (keyword) {
      params.append('keyword', keyword)
    }
    
    if (order && order !== 'default') {
      params.append('order', order)
      params.append('sort_direction', sortDirection)
    }
    
    return this.request<any>(
      `/api/watch-later/list?${params.toString()}`,
      { method: 'GET' }
    );
  }

  // 观看历史相关API
  async getHistoryList(
    pn: number = 1,
    ps: number = 20,
    keyword: string = '',
    order: string = 'default',
    sortDirection: 'desc' | 'asc' = 'desc'
  ): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      pn: pn.toString(),
      ps: ps.toString()
    })
    
    if (keyword) {
      params.append('keyword', keyword)
    }
    
    if (order && order !== 'default') {
      params.append('order', order)
      params.append('sort_direction', sortDirection)
    }
    
    return this.request<any>(
      `/api/history/list?${params.toString()}`,
      { method: 'GET' }
    );
  }

  // 认证升级相关API（Week 1 & 2）
  async initFingerprint(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/init', {
      method: 'POST',
    });
  }

  async refreshCookies(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/refresh/cookies', {
      method: 'POST',
    });
  }

  // Week 3: Geetest验证支持
  async getCaptchaParams(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/captcha/params', {
      method: 'GET',
    });
  }

  async validateCaptcha(
    challenge: string,
    validate: string,
    seccode: string
  ): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/captcha/validate', {
      method: 'POST',
      body: JSON.stringify({ challenge, validate, seccode }),
    });
  }

  async sendSmsCodeWithCaptcha(
    cid: string,
    tel: string,
    token: string,
    challenge: string,
    validate: string,
    seccode: string
  ): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/sms/send', {
      method: 'POST',
      body: JSON.stringify({ cid, tel, token, challenge, validate, seccode }),
    });
  }

  // 多账号管理相关API
  async getLoginStatus(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/status', {
      method: 'GET',
    });
  }

  async getAccounts(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/accounts', {
      method: 'GET',
    });
  }

  async switchAccount(accountId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/auth/accounts/switch?account_id=${accountId}`, {
      method: 'POST',
    });
  }

  async refreshAccount(accountId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/auth/accounts/refresh?account_id=${accountId}`, {
      method: 'POST',
    });
  }

  async deleteAccount(accountId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/auth/accounts/${accountId}`, {
      method: 'DELETE',
    });
  }

  async logout(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/auth/logout', {
      method: 'POST',
    });
  }

  // ===== 新系统API =====

  // 队列管理
  async getAllQueues(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/queue', { method: 'GET' });
  }

  async getQueue(queueType: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/${queueType}`, { method: 'GET' });
  }

  // 任务管理
  async submitTask(taskData: {
    media_type: string;
    media_id: string;
    title?: string;
    cover?: string;
    desc?: string;
    meta?: any;
    prepare?: any;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/api/queue/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async getTask(taskId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/tasks/${taskId}`, { method: 'GET' });
  }

  async updateTask(taskId: string, updateData: {
    state?: number;
    status?: any;
    meta?: any;
    prepare?: any;
  }): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  // 调度器管理
  async createScheduler(schedulerData: {
    title: string;
    task_ids?: string[];
    folder: string;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/api/queue/schedulers', {
      method: 'POST',
      body: JSON.stringify(schedulerData),
    });
  }

  async getSchedulers(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/queue/schedulers', { method: 'GET' });
  }

  async getScheduler(schedulerId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/schedulers/${schedulerId}`, {
      method: 'GET',
    });
  }

  async startScheduler(schedulerId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/schedulers/${schedulerId}/start`, {
      method: 'POST',
    });
  }

  async pauseScheduler(schedulerId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/schedulers/${schedulerId}/pause`, {
      method: 'POST',
    });
  }

  async resumeScheduler(schedulerId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/schedulers/${schedulerId}/resume`, {
      method: 'POST',
    });
  }

  async cancelScheduler(schedulerId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/queue/schedulers/${schedulerId}/cancel`, {
      method: 'POST',
    });
  }

  // 统一媒体API
  async getMediaInfo(mediaType: string, mediaId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/media/${mediaType}/${mediaId}`, {
      method: 'GET',
    });
  }

  async getFavoriteMedia(fid: string, mid?: string): Promise<ApiResponse<any>> {
    const params = mid ? `?mid=${encodeURIComponent(mid)}` : '';
    return this.request<any>(`/api/media/favorite/${fid}${params}`, {
      method: 'GET',
    });
  }

  async getWatchlaterMedia(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/media/watchlater', { method: 'GET' });
  }

  // 缓存管理API
  async clearCache(cacheType?: string): Promise<ApiResponse<any>> {
    const params = cacheType ? `?type=${encodeURIComponent(cacheType)}` : '';
    return this.request<any>(`/api/cache/clear${params}`, {
      method: 'DELETE',
    });
  }

  async getCacheStats(): Promise<ApiResponse<any>> {
    return this.request<any>('/api/cache/stats', {
      method: 'GET',
    });
  }

  async parseDownloadUrl(url: string): Promise<ApiResponse<any>> {
    return this.request<any>('/api/download/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
  }

  async addToDownloadQueue(data: {
    bvid: string
    cid: number
    title: string
    page?: number
    quality?: number
    audio_bitrate?: number
    codec?: string
    output_format?: string
    thumbnail_url?: string
    duration?: number
    uploader?: string
    uploader_mid?: number
    sessdata?: string
    enable_subtitle?: boolean
    enable_nfo?: boolean
    enable_cover?: boolean
    enable_avatar?: boolean
  }): Promise<ApiResponse<any>> {
    return this.submitTask({
      media_type: 'video',
      media_id: data.bvid,
      title: data.title,
      meta: {
        cid: data.cid,
        page: data.page,
        quality: data.quality,
        audio_bitrate: data.audio_bitrate,
        codec: data.codec,
        output_format: data.output_format,
        thumbnail_url: data.thumbnail_url,
        duration: data.duration,
        uploader: data.uploader,
        uploader_mid: data.uploader_mid,
        enable_subtitle: data.enable_subtitle,
        enable_nfo: data.enable_nfo,
        enable_cover: data.enable_cover,
        enable_avatar: data.enable_avatar
      }
    })
  }

  async getDownloadList(): Promise<ApiResponse<any>> {
    // 迁移到新的队列API
    return this.request<any>('/api/queue/tasks', { method: 'GET' })
  }

  async deleteDownload(taskId: string): Promise<ApiResponse<any>> {
    // 迁移到新的队列API
    return this.request<any>(`/api/queue/tasks/${taskId}`, { method: 'DELETE' })
  }

  async deleteDownloadByBvid(bvid: string): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 先获取所有任务，然后根据media_id过滤
    const response = await this.request<any>('/api/queue/tasks', { method: 'GET' })
    if (response.success && response.data) {
      const tasksToDelete = response.data.filter((task: any) => task.media_id === bvid)
      const taskIds = tasksToDelete.map((task: any) => task.id)
      
      // 批量删除
      return this.request<any>('/api/queue/tasks/batch', {
        method: 'DELETE',
        body: JSON.stringify(taskIds),
      })
    }
    return response
  }

  async startBatchDownloads(bvidList: string[]): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 先获取所有任务，然后根据media_id过滤并启动
    const response = await this.request<any>('/api/queue/tasks', { method: 'GET' })
    if (response.success && response.data) {
      const tasksToStart = response.data.filter((task: any) => bvidList.includes(task.media_id))
      
      // 批量更新任务状态为active
      const updatePromises = tasksToStart.map((task: any) => 
        this.updateTask(task.id, { state: 2 }) // 2 = ACTIVE
      )
      
      const results = await Promise.all(updatePromises)
      const allSuccess = results.every(result => result.success)
      
      return {
        success: allSuccess,
        message: allSuccess ? `已启动 ${tasksToStart.length} 个下载任务` : '部分任务启动失败'
      }
    }
    return { success: false, message: '获取任务列表失败' }
  }

  async startDownloadTask(taskId: string): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 更新任务状态为active
    return this.updateTask(taskId, { state: 2 }) // 2 = ACTIVE
  }

  async pauseDownloadTask(taskId: string): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 使用专门的暂停端点
    return this.request<any>(`/api/queue/tasks/${taskId}/pause`, { method: 'POST' })
  }

  async resumeDownloadTask(taskId: string): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 更新任务状态为active
    return this.updateTask(taskId, { state: 2 }) // 2 = ACTIVE
  }

  async cancelDownloadTask(taskId: string): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 使用专门的取消端点
    return this.request<any>(`/api/queue/tasks/${taskId}/cancel`, { method: 'POST' })
  }

  async getDownloadTaskStatus(taskId: string): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 获取任务详情
    return this.getTask(taskId)
  }

  // ========== 下载历史记录相关API ==========

  async getDownloadHistory(
    status?: string,
    page: number = 1,
    pageSize: number = 20,
    keyword?: string,
    dateFrom?: string,
    dateTo?: string,
    order?: string,
    sortDirection?: string
  ): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 获取所有任务并在前端过滤
    const response = await this.request<any>('/api/queue/tasks', { method: 'GET' })
    
    if (response.success && response.data) {
      let filteredTasks = response.data
      
      // 状态过滤
      if (status) {
        const statusMap: Record<string, number> = {
          'pending': 0,    // BACKLOG
          'downloading': 2, // ACTIVE
          'completed': 3,  // COMPLETED
          'paused': 4,     // PAUSED
          'failed': 5,     // FAILED
          'cancelled': 6   // CANCELLED
        }
        if (statusMap[status] !== undefined) {
          filteredTasks = filteredTasks.filter((task: any) => task.state === statusMap[status])
        }
      }
      
      // 关键词过滤
      if (keyword) {
        const lowerKeyword = keyword.toLowerCase()
        filteredTasks = filteredTasks.filter((task: any) =>
          task.title.toLowerCase().includes(lowerKeyword) ||
          task.media_id.toLowerCase().includes(lowerKeyword)
        )
      }
      
      // 日期过滤
      if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime()
        filteredTasks = filteredTasks.filter((task: any) =>
          task.created_at >= fromDate
        )
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo).getTime()
        filteredTasks = filteredTasks.filter((task: any) =>
          task.created_at <= toDate
        )
      }
      
      // 排序
      if (order) {
        filteredTasks.sort((a: any, b: any) => {
          const isAsc = sortDirection === 'asc'
          let comparison = 0
          
          if (order === 'created_at' || order === 'completed_at') {
            const field = order === 'completed_at' ? 'updated_at' : order
            comparison = a[field] - b[field]
          } else if (order === 'title') {
            comparison = a.title.localeCompare(b.title)
          }
          
          return isAsc ? comparison : -comparison
        })
      }
      
      // 分页
      const total = filteredTasks.length
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedTasks = filteredTasks.slice(startIndex, endIndex)
      
      return {
        success: true,
        data: {
          downloads: paginatedTasks,
          total: total
        }
      }
    }
    
    return response
  }

  async clearDownloadHistory(): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 删除所有已完成、失败或取消的任务
    const response = await this.request<any>('/api/queue/tasks', { method: 'GET' })
    
    if (response.success && response.data) {
      const tasksToDelete = response.data.filter((task: any) =>
        task.state === 3 || // COMPLETED
        task.state === 5 || // FAILED
        task.state === 6    // CANCELLED
      )
      
      const taskIds = tasksToDelete.map((task: any) => task.id)
      
      if (taskIds.length > 0) {
        return this.request<any>('/api/queue/tasks/batch', {
          method: 'DELETE',
          body: JSON.stringify(taskIds),
        })
      }
      
      return { success: true, message: '没有需要清理的任务' }
    }
    
    return { success: false, message: '获取任务列表失败' }
  }

  async getHistoryStats(): Promise<ApiResponse<any>> {
    // 迁移到新的队列API - 在前端计算统计信息
    const response = await this.request<any>('/api/queue/tasks', { method: 'GET' })
    
    if (response.success && response.data) {
      const tasks = response.data
      
      // 状态映射
      const stateMap: Record<number, string> = {
        0: 'pending',
        1: 'pending',
        2: 'downloading',
        3: 'completed',
        4: 'paused',
        5: 'failed',
        6: 'cancelled'
      }
      
      // 统计信息
      const total = tasks.length
      const completed = tasks.filter((t: any) => t.state === 3).length
      const failed = tasks.filter((t: any) => t.state === 5).length
      const cancelled = tasks.filter((t: any) => t.state === 6).length
      const downloading = tasks.filter((t: any) => t.state === 2).length
      const pending = tasks.filter((t: any) => t.state === 0 || t.state === 1).length
      const paused = tasks.filter((t: any) => t.state === 4).length
      
      // 计算文件大小（从meta中获取）
      let totalSize = 0
      tasks.forEach((task: any) => {
        if (task.meta && task.meta.totalSize) {
          totalSize += task.meta.totalSize
        }
      })
      
      const averageSize = completed > 0 ? totalSize / completed : 0
      
      // 计算最近的时间统计
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      const oneWeek = 7 * oneDay
      const oneMonth = 30 * oneDay
      
      const completedTasks = tasks.filter((t: any) => t.state === 3)
      
      const completedToday = completedTasks.filter((task: any) =>
        task.updated_at >= now - oneDay
      ).length
      
      const completedThisWeek = completedTasks.filter((task: any) =>
        task.updated_at >= now - oneWeek
      ).length
      
      const completedThisMonth = completedTasks.filter((task: any) =>
        task.updated_at >= now - oneMonth
      ).length
      
      const successRate = total > 0 ? (completed / total) * 100 : 0
      
      return {
        success: true,
        data: {
          total,
          completed,
          failed,
          cancelled,
          total_size: totalSize,
          average_size: averageSize,
          completed_today: completedToday,
          completed_this_week: completedThisWeek,
          completed_this_month: completedThisMonth,
          success_rate: successRate,
          downloading,
          pending,
          paused
        }
      }
    }
    
    return { success: false, message: '获取任务列表失败' }
  }

  // ========== 下载设置相关API ==========
// 注意：这些API端点尚未在后端实现，暂时保留方法签名
// 实际下载设置通过settings API管理

  async getDownloadSettings(): Promise<ApiResponse<any>> {
    // TODO: 下载设置功能尚未实现，需要后端支持
    // 临时返回默认设置
    return {
      success: false,
      message: '下载设置功能尚未实现，请使用全局设置'
    }
  }

  async updateDownloadSettings(settings: any): Promise<ApiResponse<any>> {
    // TODO: 下载设置功能尚未实现，需要后端支持
    return {
      success: false,
      message: '下载设置功能尚未实现，请使用全局设置'
    }
  }

  async resetDownloadSettings(category?: string): Promise<ApiResponse<any>> {
    // TODO: 下载设置功能尚未实现，需要后端支持
    return {
      success: false,
      message: '下载设置功能尚未实现，请使用全局设置'
    }
  }

  async exportDownloadSettings(): Promise<ApiResponse<any>> {
    // TODO: 下载设置功能尚未实现，需要后端支持
    return {
      success: false,
      message: '下载设置功能尚未实现，请使用全局设置'
    }
  }

  async importDownloadSettings(data: any): Promise<ApiResponse<any>> {
    // TODO: 下载设置功能尚未实现，需要后端支持
    return {
      success: false,
      message: '下载设置功能尚未实现，请使用全局设置'
    }
  }

  async validateDownloadSettings(settings: any): Promise<ApiResponse<any>> {
    // TODO: 下载设置功能尚未实现，需要后端支持
    return {
      success: false,
      message: '下载设置功能尚未实现，请使用全局设置'
    }
  }
}

export const apiService = new ApiService();