'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
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
import { api } from '@/lib/api/client';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  sortOrder: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'issued' | 'paid' | 'void' | 'overdue';
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  totalAmount: string;
  notes: string | null;
  issuerSnapshot: Record<string, unknown> | null;
  clientSnapshot: Record<string, unknown> | null;
  createdAt: string;
  paidAt: string | null;
  lineItems: LineItem[];
}

const statusColors: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-red-100 text-red-800',
  overdue: 'bg-orange-100 text-orange-800',
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      setIsLoading(true);
      try {
        const response = await api.billing.invoices.get(invoiceId);
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

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <>
        <Header title="Invoice" />
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Header title="Invoice" />
        <div className="p-6">
          <p className="text-center text-gray-500">Invoice not found</p>
        </div>
      </>
    );
  }

  const issuer = invoice.issuerSnapshot as Record<string, string> | null;
  const client = invoice.clientSnapshot as Record<string, string> | null;

  return (
    <>
      <Header
        title={`Invoice ${invoice.invoiceNumber}`}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" asChild>
              <Link href="/settings/billing">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Billing
              </Link>
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        }
      />

      <div className="p-6 max-w-4xl mx-auto print:p-0">
        {/* Invoice Header */}
        <Card className="mb-6 print:shadow-none print:border-0">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-8">
              <div>
                {issuer?.companyName && (
                  <h2 className="text-2xl font-bold">{issuer.companyName}</h2>
                )}
                {issuer?.address && <p className="text-gray-600">{issuer.address}</p>}
                {(issuer?.city || issuer?.state || issuer?.postalCode) && (
                  <p className="text-gray-600">
                    {[issuer.city, issuer.state, issuer.postalCode].filter(Boolean).join(', ')}
                  </p>
                )}
                {issuer?.country && <p className="text-gray-600">{issuer.country}</p>}
                {issuer?.email && <p className="text-gray-600">{issuer.email}</p>}
                {issuer?.phone && <p className="text-gray-600">{issuer.phone}</p>}
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
                <p className="text-xl font-mono mt-2">{invoice.invoiceNumber}</p>
                <Badge className={`${statusColors[invoice.status]} mt-2`}>
                  {invoice.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-500 mb-2">Bill To:</h3>
                {client?.name && <p className="font-semibold">{client.name}</p>}
                {client?.legalName && client.legalName !== client?.name && (
                  <p className="text-gray-600">{client.legalName}</p>
                )}
                {client?.address && <p className="text-gray-600">{client.address}</p>}
                {(client?.city || client?.state || client?.postalCode) && (
                  <p className="text-gray-600">
                    {[client.city, client.state, client.postalCode].filter(Boolean).join(', ')}
                  </p>
                )}
                {client?.country && <p className="text-gray-600">{client.country}</p>}
                {client?.vatId && (
                  <p className="text-gray-600">VAT: {client.vatId}</p>
                )}
              </div>
              <div className="text-right">
                <div className="space-y-1">
                  <p>
                    <span className="text-gray-500">Issue Date:</span>{' '}
                    <span className="font-medium">
                      {invoice.issueDate
                        ? format(new Date(invoice.issueDate), 'MMMM d, yyyy')
                        : '-'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Due Date:</span>{' '}
                    <span className="font-medium">
                      {invoice.dueDate
                        ? format(new Date(invoice.dueDate), 'MMMM d, yyyy')
                        : '-'}
                    </span>
                  </p>
                  {invoice.paidAt && (
                    <p>
                      <span className="text-gray-500">Paid:</span>{' '}
                      <span className="font-medium text-green-600">
                        {format(new Date(invoice.paidAt), 'MMMM d, yyyy')}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="mb-6 print:shadow-none print:border-0">
          <CardContent className="pt-6">
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
                {invoice.lineItems
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((item) => (
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
              <div className="flex justify-end gap-8 text-xl font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="w-32 text-right">
                  {invoice.currency} {parseFloat(invoice.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <Card className="mb-6 print:shadow-none print:border-0">
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-gray-600">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Payment Information */}
        {issuer && (issuer.bankName || issuer.cryptoWalletAddress || issuer.paymentInstructions) && (
          <Card className="print:shadow-none print:border-0">
            <CardHeader>
              <CardTitle className="text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {issuer.bankName && (
                <div>
                  <h4 className="font-medium mb-2">Bank Transfer</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Bank: {issuer.bankName}</p>
                    {issuer.bankAccountName && <p>Account Name: {issuer.bankAccountName}</p>}
                    {issuer.bankAccountNumber && <p>Account Number: {issuer.bankAccountNumber}</p>}
                    {issuer.bankRoutingNumber && <p>Routing Number: {issuer.bankRoutingNumber}</p>}
                    {issuer.bankSwiftCode && <p>SWIFT/BIC: {issuer.bankSwiftCode}</p>}
                    {issuer.bankIban && <p>IBAN: {issuer.bankIban}</p>}
                  </div>
                </div>
              )}
              {issuer.cryptoWalletAddress && (
                <div>
                  <h4 className="font-medium mb-2">Cryptocurrency</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Network: {issuer.cryptoNetwork || 'N/A'}</p>
                    <p className="font-mono break-all">Address: {issuer.cryptoWalletAddress}</p>
                  </div>
                </div>
              )}
              {issuer.paymentInstructions && (
                <div>
                  <h4 className="font-medium mb-2">Instructions</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {issuer.paymentInstructions}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
