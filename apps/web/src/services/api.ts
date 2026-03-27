const API_BASE_URL = 'http://localhost:8000';

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
  async getFolders(sessdata: string, upMid: number, page: number = 1, pageSize: number = 20): Promise<ApiResponse<any>> {
    return this.request<any>(
      `/api/favorites/folders?sessdata=${encodeURIComponent(sessdata)}&up_mid=${upMid}&page=${page}&page_size=${pageSize}`,
      { method: 'GET' }
    );
  }

  async getFolderDetail(
    folderId: number,
    sessdata: string,
    page: number = 1,
    pageSize: number = 20,
    keyword: string = '',
    order: string = 'mtime'
  ): Promise<ApiResponse<any>> {
    return this.request<any>(
      `/api/favorites/folders/${folderId}?sessdata=${encodeURIComponent(sessdata)}&page=${page}&page_size=${pageSize}&keyword=${keyword}&order=${order}`,
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
}

export const apiService = new ApiService();