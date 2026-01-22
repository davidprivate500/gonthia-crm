import { NextRequest } from 'next/server';
import { db, pipelineStages } from '@/lib/db';
import { requireTenantAuth, requireTenantAdmin } from '@/lib/auth/middleware';
import { pipelineStageSchema, reorderStagesSchema } from '@/validations/deal';
import { successResponse, validationError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const stages = await db.query.pipelineStages.findMany({
      where: and(
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
      orderBy: [asc(pipelineStages.position)],
    });

    return successResponse({ stages });
  } catch (error) {
    console.error('List stages error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTenantAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = pipelineStageSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Validate: only one stage can be won, one can be lost
    if (result.data.isWon || result.data.isLost) {
      const existingStages = await db.query.pipelineStages.findMany({
        where: and(
          eq(pipelineStages.tenantId, auth.tenantId),
          isNull(pipelineStages.deletedAt)
        ),
      });

      if (result.data.isWon && existingStages.some(s => s.isWon)) {
        return validationError({ isWon: ['A "won" stage already exists'] });
      }
      if (result.data.isLost && existingStages.some(s => s.isLost)) {
        return validationError({ isLost: ['A "lost" stage already exists'] });
      }
    }

    const [stage] = await db.insert(pipelineStages).values({
      ...result.data,
      tenantId: auth.tenantId,
    }).returning();

    return successResponse({ stage });
  } catch (error) {
    console.error('Create stage error:', error);
    return internalError();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireTenantAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = reorderStagesSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // BUG-010 FIX: Update positions in a transaction to prevent race conditions
    await db.transaction(async (tx) => {
      for (const { id, position } of result.data.stages) {
        await tx.update(pipelineStages)
          .set({ position, updatedAt: new Date() })
          .where(and(
            eq(pipelineStages.id, id),
            eq(pipelineStages.tenantId, auth.tenantId)
          ));
      }
    });

    // Return updated stages
    const stages = await db.query.pipelineStages.findMany({
      where: and(
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
      orderBy: [asc(pipelineStages.position)],
    });

    return successResponse({ stages });
  } catch (error) {
    console.error('Reorder stages error:', error);
    return internalError();
  }
}
