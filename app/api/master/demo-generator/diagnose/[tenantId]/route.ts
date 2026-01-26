import { NextRequest } from 'next/server';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { successResponse, internalError } from '@/lib/api/response';
import { db, pipelineStages, deals, demoPatchJobs } from '@/lib/db';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ tenantId: string }>;
}

// GET /api/master/demo-generator/diagnose/:tenantId
// Diagnose why won deals might not be appearing
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await params;

    // 1. Get all pipeline stages with their flags
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

    const wonStages = stages.filter(s => s.isWon);
    const lostStages = stages.filter(s => s.isLost);

    // 2. Get deals by stage
    const dealsByStage = await db.select({
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      isWon: pipelineStages.isWon,
      count: sql<number>`count(*)::int`,
      totalValue: sql<string>`coalesce(sum(cast(${deals.value} as numeric)), 0)::text`,
    })
      .from(deals)
      .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(and(
        eq(deals.tenantId, tenantId),
        isNull(deals.deletedAt)
      ))
      .groupBy(deals.stageId, pipelineStages.name, pipelineStages.isWon);

    // 3. Get recent patch jobs for this tenant
    const recentJobs = await db.select({
      id: demoPatchJobs.id,
      status: demoPatchJobs.status,
      mode: demoPatchJobs.mode,
      rangeStartMonth: demoPatchJobs.rangeStartMonth,
      rangeEndMonth: demoPatchJobs.rangeEndMonth,
      progress: demoPatchJobs.progress,
      currentStep: demoPatchJobs.currentStep,
      errorMessage: demoPatchJobs.errorMessage,
      metricsJson: demoPatchJobs.metricsJson,
      patchPlanJson: demoPatchJobs.patchPlanJson,
      createdAt: demoPatchJobs.createdAt,
    })
      .from(demoPatchJobs)
      .where(eq(demoPatchJobs.tenantId, tenantId))
      .orderBy(desc(demoPatchJobs.createdAt))
      .limit(5);

    // 4. Check for deals with demo job IDs from patch jobs
    const patchJobIds = recentJobs.map(j => j.id);
    let dealsFromPatchJobs: any[] = [];

    if (patchJobIds.length > 0) {
      dealsFromPatchJobs = await db.select({
        demoJobId: deals.demoJobId,
        stageId: deals.stageId,
        stageName: pipelineStages.name,
        isWon: pipelineStages.isWon,
        value: deals.value,
        createdAt: deals.createdAt,
      })
        .from(deals)
        .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .where(and(
          eq(deals.tenantId, tenantId),
          sql`${deals.demoJobId}::text = ANY(ARRAY[${sql.join(patchJobIds.map(id => sql`${id}`), sql`, `)}]::text[])`,
          isNull(deals.deletedAt)
        ))
        .limit(50);
    }

    return successResponse({
      tenantId,
      diagnosis: {
        stagesWithIsWon: wonStages.length,
        stagesWithIsLost: lostStages.length,
        problemDetected: wonStages.length === 0
          ? 'NO_WON_STAGES: No pipeline stages have isWon=true. Won deals cannot be assigned!'
          : null,
      },
      allStages: stages,
      wonStages,
      lostStages,
      dealsByStage,
      recentPatchJobs: recentJobs.map(j => ({
        ...j,
        patchPlan: j.patchPlanJson,
        metrics: j.metricsJson,
      })),
      dealsCreatedByPatchJobs: dealsFromPatchJobs,
    });
  } catch (error) {
    console.error('Diagnose error:', error);
    return internalError();
  }
}
