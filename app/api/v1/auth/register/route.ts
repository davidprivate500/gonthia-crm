import { NextRequest, NextResponse } from 'next/server';
import { db, tenants, users, pipelineStages } from '@/lib/db';
import { registerSchema } from '@/validations/auth';
import { hashPassword } from '@/lib/auth/password';
import { createSession, createSessionCookie, getSessionCookieHeader } from '@/lib/auth/session';
import { validationError, conflictError, safeInternalError, formatZodErrors } from '@/lib/api/response';
import { rateLimit } from '@/lib/ratelimit';
import { eq } from 'drizzle-orm';

// Default pipeline stages for new tenants
const DEFAULT_PIPELINE_STAGES = [
  { name: 'Lead', color: '#6366f1', position: 0 },
  { name: 'Qualified', color: '#8b5cf6', position: 1 },
  { name: 'Proposal', color: '#d946ef', position: 2 },
  { name: 'Negotiation', color: '#f97316', position: 3 },
  { name: 'Closed Won', color: '#22c55e', position: 4 },
];

export async function POST(request: NextRequest) {
  // BUG-002 FIX: Rate limiting on registration endpoint
  const rateLimitResponse = rateLimit(request, 'register');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { email, password, organizationName, firstName, lastName } = result.data;

    // Check if email already exists (outside transaction for early fail)
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return conflictError('An account with this email already exists');
    }

    // Hash password before transaction
    const passwordHash = await hashPassword(password);

    // BUG-001 FIX: Wrap tenant, user, and pipeline creation in transaction
    const registrationResult = await db.transaction(async (tx) => {
      // Create tenant
      const [tenant] = await tx.insert(tenants).values({
        name: organizationName,
      }).returning();

      // Create user as owner
      const [user] = await tx.insert(users).values({
        email: email.toLowerCase(),
        passwordHash,
        tenantId: tenant.id,
        role: 'owner',
        firstName: firstName || null,
        lastName: lastName || null,
      }).returning({
        id: users.id,
        email: users.email,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
      });

      // Create default pipeline stages
      await tx.insert(pipelineStages).values(
        DEFAULT_PIPELINE_STAGES.map(stage => ({
          tenantId: tenant.id,
          name: stage.name,
          color: stage.color,
          position: stage.position,
        }))
      );

      return { tenant, user };
    });

    // Create session data
    const sessionData = {
      userId: registrationResult.user.id,
      tenantId: registrationResult.tenant.id,
      role: registrationResult.user.role,
      email: registrationResult.user.email,
      firstName: registrationResult.user.firstName || undefined,
      lastName: registrationResult.user.lastName || undefined,
    };

    // Create session (outside transaction - session failure shouldn't rollback data)
    await createSession(sessionData);

    // Also manually create cookie header as a workaround for Next.js 15+ issues
    const sealedCookie = await createSessionCookie(sessionData);
    const cookieHeader = getSessionCookieHeader(sealedCookie);

    // Prepare response
    const responseData = {
      user: {
        id: registrationResult.user.id,
        email: registrationResult.user.email,
        role: registrationResult.user.role,
        firstName: registrationResult.user.firstName,
        lastName: registrationResult.user.lastName,
      },
      organization: {
        id: registrationResult.tenant.id,
        name: registrationResult.tenant.name,
      },
    };

    // Return response with explicit Set-Cookie header
    const response = NextResponse.json({ data: responseData });
    response.headers.set('Set-Cookie', cookieHeader);
    return response;
  } catch (error) {
    // BUG-014 FIX: Handle unique constraint violation (TOCTOU race)
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return conflictError('An account with this email already exists');
    }

    // BUG-027 FIX: Sanitized error response
    return safeInternalError(error, 'auth.register');
  }
}
