import { z } from 'zod';

export const globalSearchSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
  types: z.string().optional(), // comma-separated: contacts,companies,deals
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export type GlobalSearchInput = z.infer<typeof globalSearchSchema>;
