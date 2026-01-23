import { z } from 'zod';

// Patch metrics schema - all fields optional since partial patches are allowed
export const patchMetricsSchema = z.object({
  leadsCreated: z.number().int().min(0).optional(),
  contactsCreated: z.number().int().min(0).optional(),
  companiesCreated: z.number().int().min(0).optional(),
  dealsCreated: z.number().int().min(0).optional(),
  closedWonCount: z.number().int().min(0).optional(),
  closedWonValue: z.number().min(0).optional(),
  pipelineAddedValue: z.number().min(0).optional(),
  activitiesCreated: z.number().int().min(0).optional(),
});

// Single month target in patch plan
export const patchMonthTargetSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'),
  metrics: patchMetricsSchema,
});

// Tolerance configuration
export const toleranceConfigSchema = z.object({
  countTolerance: z.number().min(0).max(100).default(0),
  valueTolerance: z.number().min(0).max(1).default(0.005),
});

// Validate patch plan request
export const validatePatchSchema = z.object({
  mode: z.enum(['additive', 'reconcile']).default('additive'),
  planType: z.enum(['targets', 'deltas']).default('deltas'),
  months: z.array(patchMonthTargetSchema).min(1, 'At least one month required').max(24, 'Maximum 24 months allowed'),
  tolerances: toleranceConfigSchema.optional(),
}).superRefine((plan, ctx) => {
  // Validate months are unique
  const months = plan.months.map(m => m.month);
  const uniqueMonths = new Set(months);
  if (uniqueMonths.size !== months.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duplicate months are not allowed in the patch plan',
      path: ['months'],
    });
  }

  // Validate logical constraints per month
  for (let i = 0; i < plan.months.length; i++) {
    const month = plan.months[i];
    const { metrics } = month;

    // closedWonCount cannot exceed dealsCreated
    if (
      metrics.closedWonCount !== undefined &&
      metrics.dealsCreated !== undefined &&
      metrics.closedWonCount > metrics.dealsCreated
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${month.month}: closedWonCount (${metrics.closedWonCount}) cannot exceed dealsCreated (${metrics.dealsCreated})`,
        path: ['months', i, 'metrics'],
      });
    }

    // leadsCreated cannot exceed contactsCreated
    if (
      metrics.leadsCreated !== undefined &&
      metrics.contactsCreated !== undefined &&
      metrics.leadsCreated > metrics.contactsCreated
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${month.month}: leadsCreated (${metrics.leadsCreated}) cannot exceed contactsCreated (${metrics.contactsCreated})`,
        path: ['months', i, 'metrics'],
      });
    }

    // closedWonValue requires closedWonCount
    if (
      metrics.closedWonValue !== undefined &&
      metrics.closedWonValue > 0 &&
      (metrics.closedWonCount === undefined || metrics.closedWonCount === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${month.month}: closedWonValue requires closedWonCount > 0`,
        path: ['months', i, 'metrics'],
      });
    }
  }
});

// Apply patch plan request (includes optional seed)
export const applyPatchSchema = validatePatchSchema.extend({
  seed: z.string().max(64).optional(),
});

// KPI query params
export const kpiQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'from must be in YYYY-MM format'),
  to: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'to must be in YYYY-MM format'),
}).refine(
  (data) => data.from <= data.to,
  { message: 'from date must be before or equal to to date', path: ['from'] }
);

// Export types
export type ValidatePatchInput = z.infer<typeof validatePatchSchema>;
export type ApplyPatchInput = z.infer<typeof applyPatchSchema>;
export type KpiQueryInput = z.infer<typeof kpiQuerySchema>;
export type PatchMetricsInput = z.infer<typeof patchMetricsSchema>;
export type PatchMonthTargetInput = z.infer<typeof patchMonthTargetSchema>;
