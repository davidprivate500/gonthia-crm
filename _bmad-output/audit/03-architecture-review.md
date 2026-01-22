# Architecture Review - Gonthia CRM

## Executive Summary

Gonthia CRM is a well-structured Next.js 16 monolith with proper separation of concerns. The architecture follows modern patterns but has several critical gaps in security hardening, transaction management, and operational readiness.

**Overall Architecture Grade: B-**

| Category | Grade | Notes |
|----------|-------|-------|
| Code Organization | A | Clear separation, consistent patterns |
| Security | C | Missing rate limiting, CSRF, session hardening |
| Data Integrity | B- | Good FK constraints, missing transactions |
| Scalability | B | Serverless-ready, connection pooling concerns |
| Operational Readiness | C- | Limited observability, no runbooks |

---

## 1. Architectural Patterns Analysis

### 1.1 Overall Structure
```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION                         │
│  React 19 Components + Shadcn/UI + Tailwind CSS        │
├─────────────────────────────────────────────────────────┤
│                    CLIENT STATE                         │
│  Zustand (Auth) + React Hook Form (Forms)              │
├─────────────────────────────────────────────────────────┤
│                    API LAYER                            │
│  Next.js Route Handlers + Zod Validation               │
├─────────────────────────────────────────────────────────┤
│                    BUSINESS LOGIC                       │
│  Inline in Route Handlers (no service layer)           │
├─────────────────────────────────────────────────────────┤
│                    DATA ACCESS                          │
│  Drizzle ORM + postgres-js driver                      │
├─────────────────────────────────────────────────────────┤
│                    DATABASE                             │
│  PostgreSQL (Supabase Transaction Pooler)              │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Strengths
1. **Type Safety:** Full TypeScript with Zod runtime validation
2. **Component Architecture:** Well-organized UI with Radix primitives
3. **Multi-tenancy:** Consistent tenant_id filtering pattern
4. **Soft Deletes:** deletedAt column on all entity tables
5. **Audit Trail:** Comprehensive audit logging for CRUD operations

### 1.3 Weaknesses
1. **No Service Layer:** Business logic mixed into route handlers
2. **No Transaction Support:** Critical operations lack atomicity
3. **Missing Error Boundaries:** No global error handling strategy
4. **No Caching Layer:** Every request hits database
5. **No Background Jobs:** Import feature incomplete

---

## 2. Multi-Tenancy Architecture

### 2.1 Current Implementation
- **Model:** Shared Database, Shared Schema
- **Isolation:** Application-level filtering via `tenant_id`
- **Key Flow:**
  ```
  Request → Session/API Key → Extract tenantId → Filter all queries
  ```

### 2.2 Tenant Isolation Verification
| Table | tenant_id FK | Verified |
|-------|-------------|----------|
| users | ✓ | ✓ |
| contacts | ✓ | ✓ |
| companies | ✓ | ✓ |
| deals | ✓ | ✓ |
| activities | ✓ | ✓ |
| tags | ✓ | ✓ |
| pipelineStages | ✓ | ✓ |
| apiKeys | ✓ | ✓ |
| auditLogs | ✓ | ✓ |
| importJobs | ✓ | ✓ |

### 2.3 Tenant Isolation Risks
1. **Direct Query Risk:** Drizzle queries could omit tenant filter
2. **API Key Context:** Always returns admin role, not tenant-specific role
3. **No Database-Level Isolation:** Relies entirely on application code

### 2.4 Recommended Improvements
```typescript
// Consider a tenant-scoped db helper
const tenantDb = (tenantId: string) => ({
  contacts: db.select().from(contacts).where(eq(contacts.tenantId, tenantId)),
  companies: db.select().from(companies).where(eq(companies.tenantId, tenantId)),
  // ... etc
});
```

---

## 3. Authorization Architecture

### 3.1 RBAC Implementation
```
Role Hierarchy: owner (4) > admin (3) > member (2) > readonly (1)
```

### 3.2 Permission Functions (lib/auth/session.ts)
| Function | Logic |
|----------|-------|
| `canCreate(role)` | role !== 'readonly' |
| `canUpdate(role)` | role !== 'readonly' |
| `canDelete(role)` | role === 'owner' \|\| role === 'admin' |
| `canManageUsers(role)` | role === 'owner' \|\| role === 'admin' |
| `canInviteRole(current, target)` | Hierarchical check |
| `canManageOrganization(role)` | role === 'owner' |
| `canViewAuditLog(role)` | role === 'owner' \|\| role === 'admin' |
| `canManageApiKeys(role)` | role === 'owner' \|\| role === 'admin' |
| `canExportData(role)` | role === 'owner' |

### 3.3 Authorization Gaps
1. **Object-Level Authorization:** No check that user owns/has access to specific record
2. **API Key Privilege:** Always admin regardless of creator
3. **No Attribute-Based Access:** Simple role check, no field-level control

### 3.4 Recommended Authorization Pattern
```typescript
// Proposed: Object-level authorization
async function canAccessContact(auth: AuthContext, contactId: string): Promise<boolean> {
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.id, contactId),
      eq(contacts.tenantId, auth.tenantId)
    )
  });

  if (!contact) return false;

  // Additional owner check if needed
  if (auth.role === 'readonly') return true; // read-only
  if (contact.ownerId === auth.userId) return true;
  if (auth.role === 'admin' || auth.role === 'owner') return true;

  return false;
}
```

---

## 4. Data Flow Architecture

### 4.1 Contact Creation Flow
```
Client POST /api/v1/contacts
       │
       ▼
┌─────────────────┐
│ Zod Validation  │ ← createContactSchema
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Middleware │ ← requireAuth() + requireWriteAccess()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DB Insert       │ ← db.insert(contacts).values({...tenantId})
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Audit Log       │ ← logAudit() - fire and forget
└────────┬────────┘
         │
         ▼
    JSON Response
```

### 4.2 Deal Pipeline Flow
```
Client POST /api/v1/deals/{id}/move
       │
       ▼
┌─────────────────┐
│ Validate Move   │ ← stageId, position
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ Update Deal Stage/Position  │ ← NOT in transaction
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Reorder Other Deals         │ ← Race condition possible
└────────┬────────────────────┘
         │
         ▼
    Audit Log + Response
```

---

## 5. Critical Architectural Issues

### Issue 1: No Transaction Support
**Impact:** Data inconsistency on failures
**Location:** Multiple routes (register, deal move, etc.)
**Root Cause:** postgres-js with prepare:false configuration

**Recommendation:**
```typescript
// lib/db/index.ts - Add transaction helper
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

export async function transaction<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  return sql.begin(fn);
}
```

### Issue 2: No Service Layer
**Impact:** Business logic scattered, hard to test, duplicated code
**Location:** All route handlers

**Recommendation:**
```
lib/
  services/
    contact.service.ts
    deal.service.ts
    auth.service.ts
```

### Issue 3: No Caching Strategy
**Impact:** Unnecessary database load
**Location:** All read operations

**Recommendation:**
- Vercel KV for session caching
- React Query for client-side caching (already installed, not used)
- Edge caching for public content

### Issue 4: No Background Job System
**Impact:** Import feature broken, no async processing
**Location:** Import route

**Recommendation:**
- Vercel Cron for scheduled jobs
- Inngest or Trigger.dev for background processing
- Or synchronous processing with chunking for small files

---

## 6. Dependency Direction Analysis

```
┌─────────────────────────────────────────────────────────┐
│                     GOOD ✓                              │
│  UI Components → Hooks → Stores → API Client           │
│  Route Handlers → Middleware → DB → Schema             │
│  Validation Schemas (standalone)                        │
├─────────────────────────────────────────────────────────┤
│                   CONCERNS ⚠                            │
│  Route handlers have too much responsibility           │
│  Audit logger called directly from routes              │
│  No abstraction for common patterns                    │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Scalability Considerations

### Current Limits
| Resource | Current | Concern |
|----------|---------|---------|
| Vercel Function Timeout | 10s default | Large imports may timeout |
| Database Connections | Pooled (6543) | Need monitoring |
| Request Body Size | Default ~1MB | Large CSV imports |
| Session Storage | Cookie | 4KB limit |

### Scaling Path
1. **Short Term:** Add connection monitoring, optimize queries
2. **Medium Term:** Add Redis/KV caching, background jobs
3. **Long Term:** Consider read replicas, event sourcing for audit

---

## 8. Recommendations Summary

### P0 - Immediate (Week 1)
1. Remove SESSION_SECRET fallback
2. Add rate limiting middleware
3. Fix API key privilege escalation

### P1 - High Priority (Weeks 2-3)
1. Add transaction support for critical flows
2. Implement CSRF protection
3. Add security headers
4. Fix error response sanitization

### P2 - Medium Priority (Weeks 4-6)
1. Extract service layer
2. Implement background job processing
3. Add caching layer
4. Complete user invitation flow

### P3 - Backlog
1. Add comprehensive monitoring
2. Create runbooks
3. Implement field-level audit logging
4. Add request tracing
