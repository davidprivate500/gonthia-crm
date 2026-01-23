import { z } from 'zod';

// Industry enum
export const industryEnum = z.enum([
  'trading',
  'igaming',
  'saas',
  'ecommerce',
  'realestate',
  'finserv',
]);

// Growth curve enum
export const growthCurveEnum = z.enum([
  'linear',
  'exponential',
  'logistic',
  'step',
]);

// Volume targets schema
export const volumeTargetsSchema = z.object({
  leads: z.number().int().min(100).max(50000).optional(),
  contacts: z.number().int().min(50).max(20000).optional(),
  companies: z.number().int().min(20).max(5000).optional(),
  pipelineValue: z.number().min(10000).max(100000000).optional(),
  closedWonValue: z.number().min(5000).max(50000000).optional(),
  closedWonCount: z.number().int().min(10).max(5000).optional(),
});

// Growth config schema
export const growthConfigSchema = z.object({
  curve: growthCurveEnum.optional(),
  monthlyRate: z.number().min(0).max(50).optional(),
  seasonality: z.boolean().optional(),
});

// Channel mix schema
export const channelMixSchema = z.object({
  seo: z.number().min(0).max(100).optional(),
  meta: z.number().min(0).max(100).optional(),
  google: z.number().min(0).max(100).optional(),
  affiliates: z.number().min(0).max(100).optional(),
  referrals: z.number().min(0).max(100).optional(),
  direct: z.number().min(0).max(100).optional(),
});

// Realism config schema
export const realismConfigSchema = z.object({
  dropOffRate: z.number().min(0).max(50).optional(),
  whaleRatio: z.number().min(0).max(20).optional(),
  responseSlaHours: z.number().int().min(1).max(72).optional(),
});

// Create demo request schema
export const createDemoSchema = z.object({
  tenantName: z.string().min(3).max(100).optional(),
  country: z.string().length(2).regex(/^[A-Z]{2}$/, 'Must be a valid ISO country code'),
  timezone: z.string().min(1).max(50).optional(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
  industry: industryEnum,
  startDate: z.string().refine(
    (val) => {
      const date = new Date(val);
      const now = new Date();
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      return !isNaN(date.getTime()) && date <= now && date >= twoYearsAgo;
    },
    'Start date must be a valid date within the last 24 months and not in the future'
  ),
  teamSize: z.number().int().min(2).max(50).optional().default(8),
  targets: volumeTargetsSchema.optional(),
  growth: growthConfigSchema.optional(),
  channelMix: channelMixSchema.optional(),
  realism: realismConfigSchema.optional(),
  seed: z.string().max(64).optional(),
});

// Preview request schema
export const previewSchema = z.object({
  country: z.string().length(2).regex(/^[A-Z]{2}$/),
  industry: industryEnum,
  startDate: z.string().refine(
    (val) => {
      const date = new Date(val);
      const now = new Date();
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      return !isNaN(date.getTime()) && date <= now && date >= twoYearsAgo;
    },
    'Start date must be valid and within last 24 months'
  ),
  targets: volumeTargetsSchema.optional(),
  growth: growthConfigSchema.optional(),
});

// List jobs query schema
export const listJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  country: z.string().length(2).optional(),
  industry: industryEnum.optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['createdAt', 'completedAt', 'tenantName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// MONTHLY PLAN VALIDATION SCHEMAS
// ============================================================================

// Generation mode enum
export const generationModeEnum = z.enum(['growth-curve', 'monthly-plan']);

// Month format validation (YYYY-MM)
const monthFormatRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

// Monthly metric targets schema
export const monthlyMetricTargetsSchema = z.object({
  leadsCreated: z.number().int().min(0).max(10000),
  contactsCreated: z.number().int().min(0).max(10000),
  companiesCreated: z.number().int().min(0).max(5000),
  dealsCreated: z.number().int().min(0).max(5000),
  closedWonCount: z.number().int().min(0).max(5000),
  closedWonValue: z.number().min(0).max(100000000),
  pipelineAddedValue: z.number().min(0).max(100000000),
});

// Monthly target (single month) schema
export const monthlyTargetSchema = z.object({
  month: z.string().regex(monthFormatRegex, 'Month must be in YYYY-MM format'),
  targets: monthlyMetricTargetsSchema,
  overrides: z.object({
    avgDealSize: z.number().min(0).optional(),
    winRate: z.number().min(0).max(100).optional(),
    conversionRate: z.number().min(0).max(100).optional(),
  }).optional(),
});

// Tolerance config schema
export const toleranceConfigSchema = z.object({
  countTolerance: z.number().min(0).max(1).default(0), // 0 = exact
  valueTolerance: z.number().min(0).max(0.1).default(0.005), // 0.005 = ±0.5%
});

// Monthly plan metadata schema
export const monthlyPlanMetadataSchema = z.object({
  version: z.string().default('1.0'),
  createdAt: z.string().datetime().optional(),
  lastModifiedAt: z.string().datetime().optional(),
});

// Full monthly plan schema with validation
export const monthlyPlanSchema = z.object({
  months: z.array(monthlyTargetSchema)
    .min(1, 'At least one month is required')
    .max(24, 'Maximum 24 months allowed'),
  tolerances: toleranceConfigSchema.default({ countTolerance: 0, valueTolerance: 0.005 }),
  metadata: monthlyPlanMetadataSchema.optional(),
}).superRefine((plan, ctx) => {
  // Validate date range: not in future, chronological order
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let prevMonth = '';
  for (let i = 0; i < plan.months.length; i++) {
    const m = plan.months[i];

    // Check not in future
    if (m.month > currentMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Month ${m.month} is in the future`,
        path: ['months', i, 'month'],
      });
    }

    // Check chronological order
    if (prevMonth && m.month <= prevMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Months must be in chronological order (${m.month} after ${prevMonth})`,
        path: ['months', i, 'month'],
      });
    }
    prevMonth = m.month;

    // Logical constraints
    const { targets } = m;

    // Leads must be <= contacts (leads are a subset)
    if (targets.leadsCreated > targets.contactsCreated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Leads (${targets.leadsCreated}) cannot exceed contacts (${targets.contactsCreated}) - leads are a subset of contacts`,
        path: ['months', i, 'targets', 'leadsCreated'],
      });
    }

    // Closed won count must be <= deals created
    if (targets.closedWonCount > targets.dealsCreated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Closed won count (${targets.closedWonCount}) cannot exceed deals created (${targets.dealsCreated})`,
        path: ['months', i, 'targets', 'closedWonCount'],
      });
    }

    // If closedWonValue > 0, closedWonCount must be > 0
    if (targets.closedWonValue > 0 && targets.closedWonCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Closed won value is ${targets.closedWonValue} but closed won count is 0`,
        path: ['months', i, 'targets', 'closedWonValue'],
      });
    }

    // Pipeline value should generally be >= closed won value
    if (targets.pipelineAddedValue > 0 && targets.pipelineAddedValue < targets.closedWonValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Pipeline added value (${targets.pipelineAddedValue}) is less than closed won value (${targets.closedWonValue}) - this is unusual`,
        path: ['months', i, 'targets', 'pipelineAddedValue'],
      });
    }
  }
});

// Extended create demo schema supporting both modes
export const createDemoV2Schema = createDemoSchema.extend({
  mode: generationModeEnum.default('growth-curve'),
  monthlyPlan: monthlyPlanSchema.optional(),
}).superRefine((data, ctx) => {
  // If mode is monthly-plan, monthlyPlan is required
  if (data.mode === 'monthly-plan' && !data.monthlyPlan) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Monthly plan is required when mode is monthly-plan',
      path: ['monthlyPlan'],
    });
  }
});

// Validate plan endpoint schema
export const validatePlanSchema = z.object({
  country: z.string().length(2).regex(/^[A-Z]{2}$/),
  industry: industryEnum,
  monthlyPlan: monthlyPlanSchema,
});

// Types from schemas
export type CreateDemoInput = z.infer<typeof createDemoSchema>;
export type CreateDemoV2Input = z.infer<typeof createDemoV2Schema>;
export type PreviewInput = z.infer<typeof previewSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type MonthlyPlanInput = z.infer<typeof monthlyPlanSchema>;
export type ValidatePlanInput = z.infer<typeof validatePlanSchema>;
