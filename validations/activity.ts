import { z } from 'zod';

export const activityTypeSchema = z.enum(['note', 'call', 'email', 'meeting', 'task']);

export const createActivitySchema = z.object({
  type: activityTypeSchema,
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().max(10000).optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
});

export const updateActivitySchema = createActivitySchema.partial();

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['subject', 'type', 'scheduledAt', 'completedAt', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  type: activityTypeSchema.optional(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  scheduledFrom: z.coerce.date().optional(),
  scheduledTo: z.coerce.date().optional(),
  isCompleted: z.coerce.boolean().optional(),
});

export type ActivityType = z.infer<typeof activityTypeSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
