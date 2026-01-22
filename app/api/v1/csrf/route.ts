import { NextResponse } from 'next/server';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

// BUG-007 FIX: CSRF token endpoint

export async function GET() {
  const token = generateCsrfToken();

  const response = NextResponse.json({ token });
  return setCsrfCookie(response, token);
}
