import { z } from 'zod';

export const importEntityTypeSchema = z.enum(['contacts', 'companies', 'deals']);

export const createImportJobSchema = z.object({
  entityType: importEntityTypeSchema,
  fileName: z.string().min(1).max(255),
  mappings: z.record(z.string(), z.string()).optional(), // CSV column -> DB field
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
});

export const importJobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  entityType: importEntityTypeSchema.optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

export type ImportEntityType = z.infer<typeof importEntityTypeSchema>;
export type CreateImportJobInput = z.infer<typeof createImportJobSchema>;
export type ImportJobQuery = z.infer<typeof importJobQuerySchema>;
