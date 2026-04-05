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
  private async request<T>(
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
    order: string = 'mtime'
  ): Promise<ApiResponse<any>> {
    return this.request<any>(
      `/api/favorites/folders/${folderId}?page=${page}&page_size=${pageSize}&keyword=${keyword}&order=${order}`,
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
    ps: number = 20
  ): Promise<ApiResponse<any>> {
    return this.request<any>(
      `/api/watchlater/list?pn=${pn}&ps=${ps}`,
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
}

export const apiService = new ApiService();