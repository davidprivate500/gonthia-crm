'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building2,
  Calendar,
  Activity,
  Kanban,
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

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  company: { id: string; name: string } | null;
  owner: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  activities: Array<{
    id: string;
    type: string;
    subject: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  deals: Array<{
    id: string;
    title: string;
    value: string | null;
    stage: { id: string; name: string; color: string | null };
  }>;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-800',
  prospect: 'bg-yellow-100 text-yellow-800',
  customer: 'bg-green-100 text-green-800',
  churned: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.contactId as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const response = await api.contacts.get(contactId);
        const data = response.data as { contact?: Contact } | undefined;
        if (data?.contact) {
          setContact(data.contact);
        }
      } catch (error) {
        console.error('Failed to fetch contact:', error);
        router.push('/contacts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContact();
  }, [contactId, router]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.contacts.delete(contactId);
      router.push('/contacts');
    } catch (error) {
      console.error('Failed to delete contact:', error);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <>
      <Header
        title={`${contact.firstName} ${contact.lastName}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/contacts/${contactId}/edit`}>
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
                  <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {contact.firstName} {contact.lastName} and
                    all associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="p-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/contacts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to contacts
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-medium">
                    {(contact.firstName?.[0] || '').toUpperCase()}
                    {(contact.lastName?.[0] || '').toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {contact.firstName} {contact.lastName}
                    </h2>
                    <Badge className={statusColors[contact.status]}>
                      {contact.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {contact.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <Link href={`/companies/${contact.company.id}`} className="text-primary hover:underline">
                        {contact.company.name}
                      </Link>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Added {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {contact.tags && contact.tags.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Tags</p>
                    <div className="flex gap-2 flex-wrap">
                      {contact.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deals */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Kanban className="h-5 w-5" />
                  Deals
                </CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/pipeline?new=deal&contactId=${contactId}`}>
                    Add Deal
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {contact.deals && contact.deals.length > 0 ? (
                  <div className="space-y-3">
                    {contact.deals.map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/pipeline?deal=${deal.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: deal.stage.color || '#6366f1' }}
                          />
                          <div>
                            <p className="font-medium">{deal.title}</p>
                            <p className="text-sm text-gray-500">{deal.stage.name}</p>
                          </div>
                        </div>
                        {deal.value && (
                          <p className="font-medium">
                            ${parseFloat(deal.value).toLocaleString()}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No deals yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity Timeline */}
          <div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/activities/new?contactId=${contactId}`}>
                    Log Activity
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {contact.activities && contact.activities.length > 0 ? (
                  <div className="space-y-4">
                    {contact.activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-gray-300 mt-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.subject}</p>
                          <p className="text-xs text-gray-500">
                            {activity.type} • {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No activities yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
