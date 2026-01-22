import { NextRequest } from 'next/server';
import { db, users, passwordResetTokens } from '@/lib/db';
import { resetPasswordSchema } from '@/validations/auth';
import { hashPassword, hashApiKey } from '@/lib/auth/password';
import { successResponse, validationError, unauthorizedError, internalError, formatZodErrors } from '@/lib/api/response';
import { rateLimit } from '@/lib/ratelimit';
import { eq, and, gt, isNull } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  // BUG-002 FIX: Rate limiting on reset password endpoint
  const rateLimitResponse = rateLimit(request, 'resetPassword');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { token, password } = result.data;
    const tokenHash = hashApiKey(token);

    // Find valid reset token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      ),
    });

    if (!resetToken) {
      return unauthorizedError('Invalid or expired reset token');
    }

    // Update password
    const passwordHash = await hashPassword(password);
    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return successResponse({
      message: 'Password has been reset successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return internalError();
  }
}
