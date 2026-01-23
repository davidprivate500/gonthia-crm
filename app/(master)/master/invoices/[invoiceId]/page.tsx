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
import { api } from '@/lib/api/client';
import { ArrowLeft, Send, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  sortOrder: number;
}

interface Tenant {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  status: 'draft' | 'issued' | 'paid' | 'void';
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  total: string;
  notes: string | null;
  internalNotes: string | null;
  issuerSnapshot: Record<string, unknown> | null;
  clientSnapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  voidedAt: string | null;
  lineItems: LineItem[];
  tenant: Tenant;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-red-100 text-red-800',
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      setIsLoading(true);
      try {
        const response = await api.master.invoices.get(invoiceId);
        if (response.data) {
          setInvoice(response.data as Invoice);
        }
      } catch (error) {
        console.error('Failed to fetch invoice:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  const handleStatusChange = async (newStatus: 'issued' | 'paid' | 'void') => {
    if (!invoice) return;

    setIsUpdating(true);
    try {
      await api.master.invoices.update(invoiceId, { status: newStatus });
      const response = await api.master.invoices.get(invoiceId);
      if (response.data) {
        setInvoice(response.data as Invoice);
      }
    } catch (error) {
      console.error('Failed to update invoice status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;

    setIsUpdating(true);
    try {
      await api.master.invoices.delete(invoiceId);
      router.push(`/master/tenants/${invoice.tenantId}`);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invoice not found</p>
      </div>
    );
  }

  return (
    <>
      <MasterHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`For ${invoice.tenant.name}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/master/tenants/${invoice.tenantId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tenant
              </Link>
            </Button>

            {/* Status Actions */}
            {invoice.status === 'draft' && (
              <>
                <Button
                  onClick={() => handleStatusChange('issued')}
                  disabled={isUpdating}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Issue Invoice
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isUpdating}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this draft invoice? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {invoice.status === 'issued' && (
              <>
                <Button
                  onClick={() => handleStatusChange('paid')}
                  disabled={isUpdating}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Paid
                </Button>
                <Button
                  onClick={() => handleStatusChange('void')}
                  disabled={isUpdating}
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Void Invoice
                </Button>
              </>
            )}

            {invoice.status === 'paid' && (
              <Button
                onClick={() => handleStatusChange('void')}
                disabled={isUpdating}
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Void (Refund)
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Invoice Status and Summary */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className={`${statusColors[invoice.status]} text-base px-3 py-1`}>
                {invoice.status.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Issue Date</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-lg font-medium">
                {invoice.issueDate
                  ? format(new Date(invoice.issueDate), 'MMM d, yyyy')
                  : 'Not issued'}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Due Date</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-lg font-medium">
                {invoice.dueDate
                  ? format(new Date(invoice.dueDate), 'MMM d, yyyy')
                  : '-'}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Amount</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {invoice.currency} {parseFloat(invoice.total).toFixed(2)}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {invoice.currency} {parseFloat(item.unitPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {invoice.currency} {parseFloat(item.lineTotal).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-end gap-8">
                <span className="text-gray-600">Subtotal:</span>
                <span className="w-32 text-right">
                  {invoice.currency} {parseFloat(invoice.subtotal).toFixed(2)}
                </span>
              </div>
              {invoice.taxRate && parseFloat(invoice.taxRate) > 0 && (
                <div className="flex justify-end gap-8">
                  <span className="text-gray-600">Tax ({invoice.taxRate}%):</span>
                  <span className="w-32 text-right">
                    {invoice.currency} {parseFloat(invoice.taxAmount || '0').toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-8 text-lg font-bold">
                <span>Total:</span>
                <span className="w-32 text-right">
                  {invoice.currency} {parseFloat(invoice.total).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <div className="grid grid-cols-2 gap-4">
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
                <CardDescription>Visible to client</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
          {invoice.internalNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
                <CardDescription>Not visible to client</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-gray-600">{invoice.internalNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Snapshots */}
        <div className="grid grid-cols-2 gap-4">
          {invoice.issuerSnapshot && (
            <Card>
              <CardHeader>
                <CardTitle>Issuer Details (Snapshot)</CardTitle>
                <CardDescription>Captured at invoice creation</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {Object.entries(invoice.issuerSnapshot)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <div key={key}>
                      <span className="text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>{' '}
                      {String(value)}
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
          {invoice.clientSnapshot && (
            <Card>
              <CardHeader>
                <CardTitle>Client Details (Snapshot)</CardTitle>
                <CardDescription>Captured at invoice creation</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {Object.entries(invoice.clientSnapshot)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <div key={key}>
                      <span className="text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                      </span>{' '}
                      {String(value)}
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Audit Info */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Information</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              <span className="text-gray-500">Created:</span>{' '}
              {format(new Date(invoice.createdAt), 'PPpp')}
            </div>
            <div>
              <span className="text-gray-500">Last Updated:</span>{' '}
              {format(new Date(invoice.updatedAt), 'PPpp')}
            </div>
            {invoice.paidAt && (
              <div>
                <span className="text-gray-500">Paid:</span>{' '}
                {format(new Date(invoice.paidAt), 'PPpp')}
              </div>
            )}
            {invoice.voidedAt && (
              <div>
                <span className="text-gray-500">Voided:</span>{' '}
                {format(new Date(invoice.voidedAt), 'PPpp')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
