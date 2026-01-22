'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Globe,
  Phone,
  MapPin,
  Users,
  Kanban,
  Building2,
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

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  notes: string | null;
  owner: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    status: string;
  }>;
  deals: Array<{
    id: string;
    title: string;
    value: string | null;
    stage: { id: string; name: string; color: string | null };
  }>;
  createdAt: string;
}

export default function CompanyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await api.companies.get(companyId);
        const data = response.data as { company?: Company } | undefined;
        if (data?.company) {
          setCompany(data.company);
        }
      } catch (error) {
        console.error('Failed to fetch company:', error);
        router.push('/companies');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompany();
  }, [companyId, router]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.companies.delete(companyId);
      router.push('/companies');
    } catch (error) {
      console.error('Failed to delete company:', error);
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

  if (!company) {
    return null;
  }

  const fullAddress = [company.address, company.city, company.state, company.postalCode, company.country]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Header
        title={company.name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/companies/${companyId}/edit`}>
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
                  <AlertDialogTitle>Delete company?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {company.name}. Contacts and deals
                    associated with this company will remain but lose their company
                    association.
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
          <Link href="/companies">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to companies
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-gray-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{company.name}</h2>
                    {company.industry && (
                      <p className="text-gray-600">{company.industry}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {company.domain && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <a
                        href={`https://${company.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {company.domain}
                      </a>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <a href={`tel:${company.phone}`} className="text-primary hover:underline">
                        {company.phone}
                      </a>
                    </div>
                  )}
                  {fullAddress && (
                    <div className="flex items-start gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-600">{fullAddress}</span>
                    </div>
                  )}
                  {company.size && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{company.size} employees</span>
                    </div>
                  )}
                </div>

                {company.notes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Notes</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{company.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contacts ({company.contacts?.length || 0})
                </CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/contacts/new?companyId=${companyId}`}>
                    Add Contact
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {company.contacts && company.contacts.length > 0 ? (
                  <div className="space-y-3">
                    {company.contacts.map((contact) => (
                      <Link
                        key={contact.id}
                        href={`/contacts/${contact.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                            {contact.firstName[0]}
                            {contact.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.email && (
                              <p className="text-sm text-gray-500">{contact.email}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">
                          {contact.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No contacts yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Deals */}
          <div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Kanban className="h-5 w-5" />
                  Deals
                </CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/pipeline?new=deal&companyId=${companyId}`}>
                    Add Deal
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {company.deals && company.deals.length > 0 ? (
                  <div className="space-y-3">
                    {company.deals.map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/pipeline?deal=${deal.id}`}
                        className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: deal.stage.color || '#6366f1' }}
                          />
                          <p className="font-medium">{deal.title}</p>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{deal.stage.name}</span>
                          {deal.value && (
                            <span className="font-medium">
                              ${parseFloat(deal.value).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No deals yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
