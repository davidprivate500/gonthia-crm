import { NextRequest } from 'next/server';
import { db, invoices } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { invoiceQuerySchema } from '@/validations/invoice';
import { successResponse, internalError, paginatedResponse } from '@/lib/api/response';
import { eq, desc, asc, ilike, and, sql, ne } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';

// List invoices for the current tenant
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = invoiceQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, status, search, sortBy, sortOrder } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions - only show invoices for this tenant
    // Also exclude draft invoices (tenants only see issued/paid/void)
    const conditions = [
      eq(invoices.tenantId, auth.tenantId),
      ne(invoices.status, 'draft'),
    ];

    if (status && status !== 'draft') {
      conditions.push(eq(invoices.status, status));
    }

    if (search) {
      const searchPattern = toSearchPattern(search);
      conditions.push(ilike(invoices.invoiceNumber, searchPattern));
    }

    const whereClause = and(...conditions);

    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(whereClause);

    // Build order by
    const orderByMap: Record<string, typeof invoices.invoiceNumber> = {
      invoiceNumber: invoices.invoiceNumber,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.totalAmount,
      createdAt: invoices.createdAt,
    };
    const orderByField = orderByMap[sortBy] || invoices.createdAt;
    const orderByClause = sortOrder === 'asc' ? asc(orderByField) : desc(orderByField);

    // Get invoices with line items
    const invoiceList = await db.query.invoices.findMany({
      where: whereClause,
      with: {
        lineItems: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
      },
      limit: pageSize,
      offset,
      orderBy: [orderByClause],
    });

    return paginatedResponse(invoiceList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List tenant invoices error:', error);
    return internalError();
  }
}
