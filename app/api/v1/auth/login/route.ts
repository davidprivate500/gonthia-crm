import { NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { loginSchema } from '@/validations/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { successResponse, validationError, unauthorizedError, safeInternalError, formatZodErrors } from '@/lib/api/response';
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

    // Create session
    await createSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      isMasterAdmin: user.isMasterAdmin,
    });

    // BUG-009 FIX: Log successful login
    // For master admins, we don't have a tenantId
    if (user.tenantId) {
      logAuthSuccess(user.tenantId, user.id, 'login_success', clientInfo);
    }

    // Handle master admin response (no organization)
    if (user.isMasterAdmin) {
      return successResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isMasterAdmin: true,
        },
        organization: null, // Master admins have no organization
      });
    }

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isMasterAdmin: false,
      },
      organization: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
      } : null,
    });
  } catch (error) {
    // BUG-027 FIX: Sanitized error response
    return safeInternalError(error, 'auth.login');
  }
}
