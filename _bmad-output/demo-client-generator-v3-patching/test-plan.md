# Test Plan: Demo Client Generator v3 - Patching System

## 1. Overview

### 1.1 Scope
This test plan covers the Demo Client Generator v3 patching system, including:
- Database schema changes and provenance tracking
- KPI aggregation and snapshot functionality
- Patch validation and planning
- Patch engine execution (ADDITIVE mode)
- API endpoints
- UI components

### 1.2 Test Environments
| Environment | Purpose | Database |
|-------------|---------|----------|
| Unit | Component isolation | Mocked |
| Integration | Service integration | Test PostgreSQL |
| E2E | Full flow validation | Test PostgreSQL |
| Staging | Pre-production | Staging PostgreSQL |

### 1.3 Test Data Requirements
- Demo tenant with 12 months of existing data
- Demo tenant with no data (freshly created)
- Non-demo tenant (for negative tests)
- Multiple patch job states (pending, running, completed, failed)

---

## 2. Unit Tests

### 2.1 KPI Aggregator Tests

**File:** `lib/demo-generator/engine/__tests__/kpi-aggregator.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| KPI-U1 | Query KPIs for month with data | Returns correct counts/values |
| KPI-U2 | Query KPIs for month with no data | Returns zeros |
| KPI-U3 | Query KPIs for multiple months | Returns array with all months |
| KPI-U4 | Handle deleted records (soft delete) | Excludes deleted records |
| KPI-U5 | Calculate closed won value correctly | Sums only won deals |
| KPI-U6 | Calculate pipeline value correctly | Excludes lost deals |
| KPI-U7 | Differentiate leads from contacts | Correct status filtering |
| KPI-U8 | Create snapshot with timestamp | Includes accurate timestamp |
| KPI-U9 | Compute diff between snapshots | Correct delta calculations |
| KPI-U10 | Evaluate pass/fail with tolerance | Respects tolerance config |

```typescript
// Example test case
describe('KpiAggregator', () => {
  it('KPI-U1: should return correct counts for month with data', async () => {
    // Setup: Insert test data for January 2024
    await insertTestContacts(tenantId, '2024-01', 50);
    await insertTestDeals(tenantId, '2024-01', 10, { wonCount: 3, wonValue: 25000 });

    const aggregator = new KpiAggregator(db);
    const kpis = await aggregator.queryMonthlyKpis(tenantId, '2024-01', '2024-01');

    expect(kpis[0]).toEqual({
      month: '2024-01',
      metrics: {
        leadsCreated: expect.any(Number),
        contactsCreated: 50,
        companiesCreated: expect.any(Number),
        dealsCreated: 10,
        closedWonCount: 3,
        closedWonValue: 25000,
        pipelineAddedValue: expect.any(Number),
      },
      snapshotAt: expect.any(String),
    });
  });
});
```

---

### 2.2 Patch Validator Tests

**File:** `lib/demo-generator/engine/__tests__/patch-validator.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| VAL-U1 | Valid ADDITIVE plan with positive deltas | valid: true |
| VAL-U2 | ADDITIVE plan with negative delta | valid: false, error message |
| VAL-U3 | Month in future | valid: false, error message |
| VAL-U4 | Month before tenant creation | valid: false, error message |
| VAL-U5 | closedWonCount > dealsCreated | valid: false, error message |
| VAL-U6 | leadsCreated > contactsCreated | valid: false, error message |
| VAL-U7 | Non-demo tenant | valid: false, error message |
| VAL-U8 | Empty months array | valid: false, error message |
| VAL-U9 | More than 24 months | valid: false, error message |
| VAL-U10 | Duplicate months in plan | valid: false, error message |
| VAL-U11 | Valid plan returns warnings for high growth | valid: true, warnings array |

---

### 2.3 Patch Planner Tests

**File:** `lib/demo-generator/engine/__tests__/patch-planner.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PLN-U1 | DELTAS mode returns provided values | Deltas match input |
| PLN-U2 | TARGETS mode computes positive delta | delta = target - current |
| PLN-U3 | TARGETS mode with higher current | Blocker returned for ADDITIVE |
| PLN-U4 | TARGETS with equal current and target | Zero delta |
| PLN-U5 | Mixed metrics (some undefined) | Only defined metrics in output |
| PLN-U6 | Generate preview with record estimates | Reasonable estimates |

---

### 2.4 Monthly Patch Allocator Tests

**File:** `lib/demo-generator/engine/__tests__/monthly-patch-allocator.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| ALLOC-U1 | Allocate contacts to business days | Sum equals total, weekdays only |
| ALLOC-U2 | Weekday weighting applied | Tue-Thu have more than Mon/Fri |
| ALLOC-U3 | Value allocation sums to target | Total value matches exactly |
| ALLOC-U4 | Handle month with holidays | Skips weekends correctly |
| ALLOC-U5 | Single day allocation | All records on one day |
| ALLOC-U6 | Zero delta allocation | Returns empty allocation |

---

### 2.5 Entity Creator Tests

**File:** `lib/demo-generator/engine/__tests__/entity-creator.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| ENT-U1 | Create contacts with provenance | demo_generated=true, job_id set |
| ENT-U2 | Create contacts with correct status | Leads have status='lead' |
| ENT-U3 | Create companies with provenance | demo_generated=true, job_id set |
| ENT-U4 | Create deals with value allocation | Values sum to target |
| ENT-U5 | Create deals with stage distribution | Won deals in won stages |
| ENT-U6 | Create activities linked to contacts | Foreign keys valid |
| ENT-U7 | Timestamps within business hours | 9am-6pm weekdays |
| ENT-U8 | Timestamps in correct month | All dates within target month |
| ENT-U9 | Batch insert performance | <100ms for 500 records |

---

### 2.6 Patch Engine Tests

**File:** `lib/demo-generator/engine/__tests__/patch-engine.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| ENG-U1 | Execute valid patch job | Status: completed |
| ENG-U2 | Rollback on error | No records created |
| ENG-U3 | Progress updates during execution | 0 → 100 progression |
| ENG-U4 | Before KPIs captured | beforeKpisJson populated |
| ENG-U5 | After KPIs captured | afterKpisJson populated |
| ENG-U6 | Diff report generated | diffReportJson populated |
| ENG-U7 | Idempotency on re-run | No duplicate records |
| ENG-U8 | Error details on failure | errorMessage populated |

---

## 3. Integration Tests

### 3.1 Database Integration

**File:** `__tests__/integration/patch-db.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| DB-I1 | Provenance columns exist on contacts | Columns queryable |
| DB-I2 | Provenance columns exist on companies | Columns queryable |
| DB-I3 | Provenance columns exist on deals | Columns queryable |
| DB-I4 | Provenance columns exist on activities | Columns queryable |
| DB-I5 | demo_patch_jobs table exists | Table queryable |
| DB-I6 | Foreign keys enforced | Invalid refs rejected |
| DB-I7 | Indexes improve query performance | Explain shows index use |

---

### 3.2 API Integration

**File:** `__tests__/integration/patch-api.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| API-I1 | GET /kpis returns monthly data | 200, KPI array |
| API-I2 | GET /kpis with invalid tenant | 404 |
| API-I3 | POST /validate with valid plan | 200, valid: true |
| API-I4 | POST /validate with invalid plan | 400, errors array |
| API-I5 | POST /apply creates job | 200, jobId returned |
| API-I6 | POST /apply without CSRF | 403 |
| API-I7 | GET /patch-jobs/:id returns job | 200, job details |
| API-I8 | GET /patch-jobs/:id not found | 404 |
| API-I9 | All endpoints require master admin | 401/403 for others |

---

### 3.3 Full Patch Flow Integration

**File:** `__tests__/integration/patch-flow.test.ts`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| FLOW-I1 | Complete ADDITIVE patch with DELTAS | Records created, KPIs match |
| FLOW-I2 | Complete ADDITIVE patch with TARGETS | Deltas computed, KPIs match |
| FLOW-I3 | Patch multiple months | All months have correct data |
| FLOW-I4 | Patch month with existing data | Adds to existing, no overwrite |
| FLOW-I5 | Verify KPI tolerance checking | Pass within tolerance |
| FLOW-I6 | Verify provenance on all records | All have demo_job_id |

```typescript
// Example integration test
describe('Patch Flow Integration', () => {
  it('FLOW-I1: should complete ADDITIVE patch with DELTAS', async () => {
    // Setup: Create demo tenant
    const tenant = await createDemoTenant();

    // Define patch plan
    const plan = {
      mode: 'additive',
      planType: 'deltas',
      months: [{
        month: '2025-01',
        metrics: {
          contactsCreated: 50,
          dealsCreated: 10,
          closedWonCount: 3,
          closedWonValue: 25000,
        },
      }],
    };

    // Validate
    const validateRes = await api.post(`/tenants/${tenant.id}/patch/validate`, plan);
    expect(validateRes.data.valid).toBe(true);

    // Apply
    const applyRes = await api.post(`/tenants/${tenant.id}/patch/apply`, plan);
    const jobId = applyRes.data.jobId;

    // Wait for completion
    await waitForJobCompletion(jobId);

    // Verify
    const job = await api.get(`/patch-jobs/${jobId}`);
    expect(job.data.status).toBe('completed');
    expect(job.data.diffReport.overallPassed).toBe(true);

    // Verify records created
    const contacts = await db.select().from(contactsTable)
      .where(eq(contactsTable.demoJobId, jobId));
    expect(contacts.length).toBe(50);
  });
});
```

---

## 4. Component Tests (UI)

### 4.1 Patch Plan Grid Tests

**File:** `components/demo-generator/__tests__/patch-plan-grid.test.tsx`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| GRID-C1 | Render with empty months | Shows empty grid |
| GRID-C2 | Edit cell updates value | onChange called with new value |
| GRID-C3 | Tab navigation between cells | Focus moves correctly |
| GRID-C4 | Invalid value shows error | Red border on cell |
| GRID-C5 | Totals row calculates sum | Correct totals displayed |
| GRID-C6 | CSV paste populates grid | Values populated correctly |
| GRID-C7 | Currency formatting on blur | Values formatted |

---

### 4.2 Patch Preview Tests

**File:** `components/demo-generator/__tests__/patch-preview.test.tsx`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PREV-C1 | Show validation success | Green status banner |
| PREV-C2 | Show validation errors | Error list visible |
| PREV-C3 | Show record estimates | Table with estimates |
| PREV-C4 | Apply button calls handler | onApply invoked |
| PREV-C5 | Back button calls handler | onBack invoked |
| PREV-C6 | Loading state during apply | Button disabled |

---

### 4.3 KPI Chart Tests

**File:** `components/demo-generator/__tests__/tenant-kpi-chart.test.tsx`

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| CHART-C1 | Render with KPI data | Chart visible |
| CHART-C2 | Metric selector changes chart | Data updates |
| CHART-C3 | Hover shows tooltip | Tooltip with values |
| CHART-C4 | Empty data shows message | "No data" displayed |

---

## 5. E2E Tests

**File:** `e2e/patch-demo-tenant.spec.ts`

| Test ID | Description | Steps |
|---------|-------------|-------|
| E2E-1 | Complete patch flow via UI | Login → Navigate → Configure → Preview → Apply → Verify |
| E2E-2 | Validate then apply | Validate shows preview → Apply creates data |
| E2E-3 | CSV paste and apply | Paste CSV → Verify grid → Apply |
| E2E-4 | View patch history | Apply patch → Navigate to history → See job |
| E2E-5 | Error recovery | Enter invalid plan → See errors → Fix → Apply succeeds |

```typescript
// E2E test example (Playwright)
test('E2E-1: Complete patch flow via UI', async ({ page }) => {
  // Login as master admin
  await loginAsMasterAdmin(page);

  // Navigate to demo generator
  await page.click('text=Demo Generator');

  // Select demo tenant
  await page.click(`[data-tenant-id="${demoTenantId}"]`);

  // Go to Monthly Updates tab
  await page.click('text=Monthly Updates');

  // Click Add Monthly Update
  await page.click('text=Add Monthly Update');

  // Configure patch
  await page.selectOption('[name=planType]', 'deltas');
  await page.fill('[data-month="2025-01"][data-metric="contactsCreated"]', '50');
  await page.fill('[data-month="2025-01"][data-metric="dealsCreated"]', '10');

  // Preview
  await page.click('text=Preview Changes');
  await expect(page.locator('text=Plan is valid')).toBeVisible();

  // Apply
  await page.click('text=Apply Patch');

  // Wait for completion
  await expect(page.locator('text=Patch Complete')).toBeVisible({ timeout: 60000 });

  // Verify results
  await expect(page.locator('text=All metrics met targets')).toBeVisible();
});
```

---

## 6. Negative Test Cases

### 6.1 Security Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| SEC-N1 | Patch non-demo tenant | 400, error: not demo tenant |
| SEC-N2 | Patch without authentication | 401, unauthorized |
| SEC-N3 | Patch as non-master admin | 403, forbidden |
| SEC-N4 | Patch with missing CSRF | 403, CSRF required |
| SEC-N5 | SQL injection in tenant ID | 400, invalid UUID |
| SEC-N6 | Patch deleted tenant | 404, tenant not found |

---

### 6.2 Validation Negative Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| VAL-N1 | ADDITIVE with negative leadsCreated | Validation error |
| VAL-N2 | closedWonValue without closedWonCount | Validation error |
| VAL-N3 | Month format invalid (2025/01) | Validation error |
| VAL-N4 | Month in distant future (2030-01) | Validation error |
| VAL-N5 | Empty patch plan | Validation error |
| VAL-N6 | 25+ months in plan | Validation error |

---

### 6.3 Edge Cases

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| EDGE-1 | Patch first month of tenant history | Success, handles boundary |
| EDGE-2 | Patch current month | Success, partial month OK |
| EDGE-3 | Zero values in all metrics | Creates no records, success |
| EDGE-4 | Very large values (1M contacts) | Fails fast with size error |
| EDGE-5 | Concurrent patches same tenant | Second blocked or queued |
| EDGE-6 | Patch during generation job | Blocked, tenant busy |

---

## 7. Performance Tests

### 7.1 Benchmarks

| Test ID | Scenario | Target | Measurement |
|---------|----------|--------|-------------|
| PERF-1 | KPI query for 12 months | <3s | Query time |
| PERF-2 | Create 500 contacts | <5s | Insert time |
| PERF-3 | Create 100 deals with values | <3s | Insert time |
| PERF-4 | Full 3-month patch (500/month) | <60s | Total time |
| PERF-5 | Validation of 24-month plan | <2s | Validation time |
| PERF-6 | Preview generation | <3s | Response time |

---

### 7.2 Load Tests

| Test ID | Scenario | Target |
|---------|----------|--------|
| LOAD-1 | 5 concurrent patch validations | All succeed |
| LOAD-2 | Patch while 1000 contacts exist | No degradation |
| LOAD-3 | UI responsiveness during patch | No blocking |

---

## 8. Regression Tests

After each change, run:

1. **Full unit test suite** - All tests pass
2. **Integration test suite** - All API tests pass
3. **E2E smoke test** - E2E-1 passes
4. **Performance benchmark** - PERF-4 within target

---

## 9. Test Data Setup

### 9.1 Fixtures

```typescript
// fixtures/demo-tenant.ts
export async function createDemoTenantWithData() {
  const tenant = await createTenant({ name: 'Test Demo Corp' });
  await createDemoMetadata(tenant.id, { isDemoGenerated: true });

  // Create 12 months of data
  for (let month = 1; month <= 12; month++) {
    const monthStr = `2024-${String(month).padStart(2, '0')}`;
    await insertContacts(tenant.id, monthStr, 50 + month * 5);
    await insertDeals(tenant.id, monthStr, 10 + month);
  }

  return tenant;
}

export async function createEmptyDemoTenant() {
  const tenant = await createTenant({ name: 'Empty Demo Corp' });
  await createDemoMetadata(tenant.id, { isDemoGenerated: true });
  return tenant;
}

export async function createNonDemoTenant() {
  return createTenant({ name: 'Real Corp' });
  // No demo metadata = not demo-generated
}
```

### 9.2 Test Database Reset

```typescript
// Reset before each test file
beforeAll(async () => {
  await resetTestDatabase();
});

// Cleanup after each test
afterEach(async () => {
  await cleanupTestData();
});
```

---

## 10. Acceptance Criteria Verification

### MVP Acceptance Criteria Mapping

| AC | Test Coverage |
|----|---------------|
| AC-1: Apply patch to existing demo tenant | FLOW-I1, E2E-1 |
| AC-2: Data timestamped in target months | ENT-U8, FLOW-I3 |
| AC-3: Before/after KPI snapshots | ENG-U4, ENG-U5, FLOW-I1 |
| AC-4: Targets met within tolerance | ENG-U6, FLOW-I5 |
| AC-5: Idempotent re-run | ENG-U7 |
| AC-6: Tenant isolation | SEC-N1, R7 tests |

---

## 11. Bug Reporting Template

```markdown
## Bug Report

**Test ID:** [Test ID that failed]
**Environment:** [Unit/Integration/E2E/Staging]
**Date:** [Date]

### Description
[What went wrong]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Result
[What should happen]

### Actual Result
[What actually happened]

### Logs/Screenshots
[Attach relevant logs or screenshots]

### Severity
[ ] Critical - Blocks release
[ ] High - Major functionality broken
[ ] Medium - Workaround exists
[ ] Low - Minor issue
```
