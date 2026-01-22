import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'readonly';
  firstName: string | null;
  lastName: string | null;
  isMasterAdmin?: boolean;
}

export interface Organization {
  id: string;
  name: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isMasterAdmin: boolean;
  setAuth: (user: User, organization: Organization | null) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,  // Start as true to prevent premature redirects
  isAuthenticated: false,
  isMasterAdmin: false,
  setAuth: (user, organization) =>
    set({
      user,
      organization,
      isAuthenticated: true,
      isLoading: false,
      isMasterAdmin: user.isMasterAdmin === true,
    }),
  clearAuth: () =>
    set({
      user: null,
      organization: null,
      isAuthenticated: false,
      isLoading: false,
      isMasterAdmin: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
