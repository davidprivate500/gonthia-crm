# Demo Client Seed

This document describes how to populate the CRM with a realistic demo client for development and demonstration purposes.

## Overview

The seed script creates a single tenant called **Meridian Trading Group** with comprehensive, realistic data that simulates an active fintech/trading CRM over a 13-month period (January 2024 - January 2025).

## Quick Start

```bash
# Seed the demo client
npm run seed:demo-client

# Remove the demo client (if needed)
npm run seed:demo-cleanup
```

## Login Credentials

After seeding, you can log in with:

- **Email:** `carlos.mendez@meridiantrading.io`
- **Password:** `Meridian2024!`

## Data Generated

### Tenant Profile

| Field | Value |
|-------|-------|
| Company | Meridian Trading Group |
| Industry | Financial Services / Trading |
| Business Volume | ~$4-8M monthly turnover |

### Team Members (12 users)

| Name | Role | Email |
|------|------|-------|
| Carlos Mendez | Owner | carlos.mendez@meridiantrading.io |
| Sarah Chen | Admin | sarah.chen@meridiantrading.io |
| Michael Thompson | Admin | michael.thompson@meridiantrading.io |
| Elena Rodriguez | Member | elena.rodriguez@meridiantrading.io |
| James Wilson | Member | james.wilson@meridiantrading.io |
| Aisha Patel | Member | aisha.patel@meridiantrading.io |
| Lucas Andersson | Member | lucas.andersson@meridiantrading.io |
| Maria Santos | Member | maria.santos@meridiantrading.io |
| David Kim | Member | david.kim@meridiantrading.io |
| Laura Fischer | Member | laura.fischer@meridiantrading.io |
| Robert Martinez | Readonly | robert.martinez@meridiantrading.io |
| Jennifer Lee | Readonly | jennifer.lee@meridiantrading.io |

### Data Volumes (approximately)

| Entity | Count | Notes |
|--------|-------|-------|
| Contacts | ~5,700 | With growth curve from 50/month to 600/month |
| Companies | ~300 | Various industries and sizes |
| Deals | ~3,600 | Pipeline with all stages populated |
| Activities | ~33,000 | Calls, emails, meetings, notes, tasks |
| Contact Tags | ~7,000 | Junction table associations |
| Audit Logs | ~1,000 | Sample CRUD operations |
| **Total Rows** | **~51,000** | |

### Growth Curve (Monthly Contacts)

```
2024-01: ~50
2024-02: ~100
2024-03: ~170
2024-04: ~280
2024-05: ~370
2024-06: ~420
2024-07: ~590
2024-08: ~580
2024-09: ~600
2024-10: ~640
2024-11: ~590
2024-12: ~670
2025-01: ~660
```

### Pipeline Stages

| Stage | Color | % of Deals |
|-------|-------|------------|
| New Lead | Gray | ~8% |
| Qualified | Blue | ~10% |
| Proposal Sent | Purple | ~12% |
| Negotiation | Orange | ~12% |
| Closed Won | Green | ~43% |
| Closed Lost | Red | ~15% |

### Contact Status Distribution

| Status | % |
|--------|---|
| Lead | ~35% |
| Prospect | ~25% |
| Customer | ~30% |
| Churned | ~8% |
| Other | ~2% |

## Idempotency

The seed script is idempotent. If the tenant already exists, it will skip seeding and report the existing tenant ID. To re-seed:

```bash
npm run seed:demo-cleanup
npm run seed:demo-client
```

## Determinism

The script uses a seeded random number generator (Mulberry32) for reproducible results. Change the seed via environment variable:

```bash
DEMO_SEED=42 npm run seed:demo-client
```

Default seed is `1337`.

## Verification Checklist

After seeding, verify the following pages are populated:

- [ ] **Dashboard** (`/dashboard`)
  - Total Contacts: ~5,700
  - Companies: ~300
  - Active Deals: ~3,600
  - Pipeline Value: $100M+
  - Recent Contacts list populated
  - Pipeline Overview shows all stages with deal counts

- [ ] **Contacts** (`/contacts`)
  - List shows contacts with various statuses
  - Filters work (by status, owner, tags)
  - Search returns results

- [ ] **Companies** (`/companies`)
  - List shows companies with various industries
  - Company details include contacts

- [ ] **Pipeline** (`/pipeline`)
  - Kanban board shows deals in all stages
  - Drag-and-drop works
  - Deal values displayed

- [ ] **Activities** (`/activities`)
  - Activity feed shows various types
  - Filtering by type works

- [ ] **Settings > Team** (`/settings/team`)
  - 12 team members listed

- [ ] **Settings > Audit Log** (`/settings/audit-log`)
  - Audit entries visible

## Verification Queries

Run these SQL queries to verify data integrity:

```sql
-- Total contacts
SELECT COUNT(*) FROM contacts WHERE tenant_id = '<tenant_id>';

-- Total pipeline value
SELECT SUM(CAST(value AS DECIMAL)) FROM deals WHERE tenant_id = '<tenant_id>';

-- Deals by stage
SELECT ps.name, COUNT(d.id) as deal_count, SUM(CAST(d.value AS DECIMAL)) as total_value
FROM deals d
JOIN pipeline_stages ps ON d.stage_id = ps.id
WHERE d.tenant_id = '<tenant_id>'
GROUP BY ps.name, ps.position
ORDER BY ps.position;

-- Monthly contact growth
SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as contacts
FROM contacts
WHERE tenant_id = '<tenant_id>'
GROUP BY month
ORDER BY month;
```

## Data Characteristics

- **No placeholder text**: No "demo", "test", "lorem", "Acme", or "example.com"
- **Realistic names**: Mix of international first/last names
- **Valid email formats**: Generated from name + real domains (gmail, outlook, etc.)
- **Consistent phone formats**: Country-specific formats (US, UK, DE, etc.)
- **Coherent timestamps**: Business hours, weekday distribution
- **Referential integrity**: All foreign keys valid

## Troubleshooting

### "Tenant already exists"

Run cleanup first:
```bash
npm run seed:demo-cleanup
```

### Database connection error

Ensure `DATABASE_URL` is set in `.env.local`.

### Enum errors

If you see enum-related errors, ensure the database schema is up to date:
```bash
npm run db:push
```
