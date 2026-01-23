import { NextRequest } from 'next/server';
import { db, users, auditLogs } from '@/lib/db';
import { getSession, createSessionCookie, getSessionCookieHeader, type SessionData } from '@/lib/auth/session';
import { successResponse, unauthorizedError, badRequestError, internalError } from '@/lib/api/response';
import { eq } from 'drizzle-orm';
import { verifyCsrf } from '@/lib/csrf';

/**
 * POST /api/master/auth/exit-impersonation
 * Exit impersonation mode and restore master admin session
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const csrfError = verifyCsrf(request);
    if (csrfError) {
      return csrfError;
    }

    // Get current session
    const session = await getSession();

    if (!session) {
      return unauthorizedError('Not authenticated');
    }

    // Check if actually impersonating
    if (!session.isImpersonating || !session.originalMasterAdminId) {
      return badRequestError('Not currently impersonating');
    }

    // Get the original master admin
    const masterAdmin = await db.query.users.findFirst({
      where: eq(users.id, session.originalMasterAdminId),
    });

    if (!masterAdmin || !masterAdmin.isMasterAdmin) {
      return badRequestError('Original master admin not found');
    }

    // Log the impersonation end event (before switching session)
    const auditTenantId = session.impersonatedTenantId || session.tenantId;
    if (auditTenantId) {
      await db.insert(auditLogs).values({
        tenantId: auditTenantId,
        userId: session.userId,
        action: 'impersonation_end',
        entityType: 'user',
        entityId: session.userId,
        metadata: {
          masterAdminId: session.originalMasterAdminId,
          masterAdminEmail: session.originalMasterAdminEmail,
          tenantId: session.impersonatedTenantId,
          tenantName: session.impersonatedTenantName,
          impersonatedUserId: session.userId,
          duration: session.impersonationStartedAt
            ? Math.round((Date.now() - new Date(session.impersonationStartedAt).getTime()) / 1000)
            : null,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
    }

    // Create master admin session (no impersonation fields)
    const masterAdminSession: SessionData = {
      userId: masterAdmin.id,
      tenantId: null, // Master admins have no tenant
      role: masterAdmin.role,
      email: masterAdmin.email,
      firstName: masterAdmin.firstName || undefined,
      lastName: masterAdmin.lastName || undefined,
      isMasterAdmin: true,
      // Clear impersonation fields
      isImpersonating: undefined,
      impersonatedTenantId: undefined,
      impersonatedTenantName: undefined,
      originalMasterAdminId: undefined,
      originalMasterAdminEmail: undefined,
      impersonationStartedAt: undefined,
    };

    // Create the session cookie
    const sealedSession = await createSessionCookie(masterAdminSession);
    const cookieHeader = getSessionCookieHeader(sealedSession);

    // Return success with Set-Cookie header
    const response = successResponse({
      success: true,
      message: 'Exited impersonation mode',
      redirectUrl: '/master/demo-generator',
    });

    // Add the session cookie to the response
    response.headers.set('Set-Cookie', cookieHeader);

    return response;
  } catch (error) {
    console.error('Exit impersonation error:', error);
    return internalError();
  }
}
