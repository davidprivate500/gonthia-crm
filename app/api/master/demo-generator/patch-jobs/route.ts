import { NextRequest } from 'next/server';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { successResponse, internalError } from '@/lib/api/response';
import { db, demoPatchJobs, tenants } from '@/lib/db';
import { eq, desc, and, sql } from 'drizzle-orm';

// GET /api/master/demo-generator/patch-jobs - List all patch jobs
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (tenantId) {
      conditions.push(eq(demoPatchJobs.tenantId, tenantId));
    }
    if (status) {
      conditions.push(eq(demoPatchJobs.status, status as any));
    }

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(demoPatchJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = countResult[0]?.count ?? 0;

    // Get jobs
    const jobs = await db.select({
      id: demoPatchJobs.id,
      tenantId: demoPatchJobs.tenantId,
      mode: demoPatchJobs.mode,
      planType: demoPatchJobs.planType,
      rangeStartMonth: demoPatchJobs.rangeStartMonth,
      rangeEndMonth: demoPatchJobs.rangeEndMonth,
      status: demoPatchJobs.status,
      progress: demoPatchJobs.progress,
      currentStep: demoPatchJobs.currentStep,
      errorMessage: demoPatchJobs.errorMessage,
      createdAt: demoPatchJobs.createdAt,
      completedAt: demoPatchJobs.completedAt,
    })
      .from(demoPatchJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(demoPatchJobs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get tenant names
    const tenantIds = [...new Set(jobs.map(j => j.tenantId))];
    const tenantMap = new Map<string, string>();

    if (tenantIds.length > 0) {
      for (const tid of tenantIds) {
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tid),
        });
        if (tenant) {
          tenantMap.set(tid, tenant.name);
        }
      }
    }

    // Enrich jobs with tenant names
    const enrichedJobs = jobs.map(job => ({
      ...job,
      tenantName: tenantMap.get(job.tenantId) ?? null,
    }));

    return successResponse({
      jobs: enrichedJobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List patch jobs error:', error);
    return internalError();
  }
}
