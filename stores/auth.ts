import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'readonly';
  firstName: string | null;
  lastName: string | null;
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
  setAuth: (user: User, organization: Organization) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,
  isAuthenticated: false,
  setAuth: (user, organization) =>
    set({ user, organization, isAuthenticated: true, isLoading: false }),
  clearAuth: () =>
    set({ user: null, organization: null, isAuthenticated: false, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
