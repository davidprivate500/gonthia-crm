import { destroySession } from '@/lib/auth/session';
import { successResponse, internalError } from '@/lib/api/response';

export async function POST() {
  try {
    await destroySession();
    return successResponse({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return internalError();
  }
}
