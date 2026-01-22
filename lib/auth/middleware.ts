import { NextRequest } from 'next/server';
import { getSession, UserRole } from './session';
import { unauthorizedError, forbiddenError } from '@/lib/api/response';
import { db, apiKeys } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';
import { hashApiKey } from './password';
import { verifyCsrf } from '@/lib/csrf';

export interface AuthContext {
  userId: string;
  tenantId: string | null; // null for master admins
  role: UserRole;
  email: string;
  isApiKey?: boolean;
  isMasterAdmin?: boolean;
}

// Master admin auth context (tenantId is always null)
export interface MasterAdminAuthContext extends AuthContext {
  tenantId: null;
  isMasterAdmin: true;
}

// Tenant auth context (tenantId is required)
export interface TenantAuthContext extends AuthContext {
  tenantId: string;
  isMasterAdmin?: false;
}

// Verify API key and return auth context
async function verifyApiKey(apiKey: string): Promise<AuthContext | null> {
  const keyHash = hashApiKey(apiKey);

  // BUG-004 & BUG-006 FIX: Include creator's info to get their role and check if deleted
  const result = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt)
    ),
    with: {
      createdBy: {
        columns: {
          id: true,
          email: true,
          role: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!result) {
    return null;
  }

  // BUG-006 FIX: Check if the user who created the API key is deleted
  if (!result.createdBy || result.createdBy.deletedAt) {
    return null;
  }

  // Check if API key is expired
  if (result.expiresAt && result.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, result.id))
    .catch(err => console.error('Failed to update API key last used:', err));

  // BUG-004 FIX: Return the creator's actual role instead of hardcoded 'admin'
  return {
    userId: result.createdById,
    tenantId: result.tenantId,
    role: result.createdBy.role,
    email: result.createdBy.email,
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
    isMasterAdmin: session.isMasterAdmin,
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

// BUG-007 FIX: CSRF-protected auth for state-changing operations
export async function requireAuthWithCsrf(request: NextRequest): Promise<AuthContext | Response> {
  // Check CSRF first for non-API-key requests
  const csrfError = verifyCsrf(request);
  if (csrfError) {
    return csrfError;
  }

  return requireAuth(request);
}

// BUG-007 FIX: CSRF-protected write access
export async function requireWriteAccessWithCsrf(request: NextRequest): Promise<AuthContext | Response> {
  const csrfError = verifyCsrf(request);
  if (csrfError) {
    return csrfError;
  }

  return requireWriteAccess(request);
}

// BUG-007 FIX: CSRF-protected delete access
export async function requireDeleteAccessWithCsrf(request: NextRequest): Promise<AuthContext | Response> {
  const csrfError = verifyCsrf(request);
  if (csrfError) {
    return csrfError;
  }

  return requireDeleteAccess(request);
}

// BUG-007 FIX: CSRF-protected role check
export async function requireRoleWithCsrf(
  minRole: UserRole,
  request: NextRequest
): Promise<AuthContext | Response> {
  const csrfError = verifyCsrf(request);
  if (csrfError) {
    return csrfError;
  }

  return requireRole(minRole, request);
}

// ============================================================================
// MASTER ADMIN MIDDLEWARE
// ============================================================================

/**
 * Require authenticated master admin (platform-level admin)
 * Master admins have cross-tenant access and no tenantId
 */
export async function requireMasterAdmin(request?: NextRequest): Promise<MasterAdminAuthContext | Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) {
    return result;
  }

  if (!result.isMasterAdmin) {
    return forbiddenError('Master admin access required');
  }

  return result as MasterAdminAuthContext;
}

/**
 * CSRF-protected master admin authentication
 */
export async function requireMasterAdminWithCsrf(request: NextRequest): Promise<MasterAdminAuthContext | Response> {
  const csrfError = verifyCsrf(request);
  if (csrfError) {
    return csrfError;
  }

  return requireMasterAdmin(request);
}

/**
 * Require authenticated tenant user (not master admin)
 * Ensures tenantId is present
 */
export async function requireTenantAuth(request?: NextRequest): Promise<TenantAuthContext | Response> {
  const result = await requireAuth(request);
  if (result instanceof Response) {
    return result;
  }

  // Master admins don't have tenant context
  if (result.isMasterAdmin || !result.tenantId) {
    return forbiddenError('Tenant access required');
  }

  return result as TenantAuthContext;
}

/**
 * CSRF-protected tenant authentication
 */
export async function requireTenantAuthWithCsrf(request: NextRequest): Promise<TenantAuthContext | Response> {
  const csrfError = verifyCsrf(request);
  if (csrfError) {
    return csrfError;
  }

  return requireTenantAuth(request);
}
