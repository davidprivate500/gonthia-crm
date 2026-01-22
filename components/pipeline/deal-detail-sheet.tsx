'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import {
  DollarSign,
  User,
  Building2,
  Calendar,
  Edit,
  Trash2,
  Activity,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Deal {
  id: string;
  title: string;
  value: string | null;
  currency: string;
  probability: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  stage: { id: string; name: string; color: string | null };
  contact: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null;
  company: { id: string; name: string; domain: string | null } | null;
  owner: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  activities: Array<{
    id: string;
    type: string;
    subject: string;
    createdAt: string;
  }>;
  createdAt: string;
}

interface DealDetailSheetProps {
  dealId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function DealDetailSheet({ dealId, onClose, onUpdate }: DealDetailSheetProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (dealId) {
      const fetchDeal = async () => {
        setIsLoading(true);
        try {
          const response = await api.deals.get(dealId);
          const data = response.data as { deal?: Deal } | undefined;
          if (data?.deal) {
            setDeal(data.deal);
          }
        } catch (error) {
          console.error('Failed to fetch deal:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchDeal();
    } else {
      setDeal(null);
    }
  }, [dealId]);

  const handleDelete = async () => {
    if (!dealId) return;
    setIsDeleting(true);
    try {
      await api.deals.delete(dealId);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to delete deal:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={!!dealId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
          </div>
        ) : deal ? (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl">{deal.title}</SheetTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: deal.stage.color || '#6366f1' }}
                    />
                    <span className="text-sm text-gray-500">{deal.stage.name}</span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Value */}
              {deal.value && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Value</p>
                    <p className="text-lg font-semibold">
                      ${parseFloat(deal.value).toLocaleString()} {deal.currency}
                    </p>
                  </div>
                </div>
              )}

              {/* Expected Close */}
              {deal.expectedCloseDate && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Expected Close</p>
                    <p className="font-medium">
                      {new Date(deal.expectedCloseDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Contact */}
              {deal.contact && (
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">Contact</span>
                  </div>
                  <Link
                    href={`/contacts/${deal.contact.id}`}
                    className="text-primary hover:underline font-medium"
                    onClick={onClose}
                  >
                    {deal.contact.firstName} {deal.contact.lastName}
                  </Link>
                  {deal.contact.email && (
                    <p className="text-sm text-gray-500">{deal.contact.email}</p>
                  )}
                </div>
              )}

              {/* Company */}
              {deal.company && (
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">Company</span>
                  </div>
                  <Link
                    href={`/companies/${deal.company.id}`}
                    className="text-primary hover:underline font-medium"
                    onClick={onClose}
                  >
                    {deal.company.name}
                  </Link>
                  {deal.company.domain && (
                    <p className="text-sm text-gray-500">{deal.company.domain}</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {deal.notes && (
                <div>
                  <p className="text-sm font-medium mb-2">Notes</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{deal.notes}</p>
                </div>
              )}

              {/* Activities */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">Recent Activity</span>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/activities/new?dealId=${deal.id}`} onClick={onClose}>
                      Log Activity
                    </Link>
                  </Button>
                </div>
                {deal.activities && deal.activities.length > 0 ? (
                  <div className="space-y-3">
                    {deal.activities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex gap-3 text-sm">
                        <div className="h-2 w-2 rounded-full bg-gray-300 mt-1.5" />
                        <div>
                          <p className="font-medium">{activity.subject}</p>
                          <p className="text-xs text-gray-500">
                            {activity.type} • {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No activities yet</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/pipeline/${deal.id}/edit`} onClick={onClose}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete deal?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete &quot;{deal.title}&quot;. This action cannot
                        be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
