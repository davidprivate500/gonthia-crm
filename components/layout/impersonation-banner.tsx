'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';

interface ImpersonationBannerProps {
  tenantName: string;
  originalAdminEmail?: string;
}

export function ImpersonationBanner({ tenantName, originalAdminEmail }: ImpersonationBannerProps) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  const handleExit = async () => {
    setIsExiting(true);
    try {
      const response = await api.master.exitImpersonation();
      if (response.data?.success && response.data.redirectUrl) {
        // Force a full page reload to clear any cached state
        window.location.href = response.data.redirectUrl;
      }
    } catch (error) {
      console.error('Failed to exit impersonation:', error);
      setIsExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 shadow-md">
      <div className="px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="text-sm font-medium">
              <span className="font-semibold">Impersonation Mode:</span>{' '}
              You are viewing as <span className="font-bold">{tenantName}</span>
              {originalAdminEmail && (
                <span className="text-amber-800 ml-2">
                  (logged in as {originalAdminEmail})
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExit}
            disabled={isExiting}
            className="bg-amber-600 border-amber-700 text-white hover:bg-amber-700 hover:text-white"
          >
            {isExiting ? (
              <>
                <X className="h-4 w-4 mr-1 animate-spin" />
                Exiting...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-1" />
                Exit Impersonation
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
