# Epic Breakdown: Demo Client Generator

## Document Control
- **Version**: 1.0
- **Status**: Draft
- **Last Updated**: 2026-01-23

---

## Epic Overview

| Epic | Name | Priority | Est. Hours | Dependencies |
|------|------|----------|------------|--------------|
| E1 | Database Schema & Core Types | P0 | 8h | None |
| E2 | Generation Engine Core | P0 | 16h | E1 |
| E3 | Data Generators | P0 | 20h | E2 |
| E4 | Localization System | P0 | 12h | E2 |
| E5 | Industry Templates | P1 | 8h | E2 |
| E6 | API Layer | P0 | 12h | E2, E3 |
| E7 | UI - Generator Form | P0 | 16h | E6 |
| E8 | UI - Jobs List & Management | P0 | 12h | E6 |
| E9 | Preview & Visualization | P1 | 8h | E6, E7 |
| E10 | Testing & QA | P0 | 12h | All |

**Total Estimated Hours**: 124h (~3 weeks)

---

## Epic 1: Database Schema & Core Types

### Description
Set up database tables, migrations, and TypeScript types for the demo generator module.

### Stories

#### E1-S1: Create Database Schema
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: None

**Description**: Add demo_generation_jobs and demo_tenant_metadata tables to Drizzle schema.

**Tasks**:
- [ ] Add enum for job status (pending, running, completed, failed)
- [ ] Create demo_generation_jobs table with all fields
- [ ] Create demo_tenant_metadata table with all fields
- [ ] Add proper indexes
- [ ] Add relations to existing tables (users, tenants)
- [ ] Export new schema from lib/db

**Acceptance Criteria**:
- [ ] Migration runs successfully
- [ ] Types are properly exported
- [ ] Relations work correctly

#### E1-S2: Create TypeScript Types
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E1-S1

**Description**: Define all TypeScript interfaces for configuration, metrics, and responses.

**Tasks**:
- [ ] Create lib/demo-generator/types.ts
- [ ] Define DemoGenerationConfig interface
- [ ] Define GenerationMetrics interface
- [ ] Define MonthlyTargets interface
- [ ] Define IndustryTemplate interface
- [ ] Define LocalizationProvider interface

**Acceptance Criteria**:
- [ ] All types compile without errors
- [ ] Types match schema expectations

#### E1-S3: Create Validation Schemas
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E1-S2

**Description**: Create Zod validation schemas for API inputs.

**Tasks**:
- [ ] Create validations/demo-generator.ts
- [ ] Define createDemoSchema
- [ ] Define previewSchema
- [ ] Define listJobsQuerySchema
- [ ] Add custom validation rules (date range, percentages)

**Acceptance Criteria**:
- [ ] All validations work correctly
- [ ] Error messages are clear

---

## Epic 2: Generation Engine Core

### Description
Build the core generation engine including RNG, growth planner, and batch inserter.

### Stories

#### E2-S1: Seeded Random Number Generator
**Priority**: P0 | **Estimate**: 3h | **Dependencies**: E1-S2

**Description**: Implement deterministic RNG with utility methods.

**Tasks**:
- [ ] Create lib/demo-generator/engine/rng.ts
- [ ] Implement Mulberry32 algorithm
- [ ] Add seed hashing from string
- [ ] Add utility methods (int, float, pick, pickWeighted, shuffle)
- [ ] Add distribution methods (pareto, logNormal)
- [ ] Add date methods (random date, business hours)
- [ ] Write unit tests for determinism

**Acceptance Criteria**:
- [ ] Same seed always produces same sequence
- [ ] All utility methods work correctly
- [ ] Business hour dates are valid

#### E2-S2: Growth Planner
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E2-S1

**Description**: Calculate monthly distribution of targets based on growth model.

**Tasks**:
- [ ] Create lib/demo-generator/engine/growth-planner.ts
- [ ] Calculate months between start date and now
- [ ] Implement linear growth curve
- [ ] Implement exponential growth curve
- [ ] Implement logistic (S-curve) growth
- [ ] Implement step growth
- [ ] Distribute targets across months
- [ ] Add seasonality adjustment (optional)
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] All growth curves produce valid distributions
- [ ] Monthly targets sum to total targets
- [ ] Seasonality adjusts appropriately

#### E2-S3: Batch Inserter
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: None

**Description**: Utility for efficient bulk database inserts.

**Tasks**:
- [ ] Create lib/demo-generator/engine/batch-inserter.ts
- [ ] Implement batched insert with configurable batch size
- [ ] Add progress callback support
- [ ] Handle transaction context
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Inserts large arrays efficiently
- [ ] Progress callbacks fire correctly
- [ ] Works within transaction

#### E2-S4: Progress Tracker
**Priority**: P1 | **Estimate**: 2h | **Dependencies**: E1-S1

**Description**: Track and persist generation progress for UI updates.

**Tasks**:
- [ ] Create lib/demo-generator/engine/progress-tracker.ts
- [ ] Update job progress in database
- [ ] Update current step description
- [ ] Add log entries
- [ ] Debounce database updates

**Acceptance Criteria**:
- [ ] Progress updates persist to database
- [ ] Updates are debounced appropriately
- [ ] Logs are properly structured

#### E2-S5: Main Generator Orchestrator
**Priority**: P0 | **Estimate**: 5h | **Dependencies**: E2-S1, E2-S2, E2-S3, E2-S4

**Description**: Main class that orchestrates the generation process.

**Tasks**:
- [ ] Create lib/demo-generator/engine/generator.ts
- [ ] Initialize RNG with seed
- [ ] Create growth plan
- [ ] Define generation steps
- [ ] Implement step execution with progress
- [ ] Handle errors and rollback
- [ ] Collect final metrics
- [ ] Write integration tests

**Acceptance Criteria**:
- [ ] Full generation completes successfully
- [ ] Errors cause proper rollback
- [ ] Progress tracked throughout
- [ ] Metrics accurate

---

## Epic 3: Data Generators

### Description
Implement individual data generators for each entity type.

### Stories

#### E3-S1: Tenant Generator
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E2-S5

**Description**: Generate tenant profile and billing info.

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/tenant.ts
- [ ] Generate tenant with provided/generated name
- [ ] Generate billing info from localization
- [ ] Create demo_tenant_metadata record
- [ ] Return tenant ID for subsequent generators

**Acceptance Criteria**:
- [ ] Tenant created with all fields
- [ ] Metadata linked correctly

#### E3-S2: Users Generator
**Priority**: P0 | **Estimate**: 3h | **Dependencies**: E3-S1

**Description**: Generate team members with various roles.

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/users.ts
- [ ] Generate owner user
- [ ] Generate admin users
- [ ] Generate member users
- [ ] Use localized names
- [ ] Generate realistic email addresses
- [ ] Hash passwords (use known default)
- [ ] Distribute creation dates across time

**Acceptance Criteria**:
- [ ] Team size matches config
- [ ] Role distribution realistic
- [ ] All users can login

#### E3-S3: Pipeline Generator
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E3-S1

**Description**: Generate pipeline stages from industry template.

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/pipeline.ts
- [ ] Load industry template
- [ ] Create pipeline stages in order
- [ ] Set probabilities and flags
- [ ] Return stage mapping for deal creation

**Acceptance Criteria**:
- [ ] Pipeline matches industry template
- [ ] Stage order correct
- [ ] Win/loss stages marked

#### E3-S4: Companies Generator
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E3-S2, E3-S3

**Description**: Generate companies with industry-appropriate profiles.

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/companies.ts
- [ ] Generate company names from patterns
- [ ] Generate addresses using localization
- [ ] Generate contact info
- [ ] Assign owners from users
- [ ] Set industry and size
- [ ] Distribute across months per growth plan
- [ ] Batch insert

**Acceptance Criteria**:
- [ ] Company count matches target
- [ ] Names are realistic
- [ ] Distribution follows growth curve

#### E3-S5: Contacts Generator
**Priority**: P0 | **Estimate**: 5h | **Dependencies**: E3-S4

**Description**: Generate contacts/leads with status progression.

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/contacts.ts
- [ ] Generate names using localization
- [ ] Generate emails with realistic domains
- [ ] Generate phone numbers
- [ ] Assign to companies (some unassigned)
- [ ] Assign owners
- [ ] Set status (lead/prospect/customer/churned)
- [ ] Apply drop-off rate
- [ ] Distribute across months
- [ ] Batch insert

**Acceptance Criteria**:
- [ ] Contact count matches target
- [ ] Status distribution realistic
- [ ] Names match country

#### E3-S6: Deals Generator
**Priority**: P0 | **Estimate**: 5h | **Dependencies**: E3-S3, E3-S5

**Description**: Generate deals with value distribution and stage progression.

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/deals.ts
- [ ] Generate deal values using Pareto distribution
- [ ] Apply whale ratio for large deals
- [ ] Assign to pipeline stages
- [ ] Set expected close dates
- [ ] Calculate probabilities
- [ ] Link to contacts and companies
- [ ] Distribute across months
- [ ] Ensure pipeline value matches target
- [ ] Batch insert

**Acceptance Criteria**:
- [ ] Deal count and value match targets
- [ ] Stage distribution realistic
- [ ] Win/loss rates correct

#### E3-S7: Activities Generator
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E3-S5, E3-S6

**Description**: Generate activities (calls, emails, meetings, notes, tasks).

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/activities.ts
- [ ] Generate activity types per ratio
- [ ] Generate realistic descriptions
- [ ] Link to contacts and deals
- [ ] Set business hours timestamps
- [ ] Assign to users
- [ ] Mark some as completed
- [ ] Distribute across months
- [ ] Batch insert

**Acceptance Criteria**:
- [ ] Activity count reasonable
- [ ] Types well distributed
- [ ] Timestamps in business hours

#### E3-S8: Tags Generator
**Priority**: P2 | **Estimate**: 2h | **Dependencies**: E3-S5

**Description**: Create tags and assign to contacts.

**Tasks**:
- [ ] Create lib/demo-generator/data-generators/tags.ts
- [ ] Create standard tags (High Value, VIP, At Risk, etc.)
- [ ] Assign tags to contacts based on status/value
- [ ] Batch insert contact_tags

**Acceptance Criteria**:
- [ ] Tags created
- [ ] Assignment logical

---

## Epic 4: Localization System

### Description
Implement country-specific data providers for names, addresses, phones.

### Stories

#### E4-S1: Localization Framework
**Priority**: P0 | **Estimate**: 3h | **Dependencies**: E1-S2

**Description**: Create the localization provider interface and selector.

**Tasks**:
- [ ] Create lib/demo-generator/localization/index.ts
- [ ] Define LocalizationProvider interface
- [ ] Create provider factory/selector by country
- [ ] Handle fallback to US for unknown countries

**Acceptance Criteria**:
- [ ] Provider selection works
- [ ] Fallback works correctly

#### E4-S2: US Localization Provider
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E4-S1

**Description**: Implement US-specific data generation.

**Tasks**:
- [ ] Create lib/demo-generator/localization/providers/us.ts
- [ ] Add first/last name lists
- [ ] Add city/state data
- [ ] Add phone prefix data
- [ ] Implement all provider methods
- [ ] Set US defaults (timezone, currency)

**Acceptance Criteria**:
- [ ] All methods return valid US data
- [ ] Phone format correct (+1 XXX-XXX-XXXX)

#### E4-S3: UK Localization Provider
**Priority**: P1 | **Estimate**: 2h | **Dependencies**: E4-S1

**Description**: Implement UK-specific data generation.

**Tasks**:
- [ ] Create lib/demo-generator/localization/providers/uk.ts
- [ ] Add British name lists
- [ ] Add UK city/postcode data
- [ ] Implement provider methods
- [ ] Set UK defaults (GMT, GBP)

**Acceptance Criteria**:
- [ ] Names are British
- [ ] Postcodes valid format

#### E4-S4: German Localization Provider
**Priority**: P1 | **Estimate**: 2h | **Dependencies**: E4-S1

**Description**: Implement German-specific data generation.

**Tasks**:
- [ ] Create lib/demo-generator/localization/providers/de.ts
- [ ] Add German name lists
- [ ] Add German city/PLZ data
- [ ] Implement provider methods
- [ ] Set German defaults (CET, EUR)

**Acceptance Criteria**:
- [ ] Names are German
- [ ] PLZ format correct

#### E4-S5: Additional Providers (JP, BR, AE)
**Priority**: P2 | **Estimate**: 3h | **Dependencies**: E4-S1

**Description**: Implement remaining country providers.

**Tasks**:
- [ ] Create Japanese provider
- [ ] Create Brazilian provider
- [ ] Create UAE provider
- [ ] All with appropriate name formats

**Acceptance Criteria**:
- [ ] Each country has working provider
- [ ] Data culturally appropriate

---

## Epic 5: Industry Templates

### Description
Define industry-specific configurations for pipelines, deals, and patterns.

### Stories

#### E5-S1: Template Framework
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E1-S2

**Description**: Create template loading and selection system.

**Tasks**:
- [ ] Create lib/demo-generator/templates/index.ts
- [ ] Define template interface
- [ ] Create template registry
- [ ] Add template selector by industry

**Acceptance Criteria**:
- [ ] Templates load correctly
- [ ] Selection works

#### E5-S2: Core Industry Templates
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E5-S1

**Description**: Create Trading, iGaming, SaaS, E-commerce templates.

**Tasks**:
- [ ] Create trading.ts template
- [ ] Create igaming.ts template
- [ ] Create saas.ts template
- [ ] Create ecommerce.ts template
- [ ] Each with pipeline, deal, activity configs

**Acceptance Criteria**:
- [ ] All templates complete
- [ ] Pipelines industry-appropriate
- [ ] Deal values realistic

#### E5-S3: Additional Templates
**Priority**: P2 | **Estimate**: 2h | **Dependencies**: E5-S1

**Description**: Create Real Estate and Financial Services templates.

**Tasks**:
- [ ] Create realestate.ts template
- [ ] Create finserv.ts template

**Acceptance Criteria**:
- [ ] Templates complete and realistic

---

## Epic 6: API Layer

### Description
Implement API endpoints for demo generation.

### Stories

#### E6-S1: Create Demo Endpoint
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E2-S5, E3-*

**Description**: POST /api/master/demo-generator

**Tasks**:
- [ ] Create app/api/master/demo-generator/route.ts
- [ ] Validate request body
- [ ] Create job record
- [ ] Execute generation
- [ ] Update job with results
- [ ] Return job ID and status

**Acceptance Criteria**:
- [ ] Validation works
- [ ] Generation completes
- [ ] Job tracked correctly

#### E6-S2: List Jobs Endpoint
**Priority**: P0 | **Estimate**: 3h | **Dependencies**: E1-S1

**Description**: GET /api/master/demo-generator

**Tasks**:
- [ ] Add GET handler to route.ts
- [ ] Parse query parameters
- [ ] Query with filters and pagination
- [ ] Join tenant name
- [ ] Return paginated response

**Acceptance Criteria**:
- [ ] Pagination works
- [ ] Filters work
- [ ] Sorting works

#### E6-S3: Job Detail Endpoint
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E6-S1

**Description**: GET /api/master/demo-generator/[jobId]

**Tasks**:
- [ ] Create app/api/master/demo-generator/[jobId]/route.ts
- [ ] Fetch job with relations
- [ ] Include monthly breakdown
- [ ] Return full detail

**Acceptance Criteria**:
- [ ] Full detail returned
- [ ] 404 for unknown job

#### E6-S4: Delete Demo Endpoint
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: E6-S3

**Description**: DELETE /api/master/demo-generator/[jobId]

**Tasks**:
- [ ] Add DELETE handler
- [ ] Delete tenant (cascades data)
- [ ] Update job record
- [ ] Return success

**Acceptance Criteria**:
- [ ] Tenant deleted
- [ ] All data cascaded
- [ ] Job marked deleted

#### E6-S5: Preview Endpoint
**Priority**: P1 | **Estimate**: 1h | **Dependencies**: E2-S2

**Description**: POST /api/master/demo-generator/preview

**Tasks**:
- [ ] Create preview route
- [ ] Run growth planner only
- [ ] Return monthly projections
- [ ] Estimate generation time

**Acceptance Criteria**:
- [ ] Preview returns without creating data
- [ ] Projections accurate

---

## Epic 7: UI - Generator Form

### Description
Build the demo client generator form interface.

### Stories

#### E7-S1: Page Setup & Navigation
**Priority**: P0 | **Estimate**: 2h | **Dependencies**: None

**Description**: Add page route and sidebar navigation.

**Tasks**:
- [ ] Create app/(master)/master/demo-generator/page.tsx
- [ ] Add to MasterSidebar
- [ ] Set up basic page layout
- [ ] Add MasterHeader

**Acceptance Criteria**:
- [ ] Page accessible from sidebar
- [ ] Header displays correctly

#### E7-S2: Industry Quick Select
**Priority**: P0 | **Estimate**: 3h | **Dependencies**: E7-S1

**Description**: Industry card selector component.

**Tasks**:
- [ ] Create components/demo-generator/IndustryCard.tsx
- [ ] Create IndustrySelector component
- [ ] Style selected/hover states
- [ ] Handle selection callback

**Acceptance Criteria**:
- [ ] Cards display correctly
- [ ] Selection works
- [ ] Visual feedback clear

#### E7-S3: Basic Configuration Form
**Priority**: P0 | **Estimate**: 5h | **Dependencies**: E7-S2

**Description**: Form for tenant basics and volume targets.

**Tasks**:
- [ ] Create GeneratorForm component
- [ ] Add tenant name input (with regenerate)
- [ ] Add country select with flags
- [ ] Add timezone/currency selects (auto-filled)
- [ ] Add start date picker
- [ ] Add team size input
- [ ] Add volume inputs (leads, contacts, etc.)
- [ ] Wire up react-hook-form
- [ ] Add validation display

**Acceptance Criteria**:
- [ ] All inputs work
- [ ] Validation shows errors
- [ ] Auto-fill works

#### E7-S4: Advanced Options Section
**Priority**: P1 | **Estimate**: 3h | **Dependencies**: E7-S3

**Description**: Collapsible advanced settings.

**Tasks**:
- [ ] Create collapsible section
- [ ] Add growth model radio buttons
- [ ] Add monthly rate slider
- [ ] Add seasonality toggle
- [ ] Add channel mix sliders
- [ ] Add realism settings
- [ ] Add seed input

**Acceptance Criteria**:
- [ ] Section collapses/expands
- [ ] All inputs work
- [ ] Sliders show percentages

#### E7-S5: Form Submission & Progress
**Priority**: P0 | **Estimate**: 3h | **Dependencies**: E7-S3, E6-S1

**Description**: Handle form submission and show progress.

**Tasks**:
- [ ] Submit to API
- [ ] Show progress dialog
- [ ] Poll for status updates
- [ ] Display current step
- [ ] Handle completion
- [ ] Handle errors
- [ ] Refresh list on success

**Acceptance Criteria**:
- [ ] Submission works
- [ ] Progress updates shown
- [ ] Error handling works

---

## Epic 8: UI - Jobs List & Management

### Description
Build the jobs list and management interface.

### Stories

#### E8-S1: Jobs Table
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E6-S2

**Description**: Display list of generation jobs.

**Tasks**:
- [ ] Create JobsTable component
- [ ] Add columns per spec
- [ ] Add status badges
- [ ] Add sorting
- [ ] Add pagination
- [ ] Fetch data from API

**Acceptance Criteria**:
- [ ] Table displays correctly
- [ ] Sorting works
- [ ] Pagination works

#### E8-S2: Search & Filters
**Priority**: P1 | **Estimate**: 2h | **Dependencies**: E8-S1

**Description**: Add search and filter controls.

**Tasks**:
- [ ] Add search input
- [ ] Add status tabs/filter
- [ ] Add country filter
- [ ] Add industry filter
- [ ] Wire to API query

**Acceptance Criteria**:
- [ ] Search works
- [ ] Filters work
- [ ] Combined filtering works

#### E8-S3: Row Actions
**Priority**: P0 | **Estimate**: 3h | **Dependencies**: E8-S1

**Description**: Add action dropdown for each row.

**Tasks**:
- [ ] Create action dropdown menu
- [ ] Add View Details action
- [ ] Add Login as Owner action
- [ ] Add Regenerate action
- [ ] Add Delete action with confirmation
- [ ] Wire to APIs

**Acceptance Criteria**:
- [ ] All actions work
- [ ] Delete has confirmation
- [ ] Login opens new tab

#### E8-S4: Empty & Loading States
**Priority**: P1 | **Estimate**: 2h | **Dependencies**: E8-S1

**Description**: Handle empty and loading states.

**Tasks**:
- [ ] Create skeleton loader
- [ ] Create empty state
- [ ] Handle error state

**Acceptance Criteria**:
- [ ] Loading shows skeleton
- [ ] Empty state has CTA
- [ ] Errors displayed

---

## Epic 9: Preview & Visualization

### Description
Add preview and metrics visualization.

### Stories

#### E9-S1: Preview Chart
**Priority**: P1 | **Estimate**: 3h | **Dependencies**: E6-S5

**Description**: Show growth projection chart in form.

**Tasks**:
- [ ] Create PreviewChart component
- [ ] Use Recharts AreaChart
- [ ] Show monthly projections
- [ ] Update on config change
- [ ] Add loading state

**Acceptance Criteria**:
- [ ] Chart renders
- [ ] Updates dynamically
- [ ] Shows accurate data

#### E9-S2: Job Detail Page
**Priority**: P1 | **Estimate**: 3h | **Dependencies**: E6-S3

**Description**: Full job detail page.

**Tasks**:
- [ ] Create app/(master)/master/demo-generator/jobs/[jobId]/page.tsx
- [ ] Display stats cards
- [ ] Display growth chart
- [ ] Display monthly breakdown table
- [ ] Display configuration
- [ ] Add action buttons

**Acceptance Criteria**:
- [ ] All sections display
- [ ] Data accurate
- [ ] Actions work

#### E9-S3: Stats Cards
**Priority**: P1 | **Estimate**: 2h | **Dependencies**: E9-S2

**Description**: Summary stats display.

**Tasks**:
- [ ] Create StatsCard component
- [ ] Show target vs actual
- [ ] Show variance indicator
- [ ] Style appropriately

**Acceptance Criteria**:
- [ ] Cards display correctly
- [ ] Variance shown clearly

---

## Epic 10: Testing & QA

### Description
Comprehensive testing of the module.

### Stories

#### E10-S1: Unit Tests
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E2-*, E3-*, E4-*

**Description**: Unit tests for core functions.

**Tasks**:
- [ ] Test RNG determinism
- [ ] Test growth planner curves
- [ ] Test localization providers
- [ ] Test value distributions
- [ ] Test batch inserter

**Acceptance Criteria**:
- [ ] All units tested
- [ ] Coverage >80%

#### E10-S2: Integration Tests
**Priority**: P0 | **Estimate**: 4h | **Dependencies**: E6-*

**Description**: API integration tests.

**Tasks**:
- [ ] Test create endpoint
- [ ] Test list endpoint
- [ ] Test detail endpoint
- [ ] Test delete endpoint
- [ ] Test auth requirements

**Acceptance Criteria**:
- [ ] All endpoints tested
- [ ] Auth enforced

#### E10-S3: E2E Tests
**Priority**: P1 | **Estimate**: 4h | **Dependencies**: E7-*, E8-*

**Description**: End-to-end UI tests.

**Tasks**:
- [ ] Test form submission
- [ ] Test job list display
- [ ] Test delete flow
- [ ] Test navigation

**Acceptance Criteria**:
- [ ] Critical paths tested
- [ ] No regressions

---

## Dependency Graph

```
E1 (Schema)
  ├─► E2 (Engine Core)
  │     ├─► E3 (Data Generators)
  │     │     └─► E6 (API Layer)
  │     │           ├─► E7 (Generator Form)
  │     │           ├─► E8 (Jobs List)
  │     │           └─► E9 (Visualization)
  │     ├─► E4 (Localization)
  │     └─► E5 (Templates)
  └─► E10 (Testing) ←── All
```

---

## Sprint Plan (Suggested)

### Sprint 1 (Week 1)
- E1: Database Schema & Core Types (8h)
- E2-S1, E2-S2, E2-S3: RNG, Growth Planner, Batch Inserter (9h)
- E4-S1, E4-S2: Localization Framework + US Provider (5h)
- E5-S1, E5-S2: Template Framework + Core Templates (6h)

**Sprint Total**: 28h

### Sprint 2 (Week 2)
- E2-S4, E2-S5: Progress Tracker, Generator Orchestrator (7h)
- E3-S1 to E3-S6: All Data Generators (21h)

**Sprint Total**: 28h

### Sprint 3 (Week 3)
- E6: All API Endpoints (12h)
- E7: All Generator Form Stories (16h)

**Sprint Total**: 28h

### Sprint 4 (Week 4)
- E8: Jobs List & Management (12h)
- E9: Preview & Visualization (8h)
- E10: Testing (12h)
- Buffer for fixes and polish (8h)

**Sprint Total**: 40h
