import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { loginSchema } from '@/validations/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, createSessionCookie, getSessionCookieHeader } from '@/lib/auth/session';
import { validationError, unauthorizedError, safeInternalError, formatZodErrors } from '@/lib/api/response';
import { rateLimit } from '@/lib/ratelimit';
import { logAuthEvent, logAuthSuccess } from '@/lib/audit/logger';
import { eq, and, isNull } from 'drizzle-orm';

// Helper to get client info for audit logging
function getClientInfo(request: NextRequest) {
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

export async function POST(request: NextRequest) {
  // BUG-002 FIX: Rate limiting on login endpoint
  const rateLimitResponse = rateLimit(request, 'login');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { email, password } = result.data;

    // Find user with tenant info
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.email, email.toLowerCase()),
        isNull(users.deletedAt)
      ),
      with: {
        tenant: true,
      },
    });

    const clientInfo = getClientInfo(request);

    if (!user) {
      // BUG-009 FIX: Log failed login attempt (user not found)
      logAuthEvent({
        action: 'login_failed',
        entityType: 'user',
        metadata: {
          email,
          ...clientInfo,
          reason: 'user_not_found',
        },
      });
      return unauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      // BUG-009 FIX: Log failed login attempt (wrong password)
      logAuthEvent({
        action: 'login_failed',
        entityType: 'user',
        metadata: {
          email,
          ...clientInfo,
          reason: 'invalid_password',
        },
      });
      return unauthorizedError('Invalid email or password');
    }

    // Create session data
    const sessionData = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      isMasterAdmin: user.isMasterAdmin,
    };

    // Create session using iron-session (sets cookie via next/headers)
    await createSession(sessionData);

    // Also manually create cookie header as a workaround for Next.js 15+ issues
    const sealedCookie = await createSessionCookie(sessionData);
    const cookieHeader = getSessionCookieHeader(sealedCookie);

    // BUG-009 FIX: Log successful login
    // For master admins, we don't have a tenantId
    if (user.tenantId) {
      logAuthSuccess(user.tenantId, user.id, 'login_success', clientInfo);
    }

    // Prepare response data
    const responseData = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isMasterAdmin: user.isMasterAdmin ?? false,
      },
      organization: user.isMasterAdmin
        ? null
        : user.tenant
          ? { id: user.tenant.id, name: user.tenant.name }
          : null,
    };

    // Return response with explicit Set-Cookie header
    const response = NextResponse.json({ data: responseData });
    response.headers.set('Set-Cookie', cookieHeader);
    return response;
  } catch (error) {
    return safeInternalError(error, 'Login');
  }
}
