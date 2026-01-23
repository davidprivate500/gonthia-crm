// Base Localization Provider
// Separated to avoid circular dependency with provider implementations

import type { LocalizationProvider, IndustryType, AddressComponents } from '../types';
import { SeededRNG } from '../engine/rng';

/**
 * Base class for localization providers
 * Subclasses override data arrays and some methods
 */
export abstract class BaseLocalizationProvider implements LocalizationProvider {
  protected rng: SeededRNG;

  abstract country: string;
  abstract countryName: string;
  abstract timezone: string;
  abstract currency: string;
  abstract phonePrefix: string;

  // Data arrays - override in subclasses
  protected abstract firstNamesMale: string[];
  protected abstract firstNamesFemale: string[];
  protected abstract lastNames: string[];
  protected abstract cities: Array<{ name: string; state: string; postalCode: string }>;
  protected abstract streetTypes: string[];
  protected abstract companySuffixes: string[];
  protected abstract companyWords: string[];
  protected abstract emailDomains: string[];

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  firstName(gender?: 'male' | 'female'): string {
    const g = gender || (this.rng.bool() ? 'male' : 'female');
    const names = g === 'male' ? this.firstNamesMale : this.firstNamesFemale;
    return this.rng.pick(names);
  }

  lastName(): string {
    return this.rng.pick(this.lastNames);
  }

  fullName(gender?: 'male' | 'female'): string {
    return `${this.firstName(gender)} ${this.lastName()}`;
  }

  email(firstName: string, lastName: string, companyDomain?: string): string {
    const domain = companyDomain || this.rng.pick(this.emailDomains);
    const formats = [
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
      `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}`,
      `${firstName.toLowerCase()}`,
    ];
    const localPart = this.rng.pick(formats);
    // Add random number suffix sometimes to avoid duplicates
    const suffix = this.rng.bool(0.3) ? this.rng.int(1, 99) : '';
    return `${localPart}${suffix}@${domain}`.replace(/[^a-z0-9.@]/g, '');
  }

  abstract phone(): string;

  streetAddress(): string {
    const number = this.rng.int(1, 9999);
    const streetName = this.rng.pick(this.lastNames); // Use last names as street names
    const streetType = this.rng.pick(this.streetTypes);
    return `${number} ${streetName} ${streetType}`;
  }

  city(): string {
    return this.rng.pick(this.cities).name;
  }

  state(): string {
    return this.rng.pick(this.cities).state;
  }

  postalCode(): string {
    return this.rng.pick(this.cities).postalCode;
  }

  fullAddress(): AddressComponents {
    const cityData = this.rng.pick(this.cities);
    return {
      street: this.streetAddress(),
      city: cityData.name,
      state: cityData.state,
      postalCode: cityData.postalCode,
      country: this.countryName,
    };
  }

  companyName(industry?: IndustryType): string {
    // Generate company name based on industry or generic
    const patterns = this.getCompanyPatterns(industry);
    const pattern = this.rng.pick(patterns);
    return this.expandCompanyPattern(pattern);
  }

  protected getCompanyPatterns(_industry?: IndustryType): string[] {
    return [
      '{Word} {Suffix}',
      '{Word} {Word} {Suffix}',
      '{Name} {Suffix}',
      '{Word} Solutions {Suffix}',
      '{Word} Global {Suffix}',
      '{Name} & Associates',
    ];
  }

  protected expandCompanyPattern(pattern: string): string {
    return pattern
      .replace('{Word}', () => this.rng.pick(this.companyWords))
      .replace('{Word}', () => this.rng.pick(this.companyWords))
      .replace('{Name}', () => this.lastName())
      .replace('{Suffix}', () => this.companySuffix());
  }

  companySuffix(): string {
    return this.rng.pick(this.companySuffixes);
  }

  companyDomain(companyName: string): string {
    const clean = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    const tlds = ['com', 'io', 'co', 'net'];
    return `${clean}.${this.rng.pick(tlds)}`;
  }
}
