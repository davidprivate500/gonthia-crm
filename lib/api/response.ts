import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'BAD_REQUEST';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiResponse<T> {
  data?: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
  error?: ApiError;
}

export function successResponse<T>(data: T, meta?: ApiResponse<T>['meta']): NextResponse {
  const response: ApiResponse<T> = { data };
  if (meta) {
    response.meta = meta;
  }
  return NextResponse.json(response);
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): NextResponse {
  return NextResponse.json({
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, string[]>
): NextResponse {
  const response: ApiResponse<never> = {
    error: { code, message, ...(details && { details }) },
  };
  return NextResponse.json(response, { status });
}

export function validationError(details: Record<string, string[]>): NextResponse {
  return errorResponse('VALIDATION_ERROR', 'Invalid input', 400, details);
}

export function notFoundError(message = 'Resource not found'): NextResponse {
  return errorResponse('NOT_FOUND', message, 404);
}

export function unauthorizedError(message = 'Not authenticated'): NextResponse {
  return errorResponse('UNAUTHORIZED', message, 401);
}

export function forbiddenError(message = 'You do not have permission to perform this action'): NextResponse {
  return errorResponse('FORBIDDEN', message, 403);
}

export function internalError(message = 'An unexpected error occurred'): NextResponse {
  return errorResponse('INTERNAL_ERROR', message, 500);
}

/**
 * BUG-027 FIX: Safe error handler that sanitizes errors in production
 * Logs full error details server-side but returns generic message to client
 */
export function safeInternalError(error: unknown, context?: string): NextResponse {
  // Always log full error server-side
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context || 'API Error'}]`, {
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
  });

  // In production, never expose internal error details
  if (process.env.NODE_ENV === 'production') {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }

  // In development, include error message for debugging
  return errorResponse(
    'INTERNAL_ERROR',
    `[DEV] ${errorMessage}`,
    500
  );
}

export function conflictError(message: string): NextResponse {
  return errorResponse('CONFLICT', message, 409);
}

export function badRequestError(message: string): NextResponse {
  return errorResponse('BAD_REQUEST', message, 400);
}

export function rateLimitedError(retryAfter: number): NextResponse {
  const response = errorResponse('RATE_LIMITED', `Rate limit exceeded, try again in ${retryAfter} seconds`, 429);
  response.headers.set('Retry-After', String(retryAfter));
  return response;
}

// Helper to format Zod errors
export function formatZodErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return details;
}
