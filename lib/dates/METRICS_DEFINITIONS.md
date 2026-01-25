# Metrics Definitions

This document defines how metrics are calculated for the date range selector and reporting features.

## Core Principles

1. **Exclusive End Date**: All date ranges use an exclusive end date (`to < endDate`). This prevents off-by-one errors and ensures consistent counting.

2. **UTC Storage**: All timestamps are stored in UTC in the database. Date boundaries are computed in UTC.

3. **Tenant Isolation**: All metrics respect tenant boundaries. A tenant can only see their own data unless they are a Master Admin.

## Metric Definitions

### Contacts

| Metric | Description | Timestamp Field | Filters |
|--------|-------------|-----------------|---------|
| `newContacts` | Count of contacts created in period | `contacts.createdAt` | `deletedAt IS NULL`, `createdAt >= from`, `createdAt < to` |
| `newCustomers` | Contacts with status='customer' | `contacts.createdAt` | Same as above + `status = 'customer'` |
| `contactsByStatus` | Breakdown by status | `contacts.createdAt` | Grouped by `status` |

### Companies

| Metric | Description | Timestamp Field | Filters |
|--------|-------------|-----------------|---------|
| `newCompanies` | Count of companies created in period | `companies.createdAt` | `deletedAt IS NULL`, `createdAt >= from`, `createdAt < to` |

### Deals

| Metric | Description | Timestamp Field | Filters |
|--------|-------------|-----------------|---------|
| `newDeals` | Count of deals created in period | `deals.createdAt` | `deletedAt IS NULL`, `createdAt >= from`, `createdAt < to` |
| `wonDeals` | Deals in a stage where `isWon=true` | `deals.createdAt` | Same as above + stage `isWon = true` |
| `lostDeals` | Deals in a stage where `isLost=true` | `deals.createdAt` | Same as above + stage `isLost = true` |
| `pipelineValue` | Sum of `deals.value` for new deals | `deals.createdAt` | Same as `newDeals` |
| `wonValue` | Sum of `deals.value` for won deals | `deals.createdAt` | Same as `wonDeals` |
| `winRate` | `(wonDeals / newDeals) * 100` | Calculated | - |

### Activities

| Metric | Description | Timestamp Field | Filters |
|--------|-------------|-----------------|---------|
| `activitiesCount` | Count of activities created in period | `activities.createdAt` | `deletedAt IS NULL`, `createdAt >= from`, `createdAt < to` |
| `activitiesByType` | Breakdown by type (note, call, email, meeting, task) | `activities.createdAt` | Grouped by `type` |

## Date Range Presets

| Preset | Description | From (inclusive) | To (exclusive) |
|--------|-------------|------------------|----------------|
| `today` | Current day | Start of today | Start of tomorrow |
| `yesterday` | Previous day | Start of yesterday | Start of today |
| `this_week` | Current week (Mon-Sun) | Start of Monday | Start of tomorrow |
| `last_week` | Previous week | Start of last Monday | Start of this Monday |
| `this_month` | Current month | First of month | Start of tomorrow |
| `last_month` | Previous month | First of last month | First of this month |
| `last_30_days` | Rolling 30 days | 29 days ago | Start of tomorrow |
| `last_90_days` | Rolling 90 days | 89 days ago | Start of tomorrow |
| `custom` | User-specified range | User input | User input + 1 day |

## API Endpoints

### Tenant Endpoints

#### `GET /api/v1/reports/dashboard`
Returns dashboard summary with date filtering.

**Query Parameters:**
- `preset` (optional): One of the preset keys above
- `from` (required if no preset): YYYY-MM-DD format, inclusive
- `to` (required if no preset): YYYY-MM-DD format, inclusive (converted to exclusive internally)

**Response:**
```json
{
  "data": {
    "dateRange": { "from": "...", "to": "...", "preset": "..." },
    "summary": {
      "newContacts": 0,
      "newCompanies": 0,
      "newDeals": 0,
      "activitiesCount": 0,
      "periodPipelineValue": 0,
      "totalContacts": 0,
      "totalCompanies": 0,
      "totalDeals": 0
    },
    "recentContacts": [...],
    "pipeline": [...]
  }
}
```

#### `GET /api/v1/reports/metrics`
Returns detailed performance metrics.

**Response:**
```json
{
  "data": {
    "dateRange": { ... },
    "contacts": { "new": 0, "newCustomers": 0, "byStatus": {} },
    "companies": { "new": 0 },
    "deals": { "new": 0, "won": 0, "lost": 0, "pipelineValue": 0, "wonValue": 0, "winRate": 0 },
    "activities": { "total": 0, "byType": {} }
  }
}
```

#### `GET /api/v1/reports/monthly`
Returns metrics grouped by month for billing.

**Response:**
```json
{
  "data": {
    "dateRange": { ... },
    "months": [
      { "month": "2024-01", "monthLabel": "Jan 2024", "contacts": 0, ... }
    ],
    "totals": { "contacts": 0, "companies": 0, "deals": 0, "activities": 0, "pipelineValue": 0 }
  }
}
```

### Master Admin Endpoints

#### `GET /api/master/reports/metrics`
Cross-tenant metrics. Requires Master Admin role.

**Additional Query Parameters:**
- `tenantId` (optional): Filter to specific tenant

#### `GET /api/master/reports/monthly`
Cross-tenant monthly metrics for billing.

**Additional Query Parameters:**
- `tenantId` (optional): Filter to specific tenant

## Billing Considerations

For billing purposes, the following fields are typically used:

1. **Contacts Created**: `contacts.createdAt` within billing period
2. **Companies Created**: `companies.createdAt` within billing period
3. **Deals Created**: `deals.createdAt` within billing period
4. **Activities Created**: `activities.createdAt` within billing period
5. **Pipeline Value**: Sum of `deals.value` for deals created in period

The monthly endpoint provides these metrics grouped by month, making it easy to generate invoices.

## Database Indexes

For optimal performance, ensure these indexes exist:

```sql
-- Already in schema
CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_companies_tenant_id ON companies(tenant_id);
CREATE INDEX idx_deals_tenant_id ON deals(tenant_id);
CREATE INDEX idx_activities_tenant_id ON activities(tenant_id);

-- Recommended additions for date filtering (if not already present)
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_companies_created_at ON companies(created_at);
CREATE INDEX idx_deals_created_at ON deals(created_at);
CREATE INDEX idx_activities_created_at ON activities(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_contacts_tenant_created ON contacts(tenant_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_tenant_created ON deals(tenant_id, created_at) WHERE deleted_at IS NULL;
```

## URL Persistence

The date range selection is persisted in:

1. **URL Query Parameters**: `?from=YYYY-MM-DD&to=YYYY-MM-DD&preset=this_month`
   - Enables sharing filtered views
   - Survives page refresh

2. **localStorage**: `date-range-{key}` (e.g., `date-range-dashboard`)
   - Persists selection across sessions
   - Cleared when browser storage is cleared

## Component Usage

```tsx
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { type DateRange } from '@/lib/dates';

function MyComponent() {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    resolvePreset('this_month')
  );

  return (
    <DateRangePicker
      value={dateRange}
      onChange={setDateRange}
      defaultPreset="this_month"
      persistKey="my-page"
      syncToUrl={true}
    />
  );
}
```
