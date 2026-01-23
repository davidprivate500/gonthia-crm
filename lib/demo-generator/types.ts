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

// Country defaults
export interface CountryDefaults {
  timezone: string;
  currency: string;
}

export const COUNTRY_DEFAULTS: Record<string, CountryDefaults> = {
  US: { timezone: 'America/New_York', currency: 'USD' },
  GB: { timezone: 'Europe/London', currency: 'GBP' },
  UK: { timezone: 'Europe/London', currency: 'GBP' }, // Alias
  DE: { timezone: 'Europe/Berlin', currency: 'EUR' },
  FR: { timezone: 'Europe/Paris', currency: 'EUR' },
  JP: { timezone: 'Asia/Tokyo', currency: 'JPY' },
  BR: { timezone: 'America/Sao_Paulo', currency: 'BRL' },
  AE: { timezone: 'Asia/Dubai', currency: 'AED' },
  AU: { timezone: 'Australia/Sydney', currency: 'AUD' },
  CA: { timezone: 'America/Toronto', currency: 'CAD' },
  SG: { timezone: 'Asia/Singapore', currency: 'SGD' },
  HK: { timezone: 'Asia/Hong_Kong', currency: 'HKD' },
  CH: { timezone: 'Europe/Zurich', currency: 'CHF' },
  NL: { timezone: 'Europe/Amsterdam', currency: 'EUR' },
  ES: { timezone: 'Europe/Madrid', currency: 'EUR' },
  IT: { timezone: 'Europe/Rome', currency: 'EUR' },
  IN: { timezone: 'Asia/Kolkata', currency: 'INR' },
  MX: { timezone: 'America/Mexico_City', currency: 'MXN' },
};

// Default config values
export const DEFAULT_CONFIG: Partial<DemoGenerationConfig> = {
  teamSize: 8,
  targets: {
    leads: 2000,
    contacts: 500,
    companies: 200,
    pipelineValue: 500000,
    closedWonValue: 150000,
    closedWonCount: 100,
  },
  growth: {
    curve: 'exponential',
    monthlyRate: 15,
    seasonality: true,
  },
  channelMix: {
    seo: 25,
    meta: 20,
    google: 25,
    affiliates: 15,
    referrals: 10,
    direct: 5,
  },
  realism: {
    dropOffRate: 20,
    whaleRatio: 5,
    responseSlaHours: 4,
  },
};
