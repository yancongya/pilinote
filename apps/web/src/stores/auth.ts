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
            console.log('[Auth] 已登录:', userData.username)
          } else {
            // 服务器返回未登录，检查本地状态
            const currentUser = get().user
            if (!currentUser) {
              // 本地也没有用户信息，清除状态
              console.log('[Auth] 服务器返回未登录，本地无用户信息，清除本地状态')
              set({
                user: null,
                isAuthenticated: false,
              })
            } else {
              // 本地有用户信息但服务器返回未登录，可能是session过期，清除状态
              console.log('[Auth] 服务器返回未登录，清除本地状态（session可能已过期）')
              set({
                user: null,
                isAuthenticated: false,
              })
            }
          }
        } catch (error) {
          console.error('Failed to fetch user:', error)
          // 网络错误不清除本地状态，保持当前状态
        }
      },
    }),
    {
      name: 'pilinote-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // 在从localStorage恢复状态后，立即调用fetchUser来更新状态
        console.log('[Auth] 状态已从localStorage恢复，正在从服务器验证...')
        if (state) {
          // 使用异步方式调用fetchUser，避免阻塞
          state.fetchUser().catch(err => {
            console.error('[Auth] fetchUser失败:', err)
          })
        }
      },
    }
  )
);