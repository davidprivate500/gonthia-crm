# Observability & SRE Review - Gonthia CRM

## Executive Summary

Gonthia CRM has minimal observability infrastructure. The application relies entirely on Vercel's built-in monitoring and Supabase dashboards. For production readiness, significant investment in logging, metrics, and alerting is required.

**Observability Grade: D**
**SRE Readiness Grade: D+**

---

## 1. Current Observability State

### 1.1 Logging

| Aspect | Status | Implementation |
|--------|--------|----------------|
| Application Logs | ⚠ Basic | `console.log/error` |
| Structured Logging | ✗ None | - |
| Log Aggregation | ✗ None | - |
| Log Retention | ⚠ Vercel only | 1 hour (Hobby) |
| Request Tracing | ✗ None | - |
| Correlation IDs | ✗ None | - |

**Current Logging Pattern:**
```typescript
// Unstructured, inconsistent
console.error('Error:', error);
console.log('User registered:', user.id);
```

### 1.2 Metrics

| Metric Type | Status | Source |
|-------------|--------|--------|
| Request latency | ⚠ Basic | Vercel Analytics |
| Error rates | ⚠ Basic | Vercel Functions |
| Database metrics | ⚠ Basic | Supabase Dashboard |
| Custom business metrics | ✗ None | - |
| SLI/SLO tracking | ✗ None | - |

### 1.3 Tracing

| Capability | Status |
|------------|--------|
| Distributed tracing | ✗ Not implemented |
| Request correlation | ✗ Not implemented |
| Database query tracing | ✗ Not implemented |
| External call tracing | ✗ Not implemented |

### 1.4 Alerting

| Alert Type | Status |
|------------|--------|
| Error spike alerts | ✗ None |
| Latency alerts | ✗ None |
| Database alerts | ⚠ Supabase basic |
| Business alerts | ✗ None |
| On-call rotation | ✗ None |

---

## 2. Recommended Observability Stack

### 2.1 Option A: Vercel + Third Party (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                      │
├─────────────────────────────────────────────────────────────┤
│  Logging:     Vercel Logs + Axiom/Logtail                  │
│  Metrics:     Vercel Analytics + Custom metrics            │
│  Tracing:     Sentry Performance                           │
│  Errors:      Sentry                                       │
│  Alerting:    Sentry + PagerDuty/Opsgenie                 │
│  Uptime:      Better Uptime / Checkly                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Implementation: Sentry

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
  ],
});
```

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});
```

### 2.3 Implementation: Structured Logging

```typescript
// lib/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'gonthia-crm',
  },
});

export function createRequestLogger(request: Request) {
  const requestId = crypto.randomUUID();
  return logger.child({
    requestId,
    path: new URL(request.url).pathname,
    method: request.method,
  });
}

export { logger };
```

**Usage:**
```typescript
export async function POST(request: Request) {
  const log = createRequestLogger(request);
  log.info({ action: 'contact.create' }, 'Creating contact');

  try {
    // ... operation
    log.info({ contactId: contact.id }, 'Contact created');
  } catch (error) {
    log.error({ error }, 'Failed to create contact');
    throw error;
  }
}
```

---

## 3. SLI/SLO Definitions

### 3.1 Proposed Service Level Indicators

| SLI | Definition | Measurement |
|-----|------------|-------------|
| Availability | % of successful requests (non-5xx) | HTTP status codes |
| Latency | % of requests < 500ms | Request duration |
| Error Rate | % of requests with errors | 4xx + 5xx responses |
| Login Success | % of login attempts succeeding | Auth endpoint metrics |

### 3.2 Proposed Service Level Objectives

| SLO | Target | Error Budget |
|-----|--------|--------------|
| Availability | 99.5% | 3.6 hours/month |
| P50 Latency | < 200ms | - |
| P99 Latency | < 1000ms | - |
| Error Rate | < 1% | - |
| Login Success | > 99% | - |

### 3.3 Error Budget Policy

```
If error budget exhausted:
1. Freeze non-critical deployments
2. Focus on reliability improvements
3. Post-mortem required for major incidents
```

---

## 4. Incident Response

### 4.1 Current State: No Process

| Aspect | Status |
|--------|--------|
| Incident classification | ✗ None |
| Escalation procedures | ✗ None |
| On-call rotation | ✗ None |
| Runbooks | ✗ None |
| Post-mortems | ✗ None |

### 4.2 Recommended Incident Severity Levels

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| SEV1 | Complete outage | 15 min | Site down, data breach |
| SEV2 | Major feature broken | 1 hour | Login broken, API errors |
| SEV3 | Degraded performance | 4 hours | Slow responses, minor bugs |
| SEV4 | Minor issues | Next business day | UI glitches, typos |

### 4.3 Basic Runbooks Needed

1. **Site Down**
   - Check Vercel status
   - Check Supabase status
   - Review recent deployments
   - Rollback if needed

2. **Database Connection Issues**
   - Check Supabase pooler status
   - Review connection count
   - Check for long-running queries

3. **Authentication Failures**
   - Check session configuration
   - Verify environment variables
   - Review recent auth code changes

4. **High Error Rate**
   - Check Sentry for error details
   - Identify affected endpoints
   - Review recent deployments

---

## 5. Health Checks

### 5.1 Current State

**No health check endpoints implemented**

### 5.2 Recommended Implementation

```typescript
// app/api/health/route.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      memory: 'unknown',
    },
  };

  try {
    // Database check
    await db.execute(sql`SELECT 1`);
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'unhealthy';
  }

  // Memory check (basic)
  const used = process.memoryUsage();
  checks.checks.memory = used.heapUsed < 500_000_000 ? 'healthy' : 'warning';

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return Response.json(checks, { status: statusCode });
}
```

```typescript
// app/api/health/ready/route.ts - Readiness probe
export async function GET() {
  // Check if app is ready to serve traffic
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ ready: true });
  } catch {
    return Response.json({ ready: false }, { status: 503 });
  }
}
```

---

## 6. Monitoring Dashboards

### 6.1 Recommended Dashboard Panels

**Overview Dashboard:**
- Request rate (rpm)
- Error rate (%)
- P50/P95/P99 latency
- Active users
- Database connections

**API Health Dashboard:**
- Requests by endpoint
- Errors by endpoint
- Latency by endpoint
- Status code distribution

**Business Metrics Dashboard:**
- New registrations
- Active tenants
- Contacts created
- Deals created/won

### 6.2 Alerting Rules

```yaml
# Example Prometheus-style alerts
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    duration: 5m
    severity: warning

  - name: CriticalErrorRate
    condition: error_rate > 20%
    duration: 2m
    severity: critical

  - name: HighLatency
    condition: p99_latency > 2s
    duration: 5m
    severity: warning

  - name: DatabaseDown
    condition: db_health_check == 0
    duration: 1m
    severity: critical
```

---

## 7. Deployment Observability

### 7.1 Deployment Tracking

| Aspect | Status | Recommendation |
|--------|--------|----------------|
| Deployment markers | ✗ None | Tag releases in Sentry |
| Canary deployments | ✗ None | Consider for critical changes |
| Rollback automation | ⚠ Manual | Document procedure |
| Feature flags | ✗ None | Consider for gradual rollout |

### 7.2 Release Annotation

```typescript
// In deployment script
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});
```

---

## 8. Capacity Planning

### 8.1 Current Limits

| Resource | Limit | Monitoring |
|----------|-------|------------|
| Vercel Function Duration | 10s (Hobby) / 60s (Pro) | Vercel Dashboard |
| Vercel Bandwidth | 100GB/month (Hobby) | Vercel Dashboard |
| Supabase Connections | ~20 (pooled) | Supabase Dashboard |
| Supabase Storage | 500MB (Free) | Supabase Dashboard |
| Supabase Bandwidth | 2GB/month (Free) | Supabase Dashboard |

### 8.2 Growth Projections

| Metric | Current | 6 Month | 12 Month |
|--------|---------|---------|----------|
| Tenants | ~10 | ~100 | ~500 |
| Users | ~50 | ~500 | ~2500 |
| Contacts | ~500 | ~50K | ~250K |
| API Requests/day | ~1K | ~50K | ~250K |
| Database Size | ~10MB | ~500MB | ~2GB |

### 8.3 Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| DB Connections | >80% | Upgrade Supabase plan |
| Function Duration | >8s avg | Optimize or upgrade |
| Storage | >80% | Plan expansion |
| Error Rate | >1% | Investigation required |

---

## 9. Recommendations Summary

### P0 - Immediate
1. Add basic health check endpoint
2. Integrate Sentry for error tracking
3. Add structured logging

### P1 - High Priority
1. Define and implement SLIs/SLOs
2. Create basic runbooks
3. Set up alerting for critical paths
4. Add request correlation IDs

### P2 - Medium Priority
1. Implement distributed tracing
2. Create monitoring dashboards
3. Add business metrics tracking
4. Document incident response process

### P3 - Lower Priority
1. Implement feature flags
2. Add canary deployment capability
3. Create comprehensive runbooks
4. Set up on-call rotation

---

## 10. Implementation Timeline

### Week 1
- [ ] Add health check endpoints
- [ ] Install and configure Sentry
- [ ] Add basic structured logging

### Week 2
- [ ] Define SLIs and SLOs
- [ ] Create critical path alerts
- [ ] Document basic runbooks

### Week 3
- [ ] Add request correlation
- [ ] Create monitoring dashboards
- [ ] Set up deployment tracking

### Week 4
- [ ] Add business metrics
- [ ] Implement distributed tracing
- [ ] Create incident response playbook

---

## 11. Cost Estimates

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Sentry | Team | $26/month |
| Logtail/Axiom | Starter | Free |
| Better Uptime | Team | $20/month |
| Vercel | Pro | $20/month |
| **Total** | | **~$66/month** |

*Note: Costs may vary based on usage and features needed*
