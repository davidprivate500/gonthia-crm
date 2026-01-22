# Epics and Stories - Gonthia CRM Remediation

## Epic Overview

| Epic | Priority | Stories | Effort |
|------|----------|---------|--------|
| EPIC-1: Security Hardening | P0 | 6 | 20h |
| EPIC-2: Authentication Improvements | P1 | 5 | 18h |
| EPIC-3: Data Integrity | P1 | 4 | 16h |
| EPIC-4: Observability | P1 | 5 | 16h |
| EPIC-5: Test Coverage | P1 | 5 | 24h |
| EPIC-6: Feature Completion | P2 | 4 | 20h |
| EPIC-7: Performance Optimization | P2 | 4 | 14h |

---

## EPIC-1: Security Hardening

**Goal:** Eliminate critical security vulnerabilities
**Priority:** P0 - Must complete before production
**Owner:** Backend Team

### Story 1.1: Remove SESSION_SECRET Fallback

**As a** security engineer
**I want** the application to fail on startup without proper SESSION_SECRET
**So that** sessions cannot be forged in production

**Acceptance Criteria:**
- [ ] Application throws error if SESSION_SECRET is not set
- [ ] Application throws error if SESSION_SECRET < 32 characters
- [ ] Error message is clear and actionable
- [ ] Local development instructions updated

**Effort:** 2h

---

### Story 1.2: Implement Rate Limiting

**As a** security engineer
**I want** rate limiting on authentication endpoints
**So that** brute force attacks are prevented

**Acceptance Criteria:**
- [ ] Rate limit: 10 requests per minute per IP on auth endpoints
- [ ] Rate limit: 5 requests per minute on password reset
- [ ] Returns 429 Too Many Requests when exceeded
- [ ] Configurable via environment variables
- [ ] Works with Vercel Edge

**Technical Notes:**
- Use Upstash Redis for distributed rate limiting
- Consider in-memory fallback for development

**Effort:** 4h

---

### Story 1.3: Fix API Key Privilege Escalation

**As a** tenant admin
**I want** API keys to have the same permissions as their creator
**So that** members cannot escalate privileges

**Acceptance Criteria:**
- [ ] API keys inherit creator's role level
- [ ] API keys are invalidated if creator is deleted
- [ ] Existing API keys are migrated (add role column)
- [ ] Tests verify permission inheritance

**Effort:** 4h

---

### Story 1.4: Add Security Headers

**As a** security engineer
**I want** proper security headers on all responses
**So that** common attacks are mitigated

**Acceptance Criteria:**
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy configured
- [ ] CSP configured (report-only initially)

**Effort:** 2h

---

### Story 1.5: Add Input Length Limits

**As a** security engineer
**I want** maximum length limits on all text fields
**So that** DoS via large payloads is prevented

**Acceptance Criteria:**
- [ ] notes fields: max 10,000 characters
- [ ] description fields: max 5,000 characters
- [ ] name fields: max 255 characters
- [ ] Returns 400 with clear error message
- [ ] Zod schemas updated for all entities

**Effort:** 3h

---

### Story 1.6: Implement CSRF Protection

**As a** security engineer
**I want** CSRF protection on state-changing requests
**So that** cross-site request forgery is prevented

**Acceptance Criteria:**
- [ ] Origin header verified on POST/PATCH/DELETE
- [ ] Requests without origin from same host rejected
- [ ] API key requests exempt (they use headers)
- [ ] Clear error message for CSRF failures

**Effort:** 4h

---

## EPIC-2: Authentication Improvements

**Goal:** Strengthen authentication mechanisms
**Priority:** P1
**Owner:** Backend Team

### Story 2.1: Add Session Expiration

**As a** user
**I want** my session to expire after inactivity
**So that** my account is protected on shared devices

**Acceptance Criteria:**
- [ ] Sessions expire after 24 hours of inactivity
- [ ] Session extended on activity (sliding window)
- [ ] Clear message when session expires
- [ ] Redirect to login with return URL

**Effort:** 3h

---

### Story 2.2: Check Deleted User on API Auth

**As a** security engineer
**I want** deleted users to be unable to authenticate
**So that** revoked access stays revoked

**Acceptance Criteria:**
- [ ] API key auth checks if creator is deleted
- [ ] Session auth checks if user is deleted
- [ ] Returns 401 for deleted users
- [ ] Audit log captures blocked access attempts

**Effort:** 3h

---

### Story 2.3: Add Password Complexity Requirements

**As a** security engineer
**I want** password complexity requirements
**So that** weak passwords are prevented

**Acceptance Criteria:**
- [ ] Minimum 8 characters
- [ ] At least one uppercase letter
- [ ] At least one lowercase letter
- [ ] At least one number
- [ ] Clear error messages for each requirement
- [ ] Frontend shows requirements during entry

**Effort:** 3h

---

### Story 2.4: Log Failed Authentication Attempts

**As a** security analyst
**I want** failed login attempts logged
**So that** I can detect attack patterns

**Acceptance Criteria:**
- [ ] Failed login attempts logged to audit_logs
- [ ] Includes: email, IP, user agent, timestamp
- [ ] Does not include attempted password
- [ ] Visible in admin audit log view

**Effort:** 4h

---

### Story 2.5: Add Session Rotation

**As a** security engineer
**I want** sessions rotated on privilege change
**So that** session fixation attacks are prevented

**Acceptance Criteria:**
- [ ] New session issued after login
- [ ] Session rotated after password change
- [ ] Session rotated after role change
- [ ] Old session invalidated

**Effort:** 5h

---

## EPIC-3: Data Integrity

**Goal:** Ensure data consistency in multi-step operations
**Priority:** P1
**Owner:** Backend Team

### Story 3.1: Add Transaction Support

**As a** developer
**I want** a transaction helper function
**So that** I can wrap multi-step operations

**Acceptance Criteria:**
- [ ] `db.transaction()` helper available
- [ ] Works with postgres-js driver
- [ ] Proper rollback on error
- [ ] Type-safe transaction context

**Effort:** 4h

---

### Story 3.2: Wrap Registration in Transaction

**As a** new user
**I want** registration to be atomic
**So that** I don't get orphan records on failure

**Acceptance Criteria:**
- [ ] Tenant, user, and stages created atomically
- [ ] All rolled back if any step fails
- [ ] Session only created after commit
- [ ] Error returns helpful message

**Effort:** 3h

---

### Story 3.3: Wrap Deal Movement in Transaction

**As a** sales rep
**I want** deal movements to be atomic
**So that** positions don't get corrupted

**Acceptance Criteria:**
- [ ] Deal position update and reordering atomic
- [ ] Concurrent moves handled correctly
- [ ] Optimistic locking or serializable isolation
- [ ] Clear error on conflict

**Effort:** 5h

---

### Story 3.4: Add Database Indexes

**As a** developer
**I want** proper database indexes
**So that** queries are performant

**Acceptance Criteria:**
- [ ] Index on contacts(tenant_id, deleted_at)
- [ ] Index on deals(tenant_id, stage_id, position)
- [ ] Index on activities(tenant_id, due_date)
- [ ] Index on audit_logs(tenant_id, created_at)
- [ ] Migration created and tested

**Effort:** 4h

---

## EPIC-4: Observability

**Goal:** Add monitoring, logging, and alerting
**Priority:** P1
**Owner:** DevOps/SRE

### Story 4.1: Add Health Check Endpoint

**As an** operator
**I want** a health check endpoint
**So that** I can monitor application health

**Acceptance Criteria:**
- [ ] GET /api/health returns status
- [ ] Checks database connectivity
- [ ] Returns 200 when healthy, 503 when not
- [ ] Includes response time metrics

**Effort:** 2h

---

### Story 4.2: Integrate Sentry

**As an** operator
**I want** errors tracked in Sentry
**So that** I can investigate issues

**Acceptance Criteria:**
- [ ] Client-side errors captured
- [ ] Server-side errors captured
- [ ] Release tracking configured
- [ ] Source maps uploaded
- [ ] User context attached

**Effort:** 4h

---

### Story 4.3: Add Structured Logging

**As a** developer
**I want** structured JSON logs
**So that** logs are searchable and parseable

**Acceptance Criteria:**
- [ ] All logs in JSON format
- [ ] Request ID included in all logs
- [ ] Log level configurable
- [ ] Sensitive data excluded

**Effort:** 4h

---

### Story 4.4: Create Monitoring Dashboard

**As an** operator
**I want** a monitoring dashboard
**So that** I can see system health at a glance

**Acceptance Criteria:**
- [ ] Request rate visible
- [ ] Error rate visible
- [ ] Latency percentiles visible
- [ ] Database health visible
- [ ] Alerting configured for critical metrics

**Effort:** 4h

---

### Story 4.5: Create Runbooks

**As an** on-call engineer
**I want** runbooks for common incidents
**So that** I can resolve issues quickly

**Acceptance Criteria:**
- [ ] Runbook: Site Down
- [ ] Runbook: Database Connection Issues
- [ ] Runbook: High Error Rate
- [ ] Runbook: Authentication Failures
- [ ] Stored in accessible location

**Effort:** 4h

---

## EPIC-5: Test Coverage

**Goal:** Achieve adequate test coverage
**Priority:** P1
**Owner:** QA/All Teams

### Story 5.1: Set Up Test Database

**As a** developer
**I want** a test database setup
**So that** I can run integration tests

**Acceptance Criteria:**
- [ ] Test database configured
- [ ] Migrations run automatically
- [ ] Database cleaned between tests
- [ ] CI pipeline configured

**Effort:** 4h

---

### Story 5.2: Add Authentication Tests

**As a** developer
**I want** authentication tests
**So that** auth logic is verified

**Acceptance Criteria:**
- [ ] Session management tests
- [ ] API key verification tests
- [ ] Login flow tests
- [ ] Registration flow tests
- [ ] Coverage > 80%

**Effort:** 6h

---

### Story 5.3: Add Authorization Tests

**As a** developer
**I want** authorization tests
**So that** permissions are verified

**Acceptance Criteria:**
- [ ] Role permission tests
- [ ] Tenant isolation tests
- [ ] Object access tests
- [ ] Coverage > 80%

**Effort:** 4h

---

### Story 5.4: Add API Integration Tests

**As a** developer
**I want** API integration tests
**So that** endpoints work correctly

**Acceptance Criteria:**
- [ ] CRUD tests for all entities
- [ ] Error handling tests
- [ ] Validation tests
- [ ] Coverage > 60%

**Effort:** 6h

---

### Story 5.5: Add E2E Tests

**As a** QA engineer
**I want** E2E tests for critical paths
**So that** user flows are verified

**Acceptance Criteria:**
- [ ] Auth flow tests (register, login, logout)
- [ ] Contact management tests
- [ ] Deal pipeline tests
- [ ] Tests run in CI

**Effort:** 6h

---

## EPIC-6: Feature Completion

**Goal:** Complete incomplete features
**Priority:** P2
**Owner:** Full Stack Team

### Story 6.1: Implement Background Jobs

**As a** developer
**I want** a background job system
**So that** long-running tasks don't block requests

**Acceptance Criteria:**
- [ ] Job queue infrastructure set up
- [ ] Jobs can be scheduled
- [ ] Jobs can be retried on failure
- [ ] Job status visible

**Effort:** 8h

---

### Story 6.2: Complete Import Feature

**As a** user
**I want** to import contacts from CSV
**So that** I can migrate data easily

**Acceptance Criteria:**
- [ ] CSV upload works
- [ ] Preview before import
- [ ] Progress indicator
- [ ] Error handling for invalid rows
- [ ] Up to 10,000 rows supported

**Effort:** 6h

---

### Story 6.3: Complete User Invitation Flow

**As a** tenant admin
**I want** to invite users via email
**So that** they can join my organization

**Acceptance Criteria:**
- [ ] Invite generates unique token
- [ ] Email sent with invite link
- [ ] User can set password
- [ ] Invite expires after 7 days
- [ ] Resend invite option

**Effort:** 6h

---

### Story 6.4: Fix Hydration Issues

**As a** user
**I want** no content flash on page load
**So that** the experience is smooth

**Acceptance Criteria:**
- [ ] Loading state shown during hydration
- [ ] No content shift
- [ ] Works on all protected pages

**Effort:** 2h

---

## EPIC-7: Performance Optimization

**Goal:** Improve application performance
**Priority:** P2
**Owner:** Full Stack Team

### Story 7.1: Implement React Query Caching

**As a** user
**I want** fast page loads
**So that** the app feels responsive

**Acceptance Criteria:**
- [ ] React Query wrapping all API calls
- [ ] Appropriate stale times configured
- [ ] Optimistic updates for mutations
- [ ] Cache invalidation on changes

**Effort:** 6h

---

### Story 7.2: Add Global Error Boundary

**As a** user
**I want** graceful error handling
**So that** the app doesn't crash completely

**Acceptance Criteria:**
- [ ] Error boundary wraps main content
- [ ] Friendly error message displayed
- [ ] Option to retry/refresh
- [ ] Error reported to Sentry

**Effort:** 2h

---

### Story 7.3: Optimize Bundle Size

**As a** user
**I want** fast initial page loads
**So that** I can start working quickly

**Acceptance Criteria:**
- [ ] Main bundle < 200KB gzipped
- [ ] Recharts lazy loaded
- [ ] Code splitting by route
- [ ] Unused dependencies removed

**Effort:** 4h

---

### Story 7.4: Sanitize Error Responses

**As a** security engineer
**I want** error details hidden in production
**So that** internal information isn't leaked

**Acceptance Criteria:**
- [ ] Production errors return generic message
- [ ] Development errors include details
- [ ] All errors logged server-side
- [ ] Consistent error response format

**Effort:** 2h

---

## Story Point Summary

| Epic | Stories | Total Points |
|------|---------|--------------|
| EPIC-1 | 6 | 19h |
| EPIC-2 | 5 | 18h |
| EPIC-3 | 4 | 16h |
| EPIC-4 | 5 | 18h |
| EPIC-5 | 5 | 26h |
| EPIC-6 | 4 | 22h |
| EPIC-7 | 4 | 14h |
| **Total** | **33** | **133h** |

---

## Sprint Planning Suggestion

### Sprint 1 (Week 1-2)
- EPIC-1: All stories (19h)
- Story 4.1: Health Check (2h)

### Sprint 2 (Week 2-3)
- EPIC-2: Stories 2.1, 2.2 (6h)
- EPIC-3: Stories 3.1, 3.2 (7h)
- EPIC-4: Stories 4.2, 4.3 (8h)

### Sprint 3 (Week 3-4)
- EPIC-3: Stories 3.3, 3.4 (9h)
- EPIC-5: Stories 5.1, 5.2 (10h)
- EPIC-4: Story 4.4 (4h)

### Sprint 4 (Week 5-6)
- EPIC-5: Stories 5.3, 5.4, 5.5 (16h)
- EPIC-7: All stories (14h)

### Sprint 5 (Week 6+)
- EPIC-6: All stories (22h)
- EPIC-2: Stories 2.3, 2.4, 2.5 (12h)
- EPIC-4: Story 4.5 (4h)
