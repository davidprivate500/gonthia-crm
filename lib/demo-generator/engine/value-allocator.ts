/**
 * Value Allocator Service
 *
 * Generates deal values that sum to exact target totals while maintaining
 * realistic log-normal distribution with whale deals.
 */

import { SeededRNG } from './rng';

export interface ValueAllocation {
  values: number[];
  sum: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
}

export interface ValueConstraints {
  minValue: number;
  maxValue: number;
  avgValue: number;
  whaleRatio: number; // 0-1
}

export class ValueAllocator {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /**
   * Generate deal values that sum to the target total
   */
  allocateValues(
    count: number,
    targetTotal: number,
    constraints: ValueConstraints
  ): ValueAllocation {
    if (count === 0 || targetTotal === 0) {
      return {
        values: [],
        sum: 0,
        avgValue: 0,
        minValue: 0,
        maxValue: 0,
      };
    }

    const { minValue, maxValue, avgValue, whaleRatio } = constraints;

    // Generate initial values with log-normal distribution
    let values: number[] = [];
    const targetAvg = targetTotal / count;

    for (let i = 0; i < count; i++) {
      const isWhale = this.rng.bool(whaleRatio);

      let value: number;
      if (isWhale) {
        // Whale deals: upper portion of range
        const whaleMin = Math.max(avgValue * 1.5, targetAvg * 1.5);
        const whaleMax = maxValue;
        value = this.rng.float(whaleMin, whaleMax);
      } else {
        // Normal deals: log-normal around target average
        const logMean = Math.log(targetAvg);
        const logStd = 0.4; // Moderate variance
        value = this.rng.logNormal(logMean, logStd);

        // Clamp to reasonable range
        value = Math.max(minValue, Math.min(maxValue * 0.8, value));
      }

      values.push(value);
    }

    // Adjust values to hit exact target
    values = this.adjustToTarget(values, targetTotal, minValue, maxValue);

    // Calculate final stats
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      values,
      sum,
      avgValue: sum / count,
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }

  /**
   * Adjust values to sum to exact target while maintaining realistic distribution
   */
  private adjustToTarget(
    values: number[],
    target: number,
    minValue: number,
    maxValue: number
  ): number[] {
    if (values.length === 0) return values;

    // Round all values to 2 decimal places
    let adjusted = values.map(v => Math.round(v * 100) / 100);
    let currentSum = adjusted.reduce((a, b) => a + b, 0);
    let diff = target - currentSum;

    // If close enough, adjust the last value
    const threshold = 0.01 * target; // 1% tolerance for adjustment
    if (Math.abs(diff) < threshold) {
      const lastIdx = adjusted.length - 1;
      adjusted[lastIdx] = Math.round((adjusted[lastIdx] + diff) * 100) / 100;
      return adjusted;
    }

    // For larger differences, proportionally scale all values
    if (diff !== 0) {
      const scaleFactor = target / currentSum;

      adjusted = adjusted.map((v, i) => {
        if (i === adjusted.length - 1) {
          // Last value gets the remainder
          const others = adjusted.slice(0, -1).reduce((a, b) => a + b, 0);
          return Math.round((target - others * scaleFactor) * 100) / 100;
        }
        let scaled = v * scaleFactor;
        // Clamp to constraints
        scaled = Math.max(minValue, Math.min(maxValue, scaled));
        return Math.round(scaled * 100) / 100;
      });

      // Final adjustment pass
      currentSum = adjusted.reduce((a, b) => a + b, 0);
      diff = target - currentSum;

      if (Math.abs(diff) > 0.01) {
        // Distribute remaining difference across random values
        const diffPerValue = diff / adjusted.length;
        let remaining = diff;

        for (let i = 0; i < adjusted.length && Math.abs(remaining) > 0.01; i++) {
          const idx = this.rng.int(0, adjusted.length - 1);
          const adjustment = Math.min(Math.abs(remaining), Math.abs(diffPerValue) * 2);
          const sign = remaining > 0 ? 1 : -1;

          const newValue = adjusted[idx] + sign * adjustment;
          if (newValue >= minValue && newValue <= maxValue) {
            adjusted[idx] = Math.round(newValue * 100) / 100;
            remaining -= sign * adjustment;
          }
        }

        // Final catch: put remaining on the largest value
        if (Math.abs(remaining) > 0.01) {
          const maxIdx = adjusted.indexOf(Math.max(...adjusted));
          adjusted[maxIdx] = Math.round((adjusted[maxIdx] + remaining) * 100) / 100;
        }
      }
    }

    return adjusted;
  }

  /**
   * Allocate pipeline values to deals based on stage progression
   * Returns array of {dealIndex, value} for deals entering qualified+ stages
   */
  allocatePipelineValues(
    totalDeals: number,
    closedWonCount: number,
    pipelineValue: number,
    closedWonValue: number,
    constraints: ValueConstraints
  ): {
    closedWonValues: number[];
    pipelineValues: number[];
    openDealValues: number[];
  } {
    // Allocate closed won values
    const closedWonValues = this.allocateValues(
      closedWonCount,
      closedWonValue,
      constraints
    ).values;

    // Calculate remaining deals
    const remainingDeals = totalDeals - closedWonCount;
    const remainingPipelineValue = Math.max(0, pipelineValue - closedWonValue);

    // Split remaining into open deals and lost deals (roughly 50/50)
    const openDealCount = Math.ceil(remainingDeals * 0.6);
    const lostDealCount = remainingDeals - openDealCount;

    // Open deals contribute to pipeline
    const openDealValues = this.allocateValues(
      openDealCount,
      remainingPipelineValue,
      constraints
    ).values;

    // Lost deals don't need specific values, generate reasonable ones
    const lostDealValues: number[] = [];
    for (let i = 0; i < lostDealCount; i++) {
      lostDealValues.push(
        Math.round(this.rng.float(constraints.minValue, constraints.avgValue) * 100) / 100
      );
    }

    // Combine open and lost as "pipeline values"
    const pipelineValues = [...openDealValues, ...lostDealValues];

    return {
      closedWonValues,
      pipelineValues,
      openDealValues,
    };
  }

  /**
   * Generate a single deal value within constraints
   */
  generateSingleValue(constraints: ValueConstraints): number {
    const isWhale = this.rng.bool(constraints.whaleRatio);

    let value: number;
    if (isWhale) {
      value = this.rng.float(constraints.avgValue * 2, constraints.maxValue);
    } else {
      const logMean = Math.log(constraints.avgValue);
      value = this.rng.logNormal(logMean, 0.4);
      value = Math.max(constraints.minValue, Math.min(constraints.maxValue, value));
    }

    return Math.round(value * 100) / 100;
  }
}
