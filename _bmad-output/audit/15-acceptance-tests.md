# Acceptance Tests - Gonthia CRM

## Overview

This document defines acceptance tests for critical functionality. Each test specifies the scenario, steps, expected outcomes, and pass/fail criteria.

---

## 1. Authentication Tests

### AT-001: User Registration

**Scenario:** New user can register an account

**Preconditions:**
- No existing account with test email
- Valid database connection

**Steps:**
1. Navigate to /register
2. Enter organization name: "Test Organization"
3. Enter email: "test@example.com"
4. Enter password: "SecurePass123!"
5. Click "Create Account"

**Expected Results:**
- [ ] User redirected to /dashboard
- [ ] Session cookie created
- [ ] Tenant created in database
- [ ] User created with role "owner"
- [ ] Default pipeline stages created (5 stages)
- [ ] Audit log entry created

**Pass Criteria:** All expected results verified

---

### AT-002: User Login

**Scenario:** Existing user can log in

**Preconditions:**
- User account exists
- User is not logged in

**Steps:**
1. Navigate to /login
2. Enter email: "existing@example.com"
3. Enter password: "password"
4. Click "Sign In"

**Expected Results:**
- [ ] User redirected to /dashboard
- [ ] Session cookie created
- [ ] User data accessible via /api/v1/auth/me
- [ ] Audit log entry created for login

**Pass Criteria:** All expected results verified

---

### AT-003: User Logout

**Scenario:** Logged-in user can log out

**Preconditions:**
- User is logged in

**Steps:**
1. Click user menu
2. Click "Sign Out"

**Expected Results:**
- [ ] User redirected to /login
- [ ] Session cookie destroyed
- [ ] /api/v1/auth/me returns 401
- [ ] Audit log entry created for logout

**Pass Criteria:** All expected results verified

---

### AT-004: Rate Limiting on Login

**Scenario:** Brute force attacks are blocked

**Preconditions:**
- Rate limiting enabled
- Valid user account exists

**Steps:**
1. Attempt login with wrong password 10 times in 1 minute
2. Attempt login with correct password

**Expected Results:**
- [ ] 11th request returns 429 Too Many Requests
- [ ] Rate limit resets after 1 minute
- [ ] Successful login possible after cooldown

**Pass Criteria:** Rate limiting enforced

---

### AT-005: Session Secret Validation

**Scenario:** Application fails without proper SESSION_SECRET

**Preconditions:**
- Application deployed to clean environment

**Steps:**
1. Attempt to start application without SESSION_SECRET
2. Attempt to start application with SECRET < 32 chars

**Expected Results:**
- [ ] Application fails to start
- [ ] Clear error message displayed
- [ ] No session forgery possible

**Pass Criteria:** Startup fails without valid secret

---

## 2. Authorization Tests

### AT-010: Role-Based Access - Create

**Scenario:** Only authorized roles can create records

**Test Matrix:**

| Role | Can Create Contact | Can Create Deal | Can Create User |
|------|-------------------|-----------------|-----------------|
| owner | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ |
| member | ✓ | ✓ | ✗ |
| readonly | ✗ | ✗ | ✗ |

**Steps:**
1. Log in as each role
2. Attempt to create contact
3. Verify success/failure

**Pass Criteria:** All role restrictions enforced

---

### AT-011: Role-Based Access - Delete

**Scenario:** Only authorized roles can delete records

**Test Matrix:**

| Role | Can Delete Contact | Can Delete User |
|------|-------------------|-----------------|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✗ | ✗ |
| readonly | ✗ | ✗ |

**Pass Criteria:** All role restrictions enforced

---

### AT-012: Tenant Isolation

**Scenario:** Users cannot access other tenant's data

**Preconditions:**
- Two tenants with data exist

**Steps:**
1. Log in as Tenant A user
2. Attempt to access Tenant B contact via direct URL
3. Attempt to access Tenant B contact via API with ID

**Expected Results:**
- [ ] UI shows "Not Found" or redirects
- [ ] API returns 404 (not 403 - no information leak)
- [ ] No Tenant B data visible in lists

**Pass Criteria:** Complete tenant isolation verified

---

### AT-013: API Key Permissions

**Scenario:** API keys have correct permission level

**Preconditions:**
- API key created by member user

**Steps:**
1. Use API key to call DELETE /api/v1/contacts/:id
2. Use API key to call POST /api/v1/organization/users

**Expected Results:**
- [ ] Delete returns 403 (member cannot delete)
- [ ] Invite returns 403 (member cannot invite)
- [ ] API key has member permissions, not admin

**Pass Criteria:** API key inherits creator's role

---

### AT-014: Deleted User Access

**Scenario:** Deleted users cannot authenticate

**Preconditions:**
- User with API key exists

**Steps:**
1. Soft-delete the user
2. Attempt to use user's API key
3. Attempt to use user's session (if still valid)

**Expected Results:**
- [ ] API key returns 401
- [ ] Session returns 401
- [ ] No data accessible

**Pass Criteria:** Deleted users fully blocked

---

## 3. CRUD Tests

### AT-020: Contact CRUD

**Scenario:** Full contact lifecycle

**Steps:**
1. CREATE: POST /api/v1/contacts with valid data
2. READ: GET /api/v1/contacts/:id
3. UPDATE: PATCH /api/v1/contacts/:id with changes
4. DELETE: DELETE /api/v1/contacts/:id
5. VERIFY: GET /api/v1/contacts/:id returns 404

**Expected Results:**
- [ ] Create returns 201 with contact data
- [ ] Read returns contact with all fields
- [ ] Update returns updated contact
- [ ] Delete returns 200
- [ ] Deleted contact not accessible
- [ ] Audit log entries for all operations

**Pass Criteria:** Full CRUD lifecycle works

---

### AT-021: Company CRUD

**Same structure as AT-020 for companies**

---

### AT-022: Deal CRUD

**Same structure as AT-020 for deals**

---

### AT-023: Activity CRUD

**Same structure as AT-020 for activities**

---

## 4. Pipeline Tests

### AT-030: Pipeline Board Load

**Scenario:** Pipeline board displays correctly

**Preconditions:**
- Pipeline stages exist
- Deals exist in various stages

**Steps:**
1. Navigate to /pipeline
2. Observe board rendering

**Expected Results:**
- [ ] All stages visible
- [ ] Deals in correct stages
- [ ] Deal values displayed
- [ ] Stage totals correct
- [ ] Loading state shown initially

**Pass Criteria:** Board displays accurately

---

### AT-031: Deal Movement

**Scenario:** Deal can be moved between stages

**Preconditions:**
- Deal exists in Stage A

**Steps:**
1. Drag deal from Stage A to Stage B
2. Release deal

**Expected Results:**
- [ ] Deal appears in Stage B
- [ ] Deal removed from Stage A
- [ ] Stage totals updated
- [ ] Position updated in database
- [ ] Audit log entry created

**Pass Criteria:** Deal movement persists

---

### AT-032: Concurrent Deal Movement

**Scenario:** Concurrent moves don't corrupt data

**Preconditions:**
- Multiple deals in same stage

**Steps:**
1. Open pipeline in two browser tabs
2. Move Deal A in Tab 1
3. Move Deal B in Tab 2 simultaneously

**Expected Results:**
- [ ] Both moves complete
- [ ] No position conflicts
- [ ] Both tabs show correct state after refresh

**Pass Criteria:** No data corruption

---

## 5. Data Integrity Tests

### AT-040: Registration Atomicity

**Scenario:** Registration is atomic

**Preconditions:**
- Database accessible
- Simulated failure possible

**Steps:**
1. Trigger registration with database failure after tenant creation
2. Check database state

**Expected Results:**
- [ ] No orphan tenant exists
- [ ] No orphan user exists
- [ ] No orphan pipeline stages
- [ ] Error message returned to user

**Pass Criteria:** Complete rollback on failure

---

### AT-041: Soft Delete Behavior

**Scenario:** Soft-deleted records handled correctly

**Steps:**
1. Delete a contact
2. Check that contact not in list
3. Check that contact not accessible by ID
4. Verify contact still in database with deletedAt

**Expected Results:**
- [ ] Contact not visible in UI
- [ ] API returns 404 for contact
- [ ] Database row has deletedAt timestamp
- [ ] Related activities remain accessible

**Pass Criteria:** Soft delete works correctly

---

## 6. Security Tests

### AT-050: CSRF Protection

**Scenario:** CSRF attacks are blocked

**Steps:**
1. Create malicious form on different origin
2. Submit form to Gonthia API endpoint

**Expected Results:**
- [ ] Request rejected
- [ ] 403 or similar error returned
- [ ] State not changed

**Pass Criteria:** CSRF attack blocked

---

### AT-051: Input Length Limits

**Scenario:** Large inputs are rejected

**Steps:**
1. Attempt to create contact with 1MB notes field
2. Attempt to create activity with 100KB description

**Expected Results:**
- [ ] Request returns 400 validation error
- [ ] Clear error message about length
- [ ] No server crash or memory issues

**Pass Criteria:** Large inputs rejected

---

### AT-052: Security Headers

**Scenario:** Security headers present

**Steps:**
1. Make request to any page
2. Inspect response headers

**Expected Results:**
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Referrer-Policy: strict-origin-when-cross-origin

**Pass Criteria:** All headers present

---

### AT-053: Error Information Disclosure

**Scenario:** Internal errors don't leak information

**Steps:**
1. Trigger server error in production mode
2. Observe response

**Expected Results:**
- [ ] Generic error message returned
- [ ] No stack trace visible
- [ ] No internal paths visible
- [ ] Error logged server-side

**Pass Criteria:** No information disclosure

---

## 7. UI Tests

### AT-060: Responsive Design

**Scenario:** UI works on mobile devices

**Steps:**
1. Open application on mobile viewport (375px)
2. Navigate through main features

**Expected Results:**
- [ ] Login page usable
- [ ] Dashboard visible
- [ ] Navigation accessible
- [ ] Forms completable
- [ ] Tables scrollable

**Pass Criteria:** Mobile usability verified

---

### AT-061: Loading States

**Scenario:** Loading states displayed appropriately

**Steps:**
1. Navigate to contacts page with slow network
2. Observe loading behavior

**Expected Results:**
- [ ] Loading indicator visible
- [ ] No content flash
- [ ] Smooth transition to content

**Pass Criteria:** Loading states present

---

### AT-062: Error States

**Scenario:** Errors displayed appropriately

**Steps:**
1. Disconnect network
2. Attempt to load contacts
3. Reconnect and retry

**Expected Results:**
- [ ] Error message displayed
- [ ] Retry option available
- [ ] Recovery works after reconnect

**Pass Criteria:** Error handling graceful

---

## 8. Performance Tests

### AT-070: API Response Time

**Scenario:** API responds within acceptable time

**Test Cases:**

| Endpoint | Max P95 | Max P99 |
|----------|---------|---------|
| GET /api/v1/contacts | 200ms | 500ms |
| POST /api/v1/contacts | 300ms | 800ms |
| GET /api/v1/pipeline/board | 500ms | 1000ms |

**Pass Criteria:** All endpoints within limits

---

### AT-071: Large Dataset Handling

**Scenario:** Application handles large datasets

**Preconditions:**
- 10,000 contacts in database

**Steps:**
1. Load contacts list
2. Search contacts
3. Paginate through results

**Expected Results:**
- [ ] List loads within 2 seconds
- [ ] Search returns within 1 second
- [ ] Pagination works correctly

**Pass Criteria:** Large datasets handled

---

## Test Execution Checklist

### Pre-Release Testing
- [ ] All AT-00x (Authentication) tests pass
- [ ] All AT-01x (Authorization) tests pass
- [ ] All AT-02x (CRUD) tests pass
- [ ] All AT-03x (Pipeline) tests pass
- [ ] All AT-04x (Data Integrity) tests pass
- [ ] All AT-05x (Security) tests pass
- [ ] Sample AT-06x (UI) tests pass
- [ ] Sample AT-07x (Performance) tests pass

### Sign-off
- [ ] QA Lead approval
- [ ] Security review approval
- [ ] Product owner approval

---

## Test Automation Status

| Test ID | Automated | Framework |
|---------|-----------|-----------|
| AT-001 | ✗ Planned | Playwright |
| AT-002 | ✗ Planned | Playwright |
| AT-003 | ✗ Planned | Playwright |
| AT-010 | ✗ Planned | Vitest |
| AT-012 | ✗ Planned | Vitest |
| AT-020 | ✗ Planned | Vitest |
| AT-030 | ✗ Planned | Playwright |
| AT-050 | ✗ Planned | Vitest |

**Automation Target:** 80% of acceptance tests automated by Week 6
