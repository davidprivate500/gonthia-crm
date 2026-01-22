'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, User, Organization } from '@/stores/auth';
import { api } from '@/lib/api/client';

interface AuthResponse {
  user: User;
  organization: Organization;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
    details?: Record<string, string[]>;
  };
}

export function useAuth({ requireAuth = true } = {}) {
  const router = useRouter();
  const { user, organization, isLoading, isAuthenticated, setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.auth.me();
        const data = response.data as AuthResponse | undefined;
        if (data) {
          setAuth(data.user, data.organization);
        }
      } catch {
        clearAuth();
        if (requireAuth) {
          router.push('/login');
        }
      }
    };

    checkAuth();
  }, [requireAuth, router, setAuth, clearAuth]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.auth.login({ email, password });
      const data = response.data as AuthResponse | undefined;
      if (data) {
        setAuth(data.user, data.organization);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      return { success: false, error: apiError.error?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    organizationName: string;
    firstName?: string;
    lastName?: string;
  }) => {
    setLoading(true);
    try {
      const response = await api.auth.register(data);
      const responseData = response.data as AuthResponse | undefined;
      if (responseData) {
        setAuth(responseData.user, responseData.organization);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      return {
        success: false,
        error: apiError.error?.message || 'Registration failed',
        details: apiError.error?.details,
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  return {
    user,
    organization,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
  };
}
