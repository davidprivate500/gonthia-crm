'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/client';
import { Save, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

interface BillingInfo {
  legalName?: string;
  registrationId?: string;
  vatId?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  billingEmail?: string;
  billingPhone?: string;
}

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'issued' | 'paid' | 'void' | 'overdue';
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: string;
  createdAt: string;
  lineItems: LineItem[];
}

const statusColors: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-red-100 text-red-800',
  overdue: 'bg-orange-100 text-orange-800',
};

const defaultBillingInfo: BillingInfo = {};

export default function BillingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const [billingInfo, setBillingInfo] = useState<BillingInfo>(defaultBillingInfo);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [billingResponse, invoicesResponse] = await Promise.all([
          api.billing.info.get(),
          api.billing.invoices.list({ page, pageSize }),
        ]);

        if (billingResponse.data) {
          setBillingInfo(billingResponse.data as BillingInfo);
        }
        if (invoicesResponse.data) {
          setInvoices(invoicesResponse.data as Invoice[]);
          setTotal(invoicesResponse.meta?.total || 0);
        }
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page]);

  const handleSaveBillingInfo = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.billing.info.update(billingInfo as Record<string, unknown>);
      setSaveMessage('Billing information saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save billing info:', error);
      setSaveMessage('Failed to save billing information');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof BillingInfo, value: string) => {
    setBillingInfo((prev) => ({ ...prev, [field]: value }));
  };

  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <>
        <Header title="Billing" description="Manage billing information and view invoices" />
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Billing" description="Manage billing information and view invoices" />

      <div className="p-6">
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="settings">
                Billing Details
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>
                  View all invoices issued to your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No invoices yet</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Issue Date</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow
                            key={invoice.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => router.push(`/settings/billing/invoices/${invoice.id}`)}
                          >
                            <TableCell className="font-mono font-medium">
                              {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[invoice.status]}>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {invoice.issueDate
                                ? format(new Date(invoice.issueDate), 'MMM d, yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {invoice.dueDate
                                ? format(new Date(invoice.dueDate), 'MMM d, yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {invoice.currency} {parseFloat(invoice.totalAmount).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-gray-600">
                          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page + 1)}
                            disabled={page >= totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Billing Information</CardTitle>
                  <CardDescription>
                    Update your organization's billing details. This information will appear on invoices.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="legalName">Legal Name</Label>
                      <Input
                        id="legalName"
                        value={billingInfo.legalName || ''}
                        onChange={(e) => updateField('legalName', e.target.value)}
                        placeholder="Legal Business Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vatId">VAT ID</Label>
                      <Input
                        id="vatId"
                        value={billingInfo.vatId || ''}
                        onChange={(e) => updateField('vatId', e.target.value)}
                        placeholder="VAT Registration Number"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registrationId">Registration ID</Label>
                      <Input
                        id="registrationId"
                        value={billingInfo.registrationId || ''}
                        onChange={(e) => updateField('registrationId', e.target.value)}
                        placeholder="Company Registration Number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingEmail">Billing Email</Label>
                      <Input
                        id="billingEmail"
                        type="email"
                        value={billingInfo.billingEmail || ''}
                        onChange={(e) => updateField('billingEmail', e.target.value)}
                        placeholder="billing@company.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billingAddress">Address</Label>
                    <Input
                      id="billingAddress"
                      value={billingInfo.billingAddress || ''}
                      onChange={(e) => updateField('billingAddress', e.target.value)}
                      placeholder="Street Address"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="billingCity">City</Label>
                      <Input
                        id="billingCity"
                        value={billingInfo.billingCity || ''}
                        onChange={(e) => updateField('billingCity', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingState">State/Province</Label>
                      <Input
                        id="billingState"
                        value={billingInfo.billingState || ''}
                        onChange={(e) => updateField('billingState', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingPostalCode">Postal Code</Label>
                      <Input
                        id="billingPostalCode"
                        value={billingInfo.billingPostalCode || ''}
                        onChange={(e) => updateField('billingPostalCode', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingCountry">Country</Label>
                      <Input
                        id="billingCountry"
                        value={billingInfo.billingCountry || ''}
                        onChange={(e) => updateField('billingCountry', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billingPhone">Phone</Label>
                    <Input
                      id="billingPhone"
                      value={billingInfo.billingPhone || ''}
                      onChange={(e) => updateField('billingPhone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    {saveMessage && (
                      <span className={`text-sm self-center ${saveMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                        {saveMessage}
                      </span>
                    )}
                    <Button onClick={handleSaveBillingInfo} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
