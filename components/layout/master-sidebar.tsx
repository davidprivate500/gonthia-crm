'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Building2,
  FileText,
  Settings,
  LogOut,
  Shield,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Tenants', href: '/master/tenants', icon: Building2 },
  { name: 'Demo Generator', href: '/master/demo-generator', icon: Wand2 },
  { name: 'Issuer Settings', href: '/master/settings', icon: Settings },
];

export function MasterSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full w-64 bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-800">
        <Link href="/master/tenants" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-amber-400" />
          <span className="text-xl font-bold">Master Admin</span>
        </Link>
      </div>

      {/* Context indicator */}
      <div className="px-4 py-3 border-b border-gray-800 bg-amber-900/30">
        <p className="text-xs text-amber-400 font-semibold">PLATFORM ADMIN</p>
        <p className="text-sm text-gray-300">Cross-tenant access</p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                isActive
                  ? 'bg-amber-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-amber-700 flex items-center justify-center text-sm font-medium">
            {(user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email}
            </p>
            <p className="text-xs text-amber-400">Master Admin</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
