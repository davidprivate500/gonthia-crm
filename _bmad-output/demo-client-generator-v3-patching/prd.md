# PRD: Demo Client Generator v3 - Retroactive & Incremental Month Updates

## 1. Executive Summary

### 1.1 Problem Statement
The Master CRM has a Demo Client Generator that creates demo tenants with realistic data. However, once generated, demo tenants are static. Business needs require the ability to:
- Update existing demo tenants with additional data for new time periods
- Backfill historical months that were initially missed
- Adjust data to match updated target metrics
- Maintain data integrity and realism across patches

### 1.2 Solution Overview
Extend the Demo Client Generator with a **Monthly Patch System** that enables Master Admins to apply incremental updates to existing demo tenants. The system supports two modes:
- **ADDITIVE mode**: Safely add new records without modifying existing data
- **RECONCILE mode**: Adjust dataset to match new targets (future phase)

### 1.3 Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Patch KPI accuracy | 100% of targets met within tolerance | KPI verification report |
| Data integrity | 0 orphaned/inconsistent records | Referential integrity checks |
| Idempotency | 100% safe re-runs | Duplicate detection tests |
| Patch execution time | <60s for 3 months ADDITIVE | Performance monitoring |

---

## 2. User Stories

### 2.1 Primary User: Master Admin

**US-1: Select Demo Tenant for Patching**
> As a Master Admin, I want to select an existing demo tenant from the Demo Generator interface so that I can apply monthly updates to extend or modify its data.

**Acceptance Criteria:**
- Can filter tenants by `demo_generated=true`
- See current date range of existing data
- View current KPI summary per month
- Cannot patch non-demo tenants (validation enforced)

**US-2: Apply ADDITIVE Patch**
> As a Master Admin, I want to add new data to selected months using ADDITIVE mode so that the demo tenant has more historical data without risking modification of existing records.

**Acceptance Criteria:**
- Select months to patch (range or specific)
- Enter target deltas per metric per month
- Preview shows estimated records to be created
- System blocks negative deltas in ADDITIVE mode
- Patch creates records with correct timestamps in selected months
- KPI verification confirms targets met

**US-3: Define Patch via TARGETS or DELTAS**
> As a Master Admin, I want to specify my patch plan as either absolute TARGETS or incremental DELTAS so that I can use whichever input style is more convenient for my use case.

**Acceptance Criteria:**
- Toggle between TARGETS and DELTAS interpretation
- TARGETS mode: system computes delta = target - current
- DELTAS mode: system applies delta directly
- Preview shows computed changes before applying
- Validation blocks infeasible plans

**US-4: View Before/After KPI Comparison**
> As a Master Admin, I want to see a side-by-side comparison of KPIs before and after patching so that I can verify the patch achieved the intended results.

**Acceptance Criteria:**
- "Before" KPI snapshot taken before patch starts
- "After" KPI snapshot taken after patch completes
- Diff report shows delta and percentage change per metric
- Report persisted with patch job for audit

**US-5: Retroactive Month Patching**
> As a Master Admin, I want to add data to past months (e.g., October of last year) with correctly timestamped records so that the demo tenant appears to have natural historical evolution.

**Acceptance Criteria:**
- Can select any month from tenant creation date to current month
- Created records have timestamps within business hours of selected month
- Timestamps distributed realistically (weekday weighting, business hours)
- Lifecycle constraints honored (deal created before closed)

**US-6: Paste CSV Plan Import**
> As a Master Admin, I want to paste a CSV of monthly targets into the grid so that I can quickly import plans from spreadsheets.

**Acceptance Criteria:**
- Paste support in monthly grid
- Auto-parse columns (month, leads, contacts, companies, deals, etc.)
- Validation feedback on parse errors
- Preview before apply

---

## 3. Functional Requirements

### 3.1 Patch Job Management

| Requirement | Description | Priority |
|------------|-------------|----------|
| FR-1 | Create `demo_patch_jobs` table with full audit trail | P0 |
| FR-2 | Store before/after KPI snapshots in JSON columns | P0 |
| FR-3 | Track patch status (pending, running, completed, failed) | P0 |
| FR-4 | Link patch jobs to parent generation job | P0 |
| FR-5 | Support idempotent re-runs via job ID | P0 |

### 3.2 Patch Modes

| Mode | Behavior | Priority |
|------|----------|----------|
| ADDITIVE | Only create new records; never modify/delete existing | P0 (MVP) |
| RECONCILE | Create, modify, or soft-delete demo-generated records | P1 (Future) |

### 3.3 Plan Interpretation

| Type | Behavior | Priority |
|------|----------|----------|
| DELTAS | Apply provided values as additions | P0 (MVP) |
| TARGETS | Compute delta = target - current; apply delta | P0 (MVP) |

### 3.4 Metrics Supported

| Metric | Entity | Computation | Priority |
|--------|--------|-------------|----------|
| Leads Created | Contacts (status='lead') | COUNT where createdAt in month | P0 |
| Contacts Created | Contacts | COUNT where createdAt in month | P0 |
| Companies Created | Companies | COUNT where createdAt in month | P0 |
| Deals Created | Deals | COUNT where createdAt in month | P0 |
| Closed Won Count | Deals (won stage) | COUNT where stageId in wonStages AND createdAt in month | P0 |
| Closed Won Value | Deals (won stage) | SUM(value) where stageId in wonStages AND createdAt in month | P0 |
| Pipeline Added Value | Deals (non-lost) | SUM(value) for open + won deals | P0 |
| Activities Count | Activities | COUNT where createdAt in month | P1 |

### 3.5 Validation Rules

| Rule | Mode | Error Message |
|------|------|---------------|
| V-1: No negative deltas | ADDITIVE | "Cannot reduce {metric} in ADDITIVE mode. Computed delta: {value}" |
| V-2: Valid month range | Both | "Month {month} is in the future or before tenant creation" |
| V-3: Demo tenant only | Both | "Tenant {id} is not a demo-generated tenant" |
| V-4: Logical consistency | Both | "closedWonCount ({x}) cannot exceed dealsCreated ({y})" |
| V-5: Value consistency | Both | "closedWonValue requires closedWonCount > 0" |

### 3.6 Tagging & Provenance

| Requirement | Description | Priority |
|------------|-------------|----------|
| FR-6 | Add `demo_generated` boolean to contacts, companies, deals, activities | P0 |
| FR-7 | Add `demo_job_id` UUID linking to generation or patch job | P0 |
| FR-8 | Add `demo_source_month` varchar(7) for YYYY-MM tracking | P0 |
| FR-9 | All demo-created records must have provenance fields set | P0 |

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Patch job for 3 months with 500 entities/month: <60 seconds
- KPI snapshot calculation: <5 seconds per month
- Preview computation: <3 seconds

### 4.2 Reliability
- Atomic patch execution (all-or-nothing via transaction)
- Failed patches do not corrupt existing data
- Re-runnable without duplication (idempotent)

### 4.3 Security
- Master Admin authentication required
- CSRF protection on mutating endpoints
- Tenant isolation enforced (patch only affects target tenant)

### 4.4 Auditability
- Full patch plan stored in job record
- Before/after snapshots persisted
- Logs array tracks step-by-step progress
- All created records traceable to patch job ID

---

## 5. API Specification

### 5.1 Endpoints

```
POST /api/master/demo-generator/tenants/:tenantId/patch/validate
  - Validate patch plan without executing
  - Returns: { valid, errors, warnings, preview }

POST /api/master/demo-generator/tenants/:tenantId/patch/apply
  - Execute patch plan
  - Returns: { jobId, status }

GET /api/master/demo-generator/patch-jobs/:jobId
  - Get patch job details
  - Returns: { job, beforeKpis, afterKpis, diffReport }

GET /api/master/demo-generator/tenants/:tenantId/kpis
  - Query params: from=YYYY-MM, to=YYYY-MM
  - Returns: { months: [{ month, metrics }] }
```

### 5.2 Request/Response Schemas

**Patch Plan Input:**
```typescript
interface PatchPlanInput {
  mode: 'additive' | 'reconcile';
  planType: 'targets' | 'deltas';
  months: {
    month: string; // YYYY-MM
    metrics: {
      leadsCreated?: number;
      contactsCreated?: number;
      companiesCreated?: number;
      dealsCreated?: number;
      closedWonCount?: number;
      closedWonValue?: number;
      pipelineAddedValue?: number;
    };
  }[];
  tolerances?: {
    countTolerance: number;
    valueTolerance: number;
  };
  seed?: string;
}
```

**Patch Job Response:**
```typescript
interface PatchJobResponse {
  id: string;
  tenantId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  mode: 'additive' | 'reconcile';
  planType: 'targets' | 'deltas';
  patchPlan: PatchPlanInput;
  beforeKpis: MonthlyKpiSnapshot[];
  afterKpis: MonthlyKpiSnapshot[];
  diffReport: DiffReport;
  metrics: {
    recordsCreated: number;
    recordsModified: number;
    recordsDeleted: number;
  };
  progress: number;
  currentStep: string;
  logs: LogEntry[];
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}
```

---

## 6. Data Model Changes

### 6.1 New Table: demo_patch_jobs

```sql
CREATE TABLE demo_patch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  original_job_id UUID REFERENCES demo_generation_jobs(id),
  created_by_id UUID NOT NULL REFERENCES users(id),
  mode VARCHAR(20) NOT NULL DEFAULT 'additive',
  plan_type VARCHAR(20) NOT NULL DEFAULT 'deltas',
  patch_plan_json JSONB NOT NULL,
  seed VARCHAR(64) NOT NULL,
  range_start_month VARCHAR(7) NOT NULL,
  range_end_month VARCHAR(7) NOT NULL,
  tolerance_config JSONB,
  before_kpis_json JSONB,
  after_kpis_json JSONB,
  diff_report_json JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step VARCHAR(100),
  logs JSONB DEFAULT '[]',
  metrics_json JSONB,
  error_message TEXT,
  error_stack TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patch_jobs_tenant ON demo_patch_jobs(tenant_id);
CREATE INDEX idx_patch_jobs_status ON demo_patch_jobs(status);
CREATE INDEX idx_patch_jobs_created_at ON demo_patch_jobs(created_at DESC);
```

### 6.2 Entity Provenance Columns

Add to `contacts`, `companies`, `deals`, `activities`:

```sql
ALTER TABLE contacts ADD COLUMN demo_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN demo_job_id UUID;
ALTER TABLE contacts ADD COLUMN demo_source_month VARCHAR(7);

-- Similar for companies, deals, activities
```

---

## 7. UI Wireframes

### 7.1 Tenant Selection + Monthly Updates Tab
```
┌─────────────────────────────────────────────────────────────────┐
│ Demo Generator > Tenants > Acme Corp Demo                       │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Monthly Updates] [Jobs History]                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Current Data Range: Jan 2024 - Dec 2024                         │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Monthly KPI Summary                                         │ │
│ │ [Chart: stacked bar showing leads/contacts/deals by month]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Patch Configuration ─────────────────────────────────────┐   │
│ │ Mode:        [ADDITIVE ▼]  [RECONCILE - disabled]         │   │
│ │ Plan Type:   [DELTAS ▼]    [TARGETS]                      │   │
│ │ Date Range:  [Jan 2025 ▼]  to  [Mar 2025 ▼]               │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Monthly Patch Grid ──────────────────────────────────────┐   │
│ │ Month    │ Leads │ Contacts │ Companies │ Deals │ Won$ │...│   │
│ │ 2025-01  │ 50    │ 40       │ 10        │ 8     │ 25k  │   │   │
│ │ 2025-02  │ 60    │ 48       │ 12        │ 10    │ 32k  │   │   │
│ │ 2025-03  │ 70    │ 56       │ 14        │ 12    │ 40k  │   │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ [Paste CSV] [Quick Fill: +10% Growth]                           │
│                                                                 │
│ ┌─ Preview ─────────────────────────────────────────────────┐   │
│ │ Estimated records to create:                              │   │
│ │   Contacts: 144  │  Companies: 36  │  Deals: 30           │   │
│ │ Total closed won value: $97,000                           │   │
│ │ ✓ All metrics valid for ADDITIVE mode                     │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│             [Cancel]  [Validate]  [Apply Patch]                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Patch Job Progress & Results
```
┌─────────────────────────────────────────────────────────────────┐
│ Patch Job: pj_abc123                                            │
├─────────────────────────────────────────────────────────────────┤
│ Status: ✓ Completed                                             │
│ Duration: 45 seconds                                            │
│                                                                 │
│ ┌─ KPI Comparison ──────────────────────────────────────────┐   │
│ │ Metric         │ Before │ After  │ Delta  │ Target │ Pass │   │
│ │ Leads (Jan)    │ 0      │ 50     │ +50    │ 50     │ ✓    │   │
│ │ Leads (Feb)    │ 0      │ 60     │ +60    │ 60     │ ✓    │   │
│ │ ...                                                       │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Records Created ─────────────────────────────────────────┐   │
│ │ Contacts: 144  │  Companies: 36  │  Deals: 30             │   │
│ │ Activities: 288                                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│             [View Tenant]  [Export Report]  [Close]             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data corruption on failed patch | High | Low | Atomic transactions, rollback on error |
| Duplicate records on re-run | Medium | Medium | Idempotency via job ID + seed tracking |
| Lifecycle constraint violations | Medium | Medium | Validate deal dates, contact exists before activity |
| Performance degradation | Medium | Low | Batch inserts, progress tracking, async execution |
| Tenant isolation breach | Critical | Very Low | TenantId validation at API and query level |

---

## 9. Release Plan

### Phase 1: MVP (This Release)
- ADDITIVE mode only
- DELTAS and TARGETS input
- Entity provenance tagging
- Before/after KPI snapshots
- Basic patch job UI

### Phase 2: Enhanced
- RECONCILE mode
- Soft-delete support
- Activity count patching
- CSV import improvements

### Phase 3: Advanced
- Patch templates (e.g., "Holiday dip", "Q4 surge")
- Scheduled patches
- Patch conflict detection

---

## 10. Appendix

### A. Example Patch Plans

**DELTAS Example (JSON):**
```json
{
  "mode": "additive",
  "planType": "deltas",
  "months": [
    {
      "month": "2025-01",
      "metrics": {
        "leadsCreated": 50,
        "contactsCreated": 40,
        "companiesCreated": 10,
        "dealsCreated": 8,
        "closedWonCount": 3,
        "closedWonValue": 25000,
        "pipelineAddedValue": 75000
      }
    }
  ],
  "tolerances": {
    "countTolerance": 0,
    "valueTolerance": 0.005
  }
}
```

**CSV Paste Format:**
```csv
month,leadsCreated,contactsCreated,companiesCreated,dealsCreated,closedWonCount,closedWonValue,pipelineAddedValue
2025-01,50,40,10,8,3,25000,75000
2025-02,60,48,12,10,4,32000,96000
2025-03,70,56,14,12,5,40000,120000
```

### B. Glossary

| Term | Definition |
|------|------------|
| Patch | Incremental update to an existing demo tenant's data |
| ADDITIVE mode | Patch mode that only adds new records |
| RECONCILE mode | Patch mode that can modify or remove existing records |
| TARGETS | Plan interpretation where values are desired totals |
| DELTAS | Plan interpretation where values are amounts to add |
| Provenance | Tracking fields that identify how/when a record was created |
