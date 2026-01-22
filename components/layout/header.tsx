'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <QuickActions />
          </div>
        </div>
      </div>
    </header>
  );
}

function QuickActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/contacts/new">New Contact</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/companies/new">New Company</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pipeline?new=deal">New Deal</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/activities/new">New Activity</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
