import type { DemoGenerationConfig, MonthPlan, MonthlyTargets, GrowthCurve } from '../types';

/**
 * Growth Planner - calculates how to distribute data across months
 * based on the growth model configuration
 */
export class GrowthPlanner {
  private config: DemoGenerationConfig;
  private startDate: Date;
  private endDate: Date;
  private months: MonthPlan[];

  constructor(config: DemoGenerationConfig) {
    this.config = config;
    this.startDate = new Date(config.startDate);
    this.endDate = new Date();

    // Validate dates
    if (this.startDate > this.endDate) {
      throw new Error('Start date cannot be in the future');
    }

    this.months = this.calculateMonths();
  }

  /**
   * Calculate all months between start and end dates
   */
  private calculateMonths(): MonthPlan[] {
    const months: MonthPlan[] = [];
    const current = new Date(this.startDate);
    current.setDate(1); // Start from first of month

    while (current <= this.endDate) {
      const startOfMonth = new Date(current);
      const endOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);

      months.push({
        year: current.getFullYear(),
        month: current.getMonth(),
        startDate: startOfMonth,
        endDate: endOfMonth > this.endDate ? this.endDate : endOfMonth,
      });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  /**
   * Get the number of months in the plan
   */
  getMonthCount(): number {
    return this.months.length;
  }

  /**
   * Get all months without targets
   */
  getMonths(): MonthPlan[] {
    return this.months;
  }

  /**
   * Generate the full plan with monthly targets
   */
  plan(): MonthlyTargets[] {
    const totalMonths = this.months.length;

    if (totalMonths === 0) {
      return [];
    }

    const { curve, monthlyRate, seasonality } = this.config.growth;

    // Calculate base weights per growth curve
    let weights = this.calculateWeights(totalMonths, curve, monthlyRate);

    // Apply seasonality adjustments if enabled
    if (seasonality) {
      weights = this.applySeasonality(weights);
    }

    // Normalize weights to sum to 1
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map((w) => w / totalWeight);

    // Distribute targets across months
    const { targets } = this.config;

    return this.months.map((month, index) => {
      const leads = Math.max(1, Math.round(targets.leads * normalizedWeights[index]));
      const contacts = Math.max(1, Math.round(targets.contacts * normalizedWeights[index]));

      return {
        ...month,
        targets: {
          // Ensure leads <= contacts (leads are a subset of contacts)
          leads: Math.min(leads, contacts),
          contacts,
          companies: Math.max(1, Math.round(targets.companies * normalizedWeights[index])),
          deals: Math.max(1, Math.round(targets.closedWonCount * normalizedWeights[index])),
          pipelineValue: targets.pipelineValue * normalizedWeights[index],
          closedWonValue: targets.closedWonValue * normalizedWeights[index],
        },
      };
    });
  }

  /**
   * Calculate weight for each month based on growth curve
   */
  private calculateWeights(n: number, curve: GrowthCurve, rate: number): number[] {
    switch (curve) {
      case 'linear':
        // Linear growth: equal base + slight increase per month
        return Array.from({ length: n }, (_, i) => 1 + (i * rate) / 100);

      case 'exponential':
        // Exponential growth: w_i = (1 + rate)^i
        return Array.from({ length: n }, (_, i) => Math.pow(1 + rate / 100, i));

      case 'logistic':
        // S-curve: slow start, rapid middle, plateau at end
        const midpoint = n / 2;
        const steepness = n / 6; // Controls how quickly it grows
        return Array.from({ length: n }, (_, i) => {
          const x = (i - midpoint) / steepness;
          return 1 / (1 + Math.exp(-x));
        });

      case 'step':
        // Step increases: jumps every 3 months
        return Array.from({ length: n }, (_, i) => Math.floor(i / 3) + 1);

      default:
        // Flat distribution
        return Array.from({ length: n }, () => 1);
    }
  }

  /**
   * Apply seasonality adjustments to weights
   * Simulates real business patterns (slower in certain months, etc.)
   */
  private applySeasonality(weights: number[]): number[] {
    return weights.map((weight, index) => {
      const month = this.months[index].month;

      // Seasonal multipliers by month (0 = January)
      const seasonalMultipliers: Record<number, number> = {
        0: 0.9, // January - slow start
        1: 0.95, // February
        2: 1.05, // March - Q1 push
        3: 1.0, // April
        4: 1.0, // May
        5: 1.1, // June - mid-year
        6: 0.85, // July - summer slowdown
        7: 0.85, // August - summer slowdown
        8: 1.1, // September - back to business
        9: 1.05, // October
        10: 1.0, // November
        11: 0.9, // December - holiday slowdown
      };

      return weight * (seasonalMultipliers[month] || 1);
    });
  }

  /**
   * Get a preview of monthly projections without full plan
   */
  preview(): Array<{
    month: string;
    leads: number;
    contacts: number;
    deals: number;
    pipelineValue: number;
    closedWonValue: number;
  }> {
    const plan = this.plan();

    return plan.map((month) => ({
      month: `${month.year}-${String(month.month + 1).padStart(2, '0')}`,
      leads: month.targets.leads,
      contacts: month.targets.contacts,
      deals: month.targets.deals,
      pipelineValue: Math.round(month.targets.pipelineValue),
      closedWonValue: Math.round(month.targets.closedWonValue),
    }));
  }

  /**
   * Estimate generation time based on total records
   */
  estimateGenerationTime(): number {
    const { targets } = this.config;
    const totalRecords =
      targets.leads +
      targets.contacts +
      targets.companies +
      targets.closedWonCount +
      targets.leads * 2 + // Estimated activities
      this.config.teamSize;

    // Rough estimate: 10,000 records per second
    const baseTime = totalRecords / 10000;

    // Add overhead for transactions, logging, etc.
    return Math.max(5, Math.ceil(baseTime * 1.5));
  }

  /**
   * Validate that the plan is feasible
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.months.length === 0) {
      errors.push('No months in the plan range');
    }

    if (this.months.length > 24) {
      errors.push('Maximum 24 months supported');
    }

    const { targets } = this.config;

    if (targets.leads < this.months.length) {
      errors.push('Leads count too low for number of months');
    }

    if (targets.leads > targets.contacts) {
      errors.push('Leads cannot exceed contacts - leads are a subset of contacts');
    }

    if (targets.closedWonValue > targets.pipelineValue) {
      errors.push('Closed won value cannot exceed pipeline value');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
