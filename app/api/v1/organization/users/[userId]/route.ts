import { NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { requireAdmin, requireOwner } from '@/lib/auth/middleware';
import { updateUserRoleSchema } from '@/validations/auth';
import { successResponse, validationError, notFoundError, forbiddenError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { userId } = await params;

    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.tenantId, auth.tenantId),
        isNull(users.deletedAt)
      ),
      columns: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        inviteAcceptedAt: true,
      },
    });

    if (!user) {
      return notFoundError('User not found');
    }

    return successResponse({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return internalError();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { userId } = await params;
    const body = await request.json();
    const result = updateUserRoleSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Cannot change your own role
    if (userId === auth.userId) {
      return forbiddenError('You cannot change your own role');
    }

    // Verify user exists in same tenant
    const targetUser = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.tenantId, auth.tenantId),
        isNull(users.deletedAt)
      ),
    });

    if (!targetUser) {
      return notFoundError('User not found');
    }

    // Only owner can change to/from owner role
    if (targetUser.role === 'owner' || result.data.role === 'owner') {
      if (auth.role !== 'owner') {
        return forbiddenError('Only owners can change owner roles');
      }
    }

    const [updated] = await db.update(users)
      .set({
        role: result.data.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
      });

    return successResponse({ user: updated });
  } catch (error) {
    console.error('Update user role error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { userId } = await params;

    // Cannot delete yourself
    if (userId === auth.userId) {
      return forbiddenError('You cannot delete your own account');
    }

    // Verify user exists in same tenant
    const targetUser = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.tenantId, auth.tenantId),
        isNull(users.deletedAt)
      ),
    });

    if (!targetUser) {
      return notFoundError('User not found');
    }

    // Cannot delete owner (must transfer ownership first)
    if (targetUser.role === 'owner') {
      return forbiddenError('Cannot delete the organization owner');
    }

    // Soft delete
    await db.update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, userId));

    return successResponse({ message: 'User removed from organization' });
  } catch (error) {
    console.error('Delete user error:', error);
    return internalError();
  }
}
