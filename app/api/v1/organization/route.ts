import { NextRequest } from 'next/server';
import { db, tenants } from '@/lib/db';
import { requireOwner } from '@/lib/auth/middleware';
import { updateOrganizationSchema } from '@/validations/auth';
import { successResponse, validationError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) {
      // Allow all authenticated users to view organization
      const authAny = await (await import('@/lib/auth/middleware')).requireTenantAuth(request);
      if (authAny instanceof Response) {
        return authAny;
      }

      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, authAny.tenantId),
      });

      return successResponse({ organization: tenant });
    }

    if (!auth.tenantId) {
      return internalError();
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, auth.tenantId),
    });

    return successResponse({ organization: tenant });
  } catch (error) {
    console.error('Get organization error:', error);
    return internalError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = updateOrganizationSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    if (!auth.tenantId) {
      return internalError();
    }

    const [updated] = await db.update(tenants)
      .set({
        name: result.data.name,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, auth.tenantId))
      .returning();

    return successResponse({ organization: updated });
  } catch (error) {
    console.error('Update organization error:', error);
    return internalError();
  }
}
