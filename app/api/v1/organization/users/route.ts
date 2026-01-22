import { NextRequest } from 'next/server';
import { db, users, passwordResetTokens } from '@/lib/db';
import { requireTenantAdmin, requireTenantAuth } from '@/lib/auth/middleware';
import { inviteUserSchema } from '@/validations/auth';
import { hashPassword, generateResetToken, hashApiKey } from '@/lib/auth/password';
import { canInviteRole } from '@/lib/auth/session';
import { successResponse, validationError, conflictError, forbiddenError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, isNull, count } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // Get users in the same tenant
    const [userList, totalResult] = await Promise.all([
      db.query.users.findMany({
        where: and(
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
        limit: pageSize,
        offset,
        orderBy: (users, { desc }) => [desc(users.createdAt)],
      }),
      db.select({ count: count() })
        .from(users)
        .where(and(
          eq(users.tenantId, auth.tenantId),
          isNull(users.deletedAt)
        )),
    ]);

    return paginatedResponse(userList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List users error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTenantAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = inviteUserSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { email, role, firstName, lastName } = result.data;

    // Check permission to invite this role
    if (!canInviteRole(auth.role, role)) {
      return forbiddenError('You cannot invite users with this role');
    }

    // Check if email already exists in this tenant
    const existingUser = await db.query.users.findFirst({
      where: and(
        eq(users.email, email.toLowerCase()),
        eq(users.tenantId, auth.tenantId)
      ),
    });

    if (existingUser) {
      return conflictError('A user with this email already exists in your organization');
    }

    // Create user with temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(tempPassword);

    const [user] = await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash,
      tenantId: auth.tenantId,
      role,
      firstName: firstName || null,
      lastName: lastName || null,
      invitedById: auth.userId,
    }).returning({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
    });

    // Create password reset token for invite
    const token = generateResetToken();
    const tokenHash = hashApiKey(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // TODO: Send invite email with password reset link
    console.log(`Invite token for ${email}: ${token}`);

    return successResponse({ user });
  } catch (error) {
    console.error('Invite user error:', error);
    return internalError();
  }
}
