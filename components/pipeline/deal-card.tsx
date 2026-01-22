'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, User, Building2 } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  value: string | null;
  currency: string;
  contact: { id: string; firstName: string; lastName: string } | null;
  company: { id: string; name: string } | null;
  owner: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface DealCardProps {
  deal: Deal;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
}

export function DealCard({ deal, onDragStart, onClick }: DealCardProps) {
  return (
    <Card
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <h4 className="font-medium text-sm mb-2 line-clamp-2">{deal.title}</h4>

        {deal.value && (
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
            <DollarSign className="h-3 w-3" />
            {parseFloat(deal.value).toLocaleString()} {deal.currency}
          </div>
        )}

        <div className="flex flex-col gap-1 text-xs text-gray-500">
          {deal.contact && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {deal.contact.firstName} {deal.contact.lastName}
            </div>
          )}
          {deal.company && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {deal.company.name}
            </div>
          )}
        </div>

        {deal.owner && (
          <div className="mt-2 pt-2 border-t flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
              {deal.owner.firstName?.[0] || '?'}
            </div>
            <span className="text-xs text-gray-500">
              {deal.owner.firstName} {deal.owner.lastName}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
