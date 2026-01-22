import { NextRequest } from 'next/server';
import { db, tenants, users, contacts, deals, invoices, tenantBillingInfo } from '@/lib/db';
import { requireMasterAdmin, requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { tenantBillingInfoSchema } from '@/validations/invoice';
import { successResponse, notFoundError, internalError, validationError, formatZodErrors } from '@/lib/api/response';
import { eq, count, sql } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ tenantId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await context.params;

    // Get tenant with billing info
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: {
        billingInfo: true,
      },
    });

    if (!tenant) {
      return notFoundError('Tenant not found');
    }

    // Get stats
    const [userCount, contactCount, dealCount, invoiceCount] = await Promise.all([
      db.select({ count: count() }).from(users).where(sql`${users.tenantId} = ${tenantId}`),
      db.select({ count: count() }).from(contacts).where(sql`${contacts.tenantId} = ${tenantId}`),
      db.select({ count: count() }).from(deals).where(sql`${deals.tenantId} = ${tenantId}`),
      db.select({ count: count() }).from(invoices).where(sql`${invoices.tenantId} = ${tenantId}`),
    ]);

    return successResponse({
      ...tenant,
      stats: {
        users: userCount[0].count,
        contacts: contactCount[0].count,
        deals: dealCount[0].count,
        invoices: invoiceCount[0].count,
      },
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    return internalError();
  }
}

// Update tenant billing info
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await context.params;

    // Verify tenant exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return notFoundError('Tenant not found');
    }

    const body = await request.json();
    const result = tenantBillingInfoSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const billingData = result.data;

    // Upsert billing info
    const existing = await db.query.tenantBillingInfo.findFirst({
      where: eq(tenantBillingInfo.tenantId, tenantId),
    });

    if (existing) {
      const [updated] = await db.update(tenantBillingInfo)
        .set({
          ...billingData,
          updatedAt: new Date(),
        })
        .where(eq(tenantBillingInfo.tenantId, tenantId))
        .returning();

      return successResponse(updated);
    } else {
      const [created] = await db.insert(tenantBillingInfo)
        .values({
          tenantId,
          ...billingData,
        })
        .returning();

      return successResponse(created);
    }
  } catch (error) {
    console.error('Update tenant billing error:', error);
    return internalError();
  }
}
