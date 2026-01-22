'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MasterSidebar } from '@/components/layout/master-sidebar';
import { useAuth } from '@/hooks/use-auth';

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoading, isAuthenticated, isMasterAdmin } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!isMasterAdmin) {
        // Redirect non-master-admins to the regular dashboard
        router.push('/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, isMasterAdmin, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (!isAuthenticated || !isMasterAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <MasterSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
