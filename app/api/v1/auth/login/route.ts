import { NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { loginSchema } from '@/validations/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { successResponse, validationError, unauthorizedError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

export async function POST(request: NextRequest) {
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

    if (!user) {
      return unauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
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
        id: user.tenant.id,
        name: user.tenant.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return internalError();
  }
}
