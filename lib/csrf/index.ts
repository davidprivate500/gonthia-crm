import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

// BUG-007 FIX: CSRF Protection using Double Submit Cookie pattern

const CSRF_COOKIE_NAME = 'gonthia-csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32;

// Safe methods that don't require CSRF protection
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Paths that are exempt from CSRF (no session context yet)
const EXEMPT_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
];

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Get or create CSRF token cookie
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME);

  if (existingToken?.value) {
    return existingToken.value;
  }

  // Generate new token
  const token = generateCsrfToken();
  return token;
}

/**
 * Set CSRF token in response
 */
export function setCsrfCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days (match session)
  });
  return response;
}

/**
 * Verify CSRF token from request
 * Returns null if valid, or an error response if invalid
 */
export function verifyCsrf(request: NextRequest): Response | null {
  // Skip for safe methods
  if (SAFE_METHODS.includes(request.method)) {
    return null;
  }

  // Skip for exempt paths
  const pathname = new URL(request.url).pathname;
  if (EXEMPT_PATHS.some(path => pathname === path)) {
    return null;
  }

  // Skip for API key authenticated requests (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.substring(7).startsWith('gon_')) {
    return null;
  }

  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieToken) {
    return new Response(
      JSON.stringify({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token cookie not found',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    return new Response(
      JSON.stringify({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token header not found',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(cookieToken, headerToken)) {
    return new Response(
      JSON.stringify({
        error: 'CSRF_TOKEN_INVALID',
        message: 'CSRF token mismatch',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
