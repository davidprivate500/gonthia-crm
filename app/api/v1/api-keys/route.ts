import { NextRequest } from 'next/server';
import { db, apiKeys } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth/middleware';
import { createApiKeySchema, apiKeyQuerySchema } from '@/validations/api-key';
import { generateApiKey, hashApiKey } from '@/lib/auth/password';
import { canManageApiKeys } from '@/lib/auth/session';
import { successResponse, validationError, forbiddenError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, isNull, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    if (!canManageApiKeys(auth.role)) {
      return forbiddenError('You do not have permission to manage API keys');
    }

    const { searchParams } = new URL(request.url);
    const query = apiKeyQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, includeRevoked } = query;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(apiKeys.tenantId, auth.tenantId)];

    if (!includeRevoked) {
      conditions.push(isNull(apiKeys.revokedAt));
    }

    const [keyList, totalResult] = await Promise.all([
      db.query.apiKeys.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          name: true,
          keyPrefix: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
        with: {
          createdBy: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        limit: pageSize,
        offset,
        orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
      }),
      db.select({ count: count() })
        .from(apiKeys)
        .where(and(...conditions)),
    ]);

    return paginatedResponse(keyList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List API keys error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTenantAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    if (!canManageApiKeys(auth.role)) {
      return forbiddenError('You do not have permission to manage API keys');
    }

    const body = await request.json();
    const result = createApiKeySchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Generate API key
    const { key, prefix } = generateApiKey();
    const keyHash = hashApiKey(key);

    const [apiKey] = await db.insert(apiKeys).values({
      name: result.data.name,
      keyHash,
      keyPrefix: prefix,
      tenantId: auth.tenantId,
      createdById: auth.userId,
      expiresAt: result.data.expiresAt || null,
    }).returning({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    });

    // Return the full key only once (on creation)
    return successResponse({
      apiKey: {
        ...apiKey,
        key, // Full key - only shown once!
      },
      warning: 'Save this API key now. You won\'t be able to see it again.',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return internalError();
  }
}
