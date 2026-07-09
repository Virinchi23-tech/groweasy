import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Safe SSR/Client storage initialization
  const isClient = typeof window !== 'undefined';
  
  let initialAccess = null;
  let initialRefresh = null;
  let initialUser = null;

  if (isClient) {
    initialAccess = localStorage.getItem('access_token');
    initialRefresh = localStorage.getItem('refresh_token');
    try {
      initialUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      initialUser = null;
    }
  }

  return {
    accessToken: initialAccess,
    refreshToken: initialRefresh,
    user: initialUser,
    setAuth: (accessToken, refreshToken, user) => {
      if (isClient) {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
      }
      set({ accessToken, refreshToken, user });
    },
    clearAuth: () => {
      if (isClient) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
      set({ accessToken: null, refreshToken: null, user: null });
    },
  };
});
