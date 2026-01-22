'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MasterHeader } from '@/components/layout/master-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/client';
import {
  ArrowLeft,
  Plus,
  Users,
  Building2,
  Briefcase,
  FileText,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface TenantStats {
  users: number;
  contacts: number;
  deals: number;
  invoices: number;
}

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

interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  stats: TenantStats;
  billingInfo?: BillingInfo;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'draft' | 'issued' | 'paid' | 'void';
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: string;
  createdAt: string;
  lineItems: LineItem[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-red-100 text-red-800',
};

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  // Invoice form state
  const [lineItems, setLineItems] = useState<Array<{ description: string; quantity: string; unitPrice: string }>>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);
  const [taxRate, setTaxRate] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [issueImmediately, setIssueImmediately] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [tenantResponse, invoicesResponse] = await Promise.all([
          api.master.tenants.get(tenantId),
          api.master.invoices.listForTenant(tenantId),
        ]);

        if (tenantResponse.data) {
          setTenant(tenantResponse.data as Tenant);
        }
        if (invoicesResponse.data) {
          setInvoices(invoicesResponse.data as Invoice[]);
        }
      } catch (error) {
        console.error('Failed to fetch tenant data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tenantId]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: '1', unitPrice: '' }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const calculateTotal = () => {
    let subtotal = 0;
    for (const item of lineItems) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      subtotal += qty * price;
    }
    const tax = subtotal * ((parseFloat(taxRate) || 0) / 100);
    return subtotal + tax;
  };

  const handleCreateInvoice = async () => {
    setIsCreatingInvoice(true);
    try {
      const data = {
        lineItems: lineItems.map((item) => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
        })),
        taxRate: parseFloat(taxRate) || undefined,
        notes: notes || undefined,
        internalNotes: internalNotes || undefined,
        issueImmediately,
      };

      await api.master.invoices.create(tenantId, data);

      // Refresh invoices
      const invoicesResponse = await api.master.invoices.listForTenant(tenantId);
      if (invoicesResponse.data) {
        setInvoices(invoicesResponse.data as Invoice[]);
      }

      // Reset form
      setLineItems([{ description: '', quantity: '1', unitPrice: '' }]);
      setTaxRate('');
      setNotes('');
      setInternalNotes('');
      setIssueImmediately(false);
      setIsInvoiceDialogOpen(false);
    } catch (error) {
      console.error('Failed to create invoice:', error);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Tenant not found</p>
      </div>
    );
  }

  return (
    <>
      <MasterHeader
        title={tenant.name}
        description={`Created ${formatDistanceToNow(new Date(tenant.createdAt), { addSuffix: true })}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/master/tenants">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tenants
            </Link>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                <span className="text-2xl font-semibold">{tenant.stats.users}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Contacts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                <span className="text-2xl font-semibold">{tenant.stats.contacts.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Deals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-gray-400" />
                <span className="text-2xl font-semibold">{tenant.stats.deals}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="text-2xl font-semibold">{tenant.stats.invoices}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Info */}
        {tenant.billingInfo && (
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {tenant.billingInfo.legalName && (
                  <div>
                    <span className="text-gray-500">Legal Name:</span>{' '}
                    {tenant.billingInfo.legalName}
                  </div>
                )}
                {tenant.billingInfo.vatId && (
                  <div>
                    <span className="text-gray-500">VAT ID:</span>{' '}
                    {tenant.billingInfo.vatId}
                  </div>
                )}
                {tenant.billingInfo.billingEmail && (
                  <div>
                    <span className="text-gray-500">Email:</span>{' '}
                    {tenant.billingInfo.billingEmail}
                  </div>
                )}
                {tenant.billingInfo.billingAddress && (
                  <div>
                    <span className="text-gray-500">Address:</span>{' '}
                    {[
                      tenant.billingInfo.billingAddress,
                      tenant.billingInfo.billingCity,
                      tenant.billingInfo.billingState,
                      tenant.billingInfo.billingPostalCode,
                      tenant.billingInfo.billingCountry,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Billing history for this tenant</CardDescription>
            </div>
            <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Invoice for {tenant.name}</DialogTitle>
                  <DialogDescription>
                    Add line items and configure the invoice details.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Line Items */}
                  <div className="space-y-3">
                    <Label>Line Items</Label>
                    {lineItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          />
                        </div>
                        <div className="w-20">
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Unit Price"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addLineItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Line Item
                    </Button>
                  </div>

                  {/* Tax Rate */}
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">Tax Rate (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-32"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (visible to client)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Payment terms, additional information..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Internal Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="internalNotes">Internal Notes (not visible to client)</Label>
                    <Textarea
                      id="internalNotes"
                      placeholder="Internal notes..."
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                    />
                  </div>

                  {/* Issue Immediately */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="issueImmediately"
                      checked={issueImmediately}
                      onChange={(e) => setIssueImmediately(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="issueImmediately">Issue immediately (skip draft)</Label>
                  </div>

                  {/* Total Preview */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-right">
                      <span className="text-gray-500">Total:</span>{' '}
                      <span className="text-xl font-semibold">
                        ${calculateTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateInvoice} disabled={isCreatingInvoice}>
                    {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No invoices yet</p>
            ) : (
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
                      onClick={() => router.push(`/master/invoices/${invoice.id}`)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
