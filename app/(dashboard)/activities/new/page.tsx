'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api/client';
import { ArrowLeft } from 'lucide-react';

function NewActivityForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get('contactId') || '';
  const companyId = searchParams.get('companyId') || '';
  const dealId = searchParams.get('dealId') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [deals, setDeals] = useState<Array<{ id: string; title: string }>>([]);

  const [formData, setFormData] = useState({
    type: 'note',
    subject: '',
    description: '',
    contactId,
    companyId,
    dealId,
    scheduledAt: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contactsRes, companiesRes, dealsRes] = await Promise.all([
          api.contacts.list({ pageSize: 100 }),
          api.companies.list({ pageSize: 100 }),
          api.deals.list({ pageSize: 100 }),
        ]);
        if (contactsRes.data) setContacts(contactsRes.data as Array<{ id: string; firstName: string; lastName: string }>);
        if (companiesRes.data) setCompanies(companiesRes.data as Array<{ id: string; name: string }>);
        if (dealsRes.data) setDeals(dealsRes.data as Array<{ id: string; title: string }>);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.activities.create({
        type: formData.type,
        subject: formData.subject,
        description: formData.description || null,
        contactId: formData.contactId || null,
        companyId: formData.companyId || null,
        dealId: formData.dealId || null,
        scheduledAt: formData.scheduledAt || null,
      });

      router.push('/activities');
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setError(error.error?.message || 'Failed to create activity');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header title="Log Activity" />

      <div className="p-6 max-w-2xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/activities">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to activities
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Activity Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Scheduled Date</Label>
                  <Input
                    id="scheduledAt"
                    name="scheduledAt"
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Follow-up call with client"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Add notes about the activity..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactId">Contact</Label>
                <Select
                  value={formData.contactId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, contactId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contact</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyId">Company</Label>
                <Select
                  value={formData.companyId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, companyId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No company</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dealId">Deal</Label>
                <Select
                  value={formData.dealId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, dealId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select deal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No deal</SelectItem>
                    {deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Log Activity'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function NewActivityPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewActivityForm />
    </Suspense>
  );
}
