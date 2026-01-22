import { NextRequest } from 'next/server';
import { db, companies, contacts, deals } from '@/lib/db';
import { requireTenantAuth, requireTenantWriteAccess, requireTenantDeleteAccess } from '@/lib/auth/middleware';
import { updateCompanySchema } from '@/validations/company';
import { successResponse, validationError, notFoundError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { companyId } = await params;

    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, companyId),
        eq(companies.tenantId, auth.tenantId),
        isNull(companies.deletedAt)
      ),
      with: {
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        contacts: {
          where: isNull(contacts.deletedAt),
          columns: { id: true, firstName: true, lastName: true, email: true, status: true },
          limit: 50,
        },
        deals: {
          where: isNull(deals.deletedAt),
          with: {
            stage: true,
          },
        },
        activities: {
          limit: 10,
          orderBy: (activities, { desc }) => [desc(activities.createdAt)],
        },
      },
    });

    if (!company) {
      return notFoundError('Company not found');
    }

    return successResponse({ company });
  } catch (error) {
    console.error('Get company error:', error);
    return internalError();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { companyId } = await params;
    const body = await request.json();
    const result = updateCompanySchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Verify company exists
    const existing = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, companyId),
        eq(companies.tenantId, auth.tenantId),
        isNull(companies.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Company not found');
    }

    await db.update(companies)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    // Fetch with relations
    const completeCompany = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      with: {
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return successResponse({ company: completeCompany });
  } catch (error) {
    console.error('Update company error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantDeleteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { companyId } = await params;

    const existing = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, companyId),
        eq(companies.tenantId, auth.tenantId),
        isNull(companies.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Company not found');
    }

    // Soft delete
    await db.update(companies)
      .set({ deletedAt: new Date() })
      .where(eq(companies.id, companyId));

    return successResponse({ message: 'Company deleted' });
  } catch (error) {
    console.error('Delete company error:', error);
    return internalError();
  }
}
