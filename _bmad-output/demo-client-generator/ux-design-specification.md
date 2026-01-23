# UX Design Specification: Demo Client Generator

## Document Control
- **Version**: 1.0
- **Status**: Draft
- **Last Updated**: 2026-01-23

---

## 1. Information Architecture

### 1.1 Site Map (Master CRM Addition)

```
/master
├── /tenants                    (existing)
├── /invoices                   (existing)
├── /settings                   (existing)
└── /demo-generator             (NEW)
    ├── /                       → Generator Form + List
    └── /jobs/[jobId]           → Job Detail View
```

### 1.2 Navigation Update

**Master Sidebar Addition:**
```
Dashboard
Tenants
Invoices
─────────────
Demo Generator  ← NEW (icon: Wand2 or Sparkles)
─────────────
Settings
```

---

## 2. Page Specifications

### 2.1 Demo Generator Main Page (`/master/demo-generator`)

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ MasterHeader: "Demo Client Generator"                       │
│ Description: "Generate realistic demo tenants for demos"    │
│ [+ Generate New Demo Client]                                │
├─────────────────────────────────────────────────────────────┤
│ Tabs: [All] [Generating] [Completed] [Failed]               │
├─────────────────────────────────────────────────────────────┤
│ Search: [Search by tenant name, country, industry...]       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ TABLE: Generated Tenants                                │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Tenant Name    │ Country │ Industry │ Created   │ Status │ │
│ │ Meridian Trade │ US      │ Trading  │ 2h ago    │ Ready  │ │
│ │ Sakura Gaming  │ JP      │ iGaming  │ 1d ago    │ Ready  │ │
│ │ Berlin SaaS    │ DE      │ SaaS     │ 3d ago    │ Ready  │ │
│ │ ...            │ ...     │ ...      │ ...       │ ...    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Pagination: [< Prev] Page 1 of 5 [Next >]                   │
└─────────────────────────────────────────────────────────────┘
```

#### Table Columns
| Column | Width | Sortable | Content |
|--------|-------|----------|---------|
| Tenant Name | 25% | Yes | Name + flag emoji |
| Country | 10% | Yes | ISO code badge |
| Industry | 12% | Yes | Industry badge |
| Contacts | 10% | Yes | Count |
| Deals | 10% | Yes | Count |
| Pipeline $ | 12% | Yes | Currency formatted |
| Created | 12% | Yes | Relative time |
| Status | 9% | No | Badge (Ready/Generating/Failed) |

#### Row Actions (Dropdown)
- **View Details** → Navigate to job detail
- **Login as Owner** → Open tenant dashboard (new tab)
- **Regenerate** → Open generator with same config
- **Delete** → Confirmation dialog

#### Empty State
```
┌─────────────────────────────────────────────┐
│         🪄                                   │
│                                             │
│   No demo clients generated yet             │
│                                             │
│   Generate your first demo client to see    │
│   a fully populated CRM in action.          │
│                                             │
│   [+ Generate Demo Client]                  │
└─────────────────────────────────────────────┘
```

#### Loading State
- Skeleton rows with pulsing animation
- 5 placeholder rows

---

### 2.2 Generation Form (Dialog or Page Section)

#### Form Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Generate Demo Client                              [X Close] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ QUICK START                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │ Trading │ │ iGaming │ │  SaaS   │ │E-commerce│           │
│ │   📈    │ │   🎰    │ │   💻    │ │   🛒    │            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ TENANT BASICS                                               │
│                                                             │
│ Tenant Name*                                                │
│ [Auto-generated based on industry          ] [🔄 Regenerate]│
│                                                             │
│ Country*                    Timezone                        │
│ [🇺🇸 United States    ▼]    [America/New_York    ▼]         │
│                                                             │
│ Currency                    Industry*                       │
│ [USD - US Dollar   ▼]       [Trading           ▼]          │
│                                                             │
│ Start Date*                 Team Size                       │
│ [📅 6 months ago    ]       [    8    ] users              │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ DATA VOLUMES                                                │
│                                                             │
│ Leads          Contacts        Companies                    │
│ [   2,000  ]   [     500  ]    [     200  ]                │
│                                                             │
│ Pipeline Value ($)           Closed-Won Value ($)           │
│ [     500,000     ]          [      150,000      ]         │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ▶ ADVANCED OPTIONS (collapsed by default)                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ PREVIEW                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Monthly Growth Projection                               │ │
│ │                                                         │ │
│ │ 600│          ╭──────●                                  │ │
│ │    │      ╭───╯                                         │ │
│ │ 400│  ╭───╯                                             │ │
│ │    │╭─╯                                                 │ │
│ │ 200│●                                                   │ │
│ │    └──────────────────────────────────────              │ │
│ │     Aug  Sep  Oct  Nov  Dec  Jan                        │ │
│ │                                                         │ │
│ │ Expected: 2,000 leads • 500 contacts • 200 companies    │ │
│ │           150 deals • $500K pipeline • $150K closed     │ │
│ │ Est. generation time: ~30 seconds                       │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                          [Cancel]  [Generate Demo Client]   │
└─────────────────────────────────────────────────────────────┘
```

#### Advanced Options (Collapsed Section)
```
│ ▼ ADVANCED OPTIONS                                          │
│                                                             │
│ Growth Model                                                │
│ ○ Linear  ● Exponential  ○ Logistic  ○ Step-up             │
│                                                             │
│ Monthly Growth Rate         Seasonality                     │
│ [    15    ] %              [✓] Apply weekday patterns      │
│                                                             │
│ Channel Attribution                                         │
│ SEO [====25%====]  Meta [===20%===]  Google [====25%====]  │
│ Affiliates [==15%==]  Referrals [=10%=]  Direct [5%]       │
│                                                             │
│ Realism Settings                                            │
│ Drop-off Rate [  20  ]%    Whale Ratio [   5  ]%           │
│ Response SLA  [   4  ] hours                               │
│                                                             │
│ Seed (for reproducibility)                                  │
│ [                    ] (leave empty for random)            │
```

#### Form Validation Rules
| Field | Validation | Error Message |
|-------|------------|---------------|
| Tenant Name | 3-100 chars, unique | "Name must be 3-100 characters" / "Name already exists" |
| Country | Required, valid ISO | "Please select a country" |
| Industry | Required | "Please select an industry" |
| Start Date | Not future, max 24mo | "Start date cannot be in the future" |
| Team Size | 2-50 | "Team size must be between 2 and 50" |
| Leads | 100-50,000 | "Leads must be between 100 and 50,000" |
| Pipeline Value | 10K-100M | "Pipeline value must be between $10,000 and $100,000,000" |

---

### 2.3 Generation Progress (Inline or Dialog)

```
┌─────────────────────────────────────────────────────────────┐
│ Generating Demo Client: "Meridian Trading Group"            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [████████████████████████████░░░░░░░░░░] 72%               │
│                                                             │
│ ✓ Created tenant profile                                    │
│ ✓ Created 8 team members                                    │
│ ✓ Created pipeline stages                                   │
│ ● Creating contacts... (1,456 / 2,000)                      │
│ ○ Creating companies                                        │
│ ○ Creating deals                                            │
│ ○ Creating activities                                       │
│                                                             │
│ Elapsed: 24s                                                │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.4 Job Detail Page (`/master/demo-generator/jobs/[jobId]`)

```
┌─────────────────────────────────────────────────────────────┐
│ MasterHeader: "Meridian Trading Group"                      │
│ Description: Demo tenant • Created 2 hours ago              │
│ [← Back to Generator]  [Login as Owner]  [Delete ▼]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │   Contacts   │ │    Deals     │ │  Pipeline $  │          │
│ │    2,156     │ │     187      │ │   $523,400   │          │
│ │  ▲ 8% above  │ │  ▲ 5% above  │ │  ▲ 5% above  │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ GROWTH OVER TIME                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                              Contacts ─── Deals ─ ─ ─   │ │
│ │  800│                      ╭─────●                      │ │
│ │     │                  ╭───╯                            │ │
│ │  600│              ╭───╯                                │ │
│ │     │          ╭───╯                                    │ │
│ │  400│      ╭───╯        ╭ ─ ─ ─ ●                       │ │
│ │     │  ╭───╯     ╭ ─ ─ ─╯                               │ │
│ │  200│──╯  ╭ ─ ─ ─╯                                      │ │
│ │     │─ ─ ─╯                                             │ │
│ │    0└──────────────────────────────────────             │ │
│ │      Aug   Sep   Oct   Nov   Dec   Jan                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ MONTHLY BREAKDOWN                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Month    │ Leads │ Contacts │ Deals │ Pipeline $        │ │
│ │ Jan 2026 │   412 │      105 │    32 │ $98,400           │ │
│ │ Dec 2025 │   356 │       89 │    28 │ $84,200           │ │
│ │ Nov 2025 │   310 │       76 │    24 │ $71,500           │ │
│ │ ...      │   ... │      ... │   ... │ ...               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ GENERATION CONFIG                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Country: United States (US)                             │ │
│ │ Industry: Trading                                       │ │
│ │ Start Date: August 1, 2025                              │ │
│ │ Growth Model: Exponential (15%/month)                   │ │
│ │ Seed: 8f3a2b1c-9d4e-5f6a-7b8c-9d0e1f2a3b4c             │ │
│ │                                                         │ │
│ │ Targets:                                                │ │
│ │ • Leads: 2,000 (actual: 2,156)                          │ │
│ │ • Contacts: 500 (actual: 523)                           │ │
│ │ • Pipeline: $500,000 (actual: $523,400)                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Industry Card (Quick Select)
```tsx
interface IndustryCardProps {
  industry: 'trading' | 'igaming' | 'saas' | 'ecommerce' | 'realestate' | 'finserv';
  icon: ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}
```

**States:**
- Default: Border gray-200, bg-white
- Hover: Border gray-300, shadow-sm
- Selected: Border-primary, bg-primary/5, ring-2

### 3.2 Country Select
- Uses flag emoji prefix
- Grouped by region (Americas, Europe, Asia-Pacific, Middle East)
- Search/filter enabled
- Auto-selects timezone and currency

### 3.3 Volume Input
- Number input with formatted display (1,000 → 1000)
- Slider for visual adjustment
- Min/max enforcement with error states
- Suffix label (e.g., "leads", "USD")

### 3.4 Growth Chart
- Recharts AreaChart
- Two series: Actual vs Target (if applicable)
- Tooltip with month details
- Responsive sizing

### 3.5 Status Badge
| Status | Color | Icon |
|--------|-------|------|
| Pending | Yellow | Clock |
| Generating | Blue | Loader (animated) |
| Completed | Green | CheckCircle |
| Failed | Red | XCircle |

---

## 4. Interaction Flows

### 4.1 Generate Demo Client Flow

```
1. User clicks "+ Generate Demo Client"
   └─→ Dialog opens with form

2. User selects industry template OR fills custom
   └─→ Form auto-fills defaults
   └─→ Preview updates with projections

3. User adjusts parameters as needed
   └─→ Real-time validation
   └─→ Preview recalculates

4. User clicks "Generate Demo Client"
   └─→ Dialog shows progress
   └─→ Backend creates tenant + data
   └─→ Progress bar updates

5. Generation completes
   └─→ Success toast
   └─→ List refreshes with new tenant
   └─→ Option to "View Details" or "Login"
```

### 4.2 Delete Demo Tenant Flow

```
1. User clicks "Delete" on row
   └─→ Confirmation dialog

2. Dialog: "Delete Demo Tenant?"
   "This will permanently delete 'Meridian Trading' and all its data.
    This action cannot be undone."
   [Cancel] [Delete Tenant]

3. User confirms
   └─→ Loading state
   └─→ Success toast
   └─→ Row removed from list
```

---

## 5. Responsive Behavior

### Desktop (>1024px)
- Full table with all columns
- Side-by-side form sections
- Large preview chart

### Tablet (768-1024px)
- Table hides Pipeline $ column
- Stacked form sections
- Medium preview chart

### Mobile (<768px)
- Card layout instead of table
- Single-column form
- Compact preview
- Bottom sheet for form

---

## 6. Accessibility

### Keyboard Navigation
- Tab through form fields in logical order
- Escape closes dialogs
- Enter submits form when valid
- Arrow keys navigate industry cards

### Screen Reader
- Form labels properly associated
- Progress announced at intervals
- Status changes announced
- Table has proper headers

### Color Contrast
- All text meets WCAG AA (4.5:1)
- Status badges have text labels, not just color
- Charts have patterns, not just colors

---

## 7. Error States

### Generation Failed
```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Generation Failed                                        │
│                                                             │
│ An error occurred while generating the demo tenant.         │
│                                                             │
│ Error: Database connection timeout                          │
│                                                             │
│ [View Logs]  [Retry]  [Cancel]                              │
└─────────────────────────────────────────────────────────────┘
```

### Validation Errors
- Inline errors below each field
- Red border on invalid fields
- Summary at top if multiple errors
- Focus moves to first error field

---

## 8. Loading States

### Initial Page Load
- Skeleton table with 5 rows
- Pulsing animation
- Header and tabs visible immediately

### Form Submission
- Button shows spinner + "Generating..."
- Form fields disabled
- Cancel button remains active

### Data Fetching
- Skeleton cards for stats
- Skeleton chart placeholder
- Progressive loading for job detail
