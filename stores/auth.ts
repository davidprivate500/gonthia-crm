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

export interface ImpersonationInfo {
  isImpersonating: boolean;
  tenantName?: string;
  originalAdminEmail?: string;
  startedAt?: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isMasterAdmin: boolean;
  impersonation: ImpersonationInfo | null;
  setAuth: (user: User, organization: Organization | null, impersonation?: ImpersonationInfo | null) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,  // Start as true to prevent premature redirects
  isAuthenticated: false,
  isMasterAdmin: false,
  impersonation: null,
  setAuth: (user, organization, impersonation = null) =>
    set({
      user,
      organization,
      isAuthenticated: true,
      isLoading: false,
      isMasterAdmin: user.isMasterAdmin === true,
      impersonation,
    }),
  clearAuth: () =>
    set({
      user: null,
      organization: null,
      isAuthenticated: false,
      isLoading: false,
      isMasterAdmin: false,
      impersonation: null,
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
