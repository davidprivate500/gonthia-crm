// Demo Generator Types

export type IndustryType = 'trading' | 'igaming' | 'saas' | 'ecommerce' | 'realestate' | 'finserv';
export type GrowthCurve = 'linear' | 'exponential' | 'logistic' | 'step';

export interface VolumeTargets {
  leads: number;
  contacts: number;
  companies: number;
  pipelineValue: number;
  closedWonValue: number;
  closedWonCount: number;
}

export interface GrowthConfig {
  curve: GrowthCurve;
  monthlyRate: number; // percentage
  seasonality: boolean;
}

export interface ChannelMix {
  seo: number;
  meta: number;
  google: number;
  affiliates: number;
  referrals: number;
  direct: number;
}

export interface RealismConfig {
  dropOffRate: number;
  whaleRatio: number;
  responseSlaHours: number;
}

export interface DemoGenerationConfig {
  // Tenant basics
  tenantName: string;
  country: string; // ISO 3166-1 alpha-2
  timezone: string; // IANA timezone
  currency: string; // ISO 4217
  industry: IndustryType;
  startDate: string; // ISO date
  teamSize: number;

  // Volume targets
  targets: VolumeTargets;

  // Growth model
  growth: GrowthConfig;

  // Attribution
  channelMix: ChannelMix;

  // Realism
  realism: RealismConfig;
}

export interface MonthPlan {
  year: number;
  month: number; // 0-11
  startDate: Date;
  endDate: Date;
}

export interface MonthlyTargets extends MonthPlan {
  targets: {
    leads: number;
    contacts: number;
    companies: number;
    deals: number;
    pipelineValue: number;
    closedWonValue: number;
  };
}

export interface GenerationMetrics {
  // Actual generated counts
  tenantId: string;
  users: number;
  contacts: number;
  companies: number;
  deals: number;
  activities: number;
  pipelineStages: number;
  tags: number;

  // Value totals
  totalPipelineValue: number;
  totalClosedWonValue: number;
  closedWonCount: number;

  // Monthly breakdown
  monthlyBreakdown: MonthlyMetrics[];
}

export interface MonthlyMetrics {
  month: string; // YYYY-MM
  leads: number;
  contacts: number;
  companies: number;
  deals: number;
  closedWonDeals: number;
  pipelineValue: number;
  closedWonValue: number;
}

export interface GenerationResult {
  tenantId: string;
  metrics: GenerationMetrics;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

// Industry Template Types

export interface PipelineStageTemplate {
  name: string;
  type: 'open' | 'won' | 'lost';
  probability: number; // 0-100
  avgDaysInStage: number;
  color?: string;
}

export interface IndustryTemplate {
  id: IndustryType;
  name: string;

  // Pipeline configuration
  pipeline: {
    name: string;
    stages: PipelineStageTemplate[];
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

// Localization Types

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface LocalizationProvider {
  country: string;
  countryName: string;

  // Defaults
  timezone: string;
  currency: string;
  phonePrefix: string;

  // Name generation
  firstName(gender?: 'male' | 'female'): string;
  lastName(): string;
  fullName(gender?: 'male' | 'female'): string;

  // Contact info
  email(firstName: string, lastName: string, companyDomain?: string): string;
  phone(): string;

  // Address
  streetAddress(): string;
  city(): string;
  state(): string;
  postalCode(): string;
  fullAddress(): AddressComponents;

  // Company
  companyName(industry?: IndustryType): string;
  companySuffix(): string;
  companyDomain(companyName: string): string;
}

// Preview Types

export interface PreviewResult {
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
}

// ============================================================================
// MONTHLY PLAN TYPES (for precise month-by-month control)
// ============================================================================

export type GenerationMode = 'growth-curve' | 'monthly-plan';

export interface MonthlyMetricTargets {
  leadsCreated: number;
  contactsCreated: number;
  companiesCreated: number;
  dealsCreated: number;
  closedWonCount: number;
  closedWonValue: number;
  pipelineAddedValue: number;
}

export interface MonthlyTarget {
  month: string; // "YYYY-MM" format (e.g., "2025-01")
  targets: MonthlyMetricTargets;
  overrides?: {
    avgDealSize?: number;
    winRate?: number;
    conversionRate?: number;
  };
}

export interface ToleranceConfig {
  countTolerance: number; // 0 for exact match
  valueTolerance: number; // 0.005 for ±0.5%
}

export interface MonthlyPlanMetadata {
  version: string;
  createdAt?: string;
  lastModifiedAt?: string;
}

export interface MonthlyPlan {
  months: MonthlyTarget[];
  tolerances: ToleranceConfig;
  metadata?: MonthlyPlanMetadata;
}

// Extended config that supports both modes
export interface DemoGenerationConfigV2 extends DemoGenerationConfig {
  mode: GenerationMode;
  monthlyPlan?: MonthlyPlan;
}

// Verification report types
export interface MetricVerificationResult {
  metric: keyof MonthlyMetricTargets;
  target: number;
  actual: number;
  diff: number;
  diffPercent: number;
  passed: boolean;
  tolerance: number;
}

export interface MonthVerificationResult {
  month: string;
  metrics: MetricVerificationResult[];
  passed: boolean;
}

export interface VerificationReport {
  jobId: string;
  tenantId: string;
  generatedAt: string;
  overallPassed: boolean;
  totalMetrics: number;
  passedMetrics: number;
  failedMetrics: number;
  months: MonthVerificationResult[];
  tolerances: ToleranceConfig;
}

// Plan validation types
export interface PlanValidationError {
  path: string;
  message: string;
  suggestion?: string;
}

export interface PlanValidationWarning {
  path: string;
  message: string;
}

export interface DerivedMetrics {
  totalContacts: number;
  totalLeads: number;
  totalCompanies: number;
  totalDeals: number;
  totalClosedWonCount: number;
  totalClosedWonValue: number;
  totalPipelineValue: number;
  avgDealSize: number;
  overallWinRate: number;
  avgMonthlyGrowth: number;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: PlanValidationError[];
  warnings: PlanValidationWarning[];
  derived?: DerivedMetrics;
  estimatedGenerationSeconds?: number;
}

// Runtime defaults are in ./defaults.ts to avoid circular dependencies

// ============================================================================
// PATCH TYPES (for incremental updates to existing demo tenants)
// ============================================================================

export type PatchMode = 'additive' | 'reconcile' | 'metrics-only';
export type PatchPlanType = 'targets' | 'deltas';

export interface PatchMetrics {
  leadsCreated?: number;
  contactsCreated?: number;
  companiesCreated?: number;
  dealsCreated?: number;
  closedWonCount?: number;
  closedWonValue?: number;
  pipelineAddedValue?: number;
  activitiesCreated?: number;
}

export interface PatchMonthTarget {
  month: string; // YYYY-MM
  metrics: PatchMetrics;
}

export interface PatchPlan {
  mode: PatchMode;
  planType: PatchPlanType;
  months: PatchMonthTarget[];
  tolerances?: ToleranceConfig;
  seed?: string;
}

export interface MonthlyKpiSnapshot {
  month: string;
  metrics: Required<PatchMetrics>;
  snapshotAt: string;
}

export interface KpiDiffEntry {
  metric: keyof PatchMetrics;
  before: number;
  after: number;
  delta: number;
  deltaPercent: number;
  target: number;
  passed: boolean;
}

export interface MonthlyKpiDiff {
  month: string;
  entries: KpiDiffEntry[];
  allPassed: boolean;
}

export interface PatchDiffReport {
  months: MonthlyKpiDiff[];
  overallPassed: boolean;
  totalMetrics: number;
  passedMetrics: number;
  failedMetrics: number;
}

export interface PatchPreview {
  computedDeltas: PatchMonthTarget[];
  estimatedRecords: {
    contacts: number;
    companies: number;
    deals: number;
    activities: number;
  };
  warnings: string[];
  blockers: string[];
  feasible: boolean;
}

export interface PatchJobMetrics {
  recordsCreated: number;
  recordsModified: number;
  recordsDeleted: number;
  byEntity: {
    contacts: { created: number; modified: number; deleted: number };
    companies: { created: number; modified: number; deleted: number };
    deals: { created: number; modified: number; deleted: number };
    activities: { created: number; modified: number; deleted: number };
  };
}

export interface PatchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  preview?: PatchPreview;
}
