import { NextRequest } from 'next/server';
import { db, users, passwordResetTokens } from '@/lib/db';
import { forgotPasswordSchema } from '@/validations/auth';
import { generateResetToken, hashApiKey } from '@/lib/auth/password';
import { successResponse, validationError, internalError, formatZodErrors } from '@/lib/api/response';
import { rateLimit } from '@/lib/ratelimit';
import { eq, and, isNull } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  // BUG-002 FIX: Rate limiting on forgot password endpoint
  const rateLimitResponse = rateLimit(request, 'forgotPassword');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { email } = result.data;

    // Find user - we always return success to prevent email enumeration
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.email, email.toLowerCase()),
        isNull(users.deletedAt)
      ),
    });

    if (user) {
      // Generate reset token
      const token = generateResetToken();
      const tokenHash = hashApiKey(token); // Reuse hash function
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store hashed token
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      // TODO: Send email with reset link
      // In production, this would send an email with:
      // `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
      console.log(`Password reset token for ${email}: ${token}`);
    }

    // Always return success to prevent email enumeration
    return successResponse({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return internalError();
  }
}
