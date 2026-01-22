import { NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { successResponse, internalError } from '@/lib/api/response';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    // Get full user info
    const user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
      columns: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    }) as { id: string; email: string; role: string; firstName: string | null; lastName: string | null; createdAt: Date; tenant: { id: string; name: string } } | undefined;

    if (!user) {
      return internalError('User not found');
    }

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
      organization: user.tenant,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return internalError();
  }
}
