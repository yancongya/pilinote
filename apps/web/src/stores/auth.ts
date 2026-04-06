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
  setIsLoading: (loading: boolean) => void;
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

      setIsLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      fetchUser: async () => {
        const currentUser = get().user

        set({ isLoading: true })

        try {
          const response = await fetch(getApiUrl('/api/auth/status'))
          if (!response.ok) {
            throw new Error('Failed to fetch user status')
          }
          const data = await response.json()

          if (data.success && data.data?.is_logged_in && data.data?.user) {
            const userData = data.data.user
            const currentUser = get().user
            
            // 保留原有的字段，只更新基本信息字段
            const newUser = {
              ...currentUser,
              mid: userData.mid,
              username: userData.username,
              avatar: userData.avatar,
            }
            set({
              user: newUser,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            // 服务器返回未登录，清除状态
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            })
          }
        } catch (error) {
          console.error('[Auth] fetchUser失败:', error)
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
        // 不包含isLoading，确保每次刷新都从false开始
      }),
      onRehydrateStorage: () => (state) => {
        // 不在这里修改state，让App组件在useEffect中处理
      },
    }
  )
);