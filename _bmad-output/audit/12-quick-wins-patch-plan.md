# Quick Wins Patch Plan - Gonthia CRM

## Overview

This document outlines patches that can be applied immediately with minimal risk. Each patch is self-contained, well-tested, and provides immediate security or stability improvement.

**Total Quick Wins: 12**
**Estimated Total Effort: ~16 hours**

---

## Quick Win 1: Remove SESSION_SECRET Fallback

**Priority:** P0 - CRITICAL
**Effort:** 30 minutes
**Risk:** Low (fails fast if misconfigured)

### Current Code
```typescript
// lib/auth/session.ts:8
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-in-production';
```

### Patch
```typescript
// lib/auth/session.ts:8
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

if (SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}
```

### Verification
```bash
# Without env var - should fail
unset SESSION_SECRET && npm run dev
# Expected: Error: SESSION_SECRET environment variable is required

# With short secret - should fail
SESSION_SECRET=short npm run dev
# Expected: Error: SESSION_SECRET must be at least 32 characters

# With proper secret - should work
SESSION_SECRET=$(openssl rand -hex 32) npm run dev
# Expected: Server starts normally
```

---

## Quick Win 2: Fix API Key Privilege Escalation

**Priority:** P0 - CRITICAL
**Effort:** 1 hour
**Risk:** Low

### Current Code
```typescript
// lib/auth/session.ts:89
return {
  userId: apiKeyRecord.createdBy,
  tenantId: apiKeyRecord.tenantId,
  role: 'admin', // Always admin!
  source: 'apiKey' as const,
};
```

### Patch
```typescript
// lib/auth/session.ts:89
// Fetch the creator's role
const creator = await db.query.users.findFirst({
  where: eq(users.id, apiKeyRecord.createdBy),
  columns: { role: true, deletedAt: true },
});

if (!creator || creator.deletedAt) {
  return null; // Creator deleted, invalidate key
}

return {
  userId: apiKeyRecord.createdBy,
  tenantId: apiKeyRecord.tenantId,
  role: creator.role, // Use creator's actual role
  source: 'apiKey' as const,
};
```

### Verification
```bash
# Create API key as member user
# Verify API key has member permissions, not admin
```

---

## Quick Win 3: Add Security Headers

**Priority:** P1 - HIGH
**Effort:** 30 minutes
**Risk:** Low

### Patch
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
```

### Verification
```bash
curl -I https://gonthia-app.vercel.app/
# Verify headers present in response
```

---

## Quick Win 4: Add Text Field Length Limits

**Priority:** P1 - HIGH
**Effort:** 1 hour
**Risk:** Low

### Patch
```typescript
// lib/validations/contact.ts
export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(), // Add max
  // ... rest
});

// Apply similar limits to all schemas:
// - company.ts
// - deal.ts
// - activity.ts
// - tag.ts
```

### Verification
```bash
# Attempt to create contact with 1MB notes field
# Should return 400 validation error
```

---

## Quick Win 5: Sanitize Error Responses

**Priority:** P1 - HIGH
**Effort:** 1 hour
**Risk:** Low

### Create Helper
```typescript
// lib/api/error-response.ts
export function createErrorResponse(
  error: unknown,
  context: string,
  request?: Request
): NextResponse {
  // Always log full error
  console.error(`[${context}]`, error);

  // In production, return generic message
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }

  // In development, include details
  return NextResponse.json(
    {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}
```

### Apply to Routes
```typescript
// In each catch block
} catch (error) {
  if (error instanceof Response) return error;
  return createErrorResponse(error, 'contacts.create');
}
```

---

## Quick Win 6: Add Health Check Endpoint

**Priority:** P1 - HIGH
**Effort:** 30 minutes
**Risk:** Low

### Patch
```typescript
// app/api/health/route.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    checks: {} as Record<string, string>,
  };

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    health.checks.database = `healthy (${Date.now() - start}ms)`;
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'unhealthy';
  }

  return NextResponse.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
  });
}
```

---

## Quick Win 7: Fix Hydration Flash

**Priority:** P2 - MEDIUM
**Effort:** 30 minutes
**Risk:** Low

### Current Code
```typescript
// components/auth-provider.tsx
if (!isInitialized) {
  return null; // Flash of content
}
```

### Patch
```typescript
// components/auth-provider.tsx
if (!isInitialized) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
```

---

## Quick Win 8: Add Null Safety for Initials

**Priority:** P2 - MEDIUM
**Effort:** 30 minutes
**Risk:** Low

### Create Helper
```typescript
// lib/utils.ts
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.[0]?.toUpperCase() || '';
  const last = lastName?.[0]?.toUpperCase() || '';
  return first + last || '?';
}
```

### Apply to Components
```typescript
// Replace manual null checks with helper
{getInitials(contact.firstName, contact.lastName)}
```

---

## Quick Win 9: Add Database Query Limits

**Priority:** P2 - MEDIUM
**Effort:** 1 hour
**Risk:** Low

### Patch
```typescript
// lib/validations/common.ts
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20), // Enforce max
});

// In route handlers
const { page, limit } = paginationSchema.parse({
  page: searchParams.get('page'),
  limit: searchParams.get('limit'),
});
```

---

## Quick Win 10: Add Missing Type Annotations

**Priority:** P3 - LOW
**Effort:** 2 hours
**Risk:** None

### Areas to Annotate
```typescript
// lib/auth/session.ts - Add return types
export async function getSession(request: Request): Promise<SessionData | null>
export async function requireAuth(request: Request): Promise<AuthContext>

// lib/audit.ts - Add types
export async function logAudit(params: AuditLogParams): Promise<void>
```

---

## Quick Win 11: Remove Unused Dependencies

**Priority:** P3 - LOW
**Effort:** 30 minutes
**Risk:** Low

### Patch
```bash
npm uninstall @neondatabase/serverless
# Update imports if any remain (there shouldn't be)
```

### Verify
```bash
npm run build
npm run test
```

---

## Quick Win 12: Add Request ID Logging

**Priority:** P2 - MEDIUM
**Effort:** 1 hour
**Risk:** Low

### Create Middleware Helper
```typescript
// lib/api/request-context.ts
export function getRequestId(request: Request): string {
  return request.headers.get('x-vercel-id') ||
         request.headers.get('x-request-id') ||
         crypto.randomUUID();
}

export function logRequest(
  requestId: string,
  message: string,
  data?: Record<string, unknown>
) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId,
    message,
    ...data,
  }));
}
```

### Usage
```typescript
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  logRequest(requestId, 'Creating contact');

  try {
    // ... operation
    logRequest(requestId, 'Contact created', { contactId: contact.id });
  } catch (error) {
    logRequest(requestId, 'Failed to create contact', { error: String(error) });
    throw error;
  }
}
```

---

## Implementation Checklist

### Day 1 (P0 Critical)
- [ ] Quick Win 1: Remove SESSION_SECRET fallback
- [ ] Quick Win 2: Fix API key privilege escalation
- [ ] Deploy and verify

### Day 2 (P1 High)
- [ ] Quick Win 3: Add security headers
- [ ] Quick Win 4: Add text field length limits
- [ ] Quick Win 5: Sanitize error responses
- [ ] Quick Win 6: Add health check endpoint
- [ ] Deploy and verify

### Day 3 (P2 Medium)
- [ ] Quick Win 7: Fix hydration flash
- [ ] Quick Win 8: Add null safety for initials
- [ ] Quick Win 9: Add database query limits
- [ ] Quick Win 12: Add request ID logging
- [ ] Deploy and verify

### Day 4 (P3 Low)
- [ ] Quick Win 10: Add missing type annotations
- [ ] Quick Win 11: Remove unused dependencies
- [ ] Final verification and documentation

---

## Rollback Plan

Each patch is independent. To rollback:

1. Revert the specific commit
2. Deploy previous version via Vercel dashboard
3. Document issue for fix

---

## Post-Patch Verification

After all quick wins applied:

```bash
# Run full test suite
npm run test

# Run type check
npm run typecheck

# Run linter
npm run lint

# Manual verification
- [ ] Login works
- [ ] Registration works
- [ ] CRUD operations work
- [ ] Health check returns 200
- [ ] Security headers present
```
