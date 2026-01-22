import { NextRequest } from 'next/server';
import { db, pipelineStages, deals } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';
import { updatePipelineStageSchema } from '@/validations/deal';
import { successResponse, validationError, notFoundError, conflictError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull, count } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ stageId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { stageId } = await params;
    const body = await request.json();
    const result = updatePipelineStageSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Verify stage exists
    const existing = await db.query.pipelineStages.findFirst({
      where: and(
        eq(pipelineStages.id, stageId),
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Stage not found');
    }

    // Validate unique won/lost
    if ((result.data.isWon && !existing.isWon) || (result.data.isLost && !existing.isLost)) {
      const existingStages = await db.query.pipelineStages.findMany({
        where: and(
          eq(pipelineStages.tenantId, auth.tenantId),
          isNull(pipelineStages.deletedAt)
        ),
      });

      if (result.data.isWon && existingStages.some(s => s.isWon && s.id !== stageId)) {
        return validationError({ isWon: ['A "won" stage already exists'] });
      }
      if (result.data.isLost && existingStages.some(s => s.isLost && s.id !== stageId)) {
        return validationError({ isLost: ['A "lost" stage already exists'] });
      }
    }

    const [updated] = await db.update(pipelineStages)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(pipelineStages.id, stageId))
      .returning();

    return successResponse({ stage: updated });
  } catch (error) {
    console.error('Update stage error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { stageId } = await params;

    const existing = await db.query.pipelineStages.findFirst({
      where: and(
        eq(pipelineStages.id, stageId),
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Stage not found');
    }

    // Check if stage has deals
    const dealCount = await db.select({ count: count() })
      .from(deals)
      .where(and(
        eq(deals.stageId, stageId),
        isNull(deals.deletedAt)
      ));

    if (dealCount[0].count > 0) {
      return conflictError('Cannot delete stage with active deals. Move deals first.');
    }

    // Soft delete
    await db.update(pipelineStages)
      .set({ deletedAt: new Date() })
      .where(eq(pipelineStages.id, stageId));

    return successResponse({ message: 'Stage deleted' });
  } catch (error) {
    console.error('Delete stage error:', error);
    return internalError();
  }
}
