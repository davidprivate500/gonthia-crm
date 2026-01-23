# UX Design Specification: Demo Client Generator v3 - Patching System

## 1. Overview

### 1.1 Design Goals
- **Discoverable**: Master Admin easily finds patch functionality for demo tenants
- **Safe**: Clear warnings before destructive operations; ADDITIVE mode is default
- **Efficient**: Quick plan entry with CSV paste and helper tools
- **Informative**: Clear before/after comparisons and progress feedback

### 1.2 User Flow Summary
```
Demo Generator → Select Tenant → Monthly Updates Tab → Configure Patch → Preview → Apply → View Results
```

---

## 2. Navigation & Information Architecture

### 2.1 Entry Points

**Primary Path:**
```
Master Admin Dashboard
  └── Demo Generator (sidebar)
        └── [Tenant List View]
              └── Click tenant row → Tenant Detail View
                    └── "Monthly Updates" tab
```

**Secondary Path:**
```
Demo Generator Jobs List
  └── Click completed job row
        └── "Patch This Tenant" button (if tenant still exists)
```

### 2.2 Tab Structure (Tenant Detail View)

```
┌────────────────────────────────────────────────────────────┐
│ ← Back to Tenants    Acme Corp Demo    [Delete Tenant]     │
├────────────────────────────────────────────────────────────┤
│ [Overview]  [Monthly Updates]  [Patch History]  [Settings] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                    Tab Content Area                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

| Tab | Purpose |
|-----|---------|
| **Overview** | Tenant summary, total metrics, generation info |
| **Monthly Updates** | KPI visualization + patch application |
| **Patch History** | List of previous patch jobs for this tenant |
| **Settings** | Tenant metadata, demo flags |

---

## 3. Screen Designs

### 3.1 Monthly Updates Tab - Main View

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Monthly Updates                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ Current Data Summary ────────────────────────────────────────────────┐  │
│ │ Data Range: Jan 2024 - Dec 2024 (12 months)                          │  │
│ │ Total Records: 1,247 contacts | 312 companies | 89 deals             │  │
│ │ Total Pipeline: $1.2M | Closed Won: $456K                            │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Monthly KPI Chart ───────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │  160 ┤                                           ████                │  │
│ │  140 ┤                                     ████  ████                │  │
│ │  120 ┤                               ████  ████  ████                │  │
│ │  100 ┤                         ████  ████  ████  ████                │  │
│ │   80 ┤                   ████  ████  ████  ████  ████                │  │
│ │   60 ┤             ████  ████  ████  ████  ████  ████                │  │
│ │   40 ┤       ████  ████  ████  ████  ████  ████  ████                │  │
│ │   20 ┤ ████  ████  ████  ████  ████  ████  ████  ████                │  │
│ │    0 ├─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────                │  │
│ │        Jan  Feb  Mar  Apr  May  Jun  Jul  Aug                        │  │
│ │                                                                       │  │
│ │  Legend: ▓ Contacts  ░ Deals  ▒ Companies                            │  │
│ │  Metric: [Contacts ▼]  Show Values: [✓]                              │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Monthly KPI Table ───────────────────────────────────────────────────┐  │
│ │ Month    │ Leads │ Contacts │ Companies │ Deals │ Won │ Won Value   │  │
│ │──────────┼───────┼──────────┼───────────┼───────┼─────┼─────────────│  │
│ │ 2024-01  │  45   │    58    │    12     │   8   │  3  │   $25,000   │  │
│ │ 2024-02  │  52   │    67    │    14     │   9   │  4  │   $32,500   │  │
│ │ 2024-03  │  61   │    78    │    16     │  11   │  4  │   $38,000   │  │
│ │ ...      │  ...  │   ...    │   ...     │  ...  │ ... │    ...      │  │
│ │ TOTAL    │ 587   │   752    │   156     │  89   │ 34  │  $456,000   │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─────────────────────────────────────────────────────────────────────┐    │
│ │                    [+ Add Monthly Update]                           │    │
│ └─────────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Patch Configuration Panel (Expanded)

Clicking "+ Add Monthly Update" expands the configuration panel:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Add Monthly Update                                                    [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ Patch Configuration ─────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │ Mode:             Plan Type:           Date Range:                    │  │
│ │ ┌───────────────┐ ┌───────────────┐   ┌─────────┐   ┌─────────┐      │  │
│ │ │ ○ ADDITIVE    │ │ ○ DELTAS      │   │Jan 2025▼│to │Mar 2025▼│      │  │
│ │ │   (add only)  │ │   (add these  │   └─────────┘   └─────────┘      │  │
│ │ │               │ │    amounts)   │                                   │  │
│ │ │ ○ RECONCILE   │ │               │   Months: 3                      │  │
│ │ │   (disabled)  │ │ ○ TARGETS     │                                   │  │
│ │ │               │ │   (reach these│                                   │  │
│ │ └───────────────┘ │    totals)    │                                   │  │
│ │                   └───────────────┘                                   │  │
│ │                                                                       │  │
│ │ ⓘ ADDITIVE mode only creates new records. Existing data is never    │  │
│ │   modified or deleted.                                               │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Patch Plan Grid ─────────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │ [Quick Fill ▼] [Paste CSV] [Clear]                                   │  │
│ │                                                                       │  │
│ │ Month    │ Leads │Contacts│Companies│ Deals │ Won# │ Won$ │Pipeline$│  │
│ │──────────┼───────┼────────┼─────────┼───────┼──────┼──────┼─────────│  │
│ │ 2025-01  │ [50 ] │ [ 40 ] │ [ 10  ] │ [ 8 ] │ [ 3] │[25k ]│ [ 75k ]│  │
│ │ 2025-02  │ [60 ] │ [ 48 ] │ [ 12  ] │ [10 ] │ [ 4] │[32k ]│ [ 96k ]│  │
│ │ 2025-03  │ [70 ] │ [ 56 ] │ [ 14  ] │ [12 ] │ [ 5] │[40k ]│ [120k ]│  │
│ │──────────┼───────┼────────┼─────────┼───────┼──────┼──────┼─────────│  │
│ │ TOTALS   │  180  │  144   │   36    │  30   │  12  │ 97k  │  291k  │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Quick Fill Options ──────────────────────────────────────────────────┐  │
│ │ ○ Copy from last month's actuals                                     │  │
│ │ ○ Apply +10% monthly growth                                          │  │
│ │ ○ Match monthly average                                              │  │
│ │ ○ Custom formula...                                                  │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│               [Cancel]    [Preview Changes]    [Apply Patch]               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Preview Panel

After clicking "Preview Changes":

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Preview Changes                                                       [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ Validation Status ───────────────────────────────────────────────────┐  │
│ │ ✓ Plan is valid and can be applied                                   │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ What Will Be Created ────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │ Entity     │ Jan 2025 │ Feb 2025 │ Mar 2025 │  Total                 │  │
│ │────────────┼──────────┼──────────┼──────────┼────────                │  │
│ │ Contacts   │    40    │    48    │    56    │   144                  │  │
│ │ Companies  │    10    │    12    │    14    │    36                  │  │
│ │ Deals      │     8    │    10    │    12    │    30                  │  │
│ │ Activities │    80    │    96    │   112    │   288                  │  │
│ │────────────┼──────────┼──────────┼──────────┼────────                │  │
│ │ TOTAL      │   138    │   166    │   194    │   498                  │  │
│ │                                                                       │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Value Summary ───────────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │ Closed Won Value to Add:  $97,000                                    │  │
│ │ Pipeline Value to Add:    $291,000                                   │  │
│ │                                                                       │  │
│ │ After patch:                                                         │  │
│ │   Total Closed Won: $456,000 → $553,000 (+21%)                       │  │
│ │   Total Pipeline:   $744,000 → $1,035,000 (+39%)                     │  │
│ │                                                                       │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Warnings ────────────────────────────────────────────────────────────┐  │
│ │ ⚠ March growth (25%) exceeds typical monthly rate                    │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ Estimated execution time: ~45 seconds                                      │
│                                                                            │
│                      [Back]              [Apply Patch]                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Validation Errors (If Invalid)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Preview Changes                                                       [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ Validation Failed ───────────────────────────────────────────────────┐  │
│ │ ✗ Plan cannot be applied in current mode                             │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Errors ──────────────────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │ ✗ January 2025: closedWonCount (5) exceeds dealsCreated (3)          │  │
│ │   → Suggestion: Increase dealsCreated to at least 5                  │  │
│ │                                                                       │  │
│ │ ✗ February 2025: Cannot reduce contactsCreated in ADDITIVE mode      │  │
│ │   → Current: 67, Target: 50 (delta: -17)                             │  │
│ │   → Suggestion: Set target to at least 67 or use RECONCILE mode      │  │
│ │                                                                       │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Warnings ────────────────────────────────────────────────────────────┐  │
│ │ ⚠ March pipeline value is 3x closed won value (typical: 2-2.5x)      │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│                             [Back to Edit]                                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Patch Execution Progress

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Applying Patch...                                                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Job ID: patch_abc123                                                       │
│ Started: 2:34:15 PM                                                        │
│                                                                            │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │ ████████████████████████████████░░░░░░░░░░░░  67%                    │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ Current Step: Creating deals for March 2025...                             │
│                                                                            │
│ ┌─ Progress Log ────────────────────────────────────────────────────────┐  │
│ │ 2:34:15 [INFO]  Starting patch job patch_abc123                      │  │
│ │ 2:34:16 [INFO]  Taking KPI snapshot (before)                         │  │
│ │ 2:34:18 [INFO]  KPI snapshot complete                                │  │
│ │ 2:34:18 [INFO]  Computing deltas...                                  │  │
│ │ 2:34:19 [INFO]  Creating entities for January 2025 (138 records)     │  │
│ │ 2:34:25 [INFO]  January 2025 complete                                │  │
│ │ 2:34:25 [INFO]  Creating entities for February 2025 (166 records)    │  │
│ │ 2:34:32 [INFO]  February 2025 complete                               │  │
│ │ 2:34:32 [INFO]  Creating entities for March 2025 (194 records)       │  │
│ │ ▌                                                                    │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ⚠ Do not close this window. The patch is running in the background.       │
│   You can navigate away and return to check status.                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.6 Patch Results

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Patch Complete                                                        [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ Summary ─────────────────────────────────────────────────────────────┐  │
│ │ Status: ✓ Completed Successfully                                     │  │
│ │ Duration: 45 seconds                                                 │  │
│ │ Job ID: patch_abc123                                                 │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Records Created ─────────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │  │
│ │ │   144   │  │    36   │  │    30   │  │   288   │                   │  │
│ │ │Contacts │  │Companies│  │  Deals  │  │Activities│                   │  │
│ │ └─────────┘  └─────────┘  └─────────┘  └─────────┘                   │  │
│ │                                                                       │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ KPI Comparison ──────────────────────────────────────────────────────┐  │
│ │                                                                       │  │
│ │ January 2025                                                         │  │
│ │ Metric      │ Target │ Before │ After │ Delta  │ Status              │  │
│ │─────────────┼────────┼────────┼───────┼────────┼─────────────────────│  │
│ │ Leads       │   50   │   0    │  50   │  +50   │ ✓ Met               │  │
│ │ Contacts    │   40   │   0    │  40   │  +40   │ ✓ Met               │  │
│ │ Companies   │   10   │   0    │  10   │  +10   │ ✓ Met               │  │
│ │ Deals       │    8   │   0    │   8   │   +8   │ ✓ Met               │  │
│ │ Won Count   │    3   │   0    │   3   │   +3   │ ✓ Met               │  │
│ │ Won Value   │  $25k  │  $0    │ $25k  │ +$25k  │ ✓ Met               │  │
│ │                                                                       │  │
│ │ February 2025                                                        │  │
│ │ Metric      │ Target │ Before │ After │ Delta  │ Status              │  │
│ │─────────────┼────────┼────────┼───────┼────────┼─────────────────────│  │
│ │ Leads       │   60   │   0    │  60   │  +60   │ ✓ Met               │  │
│ │ ...                                                                  │  │
│ │                                                                       │  │
│ │ [Show All Months ▼]                                                  │  │
│ │                                                                       │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌─ Overall Result ──────────────────────────────────────────────────────┐  │
│ │ ✓ All 21 metrics met targets within tolerance                        │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│           [View Tenant]    [Export Report]    [Close]                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Specifications

### 4.1 Patch Plan Grid

**Component:** `PatchPlanGrid`

**Props:**
```typescript
interface PatchPlanGridProps {
  months: PatchMonthTarget[];
  onChange: (months: PatchMonthTarget[]) => void;
  planType: 'targets' | 'deltas';
  currentKpis?: MonthlyKpiSnapshot[]; // For TARGETS mode comparison
  disabled?: boolean;
}
```

**Features:**
- Editable cells for each metric
- Tab navigation between cells
- Auto-format currency values
- Row totals
- Column validation (highlights invalid cells)
- Keyboard shortcuts (Ctrl+V for paste)

### 4.2 KPI Chart

**Component:** `TenantKpiChart`

**Props:**
```typescript
interface TenantKpiChartProps {
  kpis: MonthlyKpiSnapshot[];
  selectedMetric: keyof PatchMetrics;
  onMetricChange: (metric: keyof PatchMetrics) => void;
  highlightMonths?: string[]; // Months being patched
}
```

**Features:**
- Stacked bar chart (Recharts)
- Metric selector dropdown
- Hover tooltips with values
- Highlight overlay for patch months

### 4.3 Patch Preview

**Component:** `PatchPreview`

**Props:**
```typescript
interface PatchPreviewProps {
  preview: PatchPreview;
  onBack: () => void;
  onApply: () => void;
  isApplying: boolean;
}
```

**Features:**
- Validation status banner (success/error)
- Record creation summary table
- Value change summary
- Warnings list
- Estimated time display

### 4.4 Patch Job Results

**Component:** `PatchJobResults`

**Props:**
```typescript
interface PatchJobResultsProps {
  job: DemoPatchJob;
  onClose: () => void;
  onViewTenant: () => void;
  onExportReport: () => void;
}
```

**Features:**
- Summary cards (records created)
- Expandable KPI comparison per month
- Pass/fail indicators
- Export to PDF/CSV

---

## 5. Interaction Patterns

### 5.1 Date Range Selection

**Behavior:**
1. Default: Next 3 months from current date
2. Start month cannot be before tenant creation date
3. End month cannot be in the future (warn only)
4. Maximum range: 24 months
5. Changing range updates grid rows automatically

### 5.2 CSV Paste

**Format:**
```csv
month,leadsCreated,contactsCreated,companiesCreated,dealsCreated,closedWonCount,closedWonValue,pipelineAddedValue
2025-01,50,40,10,8,3,25000,75000
2025-02,60,48,12,10,4,32000,96000
```

**Behavior:**
1. Detect paste in grid or via "Paste CSV" button
2. Parse CSV, validate columns
3. Show confirmation with parsed data preview
4. On confirm, populate grid
5. Show toast on parse errors

### 5.3 Quick Fill

**Options:**
| Option | Behavior |
|--------|----------|
| Copy from last month | Uses most recent month's actuals as base for all months |
| +10% growth | Takes first month's values, applies compound growth |
| Match average | Uses average of all existing months |
| Custom formula | Opens modal with formula builder |

### 5.4 Validation Feedback

**Timing:**
- On blur (cell level)
- On change (row level - cross-field validation)
- On Preview click (full validation)

**Visual Indicators:**
- Red border: Invalid cell
- Orange border: Warning (valid but unusual)
- Tooltip on hover: Explanation

---

## 6. Error States

### 6.1 Tenant Not Found

```
┌───────────────────────────────────────────────┐
│ ⚠ Tenant Not Found                            │
│                                               │
│ The demo tenant you're looking for doesn't    │
│ exist or has been deleted.                    │
│                                               │
│ [← Back to Demo Generator]                    │
└───────────────────────────────────────────────┘
```

### 6.2 Not a Demo Tenant

```
┌───────────────────────────────────────────────┐
│ ✗ Cannot Patch This Tenant                    │
│                                               │
│ This tenant was not created by the Demo       │
│ Generator and cannot be patched.              │
│                                               │
│ Only demo-generated tenants can receive       │
│ monthly updates.                              │
│                                               │
│ [← Back]                                      │
└───────────────────────────────────────────────┘
```

### 6.3 Patch Failed

```
┌───────────────────────────────────────────────┐
│ ✗ Patch Failed                                │
│                                               │
│ An error occurred while applying the patch.   │
│ No data was modified.                         │
│                                               │
│ Error: Database connection timeout            │
│                                               │
│ Job ID: patch_abc123                          │
│                                               │
│ [View Logs]  [Retry]  [Close]                 │
└───────────────────────────────────────────────┘
```

---

## 7. Responsive Behavior

### 7.1 Desktop (≥1024px)
- Full grid visible
- Side-by-side chart and table
- All columns in grid

### 7.2 Tablet (768px - 1023px)
- Chart above table
- Grid scrolls horizontally
- Condensed column headers

### 7.3 Mobile (<768px)
- Not officially supported for patching
- Show message: "Patch operations require desktop view"
- KPI viewing only

---

## 8. Accessibility

### 8.1 Keyboard Navigation
- Tab: Move between cells
- Enter: Confirm cell edit
- Escape: Cancel cell edit
- Ctrl+V: Paste CSV
- Arrow keys: Navigate grid

### 8.2 Screen Reader
- All charts have text alternatives
- Status announcements for validation
- Progress updates announced

### 8.3 Color Contrast
- All status colors meet WCAG AA
- Icons paired with text labels
- Error states not color-only

---

## 9. Toast Messages

| Event | Type | Message |
|-------|------|---------|
| Patch started | Info | "Patch job started. This may take a moment." |
| Patch complete | Success | "Patch complete! 498 records created." |
| Patch failed | Error | "Patch failed. No data was modified." |
| CSV parsed | Success | "CSV imported: 3 months of data" |
| CSV error | Error | "Could not parse CSV. Check format." |
| Validation passed | Success | "Plan validated successfully" |
| Validation failed | Error | "Plan has errors. Please review." |
