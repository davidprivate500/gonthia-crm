# Remediation Roadmap - Gonthia CRM

## Executive Summary

This roadmap outlines a 6-week remediation plan to address critical security vulnerabilities, improve reliability, and establish production readiness. The plan is organized by priority and dependency, with clear milestones and success criteria.

---

## 1. Roadmap Overview

```
Week 1       Week 2       Week 3       Week 4       Week 5       Week 6
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
█████████████                                                    P0 Security
             █████████████████████████                           P1 Security
                          █████████████████████████              P1 Reliability
                                       █████████████████████████ P2 Features
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     M1           M2           M3           M4           M5
```

---

## 2. Phase 1: Critical Security (Week 1)

### Milestone M1: Security Foundation

**Goal:** Eliminate critical authentication and authorization vulnerabilities

### Sprint Backlog

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| SEC-001 | Remove SESSION_SECRET fallback | 2h | Backend |
| SEC-002 | Add rate limiting to auth endpoints | 4h | Backend |
| SEC-003 | Fix API key privilege escalation | 3h | Backend |
| SEC-004 | Add soft-deleted user check to API auth | 2h | Backend |
| SEC-005 | Add security headers | 2h | DevOps |
| SEC-006 | Add basic health check endpoint | 2h | Backend |

### Deliverables
- [ ] SESSION_SECRET throws on fallback
- [ ] Rate limiting on `/auth/*` endpoints (10 req/min)
- [ ] API keys inherit creator's role
- [ ] Deleted users cannot authenticate
- [ ] Security headers configured in next.config.ts
- [ ] `/api/health` endpoint returns status

### Success Criteria
- All auth-related tests pass
- Rate limiting verified manually
- Security headers visible in browser

### Dependencies
- Upstash Redis account (for rate limiting)

---

## 3. Phase 2: High Priority Security (Week 2)

### Milestone M2: Security Hardening

**Goal:** Address remaining security gaps and add foundational monitoring

### Sprint Backlog

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| SEC-007 | Implement CSRF protection | 4h | Backend |
| SEC-008 | Add text field length limits | 3h | Backend |
| SEC-009 | Sanitize error responses | 2h | Backend |
| SEC-010 | Integrate Sentry for error tracking | 3h | DevOps |
| SEC-011 | Add structured logging | 4h | Backend |
| SEC-012 | Create security tests | 6h | QA |

### Deliverables
- [ ] Origin header verification on state-changing requests
- [ ] Max 10KB for notes/description fields
- [ ] Production errors return generic message
- [ ] Sentry capturing all errors
- [ ] Pino logger with request IDs
- [ ] Auth/authz test coverage > 70%

### Success Criteria
- CSRF attempts blocked
- Large payload requests rejected
- Errors visible in Sentry
- Logs are structured JSON

### Dependencies
- Sentry account

---

## 4. Phase 3: Reliability (Weeks 3-4)

### Milestone M3: Data Integrity

**Goal:** Add transaction support and fix race conditions

### Week 3 Backlog

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| REL-001 | Add transaction helper to db module | 4h | Backend |
| REL-002 | Wrap registration in transaction | 3h | Backend |
| REL-003 | Add transaction to deal move | 4h | Backend |
| REL-004 | Add database indexes | 2h | Backend |
| REL-005 | Add API integration tests | 8h | QA |

### Week 4 Backlog

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| REL-006 | Implement React Query caching | 6h | Frontend |
| REL-007 | Add global error boundary | 3h | Frontend |
| REL-008 | Create basic runbooks | 4h | SRE |
| REL-009 | Set up monitoring dashboard | 4h | SRE |
| REL-010 | Add component tests | 8h | QA |

### Deliverables
- [ ] `db.transaction()` helper available
- [ ] Registration atomic (tenant + user + stages)
- [ ] Deal moves atomic with position reordering
- [ ] Key indexes created for common queries
- [ ] React Query wrapping API calls
- [ ] Error boundary catching React errors
- [ ] Runbook for common incidents
- [ ] Monitoring dashboard in Vercel/Sentry

### Success Criteria
- No orphan records possible in registration
- Deal position stays consistent under concurrent moves
- Client-side caching reduces API calls by 50%
- Error boundary prevents white screen crashes

---

## 5. Phase 4: Features & Polish (Weeks 5-6)

### Milestone M4: Feature Completion

**Goal:** Complete incomplete features and improve UX

### Week 5 Backlog

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| FEA-001 | Implement background job system | 8h | Backend |
| FEA-002 | Complete import feature | 6h | Backend |
| FEA-003 | Add session expiration | 3h | Backend |
| FEA-004 | Fix hydration flash | 2h | Frontend |
| FEA-005 | Add E2E tests for critical paths | 8h | QA |

### Week 6 Backlog

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| FEA-006 | Complete user invitation flow | 8h | Full Stack |
| FEA-007 | Add audit log for failed auth | 3h | Backend |
| FEA-008 | Optimize bundle size | 4h | Frontend |
| FEA-009 | Performance testing | 4h | QA |
| FEA-010 | Documentation updates | 4h | Tech Writer |

### Milestone M5: Production Ready

### Deliverables
- [ ] Import jobs process asynchronously
- [ ] CSV imports work end-to-end
- [ ] Sessions expire after inactivity
- [ ] No flash on protected pages
- [ ] E2E tests for auth, CRUD, pipeline
- [ ] User invitations with email
- [ ] Failed login attempts logged
- [ ] Bundle size < 250KB gzipped
- [ ] Performance baseline documented

### Success Criteria
- Import feature works for 10K row CSV
- Sessions expire after 24h inactivity
- E2E tests pass in CI
- Load test shows < 500ms P95 latency

---

## 6. Risk Mitigation

### Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Upstash rate limiting latency | Medium | Low | Fallback to in-memory |
| Transaction support complexity | Low | Medium | Test thoroughly |
| Background jobs infrastructure | Medium | Medium | Start with sync for small files |
| Test coverage targets | Medium | Low | Prioritize critical paths |

### Contingency Plans

1. **Rate limiting delayed:** Proceed with IP-based in-memory solution first
2. **Background jobs complex:** Ship synchronous import with file size limit
3. **Test targets not met:** Ship with P0 coverage, continue in maintenance

---

## 7. Resource Requirements

### Team Allocation

| Role | Weeks 1-2 | Weeks 3-4 | Weeks 5-6 |
|------|-----------|-----------|-----------|
| Backend Dev | 100% | 80% | 60% |
| Frontend Dev | 20% | 60% | 60% |
| DevOps/SRE | 30% | 30% | 20% |
| QA | 30% | 50% | 60% |

### External Services

| Service | Purpose | Cost |
|---------|---------|------|
| Upstash Redis | Rate limiting | ~$10/month |
| Sentry | Error tracking | ~$26/month |
| Vercel Pro | Extended limits | $20/month |

---

## 8. Success Metrics

### Security Metrics
- [ ] 0 critical vulnerabilities
- [ ] 0 high vulnerabilities
- [ ] Auth test coverage > 80%

### Reliability Metrics
- [ ] 99.5% availability
- [ ] < 500ms P95 latency
- [ ] < 1% error rate

### Quality Metrics
- [ ] Overall test coverage > 40%
- [ ] 0 P0 bugs in production
- [ ] < 5 P1 bugs open

---

## 9. Go/No-Go Criteria

### Required for Production

| Criteria | Status |
|----------|--------|
| SESSION_SECRET hardening | Required |
| Rate limiting on auth | Required |
| API key privilege fix | Required |
| Transaction support | Required |
| Error tracking | Required |
| Basic monitoring | Required |
| Auth test coverage > 70% | Required |
| E2E tests for auth flow | Required |

### Nice to Have

| Criteria | Status |
|----------|--------|
| Import feature complete | Recommended |
| User invitation flow | Recommended |
| Overall coverage > 50% | Recommended |
| Background jobs | Optional |

---

## 10. Weekly Checkpoints

### Week 1 Review
- Security vulnerabilities addressed?
- Rate limiting working?
- Health check deployed?

### Week 2 Review
- CSRF protection verified?
- Sentry receiving errors?
- Security tests passing?

### Week 3 Review
- Transactions working?
- Database indexes created?
- Integration tests passing?

### Week 4 Review
- React Query integrated?
- Error boundaries working?
- Runbooks created?

### Week 5 Review
- Background jobs functional?
- E2E tests passing?
- Performance baseline set?

### Week 6 Review
- All go/no-go criteria met?
- Documentation complete?
- Production deployment plan ready?

---

## 11. Post-Remediation

### Maintenance Mode
After remediation:
- Continue weekly security reviews
- Monitor error rates in Sentry
- Address P2/P3 bugs from backlog
- Improve test coverage incrementally

### Future Enhancements
- Object-level authorization
- API key scopes
- Advanced caching (Redis)
- Read replicas for reporting
