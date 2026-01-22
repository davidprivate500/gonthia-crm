import { NextRequest } from 'next/server';
import { db, deals, pipelineStages } from '@/lib/db';
import { requireWriteAccess } from '@/lib/auth/middleware';
import { moveDealSchema } from '@/validations/deal';
import { successResponse, validationError, notFoundError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull, gte, ne, sql } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ dealId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { dealId } = await params;
    const body = await request.json();
    const result = moveDealSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { stageId, position } = result.data;

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

    // Verify stage exists
    const stage = await db.query.pipelineStages.findFirst({
      where: and(
        eq(pipelineStages.id, stageId),
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
    });

    if (!stage) {
      return notFoundError('Pipeline stage not found');
    }

    // Calculate new position
    let newPosition = position;
    if (newPosition === undefined) {
      // Add to end of stage
      const lastDeal = await db.query.deals.findFirst({
        where: and(
          eq(deals.stageId, stageId),
          isNull(deals.deletedAt)
        ),
        orderBy: (deals, { desc }) => [desc(deals.position)],
      });
      newPosition = (lastDeal?.position ?? -1) + 1;
    } else {
      // Shift other deals in target stage
      await db.update(deals)
        .set({
          position: sql`${deals.position} + 1`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(deals.stageId, stageId),
          gte(deals.position, newPosition),
          ne(deals.id, dealId),
          isNull(deals.deletedAt)
        ));
    }

    // Update deal
    await db.update(deals)
      .set({
        stageId,
        position: newPosition,
        updatedAt: new Date(),
      })
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
    console.error('Move deal error:', error);
    return internalError();
  }
}
