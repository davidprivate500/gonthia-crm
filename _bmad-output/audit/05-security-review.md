# Security Review - Gonthia CRM

## Executive Summary

Gonthia CRM has foundational security measures but critical gaps exist in authentication hardening, rate limiting, and input validation. Immediate action required on P0 items before production use.

**Overall Security Grade: C+**

---

## 1. Authentication Security

### 1.1 Session Management

| Aspect | Implementation | Assessment |
|--------|---------------|------------|
| Session Storage | iron-session (encrypted cookies) | ✓ Good |
| Cookie Flags | httpOnly, secure, sameSite=lax | ✓ Good |
| Session Expiration | Not configured | ⚠ Missing |
| Session Rotation | Not implemented | ⚠ Missing |

### 1.2 Critical Vulnerability: SESSION_SECRET Fallback

**Location:** `lib/auth/session.ts:8`

```typescript
// CRITICAL BUG
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-in-production';
```

**Impact:** If deployed without `SESSION_SECRET` env var, attackers can forge sessions.

**Fix:**
```typescript
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters');
}
```

### 1.3 Password Security

| Aspect | Implementation | Assessment |
|--------|---------------|------------|
| Hashing | bcrypt | ✓ Good |
| Cost Factor | 12 (default) | ✓ Good |
| Min Length | 8 characters | ✓ Acceptable |
| Complexity | None required | ⚠ Weak |

**Recommendation:** Add password complexity requirements:
```typescript
password: z.string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain number')
```

---

## 2. Authorization Security

### 2.1 RBAC Implementation

```
Role Hierarchy: owner (4) > admin (3) > member (2) > readonly (1)
```

**Assessment:** Simple but effective role hierarchy.

### 2.2 Critical Issues

#### Issue 1: API Key Privilege Escalation
**Location:** `lib/auth/session.ts:89`

```typescript
// All API keys grant admin access regardless of creator's role
return {
  userId: apiKeyRecord.createdBy,
  tenantId: apiKeyRecord.tenantId,
  role: 'admin', // HARDCODED - member can create admin-level key
  source: 'apiKey' as const,
};
```

**Impact:** Any user who can create API keys gets admin privileges.

#### Issue 2: No Object-Level Authorization

```typescript
// Current: Only checks role
if (!canUpdate(auth.role)) { ... }

// Missing: Check ownership/access to specific record
const contact = await db.query.contacts.findFirst({ ... });
// No check if user can access THIS contact
```

#### Issue 3: Soft-Deleted User Access

```typescript
// API key verification doesn't check if user is deleted
const apiKeyRecord = await db.query.apiKeys.findFirst({ ... });
// User could be soft-deleted but API key still works
```

---

## 3. Input Validation

### 3.1 Zod Schema Coverage

| Endpoint | Validation | Assessment |
|----------|------------|------------|
| POST /auth/register | registerSchema | ✓ |
| POST /auth/login | loginSchema | ✓ |
| POST /contacts | createContactSchema | ✓ |
| PATCH /contacts/:id | updateContactSchema | ✓ |
| GET /contacts | contactQuerySchema | ✓ |
| ... | ... | All routes covered |

**Overall:** A - Comprehensive Zod validation

### 3.2 Missing Validations

| Field | Issue | Risk |
|-------|-------|------|
| notes (all entities) | No max length | DoS via large payload |
| description | No max length | DoS via large payload |
| Custom fields | Not sanitized | Potential XSS in future |

### 3.3 SQL Injection Protection

**Assessment:** ✓ Protected via Drizzle ORM parameterized queries

```typescript
// Safe - parameterized by Drizzle
const contact = await db.query.contacts.findFirst({
  where: eq(contacts.id, contactId),
});
```

---

## 4. Rate Limiting

### 4.1 Current State: NONE

**Critical Gap:** No rate limiting on any endpoint.

### 4.2 Vulnerable Endpoints

| Endpoint | Attack Vector | Impact |
|----------|--------------|--------|
| POST /auth/login | Brute force | Account takeover |
| POST /auth/register | Mass registration | Resource exhaustion |
| POST /auth/forgot-password | Email bombing | DoS |
| POST /auth/reset-password | Token brute force | Account takeover |
| GET /search | Query flooding | Database DoS |

### 4.3 Recommended Implementation

```typescript
// lib/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

export async function rateLimit(identifier: string) {
  const { success, limit, remaining } = await ratelimit.limit(identifier);
  if (!success) {
    throw new RateLimitError(limit, remaining);
  }
}
```

---

## 5. CSRF Protection

### 5.1 Current State

- **Cookie:** `sameSite=lax` provides partial protection
- **CSRF Tokens:** Not implemented
- **Origin Verification:** Not implemented

### 5.2 Gap Analysis

| Method | sameSite=lax Protection |
|--------|------------------------|
| GET (top-level navigation) | ✗ Vulnerable |
| POST (form submission) | ✗ Vulnerable |
| POST (fetch/XHR) | ✓ Protected |

### 5.3 Recommendations

1. **Verify Origin Header:**
```typescript
function verifyOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && !origin.includes(host)) {
    throw new Error('CSRF detected');
  }
}
```

2. **Or implement CSRF tokens** (more robust)

---

## 6. Security Headers

### 6.1 Current State: MISSING

No security headers configured.

### 6.2 Required Headers

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        }
      ]
    }
  ];
}
```

---

## 7. Data Exposure

### 7.1 Information Disclosure

**Issue:** Error responses may leak internal details

```typescript
// Current
console.error('Error:', error);
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
// Stack traces may still be exposed in development
```

**Recommendation:**
```typescript
// Sanitize all errors
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
}
```

### 7.2 Sensitive Data in Responses

| Data | Exposed | Recommendation |
|------|---------|----------------|
| Password hash | ✗ No | ✓ Good |
| API key (full) | Only on create | ✓ Acceptable |
| User email | ✓ Yes | Consider masking in lists |
| Internal IDs | ✓ Yes | ✓ Acceptable (UUIDs) |

---

## 8. API Security

### 8.1 API Key Security

| Aspect | Implementation | Assessment |
|--------|---------------|------------|
| Key Format | UUID v4 | ⚠ Predictable |
| Storage | Plain text | ⚠ Should hash |
| Rotation | Not supported | ⚠ Missing |
| Scopes | None | ⚠ All-or-nothing |

**Recommendations:**
1. Use cryptographically random keys (not UUID)
2. Store hashed keys, only show full key once
3. Add key expiration
4. Implement scope-based permissions

### 8.2 API Versioning

**Current:** `/api/v1/` - Good practice

---

## 9. Multi-Tenant Security

### 9.1 Tenant Isolation

**Model:** Shared Database, Shared Schema, Application-Level Isolation

**Risk Level:** Medium - Relies entirely on code correctness

### 9.2 Isolation Verification

```typescript
// All queries include tenant filter
const contacts = await db.select()
  .from(contacts)
  .where(and(
    eq(contacts.tenantId, auth.tenantId),  // ✓ Always present
    isNull(contacts.deletedAt)
  ));
```

### 9.3 Gaps

1. **No database-level RLS** - Single query bug exposes all tenants
2. **No tenant ID in session validation** - Could be manipulated
3. **API key tenant not re-verified** - Trusts stored value

---

## 10. Dependency Security

### 10.1 Critical Dependencies

| Package | Version | Known Vulnerabilities |
|---------|---------|----------------------|
| next | 16.1.4 | None known |
| iron-session | 8.0.4 | None known |
| bcrypt | 6.0.0 | None known |
| drizzle-orm | 0.45.1 | None known |
| zod | 4.3.5 | None known |

### 10.2 Recommendations

1. Run `npm audit` regularly
2. Set up Dependabot/Renovate
3. Pin major versions in production

---

## 11. Security Checklist

### Authentication
- [ ] Remove SESSION_SECRET fallback
- [ ] Add session expiration
- [ ] Implement session rotation on privilege change
- [ ] Add password complexity requirements

### Authorization
- [ ] Fix API key privilege escalation
- [ ] Add object-level authorization
- [ ] Check soft-deleted user status

### Rate Limiting
- [ ] Add rate limiting to auth endpoints
- [ ] Add rate limiting to search/export
- [ ] Implement progressive delays

### CSRF
- [ ] Add Origin header verification
- [ ] Consider CSRF tokens for forms

### Headers
- [ ] Add all security headers
- [ ] Configure CSP appropriately

### Data Protection
- [ ] Sanitize error responses
- [ ] Add field-length limits
- [ ] Review data exposure in API responses

---

## 12. OWASP Top 10 Assessment

| Vulnerability | Status | Notes |
|--------------|--------|-------|
| A01: Broken Access Control | ⚠ Issues | API key escalation, no object-level checks |
| A02: Cryptographic Failures | ✓ Good | bcrypt, iron-session encryption |
| A03: Injection | ✓ Good | Drizzle ORM parameterization |
| A04: Insecure Design | ⚠ Issues | No rate limiting, session fallback |
| A05: Security Misconfiguration | ⚠ Issues | Missing headers, fallback secrets |
| A06: Vulnerable Components | ✓ Good | No known vulnerabilities |
| A07: Auth Failures | ⚠ Issues | No brute force protection |
| A08: Data Integrity Failures | ✓ Good | No deserialization issues |
| A09: Logging Failures | ⚠ Issues | Incomplete audit logging |
| A10: SSRF | ✓ Good | No server-side requests |

---

## 13. Remediation Priority

### P0 - Immediate (Before Production)
1. Remove SESSION_SECRET fallback
2. Add rate limiting to auth endpoints
3. Fix API key privilege escalation

### P1 - High Priority (Week 1-2)
1. Add security headers
2. Implement CSRF protection
3. Add text field length limits
4. Fix soft-deleted user access

### P2 - Medium Priority (Week 3-4)
1. Add object-level authorization
2. Improve API key security
3. Add session expiration/rotation
4. Sanitize error responses

### P3 - Lower Priority
1. Consider database-level RLS
2. Add password complexity
3. Implement API key scopes
4. Add security event logging
