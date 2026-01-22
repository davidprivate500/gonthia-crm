import { NextRequest } from 'next/server';
import { db, tenants, users } from '@/lib/db';
import { registerSchema } from '@/validations/auth';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { successResponse, validationError, conflictError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { email, password, organizationName, firstName, lastName } = result.data;

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return conflictError('An account with this email already exists');
    }

    // Create tenant and user in a transaction-like manner
    // Note: Neon HTTP driver doesn't support true transactions, so we do best-effort
    const passwordHash = await hashPassword(password);

    // Create tenant
    const [tenant] = await db.insert(tenants).values({
      name: organizationName,
    }).returning();

    // Create user as owner
    const [user] = await db.insert(users).values({
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

    // Create session
    await createSession({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    });

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: tenant.id,
        name: tenant.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return internalError();
  }
}
