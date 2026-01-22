import { z } from 'zod';

export const createDealSchema = z.object({
  title: z.string().min(1, 'Deal title is required').max(255),
  value: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).default('USD'),
  stageId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  expectedCloseDate: z.coerce.date().optional().nullable(),
  probability: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateDealSchema = createDealSchema.partial();

export const moveDealSchema = z.object({
  stageId: z.string().uuid(),
  position: z.coerce.number().int().nonnegative().optional(),
});

// BUG-013 FIX: Added max length to search to prevent abuse
export const dealQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z.enum(['title', 'value', 'expectedCloseDate', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(200).optional(),
  stageId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  closeDateFrom: z.coerce.date().optional(),
  closeDateTo: z.coerce.date().optional(),
});

export const pipelineStageSchema = z.object({
  name: z.string().min(1, 'Stage name is required').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  position: z.coerce.number().int().nonnegative(),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

export const updatePipelineStageSchema = pipelineStageSchema.partial();

export const reorderStagesSchema = z.object({
  stages: z.array(z.object({
    id: z.string().uuid(),
    position: z.coerce.number().int().nonnegative(),
  })),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type MoveDealInput = z.infer<typeof moveDealSchema>;
export type DealQuery = z.infer<typeof dealQuerySchema>;
export type PipelineStageInput = z.infer<typeof pipelineStageSchema>;
export type UpdatePipelineStageInput = z.infer<typeof updatePipelineStageSchema>;
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;
