import { NextRequest } from 'next/server';
import { db, apiKeys } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';
import { canManageApiKeys } from '@/lib/auth/session';
import { successResponse, notFoundError, forbiddenError, internalError } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ keyId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    if (!canManageApiKeys(auth.role)) {
      return forbiddenError('You do not have permission to manage API keys');
    }

    const { keyId } = await params;

    const existing = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.tenantId, auth.tenantId),
        isNull(apiKeys.revokedAt)
      ),
    });

    if (!existing) {
      return notFoundError('API key not found');
    }

    // Revoke key
    await db.update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, keyId));

    return successResponse({ message: 'API key revoked' });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return internalError();
  }
}
