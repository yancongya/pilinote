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
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

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
        // 如果已经在加载中，直接返回
        if (get().isLoading) {
          console.log('[Auth] 正在加载中，跳过重复请求')
          return
        }

        set({ isLoading: true })

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
              isLoading: false,
            })
            console.log('[Auth] 已登录:', userData.username)
          } else {
            // 服务器返回未登录，清除状态
            console.log('[Auth] 服务器返回未登录，清除本地状态')
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            })
          }
        } catch (error) {
          console.error('Failed to fetch user:', error)
          // 网络错误清除loading状态，但不清除用户状态
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'pilinote-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isLoading: false, // 不持久化isLoading状态
      }),
      onRehydrateStorage: () => (state) => {
        // 在从localStorage恢复状态后，等待fetchUser完成
        console.log('[Auth] 状态已从localStorage恢复')
        // 不在这里调用fetchUser，让App组件来处理
        // 这样可以避免竞态条件
      },
    }
  )
);