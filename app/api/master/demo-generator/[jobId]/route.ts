import { NextRequest } from 'next/server';
import { db, demoGenerationJobs, demoTenantMetadata, tenants } from '@/lib/db';
import { requireMasterAdmin, requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { successResponse, notFoundError, internalError } from '@/lib/api/response';
import { eq } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

// GET /api/master/demo-generator/[jobId] - Get job detail
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { jobId } = await context.params;

    // Get job with tenant info
    const job = await db.query.demoGenerationJobs.findFirst({
      where: eq(demoGenerationJobs.id, jobId),
    });

    if (!job) {
      return notFoundError('Generation job not found');
    }

    // Get tenant info if exists
    let tenant = null;
    if (job.createdTenantId) {
      tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, job.createdTenantId),
      });
    }

    return successResponse({
      id: job.id,
      status: job.status,
      mode: job.mode || 'growth-curve',
      config: job.config,
      seed: job.seed,
      // Monthly plan specific fields
      monthlyPlan: job.monthlyPlanJson,
      planVersion: job.planVersion,
      toleranceConfig: job.toleranceConfig,
      verificationReport: job.verificationReport,
      verificationPassed: job.verificationPassed,
      // Common fields
      createdTenantId: job.createdTenantId,
      tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
      progress: job.progress,
      currentStep: job.currentStep,
      logs: job.logs,
      metrics: job.metrics,
      errorMessage: job.errorMessage,
      errorStack: job.errorStack,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error('Get demo generation job error:', error);
    return internalError();
  }
}

// DELETE /api/master/demo-generator/[jobId] - Delete demo tenant
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { jobId } = await context.params;

    // Get job
    const job = await db.query.demoGenerationJobs.findFirst({
      where: eq(demoGenerationJobs.id, jobId),
    });

    if (!job) {
      return notFoundError('Generation job not found');
    }

    // Delete the tenant if it exists (cascades all data)
    if (job.createdTenantId) {
      // First delete the metadata
      await db.delete(demoTenantMetadata)
        .where(eq(demoTenantMetadata.tenantId, job.createdTenantId));

      // Then delete the tenant (cascades to all tenant data)
      await db.delete(tenants)
        .where(eq(tenants.id, job.createdTenantId));
    }

    // Update job to mark tenant as deleted
    await db.update(demoGenerationJobs)
      .set({
        createdTenantId: null,
        currentStep: 'Deleted',
        updatedAt: new Date(),
      })
      .where(eq(demoGenerationJobs.id, jobId));

    return successResponse({ success: true, message: 'Demo tenant deleted' });
  } catch (error) {
    console.error('Delete demo tenant error:', error);
    return internalError();
  }
}
