import { NextRequest } from 'next/server';
import { requireMasterAdminWithCsrf, requireMasterAdmin } from '@/lib/auth/middleware';
import { successResponse, internalError } from '@/lib/api/response';
import { db, pipelineStages } from '@/lib/db';
import { eq, and, isNull, ilike } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ tenantId: string }>;
}

// GET - Show current stage configuration
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await params;

    const stages = await db.select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
      position: pipelineStages.position,
    })
      .from(pipelineStages)
      .where(and(
        eq(pipelineStages.tenantId, tenantId),
        isNull(pipelineStages.deletedAt)
      ))
      .orderBy(pipelineStages.position);

    return successResponse({
      tenantId,
      stages,
      wonStages: stages.filter(s => s.isWon),
      lostStages: stages.filter(s => s.isLost),
    });
  } catch (error) {
    console.error('Get stages error:', error);
    return internalError();
  }
}

// POST - Fix pipeline stages by setting isWon/isLost flags
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await params;

    // Get all stages for this tenant
    const stages = await db.select()
      .from(pipelineStages)
      .where(and(
        eq(pipelineStages.tenantId, tenantId),
        isNull(pipelineStages.deletedAt)
      ));

    if (stages.length === 0) {
      return successResponse({
        message: 'No stages found for this tenant',
        fixed: 0,
      });
    }

    const results: string[] = [];

    // Find and fix "Closed Won" or similar stages
    const wonPatterns = ['closed won', 'won', 'closed-won', 'closedwon'];
    for (const stage of stages) {
      const nameLower = stage.name.toLowerCase();
      if (wonPatterns.some(p => nameLower.includes(p)) && !stage.isWon) {
        await db.update(pipelineStages)
          .set({ isWon: true, updatedAt: new Date() })
          .where(eq(pipelineStages.id, stage.id));
        results.push(`Set isWon=true on "${stage.name}"`);
      }
    }

    // Find and fix "Closed Lost" or similar stages
    const lostPatterns = ['closed lost', 'lost', 'closed-lost', 'closedlost', 'no decision'];
    for (const stage of stages) {
      const nameLower = stage.name.toLowerCase();
      // Don't mark as lost if it's already marked as won
      if (lostPatterns.some(p => nameLower.includes(p)) && !stage.isLost && !stage.isWon) {
        await db.update(pipelineStages)
          .set({ isLost: true, updatedAt: new Date() })
          .where(eq(pipelineStages.id, stage.id));
        results.push(`Set isLost=true on "${stage.name}"`);
      }
    }

    // Re-fetch to show updated state
    const updatedStages = await db.select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
    })
      .from(pipelineStages)
      .where(and(
        eq(pipelineStages.tenantId, tenantId),
        isNull(pipelineStages.deletedAt)
      ))
      .orderBy(pipelineStages.position);

    return successResponse({
      message: results.length > 0 ? 'Fixed pipeline stages' : 'No changes needed',
      changes: results,
      stages: updatedStages,
      wonStages: updatedStages.filter(s => s.isWon),
      lostStages: updatedStages.filter(s => s.isLost),
    });
  } catch (error) {
    console.error('Fix stages error:', error);
    return internalError();
  }
}
