/**
 * Plan Validator Service
 *
 * Validates monthly plans and returns structured results with errors, warnings,
 * and derived metrics.
 */

import type {
  MonthlyPlan,
  MonthlyTarget,
  PlanValidationResult,
  PlanValidationError,
  PlanValidationWarning,
  DerivedMetrics,
} from '../types';

export class PlanValidator {
  /**
   * Validate a monthly plan and return structured results
   */
  validate(plan: MonthlyPlan): PlanValidationResult {
    const errors: PlanValidationError[] = [];
    const warnings: PlanValidationWarning[] = [];

    // Basic structure validation
    if (!plan.months || plan.months.length === 0) {
      errors.push({
        path: 'months',
        message: 'At least one month is required',
        suggestion: 'Add at least one month to the plan',
      });
      return { valid: false, errors, warnings };
    }

    if (plan.months.length > 24) {
      errors.push({
        path: 'months',
        message: `Plan has ${plan.months.length} months, maximum is 24`,
        suggestion: 'Reduce the plan to 24 months or less',
      });
    }

    // Validate each month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let prevMonth = '';

    for (let i = 0; i < plan.months.length; i++) {
      const month = plan.months[i];
      this.validateMonth(month, i, currentMonth, prevMonth, errors, warnings);
      prevMonth = month.month;
    }

    // Check for unrealistic patterns
    this.checkGrowthPatterns(plan.months, warnings);

    // Calculate derived metrics
    const derived = this.calculateDerivedMetrics(plan.months);

    // Estimate generation time
    const totalRecords = derived.totalContacts + derived.totalCompanies + derived.totalDeals;
    const estimatedGenerationSeconds = Math.ceil(totalRecords / 100); // ~100 records/second

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      derived,
      estimatedGenerationSeconds,
    };
  }

  /**
   * Validate a single month's targets
   */
  private validateMonth(
    month: MonthlyTarget,
    index: number,
    currentMonth: string,
    prevMonth: string,
    errors: PlanValidationError[],
    warnings: PlanValidationWarning[]
  ): void {
    const basePath = `months[${index}]`;
    const { targets } = month;

    // Check month format
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.month)) {
      errors.push({
        path: `${basePath}.month`,
        message: `Invalid month format: ${month.month}`,
        suggestion: 'Use YYYY-MM format (e.g., 2025-01)',
      });
    }

    // Check not in future
    if (month.month > currentMonth) {
      errors.push({
        path: `${basePath}.month`,
        message: `Month ${month.month} is in the future`,
        suggestion: 'Use a month that is not in the future',
      });
    }

    // Check chronological order
    if (prevMonth && month.month <= prevMonth) {
      errors.push({
        path: `${basePath}.month`,
        message: `Months must be in chronological order`,
        suggestion: `${month.month} should come after ${prevMonth}`,
      });
    }

    // Validate non-negative values
    for (const [key, value] of Object.entries(targets)) {
      if (typeof value === 'number' && value < 0) {
        errors.push({
          path: `${basePath}.targets.${key}`,
          message: `${key} cannot be negative`,
          suggestion: 'Use 0 or a positive number',
        });
      }
    }

    // Logical constraints
    if (targets.leadsCreated > targets.contactsCreated) {
      errors.push({
        path: `${basePath}.targets.leadsCreated`,
        message: `Leads (${targets.leadsCreated}) cannot exceed contacts (${targets.contactsCreated})`,
        suggestion: 'Leads are a subset of contacts. Increase contacts or decrease leads.',
      });
    }

    if (targets.closedWonCount > targets.dealsCreated) {
      errors.push({
        path: `${basePath}.targets.closedWonCount`,
        message: `Closed won count (${targets.closedWonCount}) cannot exceed deals created (${targets.dealsCreated})`,
        suggestion: 'Increase deals created or decrease closed won count.',
      });
    }

    if (targets.closedWonValue > 0 && targets.closedWonCount === 0) {
      errors.push({
        path: `${basePath}.targets.closedWonValue`,
        message: `Cannot have closed won value without closed won deals`,
        suggestion: 'Set closedWonCount > 0 or closedWonValue = 0',
      });
    }

    // Warnings for unusual patterns
    if (targets.pipelineAddedValue > 0 && targets.pipelineAddedValue < targets.closedWonValue) {
      warnings.push({
        path: `${basePath}.targets.pipelineAddedValue`,
        message: `Pipeline added value (${targets.pipelineAddedValue}) is less than closed won value (${targets.closedWonValue}). This is unusual unless deals from previous months are closing.`,
      });
    }

    // Check for zero activity months
    const totalActivity = targets.contactsCreated + targets.dealsCreated;
    if (totalActivity === 0) {
      warnings.push({
        path: `${basePath}`,
        message: `Month ${month.month} has no contacts or deals. Consider removing this month or adding some activity.`,
      });
    }

    // Validate overrides if present
    if (month.overrides) {
      if (month.overrides.avgDealSize !== undefined && targets.closedWonCount > 0) {
        const impliedValue = month.overrides.avgDealSize * targets.closedWonCount;
        const diff = Math.abs(impliedValue - targets.closedWonValue) / targets.closedWonValue;
        if (diff > 0.1) {
          warnings.push({
            path: `${basePath}.overrides.avgDealSize`,
            message: `avgDealSize override implies $${impliedValue.toFixed(2)} total, but closedWonValue is $${targets.closedWonValue}. Consider adjusting.`,
          });
        }
      }

      if (month.overrides.winRate !== undefined && targets.dealsCreated > 0) {
        const impliedWon = Math.round(targets.dealsCreated * (month.overrides.winRate / 100));
        if (Math.abs(impliedWon - targets.closedWonCount) > 2) {
          warnings.push({
            path: `${basePath}.overrides.winRate`,
            message: `winRate override of ${month.overrides.winRate}% implies ~${impliedWon} won deals, but closedWonCount is ${targets.closedWonCount}.`,
          });
        }
      }
    }
  }

  /**
   * Check for unrealistic growth patterns
   */
  private checkGrowthPatterns(
    months: MonthlyTarget[],
    warnings: PlanValidationWarning[]
  ): void {
    if (months.length < 2) return;

    for (let i = 1; i < months.length; i++) {
      const prev = months[i - 1].targets;
      const curr = months[i].targets;

      // Check for extreme MoM growth (>200%)
      const metrics: (keyof typeof prev)[] = ['contactsCreated', 'dealsCreated', 'closedWonValue'];

      for (const metric of metrics) {
        const prevVal = prev[metric] as number;
        const currVal = curr[metric] as number;

        if (prevVal > 0) {
          const growth = ((currVal - prevVal) / prevVal) * 100;

          if (growth > 200) {
            warnings.push({
              path: `months[${i}].targets.${metric}`,
              message: `${metric} shows ${growth.toFixed(0)}% growth from ${months[i - 1].month} to ${months[i].month}. This is unusually high.`,
            });
          }

          if (growth < -50) {
            warnings.push({
              path: `months[${i}].targets.${metric}`,
              message: `${metric} shows ${Math.abs(growth).toFixed(0)}% decline from ${months[i - 1].month} to ${months[i].month}. Ensure this is intentional.`,
            });
          }
        }
      }
    }
  }

  /**
   * Calculate derived metrics from the plan
   */
  private calculateDerivedMetrics(months: MonthlyTarget[]): DerivedMetrics {
    let totalContacts = 0;
    let totalLeads = 0;
    let totalCompanies = 0;
    let totalDeals = 0;
    let totalClosedWonCount = 0;
    let totalClosedWonValue = 0;
    let totalPipelineValue = 0;

    for (const month of months) {
      totalContacts += month.targets.contactsCreated;
      totalLeads += month.targets.leadsCreated;
      totalCompanies += month.targets.companiesCreated;
      totalDeals += month.targets.dealsCreated;
      totalClosedWonCount += month.targets.closedWonCount;
      totalClosedWonValue += month.targets.closedWonValue;
      totalPipelineValue += month.targets.pipelineAddedValue;
    }

    // Calculate averages
    const avgDealSize = totalClosedWonCount > 0
      ? totalClosedWonValue / totalClosedWonCount
      : 0;

    const overallWinRate = totalDeals > 0
      ? (totalClosedWonCount / totalDeals) * 100
      : 0;

    // Calculate average monthly growth
    let avgMonthlyGrowth = 0;
    if (months.length > 1) {
      const growthRates: number[] = [];
      for (let i = 1; i < months.length; i++) {
        const prev = months[i - 1].targets.contactsCreated;
        const curr = months[i].targets.contactsCreated;
        if (prev > 0) {
          growthRates.push(((curr - prev) / prev) * 100);
        }
      }
      if (growthRates.length > 0) {
        avgMonthlyGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      }
    }

    return {
      totalContacts,
      totalLeads,
      totalCompanies,
      totalDeals,
      totalClosedWonCount,
      totalClosedWonValue,
      totalPipelineValue,
      avgDealSize,
      overallWinRate,
      avgMonthlyGrowth,
    };
  }

  /**
   * Quick validation check - returns true if valid
   */
  isValid(plan: MonthlyPlan): boolean {
    return this.validate(plan).valid;
  }
}

// Singleton instance
export const planValidator = new PlanValidator();
