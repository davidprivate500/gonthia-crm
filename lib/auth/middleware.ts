import { NextRequest } from 'next/server';
import { getSession, UserRole } from './session';
import { unauthorizedError, forbiddenError } from '@/lib/api/response';
import { db, apiKeys } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { hashApiKey } from './password';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  isApiKey?: boolean;
}

// Verify API key and return auth context
async function verifyApiKey(apiKey: string): Promise<AuthContext | null> {
  const keyHash = hashApiKey(apiKey);

  const result = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt)
    ),
    with: {
      // We need to get the creator's tenant info
    },
  });

  if (!result) {
    return null;
  }

  // Update last used timestamp
  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, result.id));

  // API keys have admin-level access
  return {
    userId: result.createdById,
    tenantId: result.tenantId,
    role: 'admin',
    email: 'api-key',
    isApiKey: true,
  };
}

// Main auth middleware function
export async function requireAuth(request?: NextRequest): Promise<AuthContext | Response> {
  // Check for API key in Authorization header
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('gon_')) {
        const context = await verifyApiKey(token);
        if (!context) {
          return unauthorizedError('Invalid or revoked API key');
        }
        return context;
      }
    }
  }

  // Check for session
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    email: session.email,
  };
}

// Permission-specific middleware
export async function requireRole(
  minRole: UserRole,
  request?: NextRequest
): Promise<AuthContext | Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) {
    return result;
  }

  const roleHierarchy: UserRole[] = ['readonly', 'member', 'admin', 'owner'];
  const currentLevel = roleHierarchy.indexOf(result.role);
  const requiredLevel = roleHierarchy.indexOf(minRole);

  if (currentLevel < requiredLevel) {
    return forbiddenError();
  }

  return result;
}

export async function requireOwner(request?: NextRequest): Promise<AuthContext | Response> {
  return requireRole('owner', request);
}

export async function requireAdmin(request?: NextRequest): Promise<AuthContext | Response> {
  return requireRole('admin', request);
}

export async function requireMember(request?: NextRequest): Promise<AuthContext | Response> {
  return requireRole('member', request);
}

// Check if user can perform write operations
export async function requireWriteAccess(request?: NextRequest): Promise<AuthContext | Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) {
    return result;
  }

  if (result.role === 'readonly') {
    return forbiddenError('Read-only users cannot modify data');
  }

  return result;
}

// Check if user can delete
export async function requireDeleteAccess(request?: NextRequest): Promise<AuthContext | Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) {
    return result;
  }

  if (result.role === 'readonly' || result.role === 'member') {
    return forbiddenError('You do not have permission to delete records');
  }

  return result;
}
