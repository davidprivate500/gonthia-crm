# Test Strategy & Gaps - Gonthia CRM

## Executive Summary

Gonthia CRM has a test framework in place (Vitest + Testing Library) but minimal actual test coverage. Critical paths like authentication, authorization, and data operations are untested. Significant investment needed before production deployment.

**Test Coverage Grade: F**
**Test Infrastructure Grade: B**

---

## 1. Current Test State

### 1.1 Test Infrastructure

| Component | Status | Tool |
|-----------|--------|------|
| Test Runner | ✓ Configured | Vitest |
| React Testing | ✓ Configured | @testing-library/react |
| DOM Environment | ✓ Configured | jsdom |
| Type Checking | ✓ Configured | TypeScript |
| CI Integration | ✓ Basic | GitHub Actions |

### 1.2 Existing Tests

```
__tests__/
├── setup.ts              # Test setup (mocks, globals)
├── lib/
│   └── utils.test.ts     # Basic utility tests
└── components/
    └── ui/
        └── button.test.tsx  # Basic component test
```

**Current Coverage:** < 5%

### 1.3 Test Commands

```bash
npm run test           # Run tests
npm run test:coverage  # With coverage report
```

---

## 2. Test Coverage Gaps

### 2.1 Critical Gaps (P0)

| Area | Current Tests | Risk if Untested |
|------|---------------|------------------|
| Authentication Flow | 0 | Security breach |
| Authorization (RBAC) | 0 | Privilege escalation |
| Session Management | 0 | Session hijacking |
| Multi-tenant Isolation | 0 | Data leakage |
| Input Validation | 0 | Injection attacks |

### 2.2 High Priority Gaps (P1)

| Area | Current Tests | Risk if Untested |
|------|---------------|------------------|
| CRUD Operations | 0 | Data corruption |
| API Route Handlers | 0 | Regression |
| Database Queries | 0 | Data integrity |
| Form Validation | 0 | Bad user data |
| Error Handling | 0 | Information leak |

### 2.3 Medium Priority Gaps (P2)

| Area | Current Tests | Risk if Untested |
|------|---------------|------------------|
| UI Components | 2 | UX regression |
| Hooks | 0 | State bugs |
| Pipeline Board | 0 | Feature regression |
| Search Functionality | 0 | Feature regression |
| Pagination | 0 | Data display issues |

---

## 3. Recommended Test Strategy

### 3.1 Testing Pyramid

```
                    ┌─────────┐
                    │   E2E   │  10%
                    │ (few)   │
                 ┌──┴─────────┴──┐
                 │  Integration   │  30%
                 │  (some)        │
              ┌──┴───────────────┴──┐
              │      Unit Tests      │  60%
              │      (many)          │
              └──────────────────────┘
```

### 3.2 Test Categories

| Category | Scope | Tools | Priority |
|----------|-------|-------|----------|
| Unit | Functions, hooks, utils | Vitest | P0 |
| Component | UI components | Testing Library | P1 |
| Integration | API routes | Vitest + supertest | P0 |
| E2E | User flows | Playwright | P2 |

---

## 4. Unit Test Requirements

### 4.1 Authentication Tests

```typescript
// __tests__/lib/auth/session.test.ts
describe('Session Management', () => {
  describe('getSession', () => {
    it('returns null for invalid session');
    it('returns session data for valid cookie');
    it('fails if SESSION_SECRET is default');
  });

  describe('requireAuth', () => {
    it('returns auth context for valid session');
    it('returns auth context for valid API key');
    it('throws 401 for missing credentials');
    it('throws 401 for expired session');
  });
});

describe('API Key Verification', () => {
  it('returns auth context for valid key');
  it('rejects revoked API keys');
  it('rejects keys with wrong format');
  it('should check if creator user is deleted');  // BUG-006
});
```

### 4.2 Authorization Tests

```typescript
// __tests__/lib/auth/permissions.test.ts
describe('Permission Functions', () => {
  describe('canCreate', () => {
    it('returns true for owner');
    it('returns true for admin');
    it('returns true for member');
    it('returns false for readonly');
  });

  describe('canDelete', () => {
    it('returns true for owner');
    it('returns true for admin');
    it('returns false for member');
    it('returns false for readonly');
  });

  describe('canInviteRole', () => {
    it('owner can invite any role');
    it('admin cannot invite owner');
    it('member cannot invite anyone');
  });
});
```

### 4.3 Validation Tests

```typescript
// __tests__/lib/validations/contact.test.ts
describe('Contact Validation', () => {
  describe('createContactSchema', () => {
    it('accepts valid contact data');
    it('requires firstName');
    it('requires lastName');
    it('validates email format');
    it('accepts optional fields as null');
    it('rejects invalid companyId format');
  });
});
```

### 4.4 Utility Tests

```typescript
// __tests__/lib/utils.test.ts
describe('Utility Functions', () => {
  describe('cn', () => {
    it('merges class names');
    it('handles conditional classes');
    it('dedupes conflicting tailwind classes');
  });

  describe('formatCurrency', () => {
    it('formats numbers with commas');
    it('handles null/undefined');
    it('handles zero');
  });
});
```

---

## 5. Integration Test Requirements

### 5.1 API Route Tests

```typescript
// __tests__/api/auth/register.test.ts
describe('POST /api/v1/auth/register', () => {
  it('creates tenant and user successfully');
  it('creates default pipeline stages');
  it('returns 400 for invalid email');
  it('returns 400 for weak password');
  it('returns 409 for existing tenant slug');
  it('creates session cookie on success');
});

// __tests__/api/contacts/route.test.ts
describe('Contacts API', () => {
  describe('GET /api/v1/contacts', () => {
    it('returns contacts for tenant');
    it('does not return other tenant contacts');
    it('filters by company');
    it('paginates results');
    it('requires authentication');
  });

  describe('POST /api/v1/contacts', () => {
    it('creates contact for tenant');
    it('validates required fields');
    it('requires write permission');
    it('logs to audit trail');
  });
});
```

### 5.2 Multi-Tenant Isolation Tests

```typescript
// __tests__/integration/tenant-isolation.test.ts
describe('Tenant Isolation', () => {
  it('user cannot access other tenant contacts');
  it('user cannot access other tenant companies');
  it('user cannot access other tenant deals');
  it('API key is scoped to creating tenant');
  it('search only returns tenant data');
});
```

### 5.3 Test Database Setup

```typescript
// __tests__/setup.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

// Use test database
const testDb = postgres(process.env.TEST_DATABASE_URL!);
export const db = drizzle(testDb, { schema });

// Cleanup between tests
beforeEach(async () => {
  await db.delete(schema.auditLogs);
  await db.delete(schema.activities);
  await db.delete(schema.deals);
  await db.delete(schema.contacts);
  await db.delete(schema.companies);
  await db.delete(schema.tags);
  await db.delete(schema.pipelineStages);
  await db.delete(schema.apiKeys);
  await db.delete(schema.users);
  await db.delete(schema.tenants);
});

afterAll(async () => {
  await testDb.end();
});
```

---

## 6. Component Test Requirements

### 6.1 Form Components

```typescript
// __tests__/components/contacts/contact-form.test.tsx
describe('ContactForm', () => {
  it('renders all required fields');
  it('shows validation errors');
  it('submits valid data');
  it('disables submit while loading');
  it('handles API errors');
});
```

### 6.2 Data Display Components

```typescript
// __tests__/components/contacts/contacts-table.test.tsx
describe('ContactsTable', () => {
  it('renders contact rows');
  it('shows empty state');
  it('handles pagination');
  it('sorts by columns');
  it('filters by search');
});
```

### 6.3 Interactive Components

```typescript
// __tests__/components/pipeline/pipeline-board.test.tsx
describe('PipelineBoard', () => {
  it('renders all stages');
  it('renders deals in correct stages');
  it('handles drag and drop');
  it('updates deal position');
  it('shows loading state');
});
```

---

## 7. E2E Test Requirements

### 7.1 Critical User Flows

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('new user can register', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[name="organizationName"]', 'Test Org');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('user can login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'existing@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('user can logout', async ({ page }) => {
    // Login first
    await page.goto('/dashboard');
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');
    await expect(page).toHaveURL('/login');
  });
});
```

### 7.2 CRUD Flows

```typescript
// e2e/contacts.spec.ts
test.describe('Contact Management', () => {
  test('can create a contact', async ({ page }) => {
    await page.goto('/contacts/new');
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'john@example.com');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/contacts\/.+/);
  });

  test('can edit a contact', async ({ page }) => {
    await page.goto('/contacts/[id]');
    await page.click('[data-testid="edit-contact"]');
    await page.fill('[name="firstName"]', 'Jane');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toContainText('Jane');
  });

  test('can delete a contact', async ({ page }) => {
    await page.goto('/contacts/[id]');
    await page.click('[data-testid="delete-contact"]');
    await page.click('[data-testid="confirm-delete"]');
    await expect(page).toHaveURL('/contacts');
  });
});
```

---

## 8. Test Data Management

### 8.1 Test Fixtures

```typescript
// __tests__/fixtures/users.ts
export const testUsers = {
  owner: {
    id: 'owner-uuid',
    email: 'owner@test.com',
    role: 'owner',
    tenantId: 'tenant-uuid',
  },
  admin: {
    id: 'admin-uuid',
    email: 'admin@test.com',
    role: 'admin',
    tenantId: 'tenant-uuid',
  },
  member: {
    id: 'member-uuid',
    email: 'member@test.com',
    role: 'member',
    tenantId: 'tenant-uuid',
  },
  readonly: {
    id: 'readonly-uuid',
    email: 'readonly@test.com',
    role: 'readonly',
    tenantId: 'tenant-uuid',
  },
};

// __tests__/fixtures/contacts.ts
export const testContacts = {
  basic: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  },
  withCompany: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@company.com',
    companyId: 'company-uuid',
  },
};
```

### 8.2 Mock Helpers

```typescript
// __tests__/mocks/auth.ts
export function mockSession(user: Partial<User>) {
  return {
    userId: user.id || 'test-user-id',
    tenantId: user.tenantId || 'test-tenant-id',
    role: user.role || 'member',
    source: 'session' as const,
  };
}

export function mockRequest(options: {
  method?: string;
  body?: object;
  session?: AuthContext;
}) {
  // Return mock Request object
}
```

---

## 9. Coverage Targets

### 9.1 Phase 1 Targets (MVP)

| Area | Target Coverage |
|------|-----------------|
| lib/auth | 80% |
| lib/validations | 90% |
| API routes (auth) | 70% |
| API routes (CRUD) | 50% |
| **Overall** | **40%** |

### 9.2 Phase 2 Targets (Production)

| Area | Target Coverage |
|------|-----------------|
| lib/* | 80% |
| API routes | 70% |
| Components | 50% |
| Hooks | 70% |
| **Overall** | **60%** |

### 9.3 Long-term Targets

| Area | Target Coverage |
|------|-----------------|
| lib/* | 90% |
| API routes | 80% |
| Components | 70% |
| Hooks | 80% |
| E2E critical paths | 100% |
| **Overall** | **75%** |

---

## 10. Implementation Plan

### Week 1: Foundation
- [ ] Set up test database
- [ ] Create test fixtures and helpers
- [ ] Add authentication unit tests
- [ ] Add authorization unit tests

### Week 2: API Tests
- [ ] Add validation schema tests
- [ ] Add auth route integration tests
- [ ] Add contact route integration tests
- [ ] Add tenant isolation tests

### Week 3: Component Tests
- [ ] Add form component tests
- [ ] Add table component tests
- [ ] Add dialog component tests
- [ ] Add hook tests

### Week 4: E2E & CI
- [ ] Set up Playwright
- [ ] Add critical flow E2E tests
- [ ] Configure CI test reporting
- [ ] Add coverage requirements to CI

---

## 11. CI/CD Integration

### 11.1 Test Pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: gonthia_test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run test:coverage
        env:
          TEST_DATABASE_URL: postgres://postgres:test@localhost:5432/gonthia_test

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          fail_ci_if_error: true
          minimum: 40
```

### 11.2 Quality Gates

| Check | Threshold | Blocking |
|-------|-----------|----------|
| Tests passing | 100% | Yes |
| Coverage | 40% | Yes (phase 1) |
| Type check | 0 errors | Yes |
| Lint | 0 errors | Yes |

---

## 12. Recommendations Summary

### P0 - Critical
1. Add authentication unit tests
2. Add authorization unit tests
3. Add tenant isolation integration tests
4. Set up test database

### P1 - High Priority
1. Add API route integration tests
2. Add validation schema tests
3. Configure CI test pipeline
4. Add coverage requirements

### P2 - Medium Priority
1. Add component tests
2. Add E2E tests for critical flows
3. Create comprehensive fixtures
4. Add test documentation

### P3 - Lower Priority
1. Add visual regression tests
2. Add performance tests
3. Add accessibility tests
4. Achieve 75% coverage target
