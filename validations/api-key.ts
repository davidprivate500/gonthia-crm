import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100),
  expiresAt: z.coerce.date().optional().nullable(),
});

export const apiKeyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  includeRevoked: z.coerce.boolean().default(false),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type ApiKeyQuery = z.infer<typeof apiKeyQuerySchema>;
