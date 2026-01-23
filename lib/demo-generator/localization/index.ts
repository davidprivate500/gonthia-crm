import type { LocalizationProvider } from '../types';
import { SeededRNG } from '../engine/rng';
import { USProvider } from './providers/us';
import { UKProvider } from './providers/uk';
import { DEProvider } from './providers/de';

// Provider registry
const providers: Record<string, new (rng: SeededRNG) => LocalizationProvider> = {
  US: USProvider,
  GB: UKProvider,
  UK: UKProvider, // Alias
  DE: DEProvider,
};

/**
 * Get a localization provider for the given country
 * Falls back to US provider for unsupported countries
 */
export function getProvider(country: string, rng: SeededRNG): LocalizationProvider {
  const ProviderClass = providers[country.toUpperCase()] || USProvider;
  return new ProviderClass(rng);
}

/**
 * Check if a country has a dedicated provider
 */
export function hasProvider(country: string): boolean {
  return country.toUpperCase() in providers;
}

/**
 * Get list of supported countries
 */
export function getSupportedCountries(): string[] {
  return Object.keys(providers).filter((k) => k.length === 2 && k !== 'UK'); // Exclude UK alias
}

// Re-export base class from separate file to avoid circular dependency
export { BaseLocalizationProvider } from './base';

// Export providers
export { USProvider } from './providers/us';
export { UKProvider } from './providers/uk';
export { DEProvider } from './providers/de';
