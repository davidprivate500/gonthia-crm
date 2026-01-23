// Demo Generator Module - Main Entry Point

export { DemoGenerator } from './engine/generator';
export { SeededRNG, generateSeed } from './engine/rng';
export { GrowthPlanner } from './engine/growth-planner';
export { getProvider, getSupportedCountries, hasProvider } from './localization';
export { getTemplate, getAllTemplates, getTemplateIds } from './templates';

export * from './types';

// Config helpers
import { DEFAULT_CONFIG, COUNTRY_DEFAULTS, type DemoGenerationConfig } from './types';

// Input type that allows partial nested objects (from Zod schemas)
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Fill in default values for a partial config
 */
export function mergeWithDefaults(partial: DeepPartial<DemoGenerationConfig>): DemoGenerationConfig {
  const country = partial.country || 'US';
  const countryDefaults = COUNTRY_DEFAULTS[country] || COUNTRY_DEFAULTS.US;

  return {
    tenantName: partial.tenantName || generateTenantName(partial.industry || 'trading'),
    country,
    timezone: partial.timezone || countryDefaults.timezone,
    currency: partial.currency || countryDefaults.currency,
    industry: partial.industry || 'trading',
    startDate: partial.startDate || getDefaultStartDate(),
    teamSize: partial.teamSize || DEFAULT_CONFIG.teamSize!,
    targets: {
      ...DEFAULT_CONFIG.targets!,
      ...partial.targets,
    },
    growth: {
      ...DEFAULT_CONFIG.growth!,
      ...partial.growth,
    },
    channelMix: {
      ...DEFAULT_CONFIG.channelMix!,
      ...partial.channelMix,
    },
    realism: {
      ...DEFAULT_CONFIG.realism!,
      ...partial.realism,
    },
  };
}

/**
 * Generate a default tenant name based on industry
 */
function generateTenantName(industry: string): string {
  const words = {
    trading: ['Meridian', 'Apex', 'Summit', 'Vanguard', 'Horizon', 'Atlas', 'Prime', 'Capital'],
    igaming: ['Lucky', 'Royal', 'Golden', 'Diamond', 'Crystal', 'Star', 'Crown', 'Elite'],
    saas: ['CloudFlow', 'DataSync', 'NexGen', 'TechWave', 'InnoSoft', 'ByteForce', 'CodeStream'],
    ecommerce: ['ShopNow', 'BuyDirect', 'FastMart', 'EasyStore', 'QuickShop', 'DealHub'],
    realestate: ['HomeFind', 'PropertyMax', 'RealtyPro', 'EstateFirst', 'LandMark', 'PrimePlaces'],
    finserv: ['WealthWise', 'CapitalFirst', 'TrustFund', 'MoneyFlow', 'FinanceHub', 'InvestPro'],
  };

  const suffixes = {
    trading: ['Trading', 'Capital', 'Markets', 'Investments'],
    igaming: ['Casino', 'Gaming', 'Play', 'Bet'],
    saas: ['Tech', 'Systems', 'Solutions', 'Labs'],
    ecommerce: ['Store', 'Market', 'Shop', 'Direct'],
    realestate: ['Realty', 'Properties', 'Homes', 'Estate'],
    finserv: ['Financial', 'Capital', 'Advisors', 'Wealth'],
  };

  const industryWords = words[industry as keyof typeof words] || words.trading;
  const industrySuffixes = suffixes[industry as keyof typeof suffixes] || suffixes.trading;

  const randomWord = industryWords[Math.floor(Math.random() * industryWords.length)];
  const randomSuffix = industrySuffixes[Math.floor(Math.random() * industrySuffixes.length)];

  return `${randomWord} ${randomSuffix} Group`;
}

/**
 * Get default start date (6 months ago)
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().split('T')[0];
}

/**
 * Estimate generation time based on config
 */
export function estimateGenerationTime(config: DeepPartial<DemoGenerationConfig>): number {
  const merged = mergeWithDefaults(config);
  const totalRecords =
    merged.targets.leads +
    merged.targets.contacts +
    merged.targets.companies +
    merged.targets.closedWonCount +
    merged.targets.leads * 2 + // activities
    merged.teamSize;

  // 10,000 records/sec baseline
  const baseTime = totalRecords / 10000;
  return Math.max(5, Math.ceil(baseTime * 1.5));
}
