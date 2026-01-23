import { NextRequest } from 'next/server';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { successResponse, notFoundError, internalError } from '@/lib/api/response';
import { db, demoPatchJobs, tenants } from '@/lib/db';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// GET /api/master/demo-generator/patch-jobs/:jobId
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { jobId } = await params;

    // Get patch job
    const job = await db.query.demoPatchJobs.findFirst({
      where: eq(demoPatchJobs.id, jobId),
    });

    if (!job) {
      return notFoundError('Patch job not found');
    }

    // Get tenant name
    let tenantName: string | null = null;
    if (job.tenantId) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, job.tenantId),
      });
      tenantName = tenant?.name ?? null;
    }

    return successResponse({
      job: {
        id: job.id,
        tenantId: job.tenantId,
        tenantName,
        originalJobId: job.originalJobId,
        mode: job.mode,
        planType: job.planType,
        patchPlan: job.patchPlanJson,
        seed: job.seed,
        rangeStartMonth: job.rangeStartMonth,
        rangeEndMonth: job.rangeEndMonth,
        toleranceConfig: job.toleranceConfig,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        logs: job.logs,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
      beforeKpis: job.beforeKpisJson,
      afterKpis: job.afterKpisJson,
      diffReport: job.diffReportJson,
      metrics: job.metricsJson,
    });
  } catch (error) {
    console.error('Get patch job error:', error);
    return internalError();
  }
}
