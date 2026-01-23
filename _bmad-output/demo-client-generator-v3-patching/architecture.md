# Architecture: Demo Client Generator v3 - Patching System

## 1. System Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Master Admin UI                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ Tenant List │  │Monthly KPI  │  │ Patch Grid   │  │ Job Progress  │   │
│  │ Selection   │  │ Chart/Table │  │ Editor       │  │ & Results     │   │
│  └─────────────┘  └─────────────┘  └──────────────┘  └───────────────┘   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTP/REST
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           API Layer                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ /api/master/demo-generator/tenants/:tenantId/...                    │ │
│  │   POST /patch/validate  - Validate patch plan                       │ │
│  │   POST /patch/apply     - Execute patch                             │ │
│  │   GET  /kpis            - Query tenant KPIs                         │ │
│  │ /api/master/demo-generator/patch-jobs/:jobId                        │ │
│  │   GET  /                - Get job status/results                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────────┐ │
│  │ KPI           │  │ Patch         │  │ Patch Engine                  │ │
│  │ Aggregator    │  │ Validator     │  │                               │ │
│  │               │  │               │  │  ┌─────────────────────────┐  │ │
│  │ - snapshot()  │  │ - validate()  │  │  │ PatchPlanner            │  │ │
│  │ - query()     │  │ - preview()   │  │  │ - computeDeltas()       │  │ │
│  │ - diff()      │  │               │  │  │ - validateConstraints() │  │ │
│  └───────────────┘  └───────────────┘  │  └─────────────────────────┘  │ │
│                                        │  ┌─────────────────────────┐  │ │
│  ┌───────────────────────────────────┐ │  │ MonthlyPatchAllocator   │  │ │
│  │ Existing Engine Components        │ │  │ - allocateDeltas()      │  │ │
│  │  - SeededRNG                      │ │  │ - dailyDistribution()   │  │ │
│  │  - MonthlyAllocator               │ │  └─────────────────────────┘  │ │
│  │  - ValueAllocator                 │ │  ┌─────────────────────────┐  │ │
│  │  - Industry Templates             │ │  │ EntityCreator           │  │ │
│  └───────────────────────────────────┘ │  │ - createContacts()      │  │ │
│                                        │  │ - createCompanies()     │  │ │
│                                        │  │ - createDeals()         │  │ │
│                                        │  │ - createActivities()    │  │ │
│                                        │  └─────────────────────────┘  │ │
│                                        └───────────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                        │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐ │
│  │ demo_patch_jobs   │  │ Core Entities     │  │ demo_tenant_metadata  │ │
│  │                   │  │                   │  │                       │ │
│  │ - patch_plan_json │  │ contacts          │  │ - is_demo_generated   │ │
│  │ - before_kpis     │  │ companies         │  │ - generation_job_id   │ │
│  │ - after_kpis      │  │ deals             │  │                       │ │
│  │ - diff_report     │  │ activities        │  │                       │ │
│  │ - status          │  │                   │  │                       │ │
│  │                   │  │ + demo_generated  │  │                       │ │
│  │                   │  │ + demo_job_id     │  │                       │ │
│  │                   │  │ + demo_source_mo  │  │                       │ │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility | Location |
|-----------|---------------|----------|
| **KPI Aggregator** | Query actual metrics per month, snapshot before/after | `lib/demo-generator/engine/kpi-aggregator.ts` |
| **Patch Validator** | Validate patch plans, check constraints | `lib/demo-generator/engine/patch-validator.ts` |
| **Patch Planner** | Compute deltas from targets, plan execution | `lib/demo-generator/engine/patch-planner.ts` |
| **Monthly Patch Allocator** | Distribute deltas to daily buckets | `lib/demo-generator/engine/monthly-patch-allocator.ts` |
| **Patch Engine** | Orchestrate patch execution | `lib/demo-generator/engine/patch-engine.ts` |
| **Entity Creator** | Create individual entities with provenance | `lib/demo-generator/engine/entity-creator.ts` |

---

## 2. Data Model

### 2.1 New Table: demo_patch_jobs

```typescript
// drizzle/schema.ts

export const demoPatchModeEnum = pgEnum('demo_patch_mode', ['additive', 'reconcile']);
export const demoPatchPlanTypeEnum = pgEnum('demo_patch_plan_type', ['targets', 'deltas']);

export const demoPatchJobs = pgTable('demo_patch_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  originalJobId: uuid('original_job_id').references(() => demoGenerationJobs.id),
  createdById: uuid('created_by_id').notNull().references(() => users.id),

  // Patch configuration
  mode: demoPatchModeEnum('mode').notNull().default('additive'),
  planType: demoPatchPlanTypeEnum('plan_type').notNull().default('deltas'),
  patchPlanJson: json('patch_plan_json').notNull(),
  seed: varchar('seed', { length: 64 }).notNull(),
  rangeStartMonth: varchar('range_start_month', { length: 7 }).notNull(),
  rangeEndMonth: varchar('range_end_month', { length: 7 }).notNull(),
  toleranceConfig: json('tolerance_config'),

  // KPI tracking
  beforeKpisJson: json('before_kpis_json'),
  afterKpisJson: json('after_kpis_json'),
  diffReportJson: json('diff_report_json'),

  // Execution status
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  progress: integer('progress').notNull().default(0),
  currentStep: varchar('current_step', { length: 100 }),
  logs: json('logs').default([]),
  metricsJson: json('metrics_json'),

  // Error handling
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),

  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idxPatchJobsTenant: index('idx_patch_jobs_tenant').on(table.tenantId),
  idxPatchJobsStatus: index('idx_patch_jobs_status').on(table.status),
  idxPatchJobsCreatedAt: index('idx_patch_jobs_created_at').on(table.createdAt),
  idxPatchJobsOriginalJob: index('idx_patch_jobs_original_job').on(table.originalJobId),
}));
```

### 2.2 Entity Provenance Columns

```typescript
// Add to existing tables: contacts, companies, deals, activities

// contacts table extension
demoGenerated: boolean('demo_generated').default(false),
demoJobId: uuid('demo_job_id'),
demoSourceMonth: varchar('demo_source_month', { length: 7 }),

// Index for provenance queries
idxContactsDemoGenerated: index('idx_contacts_demo_generated')
  .on(table.tenantId, table.demoGenerated),
idxContactsDemoJob: index('idx_contacts_demo_job').on(table.demoJobId),
```

### 2.3 Type Definitions

```typescript
// lib/demo-generator/types.ts - additions

export type PatchMode = 'additive' | 'reconcile';
export type PatchPlanType = 'targets' | 'deltas';

export interface PatchMetrics {
  leadsCreated?: number;
  contactsCreated?: number;
  companiesCreated?: number;
  dealsCreated?: number;
  closedWonCount?: number;
  closedWonValue?: number;
  pipelineAddedValue?: number;
  activitiesCreated?: number;
}

export interface PatchMonthTarget {
  month: string; // YYYY-MM
  metrics: PatchMetrics;
}

export interface PatchPlan {
  mode: PatchMode;
  planType: PatchPlanType;
  months: PatchMonthTarget[];
  tolerances?: ToleranceConfig;
  seed?: string;
}

export interface MonthlyKpiSnapshot {
  month: string;
  metrics: Required<PatchMetrics>;
  snapshotAt: string;
}

export interface KpiDiffEntry {
  metric: keyof PatchMetrics;
  before: number;
  after: number;
  delta: number;
  deltaPercent: number;
  target: number;
  passed: boolean;
}

export interface MonthlyKpiDiff {
  month: string;
  entries: KpiDiffEntry[];
  allPassed: boolean;
}

export interface PatchDiffReport {
  months: MonthlyKpiDiff[];
  overallPassed: boolean;
  totalMetrics: number;
  passedMetrics: number;
  failedMetrics: number;
}

export interface PatchPreview {
  computedDeltas: PatchMonthTarget[];
  estimatedRecords: {
    contacts: number;
    companies: number;
    deals: number;
    activities: number;
  };
  warnings: string[];
  blockers: string[];
  feasible: boolean;
}

export interface PatchJobMetrics {
  recordsCreated: number;
  recordsModified: number;
  recordsDeleted: number;
  byEntity: {
    contacts: { created: number; modified: number; deleted: number };
    companies: { created: number; modified: number; deleted: number };
    deals: { created: number; modified: number; deleted: number };
    activities: { created: number; modified: number; deleted: number };
  };
}
```

---

## 3. Algorithm Design

### 3.1 Patch Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATCH EXECUTION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. VALIDATION                                                   │
│     ├─ Verify tenant is demo-generated                          │
│     ├─ Verify month range is valid                              │
│     ├─ Verify user is master admin                              │
│     └─ Validate plan structure                                   │
│                                                                  │
│  2. SNAPSHOT BEFORE                                              │
│     ├─ Query current KPIs for each month in range               │
│     └─ Store in beforeKpisJson                                   │
│                                                                  │
│  3. COMPUTE DELTAS                                               │
│     ├─ If planType == 'targets':                                │
│     │     delta = target - current                              │
│     ├─ If planType == 'deltas':                                 │
│     │     delta = provided value                                │
│     └─ Validate deltas (no negatives in ADDITIVE mode)          │
│                                                                  │
│  4. ALLOCATE TO DAYS                                            │
│     ├─ For each month:                                          │
│     │   ├─ Get business days in month                           │
│     │   ├─ Apply weekday weighting                              │
│     │   └─ Distribute counts and values                         │
│     └─ Build daily allocation plan                              │
│                                                                  │
│  5. CREATE ENTITIES (within transaction)                        │
│     ├─ Load existing tenant context (users, pipeline, tags)     │
│     ├─ For each day allocation:                                 │
│     │   ├─ Create companies with timestamps                     │
│     │   ├─ Create contacts (leads + regular)                    │
│     │   ├─ Create deals with stage/value allocation             │
│     │   └─ Create activities linked to contacts/deals           │
│     ├─ All records tagged with:                                 │
│     │   - demo_generated = true                                 │
│     │   - demo_job_id = patch_job.id                           │
│     │   - demo_source_month = YYYY-MM                          │
│     └─ Commit transaction                                       │
│                                                                  │
│  6. SNAPSHOT AFTER                                               │
│     ├─ Query updated KPIs for each month                        │
│     └─ Store in afterKpisJson                                   │
│                                                                  │
│  7. GENERATE DIFF REPORT                                         │
│     ├─ Compare before vs after vs targets                       │
│     ├─ Check tolerances                                         │
│     └─ Store in diffReportJson                                  │
│                                                                  │
│  8. FINALIZE                                                     │
│     ├─ Update job status                                        │
│     ├─ Store execution metrics                                  │
│     └─ Return results                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 KPI Aggregation Queries

```typescript
// KPI Aggregator - SQL patterns

// Leads created in month
const leadsQuery = `
  SELECT COUNT(*) as count
  FROM contacts
  WHERE tenant_id = $1
    AND status = 'lead'
    AND created_at >= $2 AND created_at < $3
    AND deleted_at IS NULL
`;

// Contacts created in month
const contactsQuery = `
  SELECT COUNT(*) as count
  FROM contacts
  WHERE tenant_id = $1
    AND created_at >= $2 AND created_at < $3
    AND deleted_at IS NULL
`;

// Companies created in month
const companiesQuery = `
  SELECT COUNT(*) as count
  FROM companies
  WHERE tenant_id = $1
    AND created_at >= $2 AND created_at < $3
    AND deleted_at IS NULL
`;

// Deals created + closed won metrics
const dealsQuery = `
  SELECT
    COUNT(*) as total_deals,
    COUNT(*) FILTER (WHERE stage_id = ANY($4)) as closed_won_count,
    COALESCE(SUM(CAST(value AS NUMERIC)) FILTER (WHERE stage_id = ANY($4)), 0) as closed_won_value,
    COALESCE(SUM(CAST(value AS NUMERIC)) FILTER (WHERE stage_id != ALL($5)), 0) as pipeline_value
  FROM deals
  WHERE tenant_id = $1
    AND created_at >= $2 AND created_at < $3
    AND deleted_at IS NULL
`;
// $4 = wonStageIds, $5 = lostStageIds
```

### 3.3 Delta Computation Algorithm

```typescript
function computeDeltas(
  currentKpis: MonthlyKpiSnapshot[],
  plan: PatchPlan
): { deltas: PatchMonthTarget[]; blockers: string[] } {
  const deltas: PatchMonthTarget[] = [];
  const blockers: string[] = [];

  for (const monthPlan of plan.months) {
    const current = currentKpis.find(k => k.month === monthPlan.month);
    const currentMetrics = current?.metrics ?? emptyMetrics();

    const monthDeltas: PatchMetrics = {};

    for (const [metric, targetValue] of Object.entries(monthPlan.metrics)) {
      if (targetValue === undefined) continue;

      const currentValue = currentMetrics[metric as keyof PatchMetrics] ?? 0;

      if (plan.planType === 'targets') {
        // Compute delta needed to reach target
        const delta = targetValue - currentValue;

        if (plan.mode === 'additive' && delta < 0) {
          blockers.push(
            `${metric} for ${monthPlan.month}: Cannot reduce from ${currentValue} to ${targetValue} in ADDITIVE mode`
          );
        }

        monthDeltas[metric as keyof PatchMetrics] = Math.max(0, delta);
      } else {
        // DELTAS mode - use provided value directly
        if (plan.mode === 'additive' && targetValue < 0) {
          blockers.push(
            `${metric} for ${monthPlan.month}: Negative delta (${targetValue}) not allowed in ADDITIVE mode`
          );
        }

        monthDeltas[metric as keyof PatchMetrics] = targetValue;
      }
    }

    deltas.push({ month: monthPlan.month, metrics: monthDeltas });
  }

  return { deltas, blockers };
}
```

### 3.4 Entity Creation with Provenance

```typescript
interface EntityCreationContext {
  tenantId: string;
  patchJobId: string;
  sourceMonth: string;
  users: User[];
  pipeline: { stages: PipelineStage[]; wonStageIds: string[]; lostStageIds: string[] };
  tags: Tag[];
  rng: SeededRNG;
  localization: LocalizationProvider;
  template: IndustryTemplate;
}

async function createContactsForPatch(
  ctx: EntityCreationContext,
  dayAllocation: DayAllocation,
  tx: Transaction
): Promise<Contact[]> {
  const contacts: NewContact[] = [];

  for (let i = 0; i < dayAllocation.contactsCreated; i++) {
    const timestamp = ctx.rng.businessDateTime(dayAllocation.date);
    const user = ctx.rng.pick(ctx.users);
    const isLead = i < dayAllocation.leadsCreated;

    contacts.push({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      firstName: ctx.localization.firstName(),
      lastName: ctx.localization.lastName(),
      email: ctx.localization.email(firstName, lastName),
      phone: ctx.localization.phone(),
      status: isLead ? 'lead' : ctx.rng.pickWeighted(['prospect', 'customer'], [0.7, 0.3]),
      ownerId: user.id,
      createdAt: timestamp,
      updatedAt: timestamp,

      // PROVENANCE FIELDS
      demoGenerated: true,
      demoJobId: ctx.patchJobId,
      demoSourceMonth: ctx.sourceMonth,
    });
  }

  // Batch insert
  if (contacts.length > 0) {
    await tx.insert(contactsTable).values(contacts);
  }

  return contacts;
}
```

### 3.5 Idempotency Strategy

```typescript
/**
 * Idempotency is achieved through:
 *
 * 1. Deterministic seeding:
 *    - Each patch job has a unique seed
 *    - Child RNG streams: rng.child(`${month}-contacts-${dayIndex}`)
 *    - Same seed + same plan = same entity IDs
 *
 * 2. Pre-execution check:
 *    - Before creating entities, check if any exist with this job ID
 *    - If job ID already has entities, skip creation (already applied)
 *
 * 3. Job status tracking:
 *    - Job marked 'completed' only after successful commit
 *    - Re-running completed job returns cached results
 */

async function ensureIdempotency(
  patchJobId: string,
  tx: Transaction
): Promise<{ alreadyApplied: boolean; existingCounts: EntityCounts }> {
  // Check if any entities exist with this patch job ID
  const existingContacts = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.demoJobId, patchJobId));

  const existingCompanies = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(companies)
    .where(eq(companies.demoJobId, patchJobId));

  // ... similar for deals, activities

  const totalExisting = existingContacts[0].count + existingCompanies[0].count + ...;

  return {
    alreadyApplied: totalExisting > 0,
    existingCounts: { contacts: existingContacts[0].count, ... }
  };
}
```

---

## 4. API Design

### 4.1 Endpoint Specifications

#### POST /api/master/demo-generator/tenants/:tenantId/patch/validate

```typescript
// Request
interface ValidatePatchRequest {
  mode: 'additive' | 'reconcile';
  planType: 'targets' | 'deltas';
  months: PatchMonthTarget[];
  tolerances?: ToleranceConfig;
}

// Response
interface ValidatePatchResponse {
  success: boolean;
  data: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    preview: PatchPreview;
    currentKpis: MonthlyKpiSnapshot[];
  };
}
```

#### POST /api/master/demo-generator/tenants/:tenantId/patch/apply

```typescript
// Request
interface ApplyPatchRequest extends ValidatePatchRequest {
  seed?: string; // Optional custom seed
}

// Response
interface ApplyPatchResponse {
  success: boolean;
  data: {
    jobId: string;
    status: 'running';
    seed: string;
    estimatedSeconds: number;
  };
}
```

#### GET /api/master/demo-generator/patch-jobs/:jobId

```typescript
// Response
interface GetPatchJobResponse {
  success: boolean;
  data: {
    job: DemoPatchJob;
    beforeKpis: MonthlyKpiSnapshot[];
    afterKpis: MonthlyKpiSnapshot[];
    diffReport: PatchDiffReport;
    metrics: PatchJobMetrics;
  };
}
```

#### GET /api/master/demo-generator/tenants/:tenantId/kpis

```typescript
// Query params: from=2024-01, to=2024-12
// Response
interface GetKpisResponse {
  success: boolean;
  data: {
    tenantId: string;
    months: MonthlyKpiSnapshot[];
    rangeStart: string;
    rangeEnd: string;
  };
}
```

### 4.2 Validation Schemas

```typescript
// validations/demo-patch.ts

export const patchMetricsSchema = z.object({
  leadsCreated: z.number().int().min(0).optional(),
  contactsCreated: z.number().int().min(0).optional(),
  companiesCreated: z.number().int().min(0).optional(),
  dealsCreated: z.number().int().min(0).optional(),
  closedWonCount: z.number().int().min(0).optional(),
  closedWonValue: z.number().min(0).optional(),
  pipelineAddedValue: z.number().min(0).optional(),
  activitiesCreated: z.number().int().min(0).optional(),
});

export const patchMonthTargetSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  metrics: patchMetricsSchema,
});

export const validatePatchSchema = z.object({
  mode: z.enum(['additive', 'reconcile']).default('additive'),
  planType: z.enum(['targets', 'deltas']).default('deltas'),
  months: z.array(patchMonthTargetSchema).min(1).max(24),
  tolerances: z.object({
    countTolerance: z.number().min(0).max(100).default(0),
    valueTolerance: z.number().min(0).max(1).default(0.005),
  }).optional(),
}).superRefine((plan, ctx) => {
  // Validate months are in chronological order
  const months = plan.months.map(m => m.month).sort();
  for (let i = 1; i < months.length; i++) {
    if (months[i] <= months[i-1]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Months must be in chronological order without duplicates',
        path: ['months'],
      });
    }
  }

  // Validate logical constraints per month
  for (const month of plan.months) {
    if (month.metrics.closedWonCount !== undefined &&
        month.metrics.dealsCreated !== undefined &&
        month.metrics.closedWonCount > month.metrics.dealsCreated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${month.month}: closedWonCount cannot exceed dealsCreated`,
        path: ['months'],
      });
    }

    if (month.metrics.leadsCreated !== undefined &&
        month.metrics.contactsCreated !== undefined &&
        month.metrics.leadsCreated > month.metrics.contactsCreated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${month.month}: leadsCreated cannot exceed contactsCreated`,
        path: ['months'],
      });
    }
  }
});

export const applyPatchSchema = validatePatchSchema.extend({
  seed: z.string().max(64).optional(),
});
```

---

## 5. Error Handling

### 5.1 Error Categories

| Category | HTTP Status | Recovery |
|----------|-------------|----------|
| Validation Error | 400 | Fix input and retry |
| Tenant Not Found | 404 | Verify tenant ID |
| Not Demo Tenant | 400 | Cannot patch non-demo tenants |
| Infeasible Plan | 400 | Adjust targets or use RECONCILE mode |
| Execution Error | 500 | Check logs, retry with same seed |
| Partial Failure | 500 | Transaction rollback, no data changed |

### 5.2 Error Response Format

```typescript
interface PatchErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      field?: string;
      constraint?: string;
      current?: number;
      requested?: number;
    }[];
  };
}

// Example
{
  "success": false,
  "error": {
    "code": "INFEASIBLE_PLAN",
    "message": "Cannot achieve targets in ADDITIVE mode",
    "details": [
      {
        "field": "contactsCreated",
        "constraint": "Cannot reduce existing count",
        "current": 150,
        "requested": 100
      }
    ]
  }
}
```

---

## 6. Performance Considerations

### 6.1 Batch Processing

```typescript
// Entity creation uses batch inserts
const BATCH_SIZE = 500;

async function batchInsert<T>(
  tx: Transaction,
  table: PgTable,
  records: T[],
  batchSize = BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await tx.insert(table).values(batch);
  }
}
```

### 6.2 Progress Tracking

```typescript
// Update progress during execution
async function updateProgress(
  jobId: string,
  progress: number,
  currentStep: string,
  log?: LogEntry
): Promise<void> {
  const updates: Partial<DemoPatchJob> = {
    progress,
    currentStep,
    updatedAt: new Date(),
  };

  if (log) {
    await db.execute(sql`
      UPDATE demo_patch_jobs
      SET progress = ${progress},
          current_step = ${currentStep},
          logs = logs || ${JSON.stringify([log])}::jsonb,
          updated_at = NOW()
      WHERE id = ${jobId}
    `);
  } else {
    await db.update(demoPatchJobs)
      .set(updates)
      .where(eq(demoPatchJobs.id, jobId));
  }
}
```

### 6.3 Estimated Execution Time

```typescript
function estimateExecutionTime(preview: PatchPreview): number {
  const totalRecords =
    preview.estimatedRecords.contacts +
    preview.estimatedRecords.companies +
    preview.estimatedRecords.deals +
    preview.estimatedRecords.activities;

  // ~100 records/second with batch inserts
  const insertTime = Math.ceil(totalRecords / 100);

  // KPI queries ~2s per month
  const months = preview.computedDeltas.length;
  const kpiTime = months * 2 * 2; // before + after

  return insertTime + kpiTime + 5; // +5s overhead
}
```

---

## 7. Security

### 7.1 Authorization

```typescript
// All patch endpoints require:
// 1. Valid session with master admin role
// 2. CSRF token for mutations

async function requireMasterAdminWithCsrf(request: NextRequest) {
  const auth = await requireMasterAdminWithCsrf(request);
  if (auth instanceof Response) return auth;
  return auth;
}

// Tenant validation
async function validateDemoTenant(tenantId: string): Promise<{
  valid: boolean;
  error?: string;
  tenant?: Tenant;
  metadata?: DemoTenantMetadata;
}> {
  const metadata = await db.query.demoTenantMetadata.findFirst({
    where: eq(demoTenantMetadata.tenantId, tenantId),
  });

  if (!metadata || !metadata.isDemoGenerated) {
    return {
      valid: false,
      error: 'Tenant is not a demo-generated tenant',
    };
  }

  return { valid: true, tenant, metadata };
}
```

### 7.2 Tenant Isolation

```typescript
// All entity queries include tenantId filter
// Patch engine validates tenantId matches before any writes

function assertTenantIsolation(
  targetTenantId: string,
  entityTenantId: string,
  operation: string
): void {
  if (targetTenantId !== entityTenantId) {
    throw new Error(
      `Tenant isolation violation: ${operation} attempted on tenant ${entityTenantId} ` +
      `while patching tenant ${targetTenantId}`
    );
  }
}
```

---

## 8. File Structure

```
lib/demo-generator/
├── engine/
│   ├── generator.ts           # Existing full generation
│   ├── monthly-plan-generator.ts  # Existing monthly mode
│   ├── kpi-aggregator.ts      # NEW - KPI snapshot/query
│   ├── patch-validator.ts     # NEW - Plan validation
│   ├── patch-planner.ts       # NEW - Delta computation
│   ├── patch-engine.ts        # NEW - Execution orchestration
│   ├── entity-creator.ts      # NEW - Entity creation with provenance
│   ├── monthly-patch-allocator.ts # NEW - Daily distribution for patches
│   ├── monthly-allocator.ts   # Existing
│   ├── value-allocator.ts     # Existing
│   └── rng.ts                 # Existing
├── types.ts                   # Extended with patch types
└── config.ts                  # Existing

validations/
├── demo-generator.ts          # Existing
└── demo-patch.ts              # NEW - Patch schemas

app/api/master/demo-generator/
├── route.ts                   # Existing
├── [jobId]/route.ts           # Existing
├── preview/route.ts           # Existing
├── validate-plan/route.ts     # Existing
├── tenants/[tenantId]/
│   ├── patch/
│   │   ├── validate/route.ts  # NEW
│   │   └── apply/route.ts     # NEW
│   └── kpis/route.ts          # NEW
└── patch-jobs/[jobId]/route.ts # NEW

components/demo-generator/
├── monthly-grid.tsx           # Existing
├── monthly-plan-helpers.tsx   # Existing
├── tenant-kpi-chart.tsx       # NEW
├── patch-plan-grid.tsx        # NEW
├── patch-preview.tsx          # NEW
└── patch-job-results.tsx      # NEW

drizzle/
└── schema.ts                  # Extended with patch tables + provenance columns
```
