# Test Plan: Demo Client Generator

## Document Control
- **Version**: 1.0
- **Status**: Draft
- **Last Updated**: 2026-01-23

---

## 1. Test Strategy Overview

### 1.1 Objectives
- Verify all functional requirements are met
- Ensure data quality and consistency
- Validate security and tenant isolation
- Confirm performance targets achieved
- Test edge cases and error handling

### 1.2 Scope

**In Scope**:
- Unit tests for core functions
- Integration tests for API endpoints
- E2E tests for critical user flows
- Performance benchmarks
- Security validation

**Out of Scope**:
- Load testing at scale (>100 concurrent users)
- Cross-browser compatibility (beyond Chrome)
- Accessibility compliance testing

### 1.3 Test Levels

| Level | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | Vitest | 80% |
| Integration | Vitest + Supertest | Critical paths |
| E2E | Playwright | Happy paths |
| Manual | - | Exploratory |

---

## 2. Unit Test Cases

### 2.1 Seeded RNG (lib/demo-generator/engine/rng.ts)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| RNG-001 | Same seed produces same sequence | Identical numbers |
| RNG-002 | Different seeds produce different sequences | Different numbers |
| RNG-003 | int(min, max) returns within bounds | min <= result <= max |
| RNG-004 | float(min, max) returns within bounds | min <= result <= max |
| RNG-005 | pick() returns array element | Element exists in array |
| RNG-006 | pickWeighted() respects weights | Weighted distribution |
| RNG-007 | shuffle() randomizes array | Order changed, elements preserved |
| RNG-008 | pareto() returns >= min | result >= min |
| RNG-009 | date() returns within range | start <= result <= end |
| RNG-010 | businessDate() returns weekday 9-18h | Weekday, business hours |

### 2.2 Growth Planner (lib/demo-generator/engine/growth-planner.ts)

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| GP-001 | Linear growth produces equal increments | Roughly even distribution |
| GP-002 | Exponential growth increases each month | Each month > previous |
| GP-003 | Logistic growth S-curve shape | Slow-fast-slow pattern |
| GP-004 | Step growth increases every N months | Discrete jumps |
| GP-005 | Monthly targets sum to total | Within ±1% of target |
| GP-006 | Start date after end date throws | Error thrown |
| GP-007 | Single month returns full target | 100% in one month |
| GP-008 | 12 months exponential at 10% | ~3x first month by end |

### 2.3 Localization Providers

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| LOC-001 | US firstName returns string | Non-empty string |
| LOC-002 | US lastName returns string | Non-empty string |
| LOC-003 | US phone matches format | +1 XXX-XXX-XXXX |
| LOC-004 | US postalCode is 5 digits | /^\d{5}$/ |
| LOC-005 | DE phone matches format | +49 XXX XXXXXXX |
| LOC-006 | DE postalCode is 5 digits | /^\d{5}$/ |
| LOC-007 | UK postcode matches format | Valid UK format |
| LOC-008 | Unknown country falls back to US | Returns US data |
| LOC-009 | All providers have timezone | Non-empty string |
| LOC-010 | All providers have currency | 3-letter code |

### 2.4 Data Generators

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| DG-001 | Tenant generator creates valid tenant | Tenant in DB |
| DG-002 | User count matches teamSize | Exact match |
| DG-003 | Pipeline stages match template | All stages present |
| DG-004 | Contact count within ±10% | Target ± 10% |
| DG-005 | Deal value uses Pareto dist | 80% < median |
| DG-006 | Activities have valid types | In enum list |
| DG-007 | Activities in business hours | 9am-6pm local |
| DG-008 | Company names are unique | No duplicates |
| DG-009 | Email domains are realistic | Not @test.com |
| DG-010 | Tags assigned to contacts | Some contacts tagged |

---

## 3. Integration Test Cases

### 3.1 API Endpoints

#### POST /api/master/demo-generator

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| API-001 | Valid request creates job | 200, job ID returned |
| API-002 | Missing required field | 400, validation error |
| API-003 | Invalid country code | 400, validation error |
| API-004 | Start date in future | 400, validation error |
| API-005 | Non-master-admin denied | 401/403 |
| API-006 | Missing CSRF token | 403 |
| API-007 | Job completes successfully | Status = completed |
| API-008 | Tenant created with data | All entities populated |
| API-009 | Seed stored for job | Seed in response |
| API-010 | Metrics recorded | Actual counts saved |

#### GET /api/master/demo-generator

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| API-011 | Returns paginated list | Data + meta |
| API-012 | Pagination works | Page 2 different from 1 |
| API-013 | Search by tenant name | Filtered results |
| API-014 | Filter by status | Only matching status |
| API-015 | Filter by country | Only matching country |
| API-016 | Sort by createdAt | Correct order |
| API-017 | Non-master-admin denied | 401/403 |

#### GET /api/master/demo-generator/[jobId]

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| API-018 | Returns full job detail | All fields present |
| API-019 | Unknown job ID | 404 |
| API-020 | Includes tenant info | Tenant name shown |
| API-021 | Includes monthly breakdown | Array of months |
| API-022 | Non-master-admin denied | 401/403 |

#### DELETE /api/master/demo-generator/[jobId]

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| API-023 | Deletes tenant | Tenant removed |
| API-024 | Cascades data deletion | All entities removed |
| API-025 | Job marked deleted | Status updated |
| API-026 | Unknown job ID | 404 |
| API-027 | Non-master-admin denied | 401/403 |
| API-028 | Missing CSRF token | 403 |

#### POST /api/master/demo-generator/preview

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| API-029 | Returns monthly projection | Array of months |
| API-030 | No data created | DB unchanged |
| API-031 | Totals match input | Sum equals target |
| API-032 | Includes time estimate | estimatedSeconds present |

### 3.2 Database Transactions

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| TX-001 | Success commits all data | All tables populated |
| TX-002 | Error rolls back all data | No partial data |
| TX-003 | FK constraints enforced | Invalid ref rejected |
| TX-004 | Unique constraints enforced | Duplicate rejected |

---

## 4. End-to-End Test Cases

### 4.1 Generate Demo Client Flow

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| E2E-001 | Basic generation | 1. Click Generate<br>2. Select Trading<br>3. Fill US, 6mo<br>4. Click Generate | Tenant created |
| E2E-002 | Custom volumes | 1. Set leads=5000<br>2. Set contacts=1000<br>3. Generate | Counts match |
| E2E-003 | German localization | 1. Select Germany<br>2. Generate | German names/addresses |
| E2E-004 | View progress | 1. Generate large tenant<br>2. Watch progress | Progress updates |
| E2E-005 | Error recovery | 1. Trigger error (bad input)<br>2. Fix and retry | Success on retry |

### 4.2 Jobs Management Flow

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| E2E-006 | View job list | 1. Navigate to generator<br>2. View table | Jobs displayed |
| E2E-007 | Search jobs | 1. Enter search term<br>2. View results | Filtered list |
| E2E-008 | View job detail | 1. Click row<br>2. View detail page | Full info shown |
| E2E-009 | Delete job | 1. Click Delete<br>2. Confirm | Tenant removed |
| E2E-010 | Login as tenant | 1. Click Login<br>2. New tab opens | Dashboard loads |

---

## 5. Security Test Cases

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| SEC-001 | Master admin can access | Full access |
| SEC-002 | Tenant admin denied | 403 Forbidden |
| SEC-003 | Unauthenticated denied | 401 Unauthorized |
| SEC-004 | Generated tenant isolated | Cannot see other data |
| SEC-005 | Demo flag not in tenant API | Flag hidden |
| SEC-006 | Audit log created | Generation logged |
| SEC-007 | CSRF required for mutations | 403 without token |

---

## 6. Performance Test Cases

| ID | Test Case | Target | Measurement |
|----|-----------|--------|-------------|
| PERF-001 | Generate 2K contacts | <30s | Stopwatch |
| PERF-002 | Generate 10K contacts | <60s | Stopwatch |
| PERF-003 | Generate 50K contacts | <180s | Stopwatch |
| PERF-004 | List 100 jobs | <200ms | API response time |
| PERF-005 | Memory usage | <512MB | Node heap |
| PERF-006 | Concurrent 3 jobs | All complete | No failures |

---

## 7. Data Quality Test Cases

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| DQ-001 | No "test" or "demo" in names | Pattern not found |
| DQ-002 | No example.com emails | Pattern not found |
| DQ-003 | Phone formats valid | Regex match |
| DQ-004 | Deal values > 0 | No zero/negative |
| DQ-005 | Dates in valid range | start <= date <= now |
| DQ-006 | No orphan records | All FKs valid |
| DQ-007 | Status transitions valid | No invalid states |
| DQ-008 | Created dates distributed | Not all same day |

---

## 8. Determinism Test Cases

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| DET-001 | Same seed = same tenant name | Identical |
| DET-002 | Same seed = same contact names | Identical list |
| DET-003 | Same seed = same deal values | Identical amounts |
| DET-004 | Different seed = different data | Different |
| DET-005 | Determinism across restarts | Still matches |

---

## 9. Edge Case Test Cases

| ID | Test Case | Expected Result |
|----|-----------|-----------------|
| EDGE-001 | Minimum volumes (100 leads) | Completes |
| EDGE-002 | Maximum volumes (50K leads) | Completes or warns |
| EDGE-003 | Start date = today | Single month data |
| EDGE-004 | Start date = 24mo ago | 24 months data |
| EDGE-005 | Team size = 2 | Owner + 1 member |
| EDGE-006 | Team size = 50 | All created |
| EDGE-007 | 100% whale ratio | All deals large |
| EDGE-008 | 0% whale ratio | No large deals |
| EDGE-009 | All channels at 0% | Equal distribution |
| EDGE-010 | Unknown industry | Error or fallback |

---

## 10. Test Environment

### 10.1 Requirements
- Node.js 20+
- PostgreSQL 15+
- Test database (isolated)
- Environment variables configured

### 10.2 Setup
```bash
# Install dependencies
npm install

# Set up test database
createdb gonthia_test

# Run migrations
npm run db:migrate

# Seed test data (if needed)
npm run db:seed:test
```

### 10.3 Execution
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

---

## 11. Test Data

### 11.1 Test Configurations

**Small Generation** (Fast tests):
```json
{
  "country": "US",
  "industry": "trading",
  "startDate": "2025-11-01",
  "teamSize": 4,
  "targets": {
    "leads": 100,
    "contacts": 50,
    "companies": 20
  }
}
```

**Medium Generation** (Standard tests):
```json
{
  "country": "US",
  "industry": "trading",
  "startDate": "2025-07-01",
  "teamSize": 8,
  "targets": {
    "leads": 2000,
    "contacts": 500,
    "companies": 200
  }
}
```

**Large Generation** (Performance tests):
```json
{
  "country": "US",
  "industry": "trading",
  "startDate": "2024-01-01",
  "teamSize": 20,
  "targets": {
    "leads": 50000,
    "contacts": 10000,
    "companies": 2000
  }
}
```

---

## 12. Acceptance Criteria Checklist

### MVP Release Criteria

- [ ] All P0 unit tests pass
- [ ] All P0 integration tests pass
- [ ] All P0 E2E tests pass
- [ ] No critical security issues
- [ ] Performance targets met
- [ ] Code coverage >80%
- [ ] No high-severity bugs
- [ ] Documentation complete

### Sign-off Required From

- [ ] Developer: Implementation complete
- [ ] QA: All tests pass
- [ ] Security: Review approved
- [ ] Product: Acceptance criteria met
