import { NextRequest } from 'next/server';
import { requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { successResponse, validationError, formatZodErrors, badRequestError, internalError } from '@/lib/api/response';
import { applyPatchSchema } from '@/validations/demo-patch';
import { db, demoPatchJobs, demoTenantMetadata, demoGenerationJobs, demoMetricOverrides } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
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

    // Handle metrics-only mode separately - no PatchEngine needed
    if (plan.mode === 'metrics-only') {
      console.log(`[Patch] Starting metrics-only execution for job ${job.id}`);

      await db.update(demoPatchJobs)
        .set({ status: 'running', currentStep: 'Applying metric overrides', updatedAt: new Date() })
        .where(eq(demoPatchJobs.id, job.id));

      try {
        // Get current KPIs to calculate deltas
        const aggregator = new KpiAggregator(tenantId);
        const kpis = await aggregator.queryMonthlyKpis(rangeStartMonth, rangeEndMonth);

        // Process each month and upsert metric overrides
        for (const monthPlan of plan.months) {
          const month = monthPlan.month;
          const currentMonth = kpis.find(k => k.month === month);
          const currentWonCount = currentMonth?.metrics?.closedWonCount ?? 0;
          const currentWonValue = currentMonth?.metrics?.closedWonValue ?? 0;

          // Calculate the delta to apply (target - current = adjustment needed)
          const targetWonCount = monthPlan.metrics.closedWonCount ?? currentWonCount;
          const targetWonValue = monthPlan.metrics.closedWonValue ?? currentWonValue;
          const wonCountDelta = targetWonCount - currentWonCount;
          const wonValueDelta = targetWonValue - currentWonValue;

          // Skip if no changes
          if (wonCountDelta === 0 && wonValueDelta === 0) {
            continue;
          }

          // Check if an override already exists for this tenant/month
          const existingOverride = await db.query.demoMetricOverrides.findFirst({
            where: and(
              eq(demoMetricOverrides.tenantId, tenantId),
              eq(demoMetricOverrides.month, month)
            ),
          });

          if (existingOverride) {
            // Update existing override by adding the new delta
            const newCountOverride = Number(existingOverride.closedWonCountOverride) + wonCountDelta;
            const newValueOverride = Number(existingOverride.closedWonValueOverride) + wonValueDelta;

            await db.update(demoMetricOverrides)
              .set({
                closedWonCountOverride: newCountOverride,
                closedWonValueOverride: String(newValueOverride),
                patchJobId: job.id,
                updatedAt: new Date(),
              })
              .where(eq(demoMetricOverrides.id, existingOverride.id));
          } else {
            // Insert new override
            await db.insert(demoMetricOverrides).values({
              tenantId,
              month,
              closedWonCountOverride: wonCountDelta,
              closedWonValueOverride: String(wonValueDelta),
              patchJobId: job.id,
            });
          }
        }

        // Mark job as completed
        await db.update(demoPatchJobs)
          .set({
            status: 'completed',
            progress: 100,
            currentStep: 'Completed',
            completedAt: new Date(),
            updatedAt: new Date(),
            metricsJson: {
              recordsCreated: 0,
              recordsModified: 0,
              recordsDeleted: 0,
              metricOverridesApplied: plan.months.length,
            },
          })
          .where(eq(demoPatchJobs.id, job.id));

        console.log(`[Patch] Metrics-only execution completed for job ${job.id}`);
      } catch (error) {
        console.error(`[Patch] Metrics-only execution failed for job ${job.id}:`, error);
        await db.update(demoPatchJobs)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(demoPatchJobs.id, job.id));
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
    }

    // Standard execution for additive/reconcile modes
    console.log(`[Patch] Starting execution for job ${job.id}`);

    // First, verify the job was created
    const verifyJob = await db.query.demoPatchJobs.findFirst({
      where: eq(demoPatchJobs.id, job.id),
    });
    console.log(`[Patch] Job verified: ${verifyJob?.id}, status: ${verifyJob?.status}`);

    // Update status to running immediately to confirm DB updates work
    await db.update(demoPatchJobs)
      .set({ status: 'running', currentStep: 'Starting engine', updatedAt: new Date() })
      .where(eq(demoPatchJobs.id, job.id));
    console.log(`[Patch] Status updated to running`);

    const engine = new PatchEngine(job.id);

    try {
      await engine.execute();
      console.log(`[Patch] Execution completed for job ${job.id}`);
    } catch (error) {
      console.error(`[Patch] Execution failed for job ${job.id}:`, error);
      // Update job status to failed with error message
      await db.update(demoPatchJobs)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          updatedAt: new Date()
        })
        .where(eq(demoPatchJobs.id, job.id));
    }

    // Fetch final job status
    const finalJob = await db.query.demoPatchJobs.findFirst({
      where: eq(demoPatchJobs.id, job.id),
    });
    console.log(`[Patch] Final status: ${finalJob?.status}, step: ${finalJob?.currentStep}`);

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
