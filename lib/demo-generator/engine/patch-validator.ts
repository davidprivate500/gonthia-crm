/**
 * Patch Validator - Validates patch plans before execution
 *
 * Validates:
 * - Tenant is demo-generated
 * - Month range is valid (not future, not before creation)
 * - Logical constraints (closedWonCount <= dealsCreated, etc.)
 * - ADDITIVE mode constraints (no negative deltas)
 */

import { db, demoTenantMetadata } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type {
  PatchPlan,
  PatchMonthTarget,
  PatchMetrics,
  MonthlyKpiSnapshot,
  PatchPreview,
  PatchValidationResult,
} from '../types';

interface TenantValidation {
  valid: boolean;
  error?: string;
  startDate?: Date;
}

/**
 * Validate that a tenant exists and is demo-generated
 */
export async function validateDemoTenant(tenantId: string): Promise<TenantValidation> {
  const metadata = await db.query.demoTenantMetadata.findFirst({
    where: eq(demoTenantMetadata.tenantId, tenantId),
  });

  if (!metadata) {
    return {
      valid: false,
      error: 'Tenant is not a demo-generated tenant. Only demo tenants can be patched.',
    };
  }

  if (!metadata.isDemoGenerated) {
    return {
      valid: false,
      error: 'Tenant is marked as non-demo. Cannot patch.',
    };
  }

  return {
    valid: true,
    startDate: metadata.startDate,
  };
}

/**
 * Validate month format (YYYY-MM)
 */
function isValidMonthFormat(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/**
 * Check if a month is in the future
 */
function isMonthInFuture(month: string): boolean {
  const [year, monthNum] = month.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return year > currentYear || (year === currentYear && monthNum > currentMonth);
}

/**
 * Check if a month is before a given date
 */
function isMonthBeforeDate(month: string, date: Date): boolean {
  const [year, monthNum] = month.split('-').map(Number);
  const dateYear = date.getFullYear();
  const dateMonth = date.getMonth() + 1;

  return year < dateYear || (year === dateYear && monthNum < dateMonth);
}

/**
 * Validate a patch plan
 */
export async function validatePatchPlan(
  tenantId: string,
  plan: PatchPlan,
  currentKpis: MonthlyKpiSnapshot[]
): Promise<PatchValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate tenant
  const tenantValidation = await validateDemoTenant(tenantId);
  if (!tenantValidation.valid) {
    return {
      valid: false,
      errors: [tenantValidation.error!],
      warnings: [],
    };
  }

  // 2. Validate months
  if (plan.months.length === 0) {
    errors.push('At least one month must be specified in the patch plan.');
  }

  if (plan.months.length > 24) {
    errors.push('Patch plan cannot span more than 24 months.');
  }

  // Check for duplicate months
  const monthSet = new Set<string>();
  for (const monthTarget of plan.months) {
    if (monthSet.has(monthTarget.month)) {
      errors.push(`Duplicate month in plan: ${monthTarget.month}`);
    }
    monthSet.add(monthTarget.month);
  }

  // Sort months for chronological check
  const sortedMonths = [...plan.months].sort((a, b) => a.month.localeCompare(b.month));

  for (const monthTarget of plan.months) {
    // Validate month format
    if (!isValidMonthFormat(monthTarget.month)) {
      errors.push(`Invalid month format: ${monthTarget.month}. Expected YYYY-MM.`);
      continue;
    }

    // Check if month is in future
    if (isMonthInFuture(monthTarget.month)) {
      errors.push(`Month ${monthTarget.month} is in the future. Cannot patch future months.`);
    }

    // Check if month is before tenant creation
    if (tenantValidation.startDate && isMonthBeforeDate(monthTarget.month, tenantValidation.startDate)) {
      errors.push(
        `Month ${monthTarget.month} is before tenant creation date. ` +
        `Tenant was created in ${tenantValidation.startDate.toISOString().slice(0, 7)}.`
      );
    }

    // Validate logical constraints
    const metrics = monthTarget.metrics;

    // closedWonCount cannot exceed dealsCreated
    if (
      metrics.closedWonCount !== undefined &&
      metrics.dealsCreated !== undefined &&
      metrics.closedWonCount > metrics.dealsCreated
    ) {
      errors.push(
        `${monthTarget.month}: closedWonCount (${metrics.closedWonCount}) ` +
        `cannot exceed dealsCreated (${metrics.dealsCreated}).`
      );
    }

    // leadsCreated cannot exceed contactsCreated
    if (
      metrics.leadsCreated !== undefined &&
      metrics.contactsCreated !== undefined &&
      metrics.leadsCreated > metrics.contactsCreated
    ) {
      errors.push(
        `${monthTarget.month}: leadsCreated (${metrics.leadsCreated}) ` +
        `cannot exceed contactsCreated (${metrics.contactsCreated}).`
      );
    }

    // closedWonValue requires closedWonCount > 0
    if (metrics.closedWonValue !== undefined && metrics.closedWonValue > 0) {
      if (metrics.closedWonCount === undefined || metrics.closedWonCount === 0) {
        errors.push(
          `${monthTarget.month}: closedWonValue (${metrics.closedWonValue}) ` +
          `requires closedWonCount > 0.`
        );
      }
    }

    // ADDITIVE mode: no negative values allowed
    if (plan.mode === 'additive') {
      for (const [key, value] of Object.entries(metrics)) {
        if (value !== undefined && value < 0) {
          errors.push(
            `${monthTarget.month}: ${key} cannot be negative (${value}) in ADDITIVE mode.`
          );
        }
      }
    }

    // TARGETS mode: compute deltas and check for negative
    if (plan.planType === 'targets' && plan.mode === 'additive') {
      const currentKpi = currentKpis.find(k => k.month === monthTarget.month);
      if (currentKpi) {
        for (const [key, targetValue] of Object.entries(metrics)) {
          if (targetValue === undefined) continue;

          const currentValue = currentKpi.metrics[key as keyof PatchMetrics] ?? 0;
          const delta = targetValue - currentValue;

          if (delta < 0) {
            errors.push(
              `${monthTarget.month}: Cannot reduce ${key} from ${currentValue} to ${targetValue} ` +
              `in ADDITIVE mode. Use RECONCILE mode or increase target.`
            );
          }
        }
      }
    }
  }

  // Growth rate warnings
  for (let i = 1; i < sortedMonths.length; i++) {
    const prev = sortedMonths[i - 1];
    const curr = sortedMonths[i];

    for (const metric of ['contactsCreated', 'dealsCreated'] as const) {
      const prevValue = prev.metrics[metric] ?? 0;
      const currValue = curr.metrics[metric] ?? 0;

      if (prevValue > 0 && currValue > 0) {
        const growthRate = ((currValue - prevValue) / prevValue) * 100;
        if (growthRate > 200) {
          warnings.push(
            `${curr.month}: ${metric} growth rate (${growthRate.toFixed(0)}%) ` +
            `is unusually high compared to ${prev.month}.`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Compute deltas from targets or use provided deltas
 */
export function computeDeltas(
  plan: PatchPlan,
  currentKpis: MonthlyKpiSnapshot[]
): { deltas: PatchMonthTarget[]; blockers: string[] } {
  const deltas: PatchMonthTarget[] = [];
  const blockers: string[] = [];

  for (const monthTarget of plan.months) {
    const currentKpi = currentKpis.find(k => k.month === monthTarget.month);
    const currentMetrics = currentKpi?.metrics ?? {
      leadsCreated: 0,
      contactsCreated: 0,
      companiesCreated: 0,
      dealsCreated: 0,
      closedWonCount: 0,
      closedWonValue: 0,
      pipelineAddedValue: 0,
      activitiesCreated: 0,
    };

    const monthDeltas: PatchMetrics = {};

    for (const [key, value] of Object.entries(monthTarget.metrics)) {
      if (value === undefined) continue;

      const metric = key as keyof PatchMetrics;
      const currentValue = currentMetrics[metric] ?? 0;

      if (plan.planType === 'targets') {
        // Compute delta needed to reach target
        const delta = value - currentValue;

        if (plan.mode === 'additive' && delta < 0) {
          blockers.push(
            `${monthTarget.month}: Cannot reduce ${metric} from ${currentValue} to ${value} in ADDITIVE mode.`
          );
          monthDeltas[metric] = 0; // Set to 0, blocker will prevent execution
        } else if (plan.mode === 'reconcile') {
          // Reconcile mode: allow negative deltas (deletions)
          monthDeltas[metric] = delta;
        } else {
          // Additive mode: only positive deltas
          monthDeltas[metric] = Math.max(0, delta);
        }
      } else {
        // DELTAS mode - use provided value directly
        if (plan.mode === 'additive' && value < 0) {
          blockers.push(
            `${monthTarget.month}: Negative delta (${value}) for ${metric} not allowed in ADDITIVE mode.`
          );
          monthDeltas[metric] = 0;
        } else {
          monthDeltas[metric] = value;
        }
      }
    }

    deltas.push({
      month: monthTarget.month,
      metrics: monthDeltas,
    });
  }

  return { deltas, blockers };
}

/**
 * Generate a preview of what the patch will do
 */
export function generatePreview(
  plan: PatchPlan,
  currentKpis: MonthlyKpiSnapshot[],
  deltas: PatchMonthTarget[]
): PatchPreview {
  const warnings: string[] = [];
  const blockers: string[] = [];

  // Estimate records to be created (positive deltas) and deleted (negative deltas)
  let createContacts = 0;
  let createCompanies = 0;
  let createDeals = 0;
  let createActivities = 0;
  let deleteContacts = 0;
  let deleteCompanies = 0;
  let deleteDeals = 0;
  let deleteActivities = 0;

  for (const delta of deltas) {
    const contacts = delta.metrics.contactsCreated ?? 0;
    const companies = delta.metrics.companiesCreated ?? 0;
    const deals = delta.metrics.dealsCreated ?? 0;

    if (contacts > 0) createContacts += contacts;
    else deleteContacts += Math.abs(contacts);

    if (companies > 0) createCompanies += companies;
    else deleteCompanies += Math.abs(companies);

    if (deals > 0) createDeals += deals;
    else deleteDeals += Math.abs(deals);

    // Estimate activities: ~2 per contact
    if (contacts > 0) createActivities += Math.round(contacts * 2);
    else deleteActivities += Math.round(Math.abs(contacts) * 2);
  }

  // Check for zero-delta patches
  const totalCreate = createContacts + createCompanies + createDeals + createActivities;
  const totalDelete = deleteContacts + deleteCompanies + deleteDeals + deleteActivities;

  if (totalCreate === 0 && totalDelete === 0) {
    warnings.push('This patch will not create or delete any records. All metrics are already at target levels.');
  }

  // Check for large patches
  if (totalCreate > 10000) {
    warnings.push(`Large patch: ${totalCreate} records will be created. This may take several minutes.`);
  }

  // Warn about reconcile deletions
  if (totalDelete > 0) {
    warnings.push(`Reconcile mode: ${totalDelete} demo-generated records will be deleted.`);
  }

  return {
    computedDeltas: deltas,
    estimatedRecords: {
      contacts: createContacts,
      companies: createCompanies,
      deals: createDeals,
      activities: createActivities,
    },
    warnings,
    blockers,
    feasible: blockers.length === 0,
  };
}
