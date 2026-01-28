import { NextRequest } from 'next/server';
import { requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { successResponse, validationError, formatZodErrors, badRequestError, internalError } from '@/lib/api/response';
import { validatePatchSchema } from '@/validations/demo-patch';
import { KpiAggregator } from '@/lib/demo-generator/engine/kpi-aggregator';
import { validatePatchPlan, computeDeltas, generatePreview, validateDemoTenant } from '@/lib/demo-generator/engine/patch-validator';
import type { PatchPlan } from '@/lib/demo-generator/types';

interface RouteParams {
  params: Promise<{ tenantId: string }>;
}

// POST /api/master/demo-generator/tenants/:tenantId/patch/validate
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
    const parseResult = validatePatchSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(formatZodErrors(parseResult.error));
    }

    const plan: PatchPlan = {
      mode: parseResult.data.mode,
      planType: parseResult.data.planType,
      months: parseResult.data.months,
      tolerances: parseResult.data.tolerances,
    };

    // Get current KPIs for the affected months
    const months = plan.months.map(m => m.month).sort();
    const aggregator = new KpiAggregator(tenantId);
    const currentKpis = await aggregator.queryMonthlyKpis(months[0], months[months.length - 1]);

    // Handle metrics-only mode separately - simpler validation
    if (plan.mode === 'metrics-only') {
      // For metrics-only mode, all metrics can be changed
      // No complex validation needed - just return success with a preview
      const metricsOnlyDeltas = plan.months.map(m => {
        const currentMonth = currentKpis.find(k => k.month === m.month);
        const metrics = currentMonth?.metrics ?? {} as Record<string, number>;

        // Get current values with defaults
        const currentContacts = (metrics.contactsCreated as number) ?? 0;
        const currentCompanies = (metrics.companiesCreated as number) ?? 0;
        const currentDeals = (metrics.dealsCreated as number) ?? 0;
        const currentWonCount = (metrics.closedWonCount as number) ?? 0;
        const currentWonValue = (metrics.closedWonValue as number) ?? 0;
        const currentActivities = (metrics.activitiesCreated as number) ?? 0;

        // Get target values (use current if not specified)
        const targetContacts = m.metrics.contactsCreated ?? currentContacts;
        const targetCompanies = m.metrics.companiesCreated ?? currentCompanies;
        const targetDeals = m.metrics.dealsCreated ?? currentDeals;
        const targetWonCount = m.metrics.closedWonCount ?? currentWonCount;
        const targetWonValue = m.metrics.closedWonValue ?? currentWonValue;
        const targetActivities = m.metrics.activitiesCreated ?? currentActivities;

        return {
          month: m.month,
          current: {
            contactsCreated: currentContacts,
            companiesCreated: currentCompanies,
            dealsCreated: currentDeals,
            closedWonCount: currentWonCount,
            closedWonValue: currentWonValue,
            activitiesCreated: currentActivities,
          },
          target: {
            contactsCreated: targetContacts,
            companiesCreated: targetCompanies,
            dealsCreated: targetDeals,
            closedWonCount: targetWonCount,
            closedWonValue: targetWonValue,
            activitiesCreated: targetActivities,
          },
          deltas: {
            contactsCreated: { delta: targetContacts - currentContacts, canApply: true },
            companiesCreated: { delta: targetCompanies - currentCompanies, canApply: true },
            dealsCreated: { delta: targetDeals - currentDeals, canApply: true },
            closedWonCount: { delta: targetWonCount - currentWonCount, canApply: true },
            closedWonValue: { delta: targetWonValue - currentWonValue, canApply: true },
            activitiesCreated: { delta: targetActivities - currentActivities, canApply: true },
          },
        };
      });

      // Validate business rules for metrics-only mode
      const validationErrors: string[] = [];
      for (const d of metricsOnlyDeltas) {
        // closedWonCount cannot exceed dealsCreated (target values)
        if (d.target.closedWonCount > d.target.dealsCreated) {
          validationErrors.push(
            `${d.month}: closedWonCount (${d.target.closedWonCount}) cannot exceed dealsCreated (${d.target.dealsCreated})`
          );
        }
        // closedWonValue requires closedWonCount > 0
        if (d.target.closedWonValue > 0 && d.target.closedWonCount === 0) {
          validationErrors.push(
            `${d.month}: closedWonValue requires closedWonCount > 0`
          );
        }
      }

      if (validationErrors.length > 0) {
        return successResponse({
          valid: false,
          errors: validationErrors,
          warnings: [],
          preview: null,
          currentKpis,
        });
      }

      // Filter to only months with actual changes
      const monthsWithChanges = metricsOnlyDeltas.filter(d =>
        d.deltas.contactsCreated.delta !== 0 ||
        d.deltas.companiesCreated.delta !== 0 ||
        d.deltas.dealsCreated.delta !== 0 ||
        d.deltas.closedWonCount.delta !== 0 ||
        d.deltas.closedWonValue.delta !== 0 ||
        d.deltas.activitiesCreated.delta !== 0
      );

      const preview = {
        months: monthsWithChanges,
        totalRecordsToCreate: 0, // No records created in metrics-only mode
        estimatedDurationSeconds: 1, // Nearly instant
        warnings: ['Metrics-only mode: Changes are applied as report adjustments without creating actual records.'],
      };

      return successResponse({
        valid: true,
        errors: [],
        warnings: preview.warnings,
        preview,
        currentKpis,
      });
    }

    // Standard validation for additive/reconcile modes
    const validation = await validatePatchPlan(tenantId, plan, currentKpis);

    if (!validation.valid) {
      return successResponse({
        valid: false,
        errors: validation.errors,
        warnings: validation.warnings,
        preview: null,
        currentKpis,
      });
    }

    // Compute deltas
    const { deltas, blockers } = computeDeltas(plan, currentKpis);

    if (blockers.length > 0) {
      return successResponse({
        valid: false,
        errors: blockers,
        warnings: validation.warnings,
        preview: null,
        currentKpis,
      });
    }

    // Generate preview
    const internalPreview = generatePreview(plan, currentKpis, deltas);

    // Add validation warnings to preview
    internalPreview.warnings.push(...validation.warnings);

    // Compute totals for UI
    const totalRecordsToCreate =
      internalPreview.estimatedRecords.contacts +
      internalPreview.estimatedRecords.companies +
      internalPreview.estimatedRecords.deals +
      internalPreview.estimatedRecords.activities;

    // Estimate duration: ~100 records/second + 2 seconds per month overhead
    const estimatedDurationSeconds = Math.max(10, Math.ceil(totalRecordsToCreate / 100) + deltas.length * 2);

    // Transform preview for UI
    const preview = {
      months: deltas.map(d => ({
        month: d.month,
        current: currentKpis.find(k => k.month === d.month)?.metrics || {},
        target: d.metrics,
        deltas: Object.fromEntries(
          Object.entries(d.metrics).map(([key, value]) => [
            key,
            { delta: value ?? 0, canApply: true }
          ])
        ),
      })),
      totalRecordsToCreate,
      estimatedDurationSeconds,
      warnings: internalPreview.warnings,
    };

    return successResponse({
      valid: true,
      errors: [],
      warnings: preview.warnings,
      preview,
      currentKpis,
    });
  } catch (error) {
    console.error('Validate patch error:', error);
    return internalError();
  }
}
