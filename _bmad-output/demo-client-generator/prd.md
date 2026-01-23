# Product Requirements Document: Demo Client Generator

## Document Control
- **Version**: 1.0
- **Status**: Draft
- **Last Updated**: 2026-01-23
- **Author**: BMAD AlphaTeam

---

## 1. Executive Summary

### 1.1 Problem Statement
Master Admins need to quickly generate realistic demo tenants for sales presentations, investor demos, onboarding training, and QA testing. Currently, there's no UI-driven way to create populated tenants with believable data that shows authentic CRM usage patterns.

### 1.2 Solution Overview
A Demo Client Generator module within the Master CRM that allows parameterized creation of fully-populated tenants with:
- Country-specific localized data (names, addresses, phone formats, currencies)
- Industry-specific pipelines and deal patterns
- Time-based growth simulation showing realistic business evolution
- Deterministic generation for reproducibility

### 1.3 Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Generation Time | < 60 seconds | End-to-end for typical tenant |
| Data Completeness | 100% | All CRM screens populated |
| Metric Accuracy | ±10% tolerance | Generated vs requested volumes |
| Determinism | 100% | Same seed = identical output |

---

## 2. User Personas

### 2.1 Primary: Master Admin (Platform Operator)
- **Role**: Platform-level administrator with full system access
- **Goals**: Generate demo tenants quickly for various purposes
- **Pain Points**: Manual data entry is tedious, demo data looks fake
- **Technical Level**: High (understands data models, APIs)

### 2.2 Secondary: Sales Engineer
- **Role**: Pre-sales technical demonstration
- **Goals**: Show prospects a populated CRM that matches their industry
- **Pain Points**: Generic demos don't resonate with specific verticals
- **Technical Level**: Medium

---

## 3. Functional Requirements

### 3.1 Generation Configuration (FR-GEN)

#### FR-GEN-001: Tenant Basics
**Priority**: P0 (Must Have)

| Parameter | Type | Validation | Default |
|-----------|------|------------|---------|
| Tenant Name | string | 3-100 chars, unique | Generated from industry |
| Country | ISO 3166-1 alpha-2 | Valid code | US |
| Timezone | IANA timezone | Valid zone | Derived from country |
| Currency | ISO 4217 | Valid code | Derived from country |
| Industry | enum | See templates | Trading |
| Start Date | date | Not future, max 24mo ago | 6 months ago |
| Team Size | integer | 2-50 | 8 |

#### FR-GEN-002: Volume Targets
**Priority**: P0 (Must Have)

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| Total Leads | integer | 100-50,000 | 2,000 |
| Total Contacts | integer | 50-20,000 | 500 |
| Total Companies | integer | 20-5,000 | 200 |
| Pipeline Value ($) | decimal | 10K-100M | 500,000 |
| Closed-Won Value ($) | decimal | 5K-50M | 150,000 |
| Closed-Won Count | integer | 10-5,000 | 100 |

#### FR-GEN-003: Growth Model
**Priority**: P1 (Should Have)

| Parameter | Type | Options | Default |
|-----------|------|---------|---------|
| Growth Curve | enum | linear, exponential, logistic, step | exponential |
| Monthly Growth Rate | percentage | 0-50% | 15% |
| Seasonality | boolean | - | true |

#### FR-GEN-004: Attribution & Realism
**Priority**: P2 (Nice to Have)

| Parameter | Type | Default |
|-----------|------|---------|
| Channel Mix | object | {SEO: 25%, Meta: 20%, Google: 25%, Affiliates: 15%, Referrals: 10%, Direct: 5%} |
| Drop-off Rate | percentage | 20% |
| Whale Ratio | percentage | 5% (% of deals that are large) |
| Response SLA (hours) | integer | 4 |

### 3.2 Industry Templates (FR-IND)

#### FR-IND-001: Predefined Industry Configurations
**Priority**: P0 (Must Have)

| Industry | Pipeline Stages | Avg Deal Size | Deal Cycle (days) |
|----------|-----------------|---------------|-------------------|
| Trading | New Lead → Qualified → Demo → Funded → Active → VIP | $5,000-50,000 | 14-45 |
| iGaming | Registration → KYC → First Deposit → Active → VIP → Churned | $100-5,000 | 7-30 |
| SaaS | Lead → Discovery → Demo → Proposal → Negotiation → Closed | $500-50,000 | 30-90 |
| E-commerce | Visitor → Cart → Checkout → Purchased → Repeat | $50-500 | 1-7 |
| Real Estate | Inquiry → Viewing → Offer → Negotiation → Closing | $50,000-500,000 | 60-180 |
| Financial Services | Lead → Consultation → Application → Underwriting → Funded | $10,000-100,000 | 30-90 |

### 3.3 Data Localization (FR-LOC)

#### FR-LOC-001: Country-Specific Data
**Priority**: P0 (Must Have)

| Country | Names | Phone Format | Address Format | Companies |
|---------|-------|--------------|----------------|-----------|
| US | English names | +1 (XXX) XXX-XXXX | Street, City, ST ZIP | American style |
| UK | British names | +44 XXXX XXXXXX | Street, City, Postcode | British Ltd |
| DE | German names | +49 XXX XXXXXXX | Straße Nr, PLZ Stadt | German GmbH |
| JP | Japanese names | +81 XX-XXXX-XXXX | Prefecture, City, Ward | Japanese KK |
| BR | Portuguese names | +55 XX XXXXX-XXXX | Rua, Cidade, CEP | Brazilian SA |
| AE | Arabic/English | +971 XX XXX XXXX | Building, Street, City | UAE LLC |

### 3.4 Generation Engine (FR-ENG)

#### FR-ENG-001: Deterministic Generation
**Priority**: P0 (Must Have)
- Seeded RNG using provided or auto-generated seed
- Same seed + config = identical output
- Seed stored with job for reproducibility

#### FR-ENG-002: Idempotency
**Priority**: P0 (Must Have)
- Generation job ID prevents duplicate runs
- Re-running same job returns existing tenant
- Explicit "regenerate" creates new tenant with new ID

#### FR-ENG-003: Performance
**Priority**: P1 (Should Have)
- Batch inserts (500 rows per batch)
- Progress tracking and logging
- Target: 10,000 records/second throughput

### 3.5 Master CRM UI (FR-UI)

#### FR-UI-001: Generator Form
**Priority**: P0 (Must Have)
- Multi-step wizard or sectioned form
- Industry template quick-select
- Advanced options collapsible
- Real-time validation

#### FR-UI-002: Preview Mode
**Priority**: P1 (Should Have)
- Show expected monthly metrics before generation
- Growth curve visualization
- Estimated generation time

#### FR-UI-003: Generated Tenants List
**Priority**: P0 (Must Have)
- Searchable/filterable table
- Columns: Name, Country, Industry, Created, Contacts, Deals, Pipeline $
- Actions: View, Login As, Regenerate, Delete

#### FR-UI-004: Job Detail View
**Priority**: P1 (Should Have)
- Generation config display
- Monthly KPI breakdown
- Growth chart visualization
- Log viewer

### 3.6 Security & Isolation (FR-SEC)

#### FR-SEC-001: Access Control
**Priority**: P0 (Must Have)
- Only Master Admins can access generator
- Generated tenants fully isolated
- `is_demo_generated` flag internal only

#### FR-SEC-002: Audit Trail
**Priority**: P0 (Must Have)
- Log who generated, when, with what config
- Track regeneration and deletion

---

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-PERF)
- Generation completes in < 60 seconds for typical config
- UI remains responsive during generation
- Progress updates at 1-second intervals

### 4.2 Scalability (NFR-SCALE)
- Support generating up to 50,000 records per tenant
- Handle up to 10 concurrent generation jobs

### 4.3 Reliability (NFR-REL)
- Failed generations leave no partial data
- Transaction rollback on error
- Retry capability for transient failures

### 4.4 Security (NFR-SEC)
- No real PII in generated data
- All synthetic data marked as such in metadata
- Demo tenants excludable from analytics

---

## 5. User Stories

### Epic 1: Foundation
| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| US-1.1 | As a Master Admin, I can access the Demo Generator from the Master sidebar | P0 | 2h |
| US-1.2 | As a Master Admin, I can see a list of all demo-generated tenants | P0 | 4h |
| US-1.3 | As the system, demo generation jobs are stored with full config | P0 | 4h |

### Epic 2: Generation Engine
| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| US-2.1 | As a Master Admin, I can specify basic tenant parameters | P0 | 4h |
| US-2.2 | As a Master Admin, I can select an industry template | P0 | 6h |
| US-2.3 | As the system, I generate localized names/addresses by country | P0 | 8h |
| US-2.4 | As the system, I distribute data across time per growth model | P1 | 6h |
| US-2.5 | As the system, I ensure deterministic output with seed | P0 | 4h |

### Epic 3: Data Generation
| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| US-3.1 | As the system, I create users/team members for the tenant | P0 | 4h |
| US-3.2 | As the system, I create pipeline stages per industry | P0 | 4h |
| US-3.3 | As the system, I create contacts with realistic attributes | P0 | 6h |
| US-3.4 | As the system, I create deals distributed by stage and value | P0 | 8h |
| US-3.5 | As the system, I create activities tied to contacts/deals | P0 | 6h |
| US-3.6 | As the system, I create companies with industry-appropriate profiles | P1 | 4h |

### Epic 4: UI & Preview
| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| US-4.1 | As a Master Admin, I can fill out the generation form | P0 | 8h |
| US-4.2 | As a Master Admin, I can preview expected metrics before generating | P1 | 6h |
| US-4.3 | As a Master Admin, I can see generation progress | P1 | 4h |
| US-4.4 | As a Master Admin, I can view detailed job results | P1 | 6h |

### Epic 5: Management
| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| US-5.1 | As a Master Admin, I can delete a demo tenant | P0 | 4h |
| US-5.2 | As a Master Admin, I can regenerate (create new) from existing config | P1 | 4h |
| US-5.3 | As a Master Admin, I can login as a demo tenant user | P2 | 6h |

---

## 6. Acceptance Criteria

### AC-1: Basic Generation
- [ ] Master Admin can generate a tenant with name, country, industry
- [ ] Tenant appears in tenant list with correct metadata
- [ ] Tenant user can login and see populated dashboard

### AC-2: Data Completeness
- [ ] All CRM screens have data (contacts, deals, pipeline, activities)
- [ ] No "demo/test" visible strings in generated data
- [ ] Data volumes match requested targets ±10%

### AC-3: Localization
- [ ] Names match country (German names for DE, Japanese for JP)
- [ ] Phone numbers match country format
- [ ] Addresses match country format

### AC-4: Growth Simulation
- [ ] Data distributed across time from start date to now
- [ ] Monthly metrics show growth pattern
- [ ] Charts visualize realistic progression

### AC-5: Determinism
- [ ] Same seed produces identical data
- [ ] Seed is stored and can be viewed

### AC-6: Security
- [ ] Only Master Admins can access generator
- [ ] Generated tenants are fully isolated
- [ ] Demo flag is internal only

---

## 7. Out of Scope (v1)

- External API integrations (email/SMS verification)
- Real-time exchange rate API for currency conversion
- Custom pipeline stage editor in generator
- Bulk generation (multiple tenants at once)
- Import from CSV for custom name lists
- AI-generated activity content

---

## 8. Dependencies

| Dependency | Type | Risk |
|------------|------|------|
| Existing seed-client.ts patterns | Internal | Low - can adapt |
| Drizzle ORM bulk insert | Internal | Low - proven |
| Country data libraries | External | Low - static data |

---

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Generation timeout | High | Medium | Progress tracking, batch commits |
| Data inconsistency | High | Low | Transaction rollback, validation |
| Unrealistic distributions | Medium | Medium | Tunable parameters, industry templates |
| Memory exhaustion | Medium | Low | Streaming generation, limits |

---

## 10. Timeline

### Phase 1: MVP (Week 1-2)
- Database schema
- Basic generation engine
- Simple UI form
- Core data types (users, contacts, deals)

### Phase 2: Enhancement (Week 3)
- Industry templates
- Full localization
- Growth models
- Preview mode

### Phase 3: Polish (Week 4)
- Job management UI
- Charts and visualizations
- Edge case handling
- Documentation

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Demo Tenant | A tenant created by the generator for demonstration purposes |
| Generation Job | A tracked execution of the generator with config and results |
| Seed | Random number generator seed for deterministic output |
| Growth Curve | Mathematical model for data distribution over time |
| Whale | High-value deal significantly above average |
