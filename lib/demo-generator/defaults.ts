// Demo Generator Default Values
// Separated from types.ts to avoid circular dependency issues

import type { DemoGenerationConfig } from './types';

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
