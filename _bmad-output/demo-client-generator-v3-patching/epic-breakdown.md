# Epic Breakdown: Demo Client Generator v3 - Patching System

## Overview

| Epic | Description | Priority | Dependencies |
|------|-------------|----------|--------------|
| E1 | Database Schema & Provenance | P0 | None |
| E2 | KPI Aggregator Service | P0 | E1 |
| E3 | Patch Validator & Planner | P0 | E2 |
| E4 | Patch Engine (ADDITIVE Mode) | P0 | E3 |
| E5 | API Endpoints | P0 | E4 |
| E6 | UI: KPI Visualization | P0 | E5 |
| E7 | UI: Patch Configuration & Execution | P0 | E6 |
| E8 | Patch History & Audit | P1 | E7 |
| E9 | RECONCILE Mode (Future) | P2 | E8 |

---

## E1: Database Schema & Provenance

### Description
Extend the database schema to support patch jobs and entity-level provenance tracking.

### Stories

#### E1-S1: Create demo_patch_jobs Table
**As a** system
**I want** a dedicated table for tracking patch jobs
**So that** patch operations are fully auditable and recoverable

**Acceptance Criteria:**
- [ ] Table created with all required columns (see architecture)
- [ ] Indexes on tenant_id, status, created_at, original_job_id
- [ ] Foreign keys to tenants and users
- [ ] Migration runs successfully on dev and production
- [ ] TypeScript types generated via Drizzle

**Tasks:**
1. Add table definition to `drizzle/schema.ts`
2. Add enum types for mode and plan_type
3. Create TypeScript interface in `lib/demo-generator/types.ts`
4. Run migration
5. Verify in database

**Estimated Effort:** 2 hours

---

#### E1-S2: Add Provenance Columns to Contacts Table
**As a** system
**I want** provenance fields on the contacts table
**So that** we can identify which contacts were demo-generated and by which job

**Acceptance Criteria:**
- [ ] `demo_generated` boolean column added (default false)
- [ ] `demo_job_id` UUID column added (nullable)
- [ ] `demo_source_month` varchar(7) column added (nullable)
- [ ] Indexes on (tenant_id, demo_generated) and demo_job_id
- [ ] Existing contacts have demo_generated = false
- [ ] TypeScript Contact type updated

**Tasks:**
1. Add columns to contacts table in schema.ts
2. Add indexes
3. Create migration
4. Run migration
5. Update Contact type

**Estimated Effort:** 1.5 hours

---

#### E1-S3: Add Provenance Columns to Companies Table
**As a** system
**I want** provenance fields on the companies table
**So that** we can identify which companies were demo-generated

**Acceptance Criteria:**
- [ ] Same columns as E1-S2 for companies
- [ ] Migration successful
- [ ] TypeScript types updated

**Tasks:**
1. Add columns to companies table
2. Add indexes
3. Run migration
4. Update types

**Estimated Effort:** 1 hour

---

#### E1-S4: Add Provenance Columns to Deals Table
**As a** system
**I want** provenance fields on the deals table
**So that** we can identify which deals were demo-generated

**Acceptance Criteria:**
- [ ] Same columns as E1-S2 for deals
- [ ] Migration successful
- [ ] TypeScript types updated

**Tasks:**
1. Add columns to deals table
2. Add indexes
3. Run migration
4. Update types

**Estimated Effort:** 1 hour

---

#### E1-S5: Add Provenance Columns to Activities Table
**As a** system
**I want** provenance fields on the activities table
**So that** we can identify which activities were demo-generated

**Acceptance Criteria:**
- [ ] Same columns as E1-S2 for activities
- [ ] Migration successful
- [ ] TypeScript types updated

**Tasks:**
1. Add columns to activities table
2. Add indexes
3. Run migration
4. Update types

**Estimated Effort:** 1 hour

---

#### E1-S6: Backfill Existing Demo Data with Provenance
**As a** system
**I want** existing demo-generated records to have correct provenance
**So that** the patch system can identify them

**Acceptance Criteria:**
- [ ] Script identifies records in demo tenants
- [ ] Sets demo_generated = true for all records in demo tenants
- [ ] Sets demo_job_id to original generation job if available
- [ ] Sets demo_source_month based on createdAt
- [ ] Runs idempotently (safe to re-run)
- [ ] Logs progress and results

**Tasks:**
1. Create backfill script
2. Test on dev database
3. Run on production with monitoring
4. Verify counts

**Estimated Effort:** 3 hours

---

### E1 Total Estimated Effort: 9.5 hours

---

## E2: KPI Aggregator Service

### Description
Build a service that queries actual KPIs per month for any tenant.

### Stories

#### E2-S1: Create KPI Aggregator Class
**As a** developer
**I want** a KpiAggregator service class
**So that** I can query monthly KPIs for any tenant

**Acceptance Criteria:**
- [ ] Class at `lib/demo-generator/engine/kpi-aggregator.ts`
- [ ] Method: `queryMonthlyKpis(tenantId, fromMonth, toMonth)`
- [ ] Returns `MonthlyKpiSnapshot[]`
- [ ] Handles missing months (returns zeros)
- [ ] Efficient batch query (single query per entity type)

**Tasks:**
1. Create class skeleton
2. Implement contact/lead queries
3. Implement company queries
4. Implement deal queries (with value calculations)
5. Implement activity queries
6. Add unit tests

**Estimated Effort:** 4 hours

---

#### E2-S2: Implement KPI Snapshot Method
**As a** developer
**I want** a method to capture KPI snapshots
**So that** I can record before/after states

**Acceptance Criteria:**
- [ ] Method: `createSnapshot(tenantId, months[])`
- [ ] Returns timestamped snapshot object
- [ ] Captures all metrics for all specified months
- [ ] JSON-serializable output

**Tasks:**
1. Implement snapshot method
2. Add timestamp to output
3. Add serialization helpers
4. Add tests

**Estimated Effort:** 2 hours

---

#### E2-S3: Implement KPI Diff Method
**As a** developer
**I want** a method to compute diffs between KPI snapshots
**So that** I can generate comparison reports

**Acceptance Criteria:**
- [ ] Method: `computeDiff(before, after, targets, tolerances)`
- [ ] Returns `PatchDiffReport`
- [ ] Calculates delta and deltaPercent per metric
- [ ] Evaluates pass/fail against tolerances
- [ ] Aggregates overall pass/fail

**Tasks:**
1. Implement diff computation
2. Add tolerance checking
3. Generate pass/fail status
4. Add tests

**Estimated Effort:** 2 hours

---

### E2 Total Estimated Effort: 8 hours

---

## E3: Patch Validator & Planner

### Description
Build validation and planning logic for patch operations.

### Stories

#### E3-S1: Create Patch Validator
**As a** developer
**I want** a PatchValidator service
**So that** patch plans are validated before execution

**Acceptance Criteria:**
- [ ] Class at `lib/demo-generator/engine/patch-validator.ts`
- [ ] Method: `validate(tenantId, plan)`
- [ ] Checks:
  - [ ] Tenant is demo-generated
  - [ ] Month range is valid (not future, not before creation)
  - [ ] Logical constraints (closedWonCount <= dealsCreated, etc.)
  - [ ] ADDITIVE mode constraints (no negative deltas)
- [ ] Returns `{ valid, errors, warnings }`

**Tasks:**
1. Create class skeleton
2. Implement tenant validation
3. Implement date range validation
4. Implement metric constraint validation
5. Implement mode-specific validation
6. Add tests

**Estimated Effort:** 4 hours

---

#### E3-S2: Create Patch Planner
**As a** developer
**I want** a PatchPlanner service
**So that** deltas are computed from targets or used directly

**Acceptance Criteria:**
- [ ] Class at `lib/demo-generator/engine/patch-planner.ts`
- [ ] Method: `computeDeltas(currentKpis, plan)`
- [ ] TARGETS mode: computes delta = target - current
- [ ] DELTAS mode: uses provided values
- [ ] Returns `{ deltas, blockers }`

**Tasks:**
1. Create class skeleton
2. Implement DELTAS mode logic
3. Implement TARGETS mode logic
4. Add blocker detection
5. Add tests

**Estimated Effort:** 3 hours

---

#### E3-S3: Create Patch Preview Generator
**As a** developer
**I want** a method to generate patch previews
**So that** users can see what will be created

**Acceptance Criteria:**
- [ ] Method: `generatePreview(plan, currentKpis, deltas)`
- [ ] Returns `PatchPreview` with:
  - [ ] Computed deltas per month
  - [ ] Estimated record counts
  - [ ] Warnings
  - [ ] Blockers
  - [ ] Feasibility flag

**Tasks:**
1. Implement preview generation
2. Add record estimation logic
3. Add warning detection
4. Add tests

**Estimated Effort:** 2 hours

---

### E3 Total Estimated Effort: 9 hours

---

## E4: Patch Engine (ADDITIVE Mode)

### Description
Implement the core patch execution engine for ADDITIVE mode.

### Stories

#### E4-S1: Create Monthly Patch Allocator
**As a** developer
**I want** an allocator that distributes deltas to business days
**So that** records are created with realistic timestamps

**Acceptance Criteria:**
- [ ] Class at `lib/demo-generator/engine/monthly-patch-allocator.ts`
- [ ] Reuses weekday weighting from existing MonthlyAllocator
- [ ] Method: `allocate(deltas[])`
- [ ] Returns daily allocation plan
- [ ] Handles value distribution for deals

**Tasks:**
1. Create class extending/reusing MonthlyAllocator
2. Implement delta allocation
3. Handle value metrics
4. Add tests

**Estimated Effort:** 3 hours

---

#### E4-S2: Create Entity Creator Service
**As a** developer
**I want** an EntityCreator service
**So that** entities are created with proper provenance and relationships

**Acceptance Criteria:**
- [ ] Class at `lib/demo-generator/engine/entity-creator.ts`
- [ ] Methods for each entity type
- [ ] Sets provenance fields (demo_generated, demo_job_id, demo_source_month)
- [ ] Maintains relationships (contact → company, deal → contact)
- [ ] Uses seeded RNG for determinism
- [ ] Batch insertion for performance

**Tasks:**
1. Create class skeleton
2. Implement createContacts (with leads)
3. Implement createCompanies
4. Implement createDeals (with value allocation)
5. Implement createActivities
6. Add tests

**Estimated Effort:** 6 hours

---

#### E4-S3: Create Patch Engine Orchestrator
**As a** developer
**I want** a PatchEngine that orchestrates the full patch process
**So that** patches are executed atomically with proper tracking

**Acceptance Criteria:**
- [ ] Class at `lib/demo-generator/engine/patch-engine.ts`
- [ ] Method: `execute(jobId)`
- [ ] Execution flow:
  - [ ] Load job and tenant context
  - [ ] Validate (fail fast)
  - [ ] Snapshot before
  - [ ] Execute within transaction
  - [ ] Snapshot after
  - [ ] Generate diff report
  - [ ] Update job with results
- [ ] Progress tracking (0-100%)
- [ ] Error handling with rollback
- [ ] Idempotency check

**Tasks:**
1. Create class skeleton
2. Implement job loading
3. Implement transaction wrapper
4. Implement progress updates
5. Implement error handling
6. Add integration tests

**Estimated Effort:** 6 hours

---

#### E4-S4: Implement Idempotency Check
**As a** developer
**I want** patches to be idempotent
**So that** re-running a job doesn't duplicate data

**Acceptance Criteria:**
- [ ] Before creating entities, check if job already has entities
- [ ] If entities exist, return cached results
- [ ] Log idempotency detection
- [ ] Handle partial failures gracefully

**Tasks:**
1. Add idempotency check to PatchEngine
2. Query existing entities by job ID
3. Return early if already applied
4. Add tests

**Estimated Effort:** 2 hours

---

### E4 Total Estimated Effort: 17 hours

---

## E5: API Endpoints

### Description
Implement REST API endpoints for patch operations.

### Stories

#### E5-S1: Implement GET /tenants/:tenantId/kpis
**As a** Master Admin
**I want** to query KPIs for a demo tenant
**So that** I can see current data before patching

**Acceptance Criteria:**
- [ ] Endpoint at `app/api/master/demo-generator/tenants/[tenantId]/kpis/route.ts`
- [ ] Query params: from, to (YYYY-MM format)
- [ ] Validates tenant is demo-generated
- [ ] Returns `MonthlyKpiSnapshot[]`
- [ ] Requires master admin auth

**Tasks:**
1. Create route file
2. Implement GET handler
3. Add validation
4. Add tests

**Estimated Effort:** 2 hours

---

#### E5-S2: Implement POST /tenants/:tenantId/patch/validate
**As a** Master Admin
**I want** to validate a patch plan before applying
**So that** I can preview changes and catch errors

**Acceptance Criteria:**
- [ ] Endpoint at `app/api/master/demo-generator/tenants/[tenantId]/patch/validate/route.ts`
- [ ] Accepts patch plan in request body
- [ ] Returns validation result with preview
- [ ] Does not modify any data
- [ ] Requires CSRF token

**Tasks:**
1. Create route file
2. Implement POST handler
3. Add Zod validation schema
4. Return preview object
5. Add tests

**Estimated Effort:** 3 hours

---

#### E5-S3: Implement POST /tenants/:tenantId/patch/apply
**As a** Master Admin
**I want** to apply a validated patch plan
**So that** the demo tenant data is updated

**Acceptance Criteria:**
- [ ] Endpoint at `app/api/master/demo-generator/tenants/[tenantId]/patch/apply/route.ts`
- [ ] Accepts patch plan in request body
- [ ] Creates job record
- [ ] Starts execution asynchronously
- [ ] Returns job ID and status
- [ ] Requires CSRF token

**Tasks:**
1. Create route file
2. Implement POST handler
3. Create job record
4. Start async execution
5. Return job ID
6. Add tests

**Estimated Effort:** 3 hours

---

#### E5-S4: Implement GET /patch-jobs/:jobId
**As a** Master Admin
**I want** to check patch job status and results
**So that** I can monitor progress and view outcomes

**Acceptance Criteria:**
- [ ] Endpoint at `app/api/master/demo-generator/patch-jobs/[jobId]/route.ts`
- [ ] Returns full job details
- [ ] Includes before/after KPIs
- [ ] Includes diff report
- [ ] Includes execution metrics

**Tasks:**
1. Create route file
2. Implement GET handler
3. Format response
4. Add tests

**Estimated Effort:** 2 hours

---

#### E5-S5: Add Zod Validation Schemas for Patching
**As a** developer
**I want** Zod schemas for patch requests
**So that** input validation is consistent

**Acceptance Criteria:**
- [ ] Schema file at `validations/demo-patch.ts`
- [ ] `validatePatchSchema` for validate endpoint
- [ ] `applyPatchSchema` for apply endpoint
- [ ] Includes cross-field validation
- [ ] Exports TypeScript types

**Tasks:**
1. Create schema file
2. Implement base schemas
3. Add superRefine validations
4. Export types

**Estimated Effort:** 2 hours

---

### E5 Total Estimated Effort: 12 hours

---

## E6: UI - KPI Visualization

### Description
Build UI components for viewing tenant KPIs.

### Stories

#### E6-S1: Create Tenant KPI Chart Component
**As a** Master Admin
**I want** to see a chart of monthly KPIs
**So that** I can visualize the tenant's data distribution

**Acceptance Criteria:**
- [ ] Component at `components/demo-generator/tenant-kpi-chart.tsx`
- [ ] Stacked bar chart using Recharts
- [ ] Metric selector dropdown
- [ ] Hover tooltips with values
- [ ] Responsive sizing

**Tasks:**
1. Create component
2. Implement chart with Recharts
3. Add metric selector
4. Add tooltips
5. Style and test

**Estimated Effort:** 4 hours

---

#### E6-S2: Create Tenant KPI Table Component
**As a** Master Admin
**I want** to see a table of monthly KPIs
**So that** I can see exact values per month

**Acceptance Criteria:**
- [ ] Component at `components/demo-generator/tenant-kpi-table.tsx`
- [ ] Rows = months, Columns = metrics
- [ ] Footer row with totals
- [ ] Sortable by any column
- [ ] Currency formatting for value columns

**Tasks:**
1. Create component
2. Implement table structure
3. Add totals row
4. Add sorting
5. Add formatting

**Estimated Effort:** 3 hours

---

#### E6-S3: Create Monthly Updates Tab Container
**As a** Master Admin
**I want** a tab in tenant detail view for monthly updates
**So that** I can access patching functionality

**Acceptance Criteria:**
- [ ] Tab added to tenant detail page
- [ ] Shows KPI chart and table
- [ ] Shows "Add Monthly Update" button
- [ ] Fetches KPIs on mount
- [ ] Loading and error states

**Tasks:**
1. Add tab to tenant detail page
2. Create container component
3. Implement data fetching
4. Layout chart and table
5. Add button for patch panel

**Estimated Effort:** 3 hours

---

### E6 Total Estimated Effort: 10 hours

---

## E7: UI - Patch Configuration & Execution

### Description
Build UI components for configuring and executing patches.

### Stories

#### E7-S1: Create Patch Configuration Panel
**As a** Master Admin
**I want** a panel to configure patch parameters
**So that** I can set mode, plan type, and date range

**Acceptance Criteria:**
- [ ] Component at `components/demo-generator/patch-config-panel.tsx`
- [ ] Mode selector (ADDITIVE only for MVP)
- [ ] Plan type selector (TARGETS/DELTAS)
- [ ] Date range pickers (from/to month)
- [ ] Collapsible/expandable

**Tasks:**
1. Create component
2. Add mode selector
3. Add plan type selector
4. Add date range pickers
5. Wire up state management

**Estimated Effort:** 3 hours

---

#### E7-S2: Create Patch Plan Grid Component
**As a** Master Admin
**I want** an editable grid to enter patch values
**So that** I can specify metrics for each month

**Acceptance Criteria:**
- [ ] Component at `components/demo-generator/patch-plan-grid.tsx`
- [ ] Editable cells for each metric
- [ ] Tab navigation
- [ ] Validation highlights
- [ ] Totals row
- [ ] Currency formatting

**Tasks:**
1. Create component
2. Implement editable cells
3. Add keyboard navigation
4. Add validation
5. Add totals calculation

**Estimated Effort:** 5 hours

---

#### E7-S3: Implement CSV Paste Support
**As a** Master Admin
**I want** to paste CSV data into the grid
**So that** I can quickly import plans

**Acceptance Criteria:**
- [ ] Detect paste event in grid
- [ ] Parse CSV format
- [ ] Show confirmation dialog with preview
- [ ] Populate grid on confirm
- [ ] Error handling for invalid format

**Tasks:**
1. Add paste event listener
2. Implement CSV parser
3. Create confirmation dialog
4. Add error handling
5. Add tests

**Estimated Effort:** 3 hours

---

#### E7-S4: Create Patch Preview Component
**As a** Master Admin
**I want** to preview patch changes before applying
**So that** I can verify the plan is correct

**Acceptance Criteria:**
- [ ] Component at `components/demo-generator/patch-preview.tsx`
- [ ] Shows validation status
- [ ] Shows record creation summary
- [ ] Shows value changes
- [ ] Shows warnings
- [ ] Apply and Back buttons

**Tasks:**
1. Create component
2. Implement validation display
3. Add summary tables
4. Add warnings list
5. Wire up actions

**Estimated Effort:** 3 hours

---

#### E7-S5: Create Patch Progress Component
**As a** Master Admin
**I want** to see patch execution progress
**So that** I know the status of my patch

**Acceptance Criteria:**
- [ ] Component at `components/demo-generator/patch-progress.tsx`
- [ ] Progress bar (0-100%)
- [ ] Current step display
- [ ] Log viewer
- [ ] Auto-refresh status
- [ ] Completion detection

**Tasks:**
1. Create component
2. Implement progress bar
3. Add polling for status
4. Add log viewer
5. Handle completion

**Estimated Effort:** 3 hours

---

#### E7-S6: Create Patch Results Component
**As a** Master Admin
**I want** to see patch results after completion
**So that** I can verify the patch worked correctly

**Acceptance Criteria:**
- [ ] Component at `components/demo-generator/patch-results.tsx`
- [ ] Summary cards (records created)
- [ ] KPI comparison table
- [ ] Pass/fail indicators
- [ ] Export report button

**Tasks:**
1. Create component
2. Add summary cards
3. Add comparison table
4. Add pass/fail styling
5. Add export functionality

**Estimated Effort:** 4 hours

---

#### E7-S7: Integrate Patch Flow into Monthly Updates Tab
**As a** Master Admin
**I want** the full patch flow integrated
**So that** I can complete patches end-to-end

**Acceptance Criteria:**
- [ ] Config panel expands on button click
- [ ] Grid populated based on date range
- [ ] Preview button calls validate API
- [ ] Apply button calls apply API
- [ ] Progress shown during execution
- [ ] Results shown on completion

**Tasks:**
1. Wire up config to grid
2. Connect validate API
3. Connect apply API
4. Manage flow state
5. Handle transitions

**Estimated Effort:** 4 hours

---

### E7 Total Estimated Effort: 25 hours

---

## E8: Patch History & Audit

### Description
Implement patch history tracking and viewing.

### Stories

#### E8-S1: Create Patch History Tab
**As a** Master Admin
**I want** to see past patch jobs for a tenant
**So that** I can audit changes over time

**Acceptance Criteria:**
- [ ] Tab added to tenant detail view
- [ ] Lists all patch jobs for tenant
- [ ] Shows status, date, record counts
- [ ] Click to view details
- [ ] Pagination

**Tasks:**
1. Create tab component
2. Fetch patch jobs
3. Display list
4. Add pagination
5. Link to details

**Estimated Effort:** 3 hours

---

#### E8-S2: Create Patch Job Detail Page
**As a** Master Admin
**I want** to view full details of a patch job
**So that** I can see exactly what was changed

**Acceptance Criteria:**
- [ ] Page at `app/(master)/master/demo-generator/patch-jobs/[jobId]/page.tsx`
- [ ] Shows job metadata
- [ ] Shows patch plan
- [ ] Shows before/after KPIs
- [ ] Shows diff report
- [ ] Shows logs

**Tasks:**
1. Create page
2. Fetch job details
3. Display all sections
4. Add export button

**Estimated Effort:** 4 hours

---

### E8 Total Estimated Effort: 7 hours

---

## E9: RECONCILE Mode (Future)

### Description
Implement RECONCILE mode for modifying existing data.

### Stories

#### E9-S1: Design RECONCILE Strategy
- Define safe modification patterns
- Define soft-delete approach
- Define guardrails

#### E9-S2: Implement Record Modification Logic
- Modify deal amounts
- Modify deal stages
- Modify timestamps (within bounds)

#### E9-S3: Implement Soft Delete Logic
- Mark records as void/deleted
- Update aggregations

#### E9-S4: Update UI for RECONCILE Mode
- Enable mode selector
- Add confirmation warnings
- Show modification preview

---

## Summary

| Epic | Stories | Total Hours | Priority |
|------|---------|-------------|----------|
| E1: Schema & Provenance | 6 | 9.5h | P0 |
| E2: KPI Aggregator | 3 | 8h | P0 |
| E3: Validator & Planner | 3 | 9h | P0 |
| E4: Patch Engine | 4 | 17h | P0 |
| E5: API Endpoints | 5 | 12h | P0 |
| E6: UI: KPI Visualization | 3 | 10h | P0 |
| E7: UI: Patch Flow | 7 | 25h | P0 |
| E8: History & Audit | 2 | 7h | P1 |
| E9: RECONCILE Mode | 4 | TBD | P2 |
| **TOTAL MVP (P0)** | **31** | **90.5h** | |

---

## Implementation Order (Recommended)

1. **E1**: Schema & Provenance (foundation)
2. **E2**: KPI Aggregator (needed for validation)
3. **E3**: Validator & Planner (needed for API)
4. **E5-S5**: Zod schemas (needed for API)
5. **E5-S1**: GET KPIs endpoint (enables UI work)
6. **E6**: KPI Visualization (can develop in parallel)
7. **E4**: Patch Engine (core logic)
8. **E5-S2,S3,S4**: Remaining API endpoints
9. **E7**: Patch UI flow
10. **E8**: History & Audit (polish)
