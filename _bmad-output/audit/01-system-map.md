# System Map - Gonthia CRM

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GONTHIA CRM                                     │
│                     Multi-Tenant SaaS CRM Application                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │   Next.js 16    │    │    Vercel       │    │     Supabase            │ │
│  │   App Router    │◄──►│   Serverless    │◄──►│     PostgreSQL          │ │
│  │   (React 19)    │    │   Functions     │    │     (Transaction Pool)  │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        APPLICATION LAYERS                            │   │
│  ├──────────────────┬──────────────────┬───────────────────────────────┤   │
│  │   Presentation   │    API Layer     │       Data Layer              │   │
│  │   ───────────    │    ─────────     │       ──────────              │   │
│  │   • React Pages  │    • Route       │       • Drizzle ORM           │   │
│  │   • Shadcn/UI    │      Handlers    │       • postgres-js           │   │
│  │   • Tailwind CSS │    • Middleware  │       • Schema (13 tables)    │   │
│  │   • Zustand      │    • Zod Valid.  │       • Relations             │   │
│  └──────────────────┴──────────────────┴───────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Service Topology

### 2.1 Single-Service Monolith
- **Type:** Next.js Full-Stack Application
- **Deployment:** Vercel Serverless (Edge + Node.js)
- **Database:** Supabase PostgreSQL (Transaction Pooler on port 6543)
- **Session:** Iron-session (encrypted cookies)

### 2.2 External Services
| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| Supabase | PostgreSQL Database | `lib/db/index.ts` via postgres-js |
| Vercel | Hosting & Serverless | Deployment platform |
| (Future) SMTP | Email notifications | Not yet implemented |

## 3. Module Boundary Map

```
app/
├── (auth)/                    # PUBLIC - Unauthenticated routes
│   ├── login/                 # Session creation
│   ├── register/              # Tenant + User creation
│   ├── forgot-password/       # Token generation
│   └── reset-password/        # Token consumption
│
├── (dashboard)/               # PROTECTED - Authenticated routes
│   ├── dashboard/             # Analytics & overview
│   ├── contacts/              # Contact CRUD + Tags
│   ├── companies/             # Company CRUD
│   ├── pipeline/              # Deal Kanban board
│   ├── activities/            # Activity logging
│   └── settings/              # User, team, org settings
│       ├── profile/           # Self-service profile
│       ├── team/              # User management (Admin+)
│       ├── audit-log/         # Audit trail (Admin+)
│       ├── api-keys/          # API key management (Admin+)
│       └── import-export/     # Data import/export
│
└── api/v1/                    # REST API endpoints
    ├── auth/                  # Authentication APIs
    ├── organization/          # Tenant management
    ├── contacts/              # Contact APIs
    ├── companies/             # Company APIs
    ├── deals/                 # Deal APIs
    ├── activities/            # Activity APIs
    ├── pipeline/              # Stage management
    ├── tags/                  # Tag APIs
    ├── api-keys/              # API key APIs
    ├── audit-logs/            # Audit log APIs
    ├── import/                # Import job APIs
    ├── export/                # Export APIs
    ├── search/                # Global search
    └── reports/               # Dashboard reports
```

## 4. Multi-Tenancy Model

### 4.1 Tenant Isolation Strategy
- **Type:** Shared Database, Shared Schema
- **Isolation Key:** `tenant_id` UUID column on all entity tables
- **Enforcement:** Application-level (middleware injects tenantId from session)

### 4.2 Tenant-Scoped Tables
| Table | tenant_id FK | Cascade Policy |
|-------|-------------|----------------|
| users | YES | CASCADE |
| contacts | YES | CASCADE |
| companies | YES | CASCADE |
| deals | YES | CASCADE |
| activities | YES | CASCADE |
| tags | YES | CASCADE |
| pipelineStages | YES | CASCADE |
| apiKeys | YES | CASCADE |
| auditLogs | YES | CASCADE |
| importJobs | YES | CASCADE |

### 4.3 Tenant-Independent Tables
| Table | Purpose |
|-------|---------|
| tenants | Root tenant records |
| passwordResetTokens | Cross-tenant (user-scoped) |
| contactTags | Junction table (cascades from contacts/tags) |

## 5. Authorization Model (RBAC)

### 5.1 Role Hierarchy
```
owner (4) > admin (3) > member (2) > readonly (1)
```

### 5.2 Permission Matrix
| Permission | owner | admin | member | readonly |
|------------|-------|-------|--------|----------|
| Create records | ✓ | ✓ | ✓ | ✗ |
| Update records | ✓ | ✓ | ✓ | ✗ |
| Delete records | ✓ | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✓ | ✗ | ✗ |
| Invite users | ✓ | ✓* | ✗ | ✗ |
| Manage org | ✓ | ✗ | ✗ | ✗ |
| View audit log | ✓ | ✓ | ✗ | ✗ |
| Manage API keys | ✓ | ✓ | ✗ | ✗ |
| Export data | ✓ | ✗ | ✗ | ✗ |

*Admin can only invite member/readonly roles

## 6. Data Flow - Core CRM Primitives

### 6.1 Contact Lifecycle
```
Create Contact → [API Validation] → [Tenant Filter] → [DB Insert]
                                                           │
     ┌─────────────────────────────────────────────────────┘
     ▼
[Audit Log Entry] → [Response to Client]
```

### 6.2 Deal Pipeline Flow
```
Create Deal → [Stage Assignment] → [Position Calculation]
     │
     ▼
Move Deal → [New Stage] → [Position Reorder] → [Audit Log]
     │
     ▼
Won/Lost Stage → [isWon/isLost flag check]
```

### 6.3 Authentication Flow
```
Register: Client → /api/v1/auth/register
  1. Validate input (Zod)
  2. Check email uniqueness
  3. Hash password (bcrypt)
  4. Create Tenant record
  5. Create User record (owner role)
  6. Create Session (iron-session)
  7. Return user + organization

Login: Client → /api/v1/auth/login
  1. Validate input (Zod)
  2. Find user by email
  3. Verify password (bcrypt)
  4. Check not soft-deleted
  5. Create Session
  6. Return user + organization

API Key Auth: Client → Any /api/v1/* route
  1. Extract Bearer token
  2. Validate prefix (gon_)
  3. Hash token (SHA-256)
  4. Lookup apiKeys by hash
  5. Check not revoked/expired
  6. Inject admin-level context
```

## 7. Critical Integration Points

### 7.1 Database Connection
- **File:** `lib/db/index.ts`
- **Driver:** postgres-js (`import postgres from 'postgres'`)
- **ORM:** Drizzle ORM
- **Pool:** Supabase Transaction Pooler (6543)
- **WARNING:** No true transaction support for Neon HTTP driver

### 7.2 Session Management
- **File:** `lib/auth/session.ts`
- **Library:** iron-session v8
- **Cookie:** `gonthia-session`
- **Duration:** 7 days
- **Security:** httpOnly, sameSite=lax, secure in production

### 7.3 Audit Logging
- **File:** `lib/audit/logger.ts`
- **Pattern:** Fire-and-forget (non-blocking)
- **Redaction:** Sensitive fields filtered
- **Failure:** Silent (console.error only)

## 8. Component Inventory

### 8.1 API Route Handlers: 32 files
### 8.2 Page Components: 20 routes
### 8.3 UI Components: 50+ (Radix-based)
### 8.4 Custom Hooks: 2 (use-auth, use-debounce)
### 8.5 State Stores: 1 (Zustand auth store)
### 8.6 Validation Schemas: 11 files
### 8.7 Database Tables: 13 tables
### 8.8 Database Indexes: 40+ indexes

## 9. Technology Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.4 |
| Runtime | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | Supabase |
| ORM | Drizzle | 0.45.1 |
| Auth | iron-session | 8.0.4 |
| Validation | Zod | 4.3.5 |
| Styling | Tailwind CSS | 4.x |
| UI | Radix UI | Various |
| State | Zustand | 5.0.10 |
| Testing | Vitest | 4.0.17 |
