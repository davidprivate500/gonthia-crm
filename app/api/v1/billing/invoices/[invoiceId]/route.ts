import { NextRequest } from 'next/server';
import { db, invoices } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { successResponse, notFoundError, internalError, forbiddenError } from '@/lib/api/response';
import { eq, and, ne } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ invoiceId: string }>;
}

// Get invoice details (tenant can only see their own non-draft invoices)
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { invoiceId } = await context.params;

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        ne(invoices.status, 'draft'), // Tenants cannot see drafts
      ),
      with: {
        lineItems: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
      },
    });

    if (!invoice) {
      return notFoundError('Invoice not found');
    }

    // Verify tenant owns this invoice
    if (invoice.tenantId !== auth.tenantId) {
      return forbiddenError('Access denied');
    }

    // Return invoice without internal notes (tenant-facing)
    const { internalNotes, ...publicInvoice } = invoice;

    return successResponse(publicInvoice);
  } catch (error) {
    console.error('Get tenant invoice error:', error);
    return internalError();
  }
}
