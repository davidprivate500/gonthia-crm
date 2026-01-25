import { NextRequest } from 'next/server';
import { requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { successResponse, validationError, formatZodErrors, badRequestError, internalError } from '@/lib/api/response';
import { applyPatchSchema } from '@/validations/demo-patch';
import { db, demoPatchJobs, demoTenantMetadata, demoGenerationJobs } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { KpiAggregator } from '@/lib/demo-generator/engine/kpi-aggregator';
import { validatePatchPlan, computeDeltas, validateDemoTenant } from '@/lib/demo-generator/engine/patch-validator';
import { PatchEngine } from '@/lib/demo-generator/engine/patch-engine';
import { generateSeed } from '@/lib/demo-generator/engine/rng';
import type { PatchPlan, ToleranceConfig } from '@/lib/demo-generator/types';

// Allow longer execution time (5 minutes max on Vercel Pro)
export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ tenantId: string }>;
}

// POST /api/master/demo-generator/tenants/:tenantId/patch/apply
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await params;

    // Validate tenant is demo-generated
    const tenantValidation = await validateDemoTenant(tenantId);
    if (!tenantValidation.valid) {
      return badRequestError(tenantValidation.error!);
    }

    // Parse request body
    const body = await request.json();
    const parseResult = applyPatchSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(formatZodErrors(parseResult.error));
    }

    const plan: PatchPlan = {
      mode: parseResult.data.mode,
      planType: parseResult.data.planType,
      months: parseResult.data.months,
      tolerances: parseResult.data.tolerances,
      seed: parseResult.data.seed,
    };

    // Get current KPIs for validation
    const months = plan.months.map(m => m.month).sort();
    const rangeStartMonth = months[0];
    const rangeEndMonth = months[months.length - 1];

    const aggregator = new KpiAggregator(tenantId);
    const currentKpis = await aggregator.queryMonthlyKpis(rangeStartMonth, rangeEndMonth);

    // Validate the patch plan
    const validation = await validatePatchPlan(tenantId, plan, currentKpis);

    if (!validation.valid) {
      return badRequestError(`Validation failed: ${validation.errors.join('; ')}`);
    }

    // Compute deltas to check for blockers
    const { blockers } = computeDeltas(plan, currentKpis);

    if (blockers.length > 0) {
      return badRequestError(`Patch blocked: ${blockers.join('; ')}`);
    }

    // Get original generation job ID
    const metadata = await db.query.demoTenantMetadata.findFirst({
      where: eq(demoTenantMetadata.tenantId, tenantId),
    });

    // Generate seed if not provided
    const seed = plan.seed || generateSeed();

    // Create patch job record
    const tolerances: ToleranceConfig = plan.tolerances ?? {
      countTolerance: 0,
      valueTolerance: 0.005,
    };

    const [job] = await db.insert(demoPatchJobs).values({
      tenantId,
      originalJobId: metadata?.generationJobId ?? null,
      createdById: auth.userId,
      mode: plan.mode,
      planType: plan.planType,
      patchPlanJson: plan,
      seed,
      rangeStartMonth,
      rangeEndMonth,
      toleranceConfig: tolerances,
      status: 'pending',
      progress: 0,
      currentStep: 'Queued',
      logs: [],
    }).returning();

    // Execute patch synchronously (wait for completion)
    console.log(`[Patch] Starting execution for job ${job.id}`);
    const engine = new PatchEngine(job.id);

    try {
      await engine.execute();
      console.log(`[Patch] Execution completed for job ${job.id}`);
    } catch (error) {
      console.error(`[Patch] Execution failed for job ${job.id}:`, error);
      // Error is already handled by PatchEngine.handleError()
    }

    // Fetch final job status
    const finalJob = await db.query.demoPatchJobs.findFirst({
      where: eq(demoPatchJobs.id, job.id),
    });

    return successResponse({
      jobId: job.id,
      status: finalJob?.status ?? 'unknown',
      seed,
      rangeStartMonth,
      rangeEndMonth,
      progress: finalJob?.progress ?? 0,
      currentStep: finalJob?.currentStep ?? 'Unknown',
    });
  } catch (error) {
    console.error('Apply patch error:', error);
    return internalError();
  }
}
