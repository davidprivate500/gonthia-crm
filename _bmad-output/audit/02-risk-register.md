# Risk Register - Gonthia CRM

## Risk Assessment Matrix

| Impact ↓ \ Likelihood → | Rare | Unlikely | Possible | Likely | Almost Certain |
|-------------------------|------|----------|----------|--------|----------------|
| **Critical** | Medium | High | Critical | Critical | Critical |
| **Major** | Low | Medium | High | Critical | Critical |
| **Moderate** | Low | Low | Medium | High | High |
| **Minor** | Low | Low | Low | Medium | Medium |
| **Insignificant** | Low | Low | Low | Low | Low |

---

## Critical Risks (Immediate Action Required)

### RISK-001: Authentication Bypass via Session Secret
- **Category:** Security
- **Likelihood:** Possible
- **Impact:** Critical
- **Risk Level:** CRITICAL
- **Related Bugs:** BUG-003
- **Description:** SESSION_SECRET has fallback value. If deployed without env var, all sessions can be forged.
- **Mitigation:** Fail startup in production if SECRET not set
- **Owner:** Security/Backend
- **Due Date:** Immediate

### RISK-002: Brute Force Attack Vulnerability
- **Category:** Security
- **Likelihood:** Almost Certain
- **Impact:** Major
- **Risk Level:** CRITICAL
- **Related Bugs:** BUG-002, BUG-005
- **Description:** No rate limiting on any endpoint. Login, registration, password reset all vulnerable.
- **Mitigation:** Implement rate limiting (Upstash/Vercel Edge)
- **Owner:** Backend
- **Due Date:** Week 1

### RISK-003: Data Integrity - Registration Race
- **Category:** Data Integrity
- **Likelihood:** Rare
- **Impact:** Critical
- **Risk Level:** MEDIUM-HIGH
- **Related Bugs:** BUG-001, BUG-014
- **Description:** Non-transactional tenant+user creation can orphan tenants
- **Mitigation:** Wrap in transaction or add cleanup job
- **Owner:** Backend
- **Due Date:** Week 2

---

## High Risks (Action Required)

### RISK-004: Privilege Escalation via API Keys
- **Category:** Authorization
- **Likelihood:** Possible
- **Impact:** Major
- **Risk Level:** HIGH
- **Related Bugs:** BUG-004
- **Description:** API keys always grant admin access regardless of creator's role
- **Mitigation:** Store and enforce creator's role level
- **Owner:** Backend
- **Due Date:** Week 2

### RISK-005: Deleted User Persistence
- **Category:** Authorization
- **Likelihood:** Unlikely
- **Impact:** Major
- **Risk Level:** MEDIUM-HIGH
- **Related Bugs:** BUG-006
- **Description:** Soft-deleted users can still authenticate via API keys
- **Mitigation:** Check user.deletedAt in API key verification
- **Owner:** Backend
- **Due Date:** Week 2

### RISK-006: CSRF Vulnerability
- **Category:** Security
- **Likelihood:** Possible
- **Impact:** Moderate
- **Risk Level:** HIGH
- **Related Bugs:** BUG-007
- **Description:** No CSRF token protection (sameSite=lax provides partial protection)
- **Mitigation:** Implement CSRF tokens or verify origin header
- **Owner:** Backend/Frontend
- **Due Date:** Week 3

### RISK-007: Information Disclosure
- **Category:** Security
- **Likelihood:** Likely
- **Impact:** Moderate
- **Risk Level:** HIGH
- **Related Bugs:** BUG-027
- **Description:** Internal error details may leak to clients
- **Mitigation:** Sanitize all error responses
- **Owner:** Backend
- **Due Date:** Week 2

---

## Medium Risks (Planned Remediation)

### RISK-008: Import Feature Non-Functional
- **Category:** Functionality
- **Likelihood:** Almost Certain
- **Impact:** Minor
- **Risk Level:** MEDIUM
- **Related Bugs:** BUG-011
- **Description:** Import jobs never process - feature is broken
- **Mitigation:** Implement background processing
- **Owner:** Backend
- **Due Date:** Week 4

### RISK-009: Pipeline Ordering Race
- **Category:** Data Integrity
- **Likelihood:** Possible
- **Impact:** Moderate
- **Risk Level:** MEDIUM
- **Related Bugs:** BUG-010
- **Description:** Concurrent deal moves can corrupt position ordering
- **Mitigation:** Implement transactional position updates
- **Owner:** Backend
- **Due Date:** Week 3

### RISK-010: Audit Trail Gaps
- **Category:** Compliance
- **Likelihood:** Possible
- **Impact:** Moderate
- **Risk Level:** MEDIUM
- **Related Bugs:** BUG-009, BUG-017
- **Description:** Failed auth not audited, audit failures silent
- **Mitigation:** Add security events, improve error logging
- **Owner:** Backend
- **Due Date:** Week 3

### RISK-011: DoS via Large Payloads
- **Category:** Availability
- **Likelihood:** Rare
- **Impact:** Major
- **Risk Level:** MEDIUM
- **Related Bugs:** BUG-013, BUG-028
- **Description:** No body size limits, potential memory exhaustion
- **Mitigation:** Configure body limits, validate text field lengths
- **Owner:** Backend/DevOps
- **Due Date:** Week 2

### RISK-012: Connection Pool Exhaustion
- **Category:** Availability
- **Likelihood:** Unlikely
- **Impact:** Critical
- **Risk Level:** MEDIUM
- **Related Bugs:** BUG-030
- **Description:** Database connections may not be properly pooled
- **Mitigation:** Review postgres-js settings, add monitoring
- **Owner:** Backend
- **Due Date:** Week 4

---

## Low Risks (Backlog)

### RISK-013: User Invitation Flow Incomplete
- **Category:** Functionality
- **Likelihood:** Almost Certain
- **Impact:** Minor
- **Risk Level:** LOW-MEDIUM
- **Related Bugs:** BUG-022
- **Description:** Invited users created without password or notification
- **Mitigation:** Implement invite token and email flow
- **Owner:** Backend
- **Due Date:** Week 5

### RISK-014: Missing Security Headers
- **Category:** Security
- **Likelihood:** Almost Certain
- **Impact:** Minor
- **Risk Level:** LOW-MEDIUM
- **Related Bugs:** BUG-029
- **Description:** No X-Frame-Options, CSP, etc.
- **Mitigation:** Configure Next.js headers
- **Owner:** DevOps
- **Due Date:** Week 3

### RISK-015: Hydration Issues
- **Category:** UX
- **Likelihood:** Likely
- **Impact:** Insignificant
- **Risk Level:** LOW
- **Related Bugs:** BUG-015
- **Description:** Brief flash on unauthenticated dashboard access
- **Mitigation:** Return loading state instead of null
- **Owner:** Frontend
- **Due Date:** Week 4

---

## Risk Trend Analysis

| Week | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| Current | 3 | 4 | 5 | 3 | 15 |
| After Week 1 | 1 | 4 | 5 | 3 | 13 |
| After Week 2 | 0 | 1 | 5 | 3 | 9 |
| After Week 3 | 0 | 0 | 3 | 3 | 6 |
| After Week 4 | 0 | 0 | 0 | 3 | 3 |

---

## Risk Acceptance Criteria

### Unacceptable (Must Fix)
- Any authentication bypass
- Multi-tenant data leakage
- Privilege escalation
- Critical data loss scenarios

### Requires Approval
- Risks rated HIGH or above
- Any security-related risk
- Risks affecting compliance (audit trail)

### Acceptable with Monitoring
- Performance risks with < 5% user impact
- UX issues with workarounds
- Feature gaps with documented limitations
