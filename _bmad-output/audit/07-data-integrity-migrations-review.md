# Data Integrity & Migrations Review - Gonthia CRM

## Executive Summary

Gonthia CRM has a well-designed schema with proper relationships and constraints, but lacks transaction support for critical operations. Migration tooling is in place but procedures need documentation.

**Data Integrity Grade: B-**
**Migration Readiness Grade: B**

---

## 1. Schema Analysis

### 1.1 Entity Relationships

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   tenants   │────<│    users    │     │   apiKeys   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  companies  │────<│  contacts   │────<│    deals    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   └────────┬──────────┘
       │                            │
       │                            ▼
       │                   ┌─────────────────┐
       │                   │   activities    │
       │                   └─────────────────┘
       │                            │
       ▼                            ▼
┌─────────────┐            ┌─────────────────┐
│    tags     │            │   auditLogs     │
└─────────────┘            └─────────────────┘
```

### 1.2 Table Inventory

| Table | Primary Key | Tenant Scoped | Soft Delete | Audit |
|-------|-------------|---------------|-------------|-------|
| tenants | UUID | N/A | ✗ | ✗ |
| users | UUID | ✓ | ✓ | ✓ |
| contacts | UUID | ✓ | ✓ | ✓ |
| companies | UUID | ✓ | ✓ | ✓ |
| deals | UUID | ✓ | ✓ | ✓ |
| activities | UUID | ✓ | ✓ | ✓ |
| tags | UUID | ✓ | ✗ | ✓ |
| pipelineStages | UUID | ✓ | ✗ | ✗ |
| apiKeys | UUID | ✓ | ✗ | ✓ |
| auditLogs | UUID | ✓ | ✗ | N/A |
| importJobs | UUID | ✓ | ✗ | ✗ |

### 1.3 Foreign Key Constraints

| Table | Column | References | On Delete |
|-------|--------|------------|-----------|
| users | tenantId | tenants.id | CASCADE |
| contacts | tenantId | tenants.id | CASCADE |
| contacts | companyId | companies.id | SET NULL |
| contacts | ownerId | users.id | SET NULL |
| companies | tenantId | tenants.id | CASCADE |
| companies | ownerId | users.id | SET NULL |
| deals | tenantId | tenants.id | CASCADE |
| deals | contactId | contacts.id | SET NULL |
| deals | companyId | companies.id | SET NULL |
| deals | stageId | pipelineStages.id | SET NULL |
| deals | ownerId | users.id | SET NULL |
| activities | tenantId | tenants.id | CASCADE |
| activities | contactId | contacts.id | SET NULL |
| activities | companyId | companies.id | SET NULL |
| activities | dealId | deals.id | SET NULL |
| activities | ownerId | users.id | SET NULL |
| tags | tenantId | tenants.id | CASCADE |
| pipelineStages | tenantId | tenants.id | CASCADE |
| apiKeys | tenantId | tenants.id | CASCADE |
| apiKeys | createdBy | users.id | CASCADE |
| auditLogs | tenantId | tenants.id | CASCADE |
| auditLogs | userId | users.id | SET NULL |
| importJobs | tenantId | tenants.id | CASCADE |
| importJobs | createdBy | users.id | SET NULL |

**Assessment:** ✓ Well-designed FK constraints with appropriate cascade/set null behavior

---

## 2. Data Integrity Issues

### 2.1 Transaction Gaps

**Critical: No Transactions for Multi-Step Operations**

| Operation | Steps | Risk |
|-----------|-------|------|
| Registration | Create tenant → Create user → Create default stages | Orphan tenant |
| Deal Move | Update deal position → Reorder other deals | Position corruption |
| User Invite | Create user → (Send email - future) | Orphan user |
| Bulk Import | Multiple inserts | Partial import |

**Example - Registration Race Condition:**
```typescript
// Current: app/api/v1/auth/register/route.ts
const [tenant] = await db.insert(tenants).values({ name: organizationName }).returning();
// ⚠ If server crashes here, orphan tenant exists
const [user] = await db.insert(users).values({ tenantId: tenant.id, ... }).returning();
// ⚠ If this fails, tenant exists without owner
const defaultStages = [...];
await db.insert(pipelineStages).values(defaultStages);
// ⚠ If this fails, tenant has no pipeline
```

**Recommended Fix:**
```typescript
import { db, sql } from '@/lib/db';

await db.transaction(async (tx) => {
  const [tenant] = await tx.insert(tenants).values({ name: organizationName }).returning();
  const [user] = await tx.insert(users).values({ tenantId: tenant.id, ... }).returning();
  const defaultStages = [...];
  await tx.insert(pipelineStages).values(defaultStages);
  return { tenant, user };
});
```

### 2.2 Soft Delete Consistency

**Issue:** Soft-deleted entities may have active references

```typescript
// Contact is soft-deleted
contacts.deletedAt = new Date();

// But deal still references it
deals.contactId = contact.id;  // Still points to deleted contact
```

**Impact:** UI may show "Unknown contact" or errors when displaying deals.

**Recommendation:** Either:
1. Cascade soft deletes to children
2. Add check constraints for active references
3. Handle null/deleted references in UI gracefully

### 2.3 Orphan Record Scenarios

| Scenario | Cause | Detection |
|----------|-------|-----------|
| Tenant without owner | Registration failure | Query: tenants without users with role='owner' |
| Deal without stage | Stage deletion | Query: deals where stageId IS NULL |
| Contact without tenant | Should never happen | FK constraint prevents |
| Activity without any relation | Data entry | No constraint - valid scenario |

---

## 3. Constraint Analysis

### 3.1 Unique Constraints

| Table | Constraint | Columns |
|-------|------------|---------|
| users | unique_user_email_tenant | (email, tenantId) |
| tenants | unique_tenant_slug | (slug) |
| pipelineStages | unique_stage_name_tenant | (name, tenantId) |
| tags | unique_tag_name_tenant | (name, tenantId) |
| apiKeys | unique_api_key | (keyHash) |

**Gap:** No unique constraint on tenant + default pipeline stages (could have duplicates)

### 3.2 Check Constraints

**Current:** None defined

**Recommended:**
```sql
-- Ensure deal value is non-negative
ALTER TABLE deals ADD CONSTRAINT chk_deals_value_positive
  CHECK (value IS NULL OR value >= 0);

-- Ensure probability is 0-100
ALTER TABLE deals ADD CONSTRAINT chk_deals_probability_range
  CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100));

-- Ensure position is positive
ALTER TABLE pipeline_stages ADD CONSTRAINT chk_stages_position_positive
  CHECK (position >= 0);
```

### 3.3 Default Values

| Table | Column | Default | Assessment |
|-------|--------|---------|------------|
| users | role | 'member' | ✓ Good |
| deals | probability | 0 | ✓ Good |
| activities | isCompleted | false | ✓ Good |
| pipelineStages | position | 0 | ⚠ Should auto-increment |
| * | createdAt | now() | ✓ Good |
| * | id | gen_random_uuid() | ✓ Good |

---

## 4. Migration System

### 4.1 Current Setup

```
drizzle/
├── schema.ts          # Schema definitions
├── migrations/        # Generated migrations
│   ├── 0000_*.sql
│   ├── 0001_*.sql
│   └── ...
└── migrate.ts         # Migration runner
```

**Tooling:** Drizzle Kit (`drizzle-kit`)

### 4.2 Migration Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema directly (development)
npm run db:push

# Run migrations
npm run db:migrate

# View schema in studio
npm run db:studio
```

### 4.3 Migration Best Practices Checklist

| Practice | Status |
|----------|--------|
| Migrations in version control | ✓ Yes |
| Reversible migrations | ⚠ No down migrations |
| Migration testing | ✗ Not documented |
| Production deployment procedure | ✗ Not documented |
| Backup before migration | ✗ Not documented |
| Zero-downtime migrations | ⚠ Not verified |

---

## 5. Data Validation

### 5.1 Application-Level Validation

**Zod Schemas (Comprehensive):**

```typescript
// lib/validations/contact.ts
export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),  // ⚠ No max length
});
```

### 5.2 Database vs Application Validation

| Field | App Validation | DB Constraint | Gap |
|-------|---------------|---------------|-----|
| email format | ✓ Zod | ✗ None | Low risk |
| phone format | ✗ None | ✗ None | Low risk |
| value (deals) | ✗ None | ✗ None | Could be negative |
| probability | ✗ None | ✗ None | Could be >100 |
| notes length | ✗ None | ✗ None | DoS risk |

### 5.3 Recommendations

1. **Add database constraints** as safety net
2. **Add max length** to text fields in Zod
3. **Validate numeric ranges** in Zod schemas

---

## 6. Backup & Recovery

### 6.1 Current State

**Backup Strategy:** Relies on Supabase automatic backups

| Aspect | Status | Notes |
|--------|--------|-------|
| Automatic backups | ✓ Supabase | Daily (Pro plan) |
| Point-in-time recovery | ✓ Supabase | Pro plan feature |
| Manual backup process | ✗ Not documented | |
| Restore procedure | ✗ Not documented | |
| Backup verification | ✗ Not performed | |

### 6.2 Recommendations

1. **Document backup/restore procedures**
2. **Test restore process** quarterly
3. **Consider application-level export** for tenant data

---

## 7. Data Migration Scenarios

### 7.1 Schema Changes

| Change Type | Risk | Strategy |
|-------------|------|----------|
| Add column (nullable) | Low | Direct ALTER |
| Add column (NOT NULL) | Medium | Add nullable → backfill → add constraint |
| Remove column | Medium | Stop using → remove in later release |
| Rename column | High | Add new → migrate data → remove old |
| Change type | High | Add new column → migrate → remove old |

### 7.2 Example: Adding required field

```sql
-- Step 1: Add nullable column
ALTER TABLE contacts ADD COLUMN source VARCHAR(50);

-- Step 2: Backfill existing data
UPDATE contacts SET source = 'legacy' WHERE source IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE contacts ALTER COLUMN source SET NOT NULL;
```

---

## 8. Audit Trail Analysis

### 8.1 Current Coverage

```typescript
// lib/audit.ts - Actions logged
type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout'
  | 'api_key.create' | 'api_key.revoke'
  | 'user.invite' | 'user.role_change' | 'user.remove'
  | 'import.start' | 'import.complete' | 'import.fail'
  | 'export';
```

### 8.2 Audit Gaps

| Event | Logged | Priority |
|-------|--------|----------|
| Failed login attempt | ✗ | P1 |
| Password change | ✗ | P1 |
| Session creation | ✗ | P2 |
| Permission denied | ✗ | P2 |
| Rate limit hit | ✗ | P3 |

### 8.3 Audit Data Retention

**Current:** No retention policy - grows indefinitely

**Recommendation:**
```sql
-- Add retention job (run monthly)
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '2 years'
AND action NOT IN ('delete', 'user.remove');
```

---

## 9. Recommendations Summary

### P0 - Critical
1. **Implement transactions** for registration flow
2. **Add text field length limits** to prevent DoS

### P1 - High Priority
1. Add database check constraints for numeric fields
2. Document migration procedures
3. Implement transaction support for deal moves
4. Add audit logging for failed auth attempts

### P2 - Medium Priority
1. Create backup/restore runbook
2. Add down migrations for rollback capability
3. Implement soft delete cascading strategy
4. Add data validation tests

### P3 - Lower Priority
1. Implement audit log retention policy
2. Add orphan record detection queries
3. Create data integrity monitoring
4. Document zero-downtime migration patterns

---

## 10. Database Health Queries

### 10.1 Integrity Checks

```sql
-- Orphan tenants (no owner)
SELECT t.* FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'owner' AND u.deleted_at IS NULL
WHERE u.id IS NULL;

-- Deals with invalid stage
SELECT d.* FROM deals d
LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
WHERE d.stage_id IS NOT NULL AND ps.id IS NULL;

-- Contacts referencing deleted companies
SELECT c.* FROM contacts c
JOIN companies co ON co.id = c.company_id
WHERE co.deleted_at IS NOT NULL AND c.deleted_at IS NULL;

-- Duplicate email per tenant
SELECT tenant_id, email, COUNT(*)
FROM users
WHERE deleted_at IS NULL
GROUP BY tenant_id, email
HAVING COUNT(*) > 1;
```

### 10.2 Monitoring Queries

```sql
-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Index usage
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Slow queries (requires pg_stat_statements)
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```
