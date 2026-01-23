'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { ImpersonationBanner } from '@/components/layout/impersonation-banner';
import { useAuth } from '@/hooks/use-auth';
import { CommandPalette } from '@/components/command-palette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoading, isAuthenticated, impersonation } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  // BUG-015 FIX: Show loading state instead of null to prevent hydration mismatch
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {impersonation?.isImpersonating && (
        <ImpersonationBanner
          tenantName={impersonation.tenantName || 'Unknown Tenant'}
          originalAdminEmail={impersonation.originalAdminEmail}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
