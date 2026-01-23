/**
 * Seeded Random Number Generator using Mulberry32 algorithm
 * Provides deterministic, reproducible random values
 */
export class SeededRNG {
  private state: number;

  constructor(seed: string | number) {
    // Convert string seed to number using hash
    this.state = typeof seed === 'string' ? this.hashString(seed) : seed;
    if (this.state === 0) this.state = 1; // Avoid zero state
  }

  /**
   * Hash a string to a 32-bit integer
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) || 1;
  }

  /**
   * Generate next random number using Mulberry32 algorithm
   * Returns a float between 0 (inclusive) and 1 (exclusive)
   */
  next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate a random float between min and max
   */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Pick multiple unique random elements from an array
   */
  pickMultiple<T>(array: T[], count: number): T[] {
    if (count > array.length) {
      throw new Error('Cannot pick more elements than array length');
    }
    const shuffled = this.shuffle([...array]);
    return shuffled.slice(0, count);
  }

  /**
   * Pick an element based on weighted probability
   */
  pickWeighted<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have same length');
    }
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }

    const total = weights.reduce((a, b) => a + b, 0);
    let random = this.next() * total;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }

    return items[items.length - 1];
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate a value following Pareto distribution
   * Useful for "80/20" distributions like deal values
   * @param min Minimum value
   * @param alpha Shape parameter (higher = more concentrated at min)
   */
  pareto(min: number, alpha: number = 1.5): number {
    const u = this.next();
    // Avoid division by zero
    const safeU = Math.max(u, 0.0001);
    return min / Math.pow(safeU, 1 / alpha);
  }

  /**
   * Generate a value following log-normal distribution
   * Useful for realistic monetary value distributions
   */
  logNormal(mean: number, stdDev: number): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
    return Math.exp(mean + stdDev * z);
  }

  /**
   * Generate a random boolean with given probability
   */
  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Generate a random date between start and end
   */
  date(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    if (startTime > endTime) {
      throw new Error('Start date must be before end date');
    }
    return new Date(this.int(startTime, endTime));
  }

  /**
   * Generate a random date during business hours (9am-6pm, Mon-Fri)
   */
  businessDate(start: Date, end: Date): Date {
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const date = this.date(start, end);
      const day = date.getDay();
      const hour = date.getHours();

      // Check if weekday (Mon-Fri = 1-5)
      if (day >= 1 && day <= 5) {
        // Adjust to business hours
        if (hour < 9) {
          date.setHours(9 + this.int(0, 3), this.int(0, 59), 0, 0);
        } else if (hour >= 18) {
          date.setHours(14 + this.int(0, 3), this.int(0, 59), 0, 0);
        }
        return date;
      }

      attempts++;
    }

    // Fallback: adjust the last generated date to Monday 9am
    const fallbackDate = this.date(start, end);
    const day = fallbackDate.getDay();
    const daysToAdd = day === 0 ? 1 : day === 6 ? 2 : 0;
    fallbackDate.setDate(fallbackDate.getDate() + daysToAdd);
    fallbackDate.setHours(9 + this.int(0, 3), this.int(0, 59), 0, 0);
    return fallbackDate;
  }

  /**
   * Generate a UUID-like string (not cryptographically secure)
   */
  uuid(): string {
    const hex = () => this.int(0, 15).toString(16);
    const segment = (len: number) => Array.from({ length: len }, hex).join('');
    return `${segment(8)}-${segment(4)}-4${segment(3)}-${['8', '9', 'a', 'b'][this.int(0, 3)]}${segment(3)}-${segment(12)}`;
  }

  /**
   * Generate a random string of specified length
   */
  string(length: number, charset: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    return Array.from({ length }, () => charset[this.int(0, charset.length - 1)]).join('');
  }

  /**
   * Generate a realistic deal value based on industry parameters
   * Uses a mix of distributions for whale deals vs normal deals
   */
  dealValue(
    minValue: number,
    maxValue: number,
    avgValue: number,
    whaleRatio: number = 0.05
  ): number {
    // Determine if this is a "whale" deal
    const isWhale = this.bool(whaleRatio);

    if (isWhale) {
      // Whale deals: upper 20% of range
      const whaleMin = avgValue * 2;
      const whaleMax = maxValue;
      return Math.round(this.float(whaleMin, whaleMax) * 100) / 100;
    } else {
      // Normal deals: log-normal around average
      const logMean = Math.log(avgValue);
      const logStd = 0.5; // Reasonable variance
      let value = this.logNormal(logMean, logStd);

      // Clamp to min/max
      value = Math.max(minValue, Math.min(maxValue, value));
      return Math.round(value * 100) / 100;
    }
  }

  /**
   * Create a deterministic child RNG with a different sequence
   * Useful for generating separate streams for different data types
   */
  child(suffix: string): SeededRNG {
    return new SeededRNG(`${this.state}-${suffix}`);
  }
}

/**
 * Generate a random seed string
 */
export function generateSeed(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}
