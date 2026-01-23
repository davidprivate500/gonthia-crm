/**
 * Monthly Allocator Service
 *
 * Distributes monthly targets into daily buckets while maintaining exact totals.
 * Ensures business-realistic distribution (weekday preference, business hours).
 */

import { SeededRNG } from './rng';
import type { MonthlyPlan, MonthlyTarget, MonthlyMetricTargets } from '../types';

export interface DayAllocation {
  date: Date;
  dayOfWeek: number; // 0-6
  isBusinessDay: boolean;
  metrics: Partial<MonthlyMetricTargets>;
}

export interface MonthAllocation {
  month: string;
  startDate: Date;
  endDate: Date;
  totalBusinessDays: number;
  days: DayAllocation[];
  targets: MonthlyMetricTargets;
}

export interface AllocationPlan {
  months: MonthAllocation[];
  totalRecords: number;
}

// Weekday weights: Tue-Thu get more activity than Mon/Fri
const WEEKDAY_WEIGHTS: Record<number, number> = {
  0: 0,    // Sunday - no business
  1: 0.8,  // Monday - lighter
  2: 1.2,  // Tuesday - peak
  3: 1.2,  // Wednesday - peak
  4: 1.2,  // Thursday - peak
  5: 0.6,  // Friday - lightest
  6: 0,    // Saturday - no business
};

export class MonthlyAllocator {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /**
   * Create a full allocation plan from a monthly plan
   */
  createAllocationPlan(plan: MonthlyPlan): AllocationPlan {
    const months: MonthAllocation[] = [];
    let totalRecords = 0;

    for (const monthTarget of plan.months) {
      const allocation = this.allocateMonth(monthTarget);
      months.push(allocation);

      totalRecords += monthTarget.targets.contactsCreated +
                      monthTarget.targets.companiesCreated +
                      monthTarget.targets.dealsCreated;
    }

    return { months, totalRecords };
  }

  /**
   * Allocate targets for a single month to daily buckets
   */
  allocateMonth(monthTarget: MonthlyTarget): MonthAllocation {
    const [year, month] = monthTarget.month.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    const days: DayAllocation[] = [];
    const businessDays: DayAllocation[] = [];

    // Create day entries for the entire month
    for (let day = 1; day <= endDate.getDate(); day++) {
      const date = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone issues
      const dayOfWeek = date.getDay();
      const isBusinessDay = dayOfWeek >= 1 && dayOfWeek <= 5;

      const dayAlloc: DayAllocation = {
        date,
        dayOfWeek,
        isBusinessDay,
        metrics: {},
      };

      days.push(dayAlloc);
      if (isBusinessDay) {
        businessDays.push(dayAlloc);
      }
    }

    // Allocate each metric to business days
    const metrics: (keyof MonthlyMetricTargets)[] = [
      'contactsCreated',
      'leadsCreated',
      'companiesCreated',
      'dealsCreated',
      'closedWonCount',
      'closedWonValue',
      'pipelineAddedValue',
    ];

    for (const metric of metrics) {
      const total = monthTarget.targets[metric];
      this.distributeToBusinessDays(businessDays, metric, total);
    }

    return {
      month: monthTarget.month,
      startDate,
      endDate,
      totalBusinessDays: businessDays.length,
      days,
      targets: monthTarget.targets,
    };
  }

  /**
   * Distribute a metric total across business days with weighted distribution
   */
  private distributeToBusinessDays(
    days: DayAllocation[],
    metric: keyof MonthlyMetricTargets,
    total: number
  ): void {
    if (days.length === 0 || total === 0) {
      return;
    }

    // Calculate weights based on day of week
    const weights = days.map(d => WEEKDAY_WEIGHTS[d.dayOfWeek] || 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // For count metrics (integers)
    if (metric !== 'closedWonValue' && metric !== 'pipelineAddedValue') {
      let remaining = Math.round(total);
      const allocations: number[] = [];

      // Initial allocation based on weights
      for (let i = 0; i < days.length; i++) {
        const idealAlloc = (weights[i] / totalWeight) * total;
        // Add some variance
        const variance = this.rng.float(-0.3, 0.3) * idealAlloc;
        let alloc = Math.max(0, Math.round(idealAlloc + variance));
        allocations.push(alloc);
        remaining -= alloc;
      }

      // Distribute remaining (or reduce if over-allocated)
      while (remaining !== 0) {
        const idx = this.rng.int(0, days.length - 1);
        if (remaining > 0) {
          allocations[idx]++;
          remaining--;
        } else if (allocations[idx] > 0) {
          allocations[idx]--;
          remaining++;
        }
      }

      // Apply allocations
      for (let i = 0; i < days.length; i++) {
        days[i].metrics[metric] = allocations[i];
      }
    } else {
      // For value metrics (floats), distribute proportionally
      let remaining = total;
      const allocations: number[] = [];

      for (let i = 0; i < days.length - 1; i++) {
        const idealAlloc = (weights[i] / totalWeight) * total;
        const variance = this.rng.float(-0.2, 0.2) * idealAlloc;
        const alloc = Math.max(0, idealAlloc + variance);
        allocations.push(alloc);
        remaining -= alloc;
      }

      // Last day gets the remainder to ensure exact total
      allocations.push(Math.max(0, remaining));

      // Apply allocations
      for (let i = 0; i < days.length; i++) {
        days[i].metrics[metric] = allocations[i];
      }
    }
  }

  /**
   * Get all records to create for a specific day
   */
  getRecordsForDay(day: DayAllocation): {
    contacts: number;
    leads: number;
    companies: number;
    deals: number;
    closedWonDeals: number;
    closedWonValue: number;
    pipelineValue: number;
  } {
    return {
      contacts: Math.round(day.metrics.contactsCreated || 0),
      leads: Math.round(day.metrics.leadsCreated || 0),
      companies: Math.round(day.metrics.companiesCreated || 0),
      deals: Math.round(day.metrics.dealsCreated || 0),
      closedWonDeals: Math.round(day.metrics.closedWonCount || 0),
      closedWonValue: day.metrics.closedWonValue || 0,
      pipelineValue: day.metrics.pipelineAddedValue || 0,
    };
  }

  /**
   * Generate a business hours timestamp for a given day
   */
  generateTimestamp(date: Date): Date {
    const result = new Date(date);

    // Generate time between 9am and 6pm with peak around 10am-4pm
    const hour = this.generateBusinessHour();
    const minute = this.rng.int(0, 59);
    const second = this.rng.int(0, 59);

    result.setHours(hour, minute, second, 0);
    return result;
  }

  /**
   * Generate a business hour with realistic distribution
   * Peak hours: 10am-4pm
   */
  private generateBusinessHour(): number {
    // 80% of activity in core hours (10am-4pm)
    if (this.rng.bool(0.8)) {
      return this.rng.int(10, 16);
    } else {
      // 20% in early morning (9-10) or late afternoon (4-6)
      return this.rng.bool(0.5) ? 9 : this.rng.int(17, 18);
    }
  }

  /**
   * Flatten allocation plan to array of dated records
   */
  flattenToRecords(plan: AllocationPlan, type: 'contacts' | 'companies' | 'deals'): Array<{
    date: Date;
    month: string;
    count: number;
    isClosedWon?: boolean;
    closedWonValue?: number;
  }> {
    const records: Array<{
      date: Date;
      month: string;
      count: number;
      isClosedWon?: boolean;
      closedWonValue?: number;
    }> = [];

    for (const month of plan.months) {
      for (const day of month.days) {
        if (!day.isBusinessDay) continue;

        let count = 0;
        switch (type) {
          case 'contacts':
            count = Math.round(day.metrics.contactsCreated || 0);
            break;
          case 'companies':
            count = Math.round(day.metrics.companiesCreated || 0);
            break;
          case 'deals':
            count = Math.round(day.metrics.dealsCreated || 0);
            break;
        }

        if (count > 0) {
          records.push({
            date: day.date,
            month: month.month,
            count,
            isClosedWon: type === 'deals' ? (day.metrics.closedWonCount || 0) > 0 : undefined,
            closedWonValue: type === 'deals' ? (day.metrics.closedWonValue || 0) : undefined,
          });
        }
      }
    }

    return records;
  }
}
