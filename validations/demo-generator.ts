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

// Types from schemas
export type CreateDemoInput = z.infer<typeof createDemoSchema>;
export type PreviewInput = z.infer<typeof previewSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
