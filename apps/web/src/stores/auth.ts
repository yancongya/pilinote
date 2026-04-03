import { create } from 'zustand';

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
        const response = await fetch('http://localhost:8000/api/auth/status')
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
          set({
            user: null,
            isAuthenticated: false,
          })
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
        set({
          user: null,
          isAuthenticated: false,
        })
      }
    },
  })
);