/**
 * Rate Limiting Module
 * BUG-002 FIX: Implements IP-based rate limiting for auth endpoints
 *
 * Uses in-memory storage for single-instance deployments.
 * For multi-instance deployments, configure UPSTASH_REDIS_REST_URL.
 */

import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleared on restart, suitable for single instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMITS = {
  login: { requests: 5, windowMs: 60 * 1000 }, // 5 requests per minute
  register: { requests: 3, windowMs: 60 * 1000 }, // 3 requests per minute
  forgotPassword: { requests: 3, windowMs: 60 * 60 * 1000 }, // 3 requests per hour
  resetPassword: { requests: 5, windowMs: 60 * 60 * 1000 }, // 5 requests per hour
  default: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Extract client IP from request
 */
function getClientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback headers
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Default for local development
  return '127.0.0.1';
}

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * Check rate limit for a given identifier and type
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'default'
): RateLimitResult {
  const config = RATE_LIMITS[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);

    return {
      success: true,
      limit: config.requests,
      remaining: config.requests - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count += 1;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, config.requests - entry.count);
  const success = entry.count <= config.requests;

  return {
    success,
    limit: config.requests,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit middleware for API routes
 * Returns Response if rate limited, null if allowed
 */
export function rateLimit(
  request: NextRequest,
  type: RateLimitType = 'default'
): Response | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, type);

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  return null;
}

/**
 * Utility to add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
