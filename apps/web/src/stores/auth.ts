import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiUrl } from '../config/api';

export interface User {
  mid: number;
  username: string;
  avatar?: string;
  level?: number;
  vip_status?: boolean;
  sessdata?: string;
  refresh_token?: string; // Week 2: Cookie刷新机制
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user) => {
        const newState = {
          user,
          isAuthenticated: user !== null,
        }
        set(newState)
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
        })
      },

      fetchUser: async () => {
        try {
          const response = await fetch(getApiUrl('/api/auth/status'))
          if (!response.ok) {
            throw new Error('Failed to fetch user status')
          }
          const data = await response.json()

          if (data.success && data.data?.is_logged_in && data.data?.user) {
            const userData = data.data.user
            set({
              user: {
                mid: userData.mid,
                username: userData.username,
                avatar: userData.avatar,
                sessdata: undefined, // 不暴露敏感信息
              },
              isAuthenticated: true,
            })
          } else {
            // 服务器返回未登录，但不清除本地状态
            // 这可能是服务器还没初始化完成，暂时保留本地状态
            console.log('[Auth] Server reports not logged in, keeping local state')
          }
        } catch (error) {
          console.error('Failed to fetch user:', error)
          // 网络错误不清除本地状态
        }
      },
    }),
    {
      name: 'pilinote-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);