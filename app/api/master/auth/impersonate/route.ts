import { NextRequest } from 'next/server';
import { db, users, tenants, auditLogs } from '@/lib/db';
import { requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { createSessionCookie, getSessionCookieHeader, type SessionData } from '@/lib/auth/session';
import { successResponse, badRequestError, notFoundError, internalError } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

const impersonateSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
});

/**
 * POST /api/master/auth/impersonate
 * Start impersonating a tenant as the tenant owner
 * Only accessible by master admins
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const parsed = impersonateSchema.safeParse(body);

    if (!parsed.success) {
      return badRequestError('Invalid tenant ID');
    }

    const { tenantId } = parsed.data;

    // Find the tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return notFoundError('Tenant not found');
    }

    // Find the tenant owner
    const tenantOwner = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, tenantId),
        eq(users.role, 'owner'),
        isNull(users.deletedAt)
      ),
    });

    if (!tenantOwner) {
      return notFoundError('Tenant owner not found');
    }

    // Get the original master admin's info for audit purposes
    const masterAdmin = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });

    // Create impersonation session data
    const impersonationSession: SessionData = {
      userId: tenantOwner.id,
      tenantId: tenantId,
      role: tenantOwner.role,
      email: tenantOwner.email,
      firstName: tenantOwner.firstName || undefined,
      lastName: tenantOwner.lastName || undefined,
      isMasterAdmin: false, // During impersonation, act as regular user

      // Impersonation tracking
      isImpersonating: true,
      impersonatedTenantId: tenantId,
      impersonatedTenantName: tenant.name,
      originalMasterAdminId: auth.userId,
      originalMasterAdminEmail: masterAdmin?.email || auth.email,
      impersonationStartedAt: new Date().toISOString(),
    };

    // Create the session cookie
    const sealedSession = await createSessionCookie(impersonationSession);
    const cookieHeader = getSessionCookieHeader(sealedSession);

    // Log the impersonation start event
    await db.insert(auditLogs).values({
      tenantId: tenantId,
      userId: tenantOwner.id,
      action: 'impersonation_start',
      entityType: 'user',
      entityId: tenantOwner.id,
      metadata: {
        masterAdminId: auth.userId,
        masterAdminEmail: masterAdmin?.email || auth.email,
        tenantId: tenantId,
        tenantName: tenant.name,
        impersonatedUserId: tenantOwner.id,
        impersonatedUserEmail: tenantOwner.email,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Return success with Set-Cookie header
    const response = successResponse({
      success: true,
      message: `Now viewing as ${tenant.name}`,
      redirectUrl: '/dashboard',
      tenantName: tenant.name,
    });

    // Add the session cookie to the response
    response.headers.set('Set-Cookie', cookieHeader);

    return response;
  } catch (error) {
    console.error('Impersonate tenant error:', error);
    return internalError();
  }
}
