const API_BASE_URL = 'http://localhost:8000';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  code?: number;
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

  async getUserInfo(sessdata: string): Promise<ApiResponse<UserInfo>> {
    return this.request<UserInfo>(
      `/api/auth/user-info?sessdata=${encodeURIComponent(sessdata)}`,
      { method: 'GET' }
    );
  }
}

export const apiService = new ApiService();