import { NextRequest } from 'next/server';
import { db, tenantBillingInfo } from '@/lib/db';
import { requireTenantAuth, requireRoleWithCsrf } from '@/lib/auth/middleware';
import { tenantBillingInfoSchema } from '@/validations/invoice';
import { successResponse, internalError, validationError, formatZodErrors } from '@/lib/api/response';
import { eq } from 'drizzle-orm';

// Get billing info for the current tenant
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const billingInfo = await db.query.tenantBillingInfo.findFirst({
      where: eq(tenantBillingInfo.tenantId, auth.tenantId),
    });

    return successResponse(billingInfo || null);
  } catch (error) {
    console.error('Get billing info error:', error);
    return internalError();
  }
}

// Update billing info (owner/admin only)
export async function PUT(request: NextRequest) {
  try {
    // Only owners and admins can update billing info
    const auth = await requireRoleWithCsrf('admin', request);
    if (auth instanceof Response) {
      return auth;
    }

    // Verify tenant context
    if (!auth.tenantId) {
      return internalError();
    }

    const body = await request.json();
    const result = tenantBillingInfoSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const billingData = result.data;

    // Upsert billing info
    const existing = await db.query.tenantBillingInfo.findFirst({
      where: eq(tenantBillingInfo.tenantId, auth.tenantId),
    });

    if (existing) {
      const [updated] = await db.update(tenantBillingInfo)
        .set({
          ...billingData,
          updatedAt: new Date(),
        })
        .where(eq(tenantBillingInfo.tenantId, auth.tenantId))
        .returning();

      return successResponse(updated);
    } else {
      const [created] = await db.insert(tenantBillingInfo)
        .values({
          tenantId: auth.tenantId,
          ...billingData,
        })
        .returning();

      return successResponse(created);
    }
  } catch (error) {
    console.error('Update billing info error:', error);
    return internalError();
  }
}
