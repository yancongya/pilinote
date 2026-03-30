import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'pilinote-auth',
    }
  )
);