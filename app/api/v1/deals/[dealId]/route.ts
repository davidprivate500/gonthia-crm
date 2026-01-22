import { NextRequest } from 'next/server';
import { db, deals, pipelineStages } from '@/lib/db';
import { requireAuth, requireWriteAccess, requireDeleteAccess } from '@/lib/auth/middleware';
import { updateDealSchema } from '@/validations/deal';
import { successResponse, validationError, notFoundError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ dealId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { dealId } = await params;

    const deal = await db.query.deals.findFirst({
      where: and(
        eq(deals.id, dealId),
        eq(deals.tenantId, auth.tenantId),
        isNull(deals.deletedAt)
      ),
      with: {
        stage: true,
        contact: {
          columns: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        company: {
          columns: { id: true, name: true, domain: true },
        },
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        activities: {
          limit: 20,
          orderBy: (activities, { desc }) => [desc(activities.createdAt)],
        },
      },
    });

    if (!deal) {
      return notFoundError('Deal not found');
    }

    return successResponse({ deal });
  } catch (error) {
    console.error('Get deal error:', error);
    return internalError();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { dealId } = await params;
    const body = await request.json();
    const result = updateDealSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Verify deal exists
    const existing = await db.query.deals.findFirst({
      where: and(
        eq(deals.id, dealId),
        eq(deals.tenantId, auth.tenantId),
        isNull(deals.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Deal not found');
    }

    // If changing stage, verify new stage exists
    if (result.data.stageId && result.data.stageId !== existing.stageId) {
      const stage = await db.query.pipelineStages.findFirst({
        where: and(
          eq(pipelineStages.id, result.data.stageId),
          eq(pipelineStages.tenantId, auth.tenantId),
          isNull(pipelineStages.deletedAt)
        ),
      });

      if (!stage) {
        return notFoundError('Pipeline stage not found');
      }
    }

    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: new Date(),
    };

    if (result.data.value !== undefined) {
      updateData.value = result.data.value !== null ? String(result.data.value) : null;
    }

    await db.update(deals)
      .set(updateData)
      .where(eq(deals.id, dealId));

    // Fetch complete deal
    const completeDeal = await db.query.deals.findFirst({
      where: eq(deals.id, dealId),
      with: {
        stage: true,
        contact: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        company: {
          columns: { id: true, name: true },
        },
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return successResponse({ deal: completeDeal });
  } catch (error) {
    console.error('Update deal error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireDeleteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { dealId } = await params;

    const existing = await db.query.deals.findFirst({
      where: and(
        eq(deals.id, dealId),
        eq(deals.tenantId, auth.tenantId),
        isNull(deals.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Deal not found');
    }

    // Soft delete
    await db.update(deals)
      .set({ deletedAt: new Date() })
      .where(eq(deals.id, dealId));

    return successResponse({ message: 'Deal deleted' });
  } catch (error) {
    console.error('Delete deal error:', error);
    return internalError();
  }
}
