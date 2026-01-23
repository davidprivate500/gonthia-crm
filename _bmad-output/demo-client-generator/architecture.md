# Architecture Document: Demo Client Generator

## Document Control
- **Version**: 1.0
- **Status**: Draft
- **Last Updated**: 2026-01-23

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MASTER CRM                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PRESENTATION LAYER                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ Generator   │  │ Jobs List   │  │ Job Detail      │  │   │
│  │  │ Form        │  │ Page        │  │ Page            │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      API LAYER                           │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │ POST /api/master/demo-generator                     ││   │
│  │  │ GET  /api/master/demo-generator                     ││   │
│  │  │ GET  /api/master/demo-generator/[jobId]             ││   │
│  │  │ POST /api/master/demo-generator/[jobId]/regenerate  ││   │
│  │  │ DELETE /api/master/demo-generator/[jobId]           ││   │
│  │  │ POST /api/master/demo-generator/preview             ││   │
│  │  └─────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   GENERATION ENGINE                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ Growth       │  │ Data         │  │ Localization │   │   │
│  │  │ Planner      │  │ Generators   │  │ Providers    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ Seeded RNG   │  │ Industry     │  │ Batch        │   │   │
│  │  │ (Mulberry32) │  │ Templates    │  │ Inserter     │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER                            │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ demo_generation_jobs │ demo_tenant_metadata       │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ tenants │ users │ contacts │ deals │ activities   │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation Approach | Synchronous with progress | Simpler than async jobs, <60s target |
| RNG Implementation | Mulberry32 (seeded) | Fast, proven, deterministic |
| Data Batching | 500 rows/batch | Balance memory vs transaction overhead |
| Localization | Static data files | No external API dependencies |
| Currency Conversion | Fixed rates table | No real-time API complexity |

---

## 2. Database Schema

### 2.1 New Tables

```sql
-- Generation job tracking
CREATE TABLE demo_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Creator reference
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Job status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- ENUM: pending, running, completed, failed

  -- Configuration (full input preserved)
  config JSONB NOT NULL,

  -- Seed for reproducibility
  seed VARCHAR(64) NOT NULL,

  -- Result tracking
  created_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

  -- Progress & logging
  progress INTEGER DEFAULT 0, -- 0-100
  current_step VARCHAR(100),
  logs JSONB DEFAULT '[]',

  -- Metrics (actual generated counts)
  metrics JSONB,

  -- Error info
  error_message TEXT,
  error_stack TEXT,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for listing/filtering
CREATE INDEX idx_demo_jobs_status ON demo_generation_jobs(status);
CREATE INDEX idx_demo_jobs_created_by ON demo_generation_jobs(created_by_id);
CREATE INDEX idx_demo_jobs_created_at ON demo_generation_jobs(created_at DESC);

-- Metadata for demo tenants
CREATE TABLE demo_tenant_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  generation_job_id UUID NOT NULL REFERENCES demo_generation_jobs(id) ON DELETE SET NULL,

  -- Quick lookup fields (denormalized from config)
  country VARCHAR(2) NOT NULL,
  industry VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,

  -- Flags
  is_demo_generated BOOLEAN NOT NULL DEFAULT TRUE,
  excluded_from_analytics BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_demo_metadata_tenant ON demo_tenant_metadata(tenant_id);
CREATE INDEX idx_demo_metadata_country ON demo_tenant_metadata(country);
CREATE INDEX idx_demo_metadata_industry ON demo_tenant_metadata(industry);
```

### 2.2 Drizzle Schema Addition

```typescript
// lib/db/demo-generator-schema.ts

import { pgTable, uuid, varchar, timestamp, jsonb, integer, text, boolean, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, tenants } from './schema';

// Generation job status enum
export const demoJobStatusEnum = pgEnum('demo_job_status', ['pending', 'running', 'completed', 'failed']);

// Demo generation jobs
export const demoGenerationJobs = pgTable('demo_generation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  status: demoJobStatusEnum('status').notNull().default('pending'),
  config: jsonb('config').notNull(),
  seed: varchar('seed', { length: 64 }).notNull(),
  createdTenantId: uuid('created_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  progress: integer('progress').default(0),
  currentStep: varchar('current_step', { length: 100 }),
  logs: jsonb('logs').default([]),
  metrics: jsonb('metrics'),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_demo_jobs_status').on(table.status),
  index('idx_demo_jobs_created_by').on(table.createdById),
  index('idx_demo_jobs_created_at').on(table.createdAt),
]);

// Demo tenant metadata
export const demoTenantMetadata = pgTable('demo_tenant_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  generationJobId: uuid('generation_job_id').notNull().references(() => demoGenerationJobs.id, { onDelete: 'set null' }),
  country: varchar('country', { length: 2 }).notNull(),
  industry: varchar('industry', { length: 50 }).notNull(),
  startDate: date('start_date').notNull(),
  isDemoGenerated: boolean('is_demo_generated').notNull().default(true),
  excludedFromAnalytics: boolean('excluded_from_analytics').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_demo_metadata_tenant').on(table.tenantId),
  index('idx_demo_metadata_country').on(table.country),
  index('idx_demo_metadata_industry').on(table.industry),
]);

// Relations
export const demoGenerationJobsRelations = relations(demoGenerationJobs, ({ one }) => ({
  createdBy: one(users, { fields: [demoGenerationJobs.createdById], references: [users.id] }),
  tenant: one(tenants, { fields: [demoGenerationJobs.createdTenantId], references: [tenants.id] }),
}));

export const demoTenantMetadataRelations = relations(demoTenantMetadata, ({ one }) => ({
  tenant: one(tenants, { fields: [demoTenantMetadata.tenantId], references: [tenants.id] }),
  generationJob: one(demoGenerationJobs, { fields: [demoTenantMetadata.generationJobId], references: [demoGenerationJobs.id] }),
}));
```

### 2.3 Config JSON Structure

```typescript
interface DemoGenerationConfig {
  // Tenant basics
  tenantName: string;
  country: string; // ISO 3166-1 alpha-2
  timezone: string; // IANA timezone
  currency: string; // ISO 4217
  industry: IndustryType;
  startDate: string; // ISO date
  teamSize: number;

  // Volume targets
  targets: {
    leads: number;
    contacts: number;
    companies: number;
    pipelineValue: number;
    closedWonValue: number;
    closedWonCount: number;
  };

  // Growth model
  growth: {
    curve: 'linear' | 'exponential' | 'logistic' | 'step';
    monthlyRate: number; // percentage
    seasonality: boolean;
  };

  // Attribution
  channelMix: {
    seo: number;
    meta: number;
    google: number;
    affiliates: number;
    referrals: number;
    direct: number;
  };

  // Realism
  realism: {
    dropOffRate: number;
    whaleRatio: number;
    responseSlaHours: number;
  };
}

type IndustryType = 'trading' | 'igaming' | 'saas' | 'ecommerce' | 'realestate' | 'finserv';
```

---

## 3. Generation Engine Architecture

### 3.1 Module Structure

```
lib/demo-generator/
├── index.ts                 # Main entry point
├── types.ts                 # Type definitions
├── config.ts                # Default configs & constants
├── engine/
│   ├── generator.ts         # Main orchestrator
│   ├── growth-planner.ts    # Monthly target calculation
│   ├── rng.ts               # Seeded random number generator
│   └── batch-inserter.ts    # Bulk insert utilities
├── data-generators/
│   ├── tenant.ts            # Tenant + billing info
│   ├── users.ts             # Team members
│   ├── pipeline.ts          # Pipeline stages
│   ├── contacts.ts          # Contacts + leads
│   ├── companies.ts         # Companies
│   ├── deals.ts             # Deals
│   └── activities.ts        # Activities + notes
├── localization/
│   ├── index.ts             # Provider selector
│   ├── names/               # Name generators by country
│   │   ├── us.ts
│   │   ├── uk.ts
│   │   ├── de.ts
│   │   ├── jp.ts
│   │   └── ...
│   ├── addresses/           # Address generators by country
│   ├── phones/              # Phone format generators
│   └── companies/           # Company name generators
└── templates/
    ├── trading.ts           # Trading industry template
    ├── igaming.ts           # iGaming industry template
    ├── saas.ts              # SaaS industry template
    └── ...
```

### 3.2 Core Generator Flow

```typescript
// lib/demo-generator/engine/generator.ts

export class DemoGenerator {
  private rng: SeededRNG;
  private config: DemoGenerationConfig;
  private jobId: string;
  private progress: ProgressTracker;

  constructor(jobId: string, config: DemoGenerationConfig, seed: string) {
    this.jobId = jobId;
    this.config = config;
    this.rng = new SeededRNG(seed);
    this.progress = new ProgressTracker(jobId);
  }

  async generate(): Promise<GenerationResult> {
    const tx = await db.transaction();

    try {
      // Step 1: Create tenant (5%)
      await this.progress.update(0, 'Creating tenant profile');
      const tenant = await this.createTenant(tx);

      // Step 2: Create users (10%)
      await this.progress.update(5, 'Creating team members');
      const users = await this.createUsers(tx, tenant.id);

      // Step 3: Create pipeline (15%)
      await this.progress.update(10, 'Setting up pipeline');
      const stages = await this.createPipeline(tx, tenant.id);

      // Step 4: Plan growth distribution
      await this.progress.update(15, 'Planning growth distribution');
      const monthlyPlan = this.planGrowth();

      // Step 5: Create companies (25%)
      await this.progress.update(20, 'Creating companies');
      const companies = await this.createCompanies(tx, tenant.id, monthlyPlan);

      // Step 6: Create contacts (50%)
      await this.progress.update(25, 'Creating contacts');
      const contacts = await this.createContacts(tx, tenant.id, companies, users, monthlyPlan);

      // Step 7: Create deals (75%)
      await this.progress.update(50, 'Creating deals');
      const deals = await this.createDeals(tx, tenant.id, contacts, companies, users, stages, monthlyPlan);

      // Step 8: Create activities (95%)
      await this.progress.update(75, 'Creating activities');
      await this.createActivities(tx, tenant.id, contacts, deals, users, monthlyPlan);

      // Step 9: Create tags (98%)
      await this.progress.update(95, 'Creating tags');
      await this.createTags(tx, tenant.id, contacts);

      // Commit transaction
      await tx.commit();

      // Step 10: Finalize (100%)
      await this.progress.update(100, 'Complete');

      return {
        tenantId: tenant.id,
        metrics: this.collectMetrics(),
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
}
```

### 3.3 Growth Planner

```typescript
// lib/demo-generator/engine/growth-planner.ts

export class GrowthPlanner {
  private config: DemoGenerationConfig;
  private startDate: Date;
  private endDate: Date;
  private months: MonthPlan[];

  constructor(config: DemoGenerationConfig) {
    this.config = config;
    this.startDate = new Date(config.startDate);
    this.endDate = new Date(); // Now
    this.months = this.calculateMonths();
  }

  private calculateMonths(): MonthPlan[] {
    const months: MonthPlan[] = [];
    const current = new Date(this.startDate);

    while (current <= this.endDate) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth(),
        startDate: new Date(current),
        endDate: endOfMonth(current),
      });
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  plan(): MonthlyTargets[] {
    const totalMonths = this.months.length;
    const { curve, monthlyRate } = this.config.growth;

    // Calculate distribution weights per growth curve
    const weights = this.calculateWeights(totalMonths, curve, monthlyRate);

    // Normalize weights to sum to 1
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);

    // Distribute targets across months
    return this.months.map((month, index) => ({
      ...month,
      targets: {
        leads: Math.round(this.config.targets.leads * normalizedWeights[index]),
        contacts: Math.round(this.config.targets.contacts * normalizedWeights[index]),
        companies: Math.round(this.config.targets.companies * normalizedWeights[index]),
        deals: Math.round(this.config.targets.closedWonCount * normalizedWeights[index]),
        pipelineValue: this.config.targets.pipelineValue * normalizedWeights[index],
        closedWonValue: this.config.targets.closedWonValue * normalizedWeights[index],
      },
    }));
  }

  private calculateWeights(n: number, curve: string, rate: number): number[] {
    switch (curve) {
      case 'linear':
        // Equal weights with slight increase
        return Array.from({ length: n }, (_, i) => 1 + (i * rate / 100));

      case 'exponential':
        // Exponential growth: w_i = (1 + rate)^i
        return Array.from({ length: n }, (_, i) => Math.pow(1 + rate / 100, i));

      case 'logistic':
        // S-curve: slow start, rapid middle, plateau
        const midpoint = n / 2;
        return Array.from({ length: n }, (_, i) => {
          const x = (i - midpoint) / (n / 4);
          return 1 / (1 + Math.exp(-x));
        });

      case 'step':
        // Step increase every 3 months
        return Array.from({ length: n }, (_, i) => Math.floor(i / 3) + 1);

      default:
        return Array.from({ length: n }, () => 1);
    }
  }
}
```

### 3.4 Seeded RNG

```typescript
// lib/demo-generator/engine/rng.ts

export class SeededRNG {
  private state: number;

  constructor(seed: string) {
    // Convert string seed to number using hash
    this.state = this.hashString(seed);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }

  // Mulberry32 algorithm - fast and good distribution
  next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Utility methods
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  pickWeighted<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Pareto distribution for deal values (80/20 rule)
  pareto(min: number, alpha: number = 1.5): number {
    return min / Math.pow(1 - this.next(), 1 / alpha);
  }

  // Log-normal for realistic monetary distributions
  logNormal(mean: number, stdDev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.exp(mean + stdDev * z);
  }

  // Random date within range
  date(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return new Date(this.int(startTime, endTime));
  }

  // Business hours date (9am-6pm, Mon-Fri)
  businessDate(start: Date, end: Date, timezone: string): Date {
    let date: Date;
    let attempts = 0;
    do {
      date = this.date(start, end);
      // Adjust to business hours in timezone
      const hours = date.getHours();
      if (hours < 9) date.setHours(9 + this.int(0, 2));
      if (hours > 18) date.setHours(14 + this.int(0, 4));
      attempts++;
    } while (this.isWeekend(date) && attempts < 10);
    return date;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}
```

---

## 4. API Design

### 4.1 Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/master/demo-generator` | Start generation | Master Admin |
| GET | `/api/master/demo-generator` | List jobs | Master Admin |
| GET | `/api/master/demo-generator/[jobId]` | Get job detail | Master Admin |
| DELETE | `/api/master/demo-generator/[jobId]` | Delete demo tenant | Master Admin |
| POST | `/api/master/demo-generator/[jobId]/regenerate` | Regenerate from config | Master Admin |
| POST | `/api/master/demo-generator/preview` | Preview metrics | Master Admin |

### 4.2 Request/Response Schemas

```typescript
// POST /api/master/demo-generator
// Request
interface CreateDemoRequest {
  tenantName?: string; // Auto-generated if not provided
  country: string;
  timezone?: string;
  currency?: string;
  industry: IndustryType;
  startDate: string;
  teamSize?: number;
  targets?: Partial<VolumeTargets>;
  growth?: Partial<GrowthConfig>;
  channelMix?: Partial<ChannelMix>;
  realism?: Partial<RealismConfig>;
  seed?: string; // Auto-generated if not provided
}

// Response
interface CreateDemoResponse {
  data: {
    jobId: string;
    status: 'pending' | 'running';
    estimatedSeconds: number;
  };
}

// GET /api/master/demo-generator
// Response
interface ListJobsResponse {
  data: Array<{
    id: string;
    status: JobStatus;
    config: DemoGenerationConfig;
    createdTenantId: string | null;
    tenantName: string | null;
    metrics: GenerationMetrics | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// GET /api/master/demo-generator/[jobId]
// Response
interface JobDetailResponse {
  data: {
    id: string;
    status: JobStatus;
    config: DemoGenerationConfig;
    seed: string;
    createdTenantId: string | null;
    tenant: {
      id: string;
      name: string;
    } | null;
    progress: number;
    currentStep: string | null;
    logs: LogEntry[];
    metrics: GenerationMetrics | null;
    monthlyBreakdown: MonthlyMetrics[] | null;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  };
}

// POST /api/master/demo-generator/preview
// Request
interface PreviewRequest {
  country: string;
  industry: IndustryType;
  startDate: string;
  targets?: Partial<VolumeTargets>;
  growth?: Partial<GrowthConfig>;
}

// Response
interface PreviewResponse {
  data: {
    monthlyProjection: Array<{
      month: string;
      leads: number;
      contacts: number;
      deals: number;
      pipelineValue: number;
      closedWonValue: number;
    }>;
    totals: VolumeTargets;
    estimatedGenerationSeconds: number;
  };
}
```

### 4.3 Validation Schema

```typescript
// validations/demo-generator.ts

import { z } from 'zod';

export const industryEnum = z.enum([
  'trading', 'igaming', 'saas', 'ecommerce', 'realestate', 'finserv'
]);

export const growthCurveEnum = z.enum([
  'linear', 'exponential', 'logistic', 'step'
]);

export const createDemoSchema = z.object({
  tenantName: z.string().min(3).max(100).optional(),
  country: z.string().length(2).regex(/^[A-Z]{2}$/),
  timezone: z.string().optional(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
  industry: industryEnum,
  startDate: z.string().refine(val => {
    const date = new Date(val);
    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return date <= now && date >= twoYearsAgo;
  }, 'Start date must be within last 24 months and not in future'),
  teamSize: z.number().int().min(2).max(50).optional().default(8),
  targets: z.object({
    leads: z.number().int().min(100).max(50000).optional(),
    contacts: z.number().int().min(50).max(20000).optional(),
    companies: z.number().int().min(20).max(5000).optional(),
    pipelineValue: z.number().min(10000).max(100000000).optional(),
    closedWonValue: z.number().min(5000).max(50000000).optional(),
    closedWonCount: z.number().int().min(10).max(5000).optional(),
  }).optional(),
  growth: z.object({
    curve: growthCurveEnum.optional(),
    monthlyRate: z.number().min(0).max(50).optional(),
    seasonality: z.boolean().optional(),
  }).optional(),
  channelMix: z.object({
    seo: z.number().min(0).max(100).optional(),
    meta: z.number().min(0).max(100).optional(),
    google: z.number().min(0).max(100).optional(),
    affiliates: z.number().min(0).max(100).optional(),
    referrals: z.number().min(0).max(100).optional(),
    direct: z.number().min(0).max(100).optional(),
  }).optional(),
  realism: z.object({
    dropOffRate: z.number().min(0).max(50).optional(),
    whaleRatio: z.number().min(0).max(20).optional(),
    responseSlaHours: z.number().int().min(1).max(72).optional(),
  }).optional(),
  seed: z.string().max(64).optional(),
});

export const previewSchema = createDemoSchema.pick({
  country: true,
  industry: true,
  startDate: true,
  targets: true,
  growth: true,
});

export const listJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  country: z.string().length(2).optional(),
  industry: industryEnum.optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['createdAt', 'completedAt', 'tenantName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

---

## 5. Localization Architecture

### 5.1 Provider Interface

```typescript
// lib/demo-generator/localization/types.ts

export interface LocalizationProvider {
  country: string;

  // Name generation
  firstName(gender?: 'male' | 'female'): string;
  lastName(): string;
  fullName(gender?: 'male' | 'female'): string;

  // Contact info
  email(firstName: string, lastName: string, domain?: string): string;
  phone(): string;

  // Address
  streetAddress(): string;
  city(): string;
  state(): string;
  postalCode(): string;
  fullAddress(): AddressComponents;

  // Company
  companyName(): string;
  companySuffix(): string;

  // Defaults
  timezone: string;
  currency: string;
  dateFormat: string;
}
```

### 5.2 Country Data Structure

```typescript
// lib/demo-generator/localization/data/us.ts

export const usData = {
  firstNames: {
    male: ['James', 'John', 'Robert', 'Michael', 'William', 'David', ...],
    female: ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', ...],
  },
  lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', ...],

  cities: [
    { name: 'New York', state: 'NY', zip: '10001' },
    { name: 'Los Angeles', state: 'CA', zip: '90001' },
    { name: 'Chicago', state: 'IL', zip: '60601' },
    ...
  ],

  streetTypes: ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Rd'],

  phonePrefixes: ['212', '310', '312', '415', '617', '713', '202', ...],

  companySuffixes: ['Inc', 'LLC', 'Corp', 'Co', 'Group', 'Holdings'],

  companyWords: ['Global', 'National', 'American', 'United', 'First', ...],

  emailDomains: [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'company.com', 'corp.com', 'business.com'
  ],

  defaults: {
    timezone: 'America/New_York',
    currency: 'USD',
    dateFormat: 'MM/dd/yyyy',
  },
};
```

### 5.3 Supported Countries (MVP)

| Country | Code | Names | Addresses | Phones | Companies |
|---------|------|-------|-----------|--------|-----------|
| United States | US | English | US format | +1 | American style |
| United Kingdom | UK | British | UK format | +44 | British Ltd |
| Germany | DE | German | German format | +49 | GmbH/AG |
| Japan | JP | Japanese | Japanese format | +81 | KK/Yugen |
| Brazil | BR | Portuguese | Brazilian format | +55 | SA/Ltda |
| UAE | AE | Arabic/English | UAE format | +971 | LLC/FZ |

---

## 6. Industry Templates

### 6.1 Template Structure

```typescript
// lib/demo-generator/templates/types.ts

export interface IndustryTemplate {
  id: IndustryType;
  name: string;

  // Pipeline configuration
  pipeline: {
    name: string;
    stages: Array<{
      name: string;
      type: 'open' | 'won' | 'lost';
      probability: number;
      avgDaysInStage: number;
    }>;
  };

  // Deal characteristics
  deals: {
    minValue: number;
    maxValue: number;
    avgValue: number;
    cycleDaysMin: number;
    cycleDaysMax: number;
    winRate: number;
  };

  // Lead/contact characteristics
  leads: {
    conversionRate: number; // lead to contact
    qualificationRate: number; // contact to opportunity
  };

  // Activity patterns
  activities: {
    avgPerContact: number;
    avgPerDeal: number;
    callToEmailRatio: number;
  };

  // Company name patterns
  companyPatterns: string[];
}
```

### 6.2 Trading Template Example

```typescript
// lib/demo-generator/templates/trading.ts

export const tradingTemplate: IndustryTemplate = {
  id: 'trading',
  name: 'Trading / Forex',

  pipeline: {
    name: 'Trading Pipeline',
    stages: [
      { name: 'New Lead', type: 'open', probability: 10, avgDaysInStage: 2 },
      { name: 'Qualified', type: 'open', probability: 25, avgDaysInStage: 5 },
      { name: 'Demo Scheduled', type: 'open', probability: 40, avgDaysInStage: 3 },
      { name: 'Demo Completed', type: 'open', probability: 60, avgDaysInStage: 7 },
      { name: 'Funded', type: 'open', probability: 80, avgDaysInStage: 14 },
      { name: 'Active Trader', type: 'won', probability: 100, avgDaysInStage: 0 },
      { name: 'VIP', type: 'won', probability: 100, avgDaysInStage: 0 },
      { name: 'Churned', type: 'lost', probability: 0, avgDaysInStage: 0 },
      { name: 'Disqualified', type: 'lost', probability: 0, avgDaysInStage: 0 },
    ],
  },

  deals: {
    minValue: 500,
    maxValue: 100000,
    avgValue: 5000,
    cycleDaysMin: 7,
    cycleDaysMax: 45,
    winRate: 0.25,
  },

  leads: {
    conversionRate: 0.40,
    qualificationRate: 0.30,
  },

  activities: {
    avgPerContact: 8,
    avgPerDeal: 12,
    callToEmailRatio: 0.6,
  },

  companyPatterns: [
    '{Adjective} Trading',
    '{Adjective} Capital',
    '{Name} Investments',
    '{Name} Trading Group',
    '{Adjective} Markets',
    '{Name} Financial',
  ],
};
```

---

## 7. Security Model

### 7.1 Authorization

```typescript
// All demo-generator endpoints require Master Admin
// Enforced via middleware

// app/api/master/demo-generator/route.ts
export async function POST(request: NextRequest) {
  const auth = await requireMasterAdminWithCsrf(request);
  if (auth instanceof Response) return auth;

  // ... generation logic
}
```

### 7.2 Tenant Isolation

- Generated tenants are fully isolated like any other tenant
- `is_demo_generated` flag is internal metadata only
- Tenant users cannot see or modify their demo status
- Master admin can filter/exclude demo tenants from reports

### 7.3 Audit Trail

```typescript
// All generation actions logged to audit_logs
await tx.insert(auditLogs).values({
  tenantId: null, // Platform-level action
  userId: auth.userId,
  action: 'create',
  entityType: 'demo_generation_job',
  entityId: jobId,
  newValues: config,
  metadata: { seed, estimatedRecords },
});
```

---

## 8. Performance Considerations

### 8.1 Batch Insert Strategy

```typescript
// lib/demo-generator/engine/batch-inserter.ts

export class BatchInserter {
  private batchSize = 500;

  async insertBatched<T>(
    tx: Transaction,
    table: Table,
    records: T[],
    onProgress?: (inserted: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < records.length; i += this.batchSize) {
      const batch = records.slice(i, i + this.batchSize);
      await tx.insert(table).values(batch);
      onProgress?.(Math.min(i + this.batchSize, records.length), records.length);
    }
  }
}
```

### 8.2 Memory Management

- Generate data in chunks, don't hold all in memory
- Stream large arrays through batch inserter
- Clear references after batch insertion

### 8.3 Transaction Strategy

- Single transaction for atomicity
- Savepoints for partial rollback on specific errors
- Timeout handling with graceful cleanup

---

## 9. Error Handling

### 9.1 Error Types

```typescript
export class DemoGeneratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'DemoGeneratorError';
  }
}

export class ValidationError extends DemoGeneratorError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', false);
  }
}

export class GenerationTimeoutError extends DemoGeneratorError {
  constructor() {
    super('Generation timed out', 'TIMEOUT', true);
  }
}

export class DatabaseError extends DemoGeneratorError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', true);
  }
}
```

### 9.2 Recovery Strategy

1. **Timeout**: Mark job as failed, cleanup partial data
2. **Database error**: Rollback transaction, retry once
3. **Validation error**: Fail immediately, no retry
4. **Unknown error**: Log full stack, rollback, mark failed

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Growth planner calculations
- RNG determinism verification
- Localization providers
- Value distribution functions

### 10.2 Integration Tests

- Full generation flow with small volumes
- API endpoint validation
- Database constraint verification
- Transaction rollback on error

### 10.3 Performance Tests

- Generation time benchmarks
- Memory usage profiling
- Concurrent generation handling
