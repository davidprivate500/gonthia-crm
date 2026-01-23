# Risk Register: Demo Client Generator v3 - Patching System

## Risk Assessment Matrix

| Likelihood | Impact | Risk Level |
|------------|--------|------------|
| High | High | Critical |
| High | Medium | High |
| Medium | High | High |
| Medium | Medium | Medium |
| Low | High | Medium |
| Low | Medium | Low |
| Low | Low | Low |

---

## Identified Risks

### R1: Data Corruption from Failed Patch

**Risk ID:** R1
**Category:** Technical / Data Integrity
**Likelihood:** Medium
**Impact:** High
**Risk Level:** HIGH

**Description:**
A patch operation could fail mid-execution, leaving the database in an inconsistent state with partial data created.

**Potential Causes:**
- Database connection timeout during batch insert
- Memory exhaustion on large patches
- Unexpected constraint violations
- Server restart during execution

**Mitigation Strategies:**
1. **Transaction wrapping**: All entity creation within single database transaction
2. **Atomic commit**: Only commit after all operations succeed
3. **Rollback on error**: Automatic rollback on any failure
4. **Job status tracking**: Mark job as failed with error details

**Contingency Plan:**
- If partial data exists, identify by demo_job_id and delete
- Provide manual cleanup script
- Job can be safely retried after cleanup

**Owner:** Backend Developer
**Status:** Mitigated by design

---

### R2: Duplicate Records on Retry

**Risk ID:** R2
**Category:** Technical / Data Integrity
**Likelihood:** Medium
**Impact:** Medium
**Risk Level:** MEDIUM

**Description:**
Re-running a patch job (intentionally or accidentally) could create duplicate records, skewing metrics.

**Potential Causes:**
- User clicks "Apply" twice
- Network timeout causes retry
- Job status not updated correctly

**Mitigation Strategies:**
1. **Idempotency check**: Before creating entities, verify none exist with this job ID
2. **Deterministic seeding**: Same seed produces same entity IDs
3. **UI disable**: Disable Apply button during execution
4. **Job status gate**: Don't execute if job already completed

**Contingency Plan:**
- Query records by demo_job_id to identify duplicates
- Provide deduplication script
- Log all idempotency detections

**Owner:** Backend Developer
**Status:** Mitigated by design

---

### R3: Non-Demo Tenant Modification

**Risk ID:** R3
**Category:** Security / Data Integrity
**Likelihood:** Low
**Impact:** Critical
**Risk Level:** HIGH

**Description:**
A bug or bypass could allow patching of a production (non-demo) tenant, corrupting real customer data.

**Potential Causes:**
- Missing tenant validation
- SQL injection allowing tenant ID override
- Race condition in validation

**Mitigation Strategies:**
1. **Mandatory demo check**: All patch operations verify `is_demo_generated = true`
2. **Schema enforcement**: Consider database constraint preventing demo_job_id on non-demo tenants
3. **Double validation**: Check at API layer and engine layer
4. **Audit logging**: Log all patch attempts with tenant details

**Contingency Plan:**
- If real data modified, use demo_job_id to identify and remove
- Notify affected customer
- Post-incident review

**Owner:** Security / Backend Developer
**Status:** Mitigated by design

---

### R4: KPI Calculation Inconsistency

**Risk ID:** R4
**Category:** Technical / Accuracy
**Likelihood:** Medium
**Impact:** Medium
**Risk Level:** MEDIUM

**Description:**
KPI calculations might differ between snapshot and verification, leading to false pass/fail results.

**Potential Causes:**
- Race condition between snapshot and entity creation
- Different query logic in different code paths
- Timezone handling differences
- Floating point precision issues for values

**Mitigation Strategies:**
1. **Single source of truth**: One KPI query method used everywhere
2. **Timestamp consistency**: All queries use UTC
3. **Decimal precision**: Use proper decimal type for monetary values
4. **Integration tests**: Verify snapshot consistency

**Contingency Plan:**
- Manual KPI verification via SQL
- Configurable tolerance to absorb minor differences

**Owner:** Backend Developer
**Status:** Mitigated by design

---

### R5: Performance Degradation on Large Patches

**Risk ID:** R5
**Category:** Technical / Performance
**Likelihood:** Medium
**Impact:** Medium
**Risk Level:** MEDIUM

**Description:**
Large patch operations (many months, high record counts) could cause timeout or memory issues.

**Potential Causes:**
- Creating 10,000+ records in one patch
- Complex KPI queries on large tables
- Memory accumulation in batch processing

**Mitigation Strategies:**
1. **Batch inserts**: Insert in chunks of 500 records
2. **Streaming processing**: Don't load all records in memory
3. **Progress updates**: Frequent status updates to prevent timeout appearance
4. **Size limits**: Cap maximum months (24) and total records per patch

**Contingency Plan:**
- Increase timeout for patch jobs
- Split large patches into smaller chunks
- Add queue-based processing for very large patches

**Owner:** Backend Developer
**Status:** Partially mitigated

---

### R6: Lifecycle Constraint Violations

**Risk ID:** R6
**Category:** Technical / Data Quality
**Likelihood:** Medium
**Impact:** Low
**Risk Level:** LOW

**Description:**
Generated data might violate logical constraints (e.g., deal closed before created, activity for non-existent contact).

**Potential Causes:**
- Incorrect timestamp generation
- Missing relationship validation
- Edge cases in allocation logic

**Mitigation Strategies:**
1. **Constraint validation**: Validate before insert
2. **Order of operations**: Create contacts before activities, deals after contacts
3. **Timestamp bounds**: Enforce deal.closedAt >= deal.createdAt
4. **Foreign key checks**: Verify referenced entities exist

**Contingency Plan:**
- Identify invalid records via queries
- Fix or remove invalid data
- Add stricter validation

**Owner:** Backend Developer
**Status:** Mitigated by design

---

### R7: Tenant Isolation Breach

**Risk ID:** R7
**Category:** Security
**Likelihood:** Low
**Impact:** Critical
**Risk Level:** HIGH

**Description:**
A patch operation could accidentally create or modify records in the wrong tenant.

**Potential Causes:**
- Missing tenantId in insert statements
- Incorrect join in update queries
- Context leakage between concurrent patches

**Mitigation Strategies:**
1. **Explicit tenantId**: Every insert includes tenantId from context
2. **Validation assertions**: Runtime check that entity.tenantId matches target
3. **Isolated context**: Each patch job has isolated context object
4. **No cross-tenant queries**: All queries scoped to single tenant

**Contingency Plan:**
- Use demo_job_id to identify misplaced records
- Move or delete records as needed
- Security review of code paths

**Owner:** Security / Backend Developer
**Status:** Mitigated by design

---

### R8: UI State Desync

**Risk ID:** R8
**Category:** UX / Technical
**Likelihood:** Medium
**Impact:** Low
**Risk Level:** LOW

**Description:**
UI could show stale data after patch completion, confusing users.

**Potential Causes:**
- Cached KPI data not refreshed
- WebSocket/polling failure
- Component unmount during operation

**Mitigation Strategies:**
1. **Force refresh**: Invalidate caches after patch completion
2. **Polling with backoff**: Regular status checks during execution
3. **Completion notification**: Clear signal when patch done
4. **Manual refresh option**: User can refresh data

**Contingency Plan:**
- User refreshes page
- Clear browser cache
- Add "Refresh Data" button

**Owner:** Frontend Developer
**Status:** Partially mitigated

---

### R9: Provenance Backfill Incomplete

**Risk ID:** R9
**Category:** Technical / Migration
**Likelihood:** Low
**Impact:** Medium
**Risk Level:** LOW

**Description:**
Existing demo data might not have provenance fields populated correctly after migration.

**Potential Causes:**
- Backfill script errors
- Records created during migration window
- Edge cases in date-to-month conversion

**Mitigation Strategies:**
1. **Comprehensive backfill script**: Handle all entity types
2. **Verification queries**: Count records with/without provenance
3. **Idempotent script**: Safe to re-run
4. **Logging**: Detailed logs of backfill progress

**Contingency Plan:**
- Re-run backfill script
- Manual fixes for edge cases
- Accept some records may not have full provenance

**Owner:** Backend Developer
**Status:** Requires implementation

---

### R10: RECONCILE Mode Data Loss

**Risk ID:** R10
**Category:** Technical / Data Integrity
**Likelihood:** Medium
**Impact:** High
**Risk Level:** HIGH (Future)

**Description:**
RECONCILE mode could delete or modify important demo data unintentionally.

**Potential Causes:**
- User error in target specification
- Bug in modification logic
- Unclear UI about consequences

**Mitigation Strategies:**
1. **Defer to Phase 2**: Don't implement RECONCILE in MVP
2. **Soft delete only**: Never hard delete, only mark as void
3. **Confirmation dialogs**: Require explicit confirmation for modifications
4. **Backup before modify**: Snapshot data before RECONCILE

**Contingency Plan:**
- Restore from backup
- Regenerate affected months
- Review RECONCILE logic

**Owner:** Product / Backend Developer
**Status:** Deferred to Phase 2

---

## Risk Summary by Level

| Risk Level | Count | Risks |
|------------|-------|-------|
| Critical | 0 | - |
| High | 3 | R1, R3, R7 |
| Medium | 4 | R2, R4, R5, R10 |
| Low | 3 | R6, R8, R9 |

---

## Monitoring & Alerts

### Metrics to Track

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Patch job failure rate | >5% | Investigate logs |
| Patch duration | >120s | Review performance |
| KPI verification failures | >10% | Check calculation logic |
| Duplicate detection events | Any | Review idempotency |
| Non-demo tenant patch attempts | Any | Security review |

### Log Events to Monitor

```
PATCH_JOB_STARTED
PATCH_JOB_COMPLETED
PATCH_JOB_FAILED
PATCH_IDEMPOTENCY_DETECTED
PATCH_VALIDATION_FAILED
KPI_VERIFICATION_FAILED
NON_DEMO_TENANT_BLOCKED
```

---

## Review Schedule

| Review Type | Frequency | Participants |
|-------------|-----------|--------------|
| Risk assessment update | Monthly | Tech Lead, PM |
| Incident review | Per incident | Team |
| Security review | Quarterly | Security, Backend |
| Performance review | Monthly | Backend, DevOps |
