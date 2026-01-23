/**
 * KPI Aggregator - Queries actual metrics per month for any tenant
 *
 * Used for:
 * - Taking KPI snapshots before/after patch operations
 * - Computing diffs between snapshots
 * - Validating patch targets against current state
 */

import { db, contacts, companies, deals, activities, pipelineStages } from '@/lib/db';
import { eq, and, gte, lt, sql, inArray, isNull } from 'drizzle-orm';
import type {
  MonthlyKpiSnapshot,
  PatchMetrics,
  KpiDiffEntry,
  MonthlyKpiDiff,
  PatchDiffReport,
  ToleranceConfig,
  PatchMonthTarget,
} from '../types';

interface AggregatedMetrics {
  leadsCreated: number;
  contactsCreated: number;
  companiesCreated: number;
  dealsCreated: number;
  closedWonCount: number;
  closedWonValue: number;
  pipelineAddedValue: number;
  activitiesCreated: number;
}

function emptyMetrics(): AggregatedMetrics {
  return {
    leadsCreated: 0,
    contactsCreated: 0,
    companiesCreated: 0,
    dealsCreated: 0,
    closedWonCount: 0,
    closedWonValue: 0,
    pipelineAddedValue: 0,
    activitiesCreated: 0,
  };
}

/**
 * Get month start and end dates for a YYYY-MM string
 */
function getMonthRange(month: string): { start: Date; end: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0)); // First day of next month
  return { start, end };
}

/**
 * Generate array of YYYY-MM strings between from and to (inclusive)
 */
function generateMonthRange(fromMonth: string, toMonth: string): string[] {
  const months: string[] = [];
  const [fromYear, fromM] = fromMonth.split('-').map(Number);
  const [toYear, toM] = toMonth.split('-').map(Number);

  let year = fromYear;
  let month = fromM;

  while (year < toYear || (year === toYear && month <= toM)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

export class KpiAggregator {
  private tenantId: string;
  private wonStageIds: string[] = [];
  private lostStageIds: string[] = [];
  private pipelineLoaded = false;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Load pipeline stages to identify won/lost stages
   */
  private async loadPipeline(): Promise<void> {
    if (this.pipelineLoaded) return;

    const stages = await db
      .select({
        id: pipelineStages.id,
        isWon: pipelineStages.isWon,
        isLost: pipelineStages.isLost,
      })
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.tenantId, this.tenantId),
          isNull(pipelineStages.deletedAt)
        )
      );

    this.wonStageIds = stages.filter(s => s.isWon).map(s => s.id);
    this.lostStageIds = stages.filter(s => s.isLost).map(s => s.id);
    this.pipelineLoaded = true;
  }

  /**
   * Query KPIs for a range of months
   */
  async queryMonthlyKpis(fromMonth: string, toMonth: string): Promise<MonthlyKpiSnapshot[]> {
    await this.loadPipeline();

    const months = generateMonthRange(fromMonth, toMonth);
    const snapshots: MonthlyKpiSnapshot[] = [];
    const now = new Date().toISOString();

    for (const month of months) {
      const metrics = await this.queryMonthMetrics(month);
      snapshots.push({
        month,
        metrics,
        snapshotAt: now,
      });
    }

    return snapshots;
  }

  /**
   * Query all metrics for a single month
   */
  private async queryMonthMetrics(month: string): Promise<Required<PatchMetrics>> {
    const { start, end } = getMonthRange(month);

    const [contactMetrics, companyMetrics, dealMetrics, activityMetrics] = await Promise.all([
      this.queryContactMetrics(start, end),
      this.queryCompanyMetrics(start, end),
      this.queryDealMetrics(start, end),
      this.queryActivityMetrics(start, end),
    ]);

    return {
      leadsCreated: contactMetrics.leads,
      contactsCreated: contactMetrics.total,
      companiesCreated: companyMetrics.total,
      dealsCreated: dealMetrics.total,
      closedWonCount: dealMetrics.closedWonCount,
      closedWonValue: dealMetrics.closedWonValue,
      pipelineAddedValue: dealMetrics.pipelineValue,
      activitiesCreated: activityMetrics.total,
    };
  }

  /**
   * Query contact metrics for a date range
   */
  private async queryContactMetrics(
    start: Date,
    end: Date
  ): Promise<{ total: number; leads: number }> {
    // Total contacts
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, this.tenantId),
          gte(contacts.createdAt, start),
          lt(contacts.createdAt, end),
          isNull(contacts.deletedAt)
        )
      );

    // Leads only
    const leadsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, this.tenantId),
          eq(contacts.status, 'lead'),
          gte(contacts.createdAt, start),
          lt(contacts.createdAt, end),
          isNull(contacts.deletedAt)
        )
      );

    return {
      total: totalResult[0]?.count ?? 0,
      leads: leadsResult[0]?.count ?? 0,
    };
  }

  /**
   * Query company metrics for a date range
   */
  private async queryCompanyMetrics(start: Date, end: Date): Promise<{ total: number }> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, this.tenantId),
          gte(companies.createdAt, start),
          lt(companies.createdAt, end),
          isNull(companies.deletedAt)
        )
      );

    return { total: result[0]?.count ?? 0 };
  }

  /**
   * Query deal metrics for a date range
   */
  private async queryDealMetrics(
    start: Date,
    end: Date
  ): Promise<{
    total: number;
    closedWonCount: number;
    closedWonValue: number;
    pipelineValue: number;
  }> {
    // Total deals created in period
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deals)
      .where(
        and(
          eq(deals.tenantId, this.tenantId),
          gte(deals.createdAt, start),
          lt(deals.createdAt, end),
          isNull(deals.deletedAt)
        )
      );

    // Closed won metrics (deals created in period that are in won stages)
    let closedWonCount = 0;
    let closedWonValue = 0;

    if (this.wonStageIds.length > 0) {
      const wonResult = await db
        .select({
          count: sql<number>`count(*)::int`,
          value: sql<number>`coalesce(sum(cast(${deals.value} as numeric)), 0)::float`,
        })
        .from(deals)
        .where(
          and(
            eq(deals.tenantId, this.tenantId),
            inArray(deals.stageId, this.wonStageIds),
            gte(deals.createdAt, start),
            lt(deals.createdAt, end),
            isNull(deals.deletedAt)
          )
        );

      closedWonCount = wonResult[0]?.count ?? 0;
      closedWonValue = wonResult[0]?.value ?? 0;
    }

    // Pipeline value (all non-lost deals created in period)
    let pipelineValue = 0;

    if (this.lostStageIds.length > 0) {
      // Has lost stages - exclude them
      const pipelineResult = await db
        .select({
          value: sql<number>`coalesce(sum(cast(${deals.value} as numeric)), 0)::float`,
        })
        .from(deals)
        .where(
          and(
            eq(deals.tenantId, this.tenantId),
            sql`${deals.stageId} != ALL(ARRAY[${sql.join(
              this.lostStageIds.map(id => sql`${id}::uuid`),
              sql`, `
            )}])`,
            gte(deals.createdAt, start),
            lt(deals.createdAt, end),
            isNull(deals.deletedAt)
          )
        );

      pipelineValue = pipelineResult[0]?.value ?? 0;
    } else {
      // No lost stages - include all
      const pipelineResult = await db
        .select({
          value: sql<number>`coalesce(sum(cast(${deals.value} as numeric)), 0)::float`,
        })
        .from(deals)
        .where(
          and(
            eq(deals.tenantId, this.tenantId),
            gte(deals.createdAt, start),
            lt(deals.createdAt, end),
            isNull(deals.deletedAt)
          )
        );

      pipelineValue = pipelineResult[0]?.value ?? 0;
    }

    return {
      total: totalResult[0]?.count ?? 0,
      closedWonCount,
      closedWonValue,
      pipelineValue,
    };
  }

  /**
   * Query activity metrics for a date range
   */
  private async queryActivityMetrics(start: Date, end: Date): Promise<{ total: number }> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(activities)
      .where(
        and(
          eq(activities.tenantId, this.tenantId),
          gte(activities.createdAt, start),
          lt(activities.createdAt, end),
          isNull(activities.deletedAt)
        )
      );

    return { total: result[0]?.count ?? 0 };
  }

  /**
   * Create a complete KPI snapshot for specified months
   */
  async createSnapshot(months: string[]): Promise<MonthlyKpiSnapshot[]> {
    if (months.length === 0) return [];

    const sortedMonths = [...months].sort();
    return this.queryMonthlyKpis(sortedMonths[0], sortedMonths[sortedMonths.length - 1]);
  }

  /**
   * Compute diff between before and after snapshots
   */
  computeDiff(
    before: MonthlyKpiSnapshot[],
    after: MonthlyKpiSnapshot[],
    targets: PatchMonthTarget[],
    tolerances: ToleranceConfig
  ): PatchDiffReport {
    const months: MonthlyKpiDiff[] = [];
    let totalMetrics = 0;
    let passedMetrics = 0;
    let failedMetrics = 0;

    for (const target of targets) {
      const beforeSnapshot = before.find(s => s.month === target.month);
      const afterSnapshot = after.find(s => s.month === target.month);

      if (!afterSnapshot) continue;

      const entries: KpiDiffEntry[] = [];
      let monthAllPassed = true;

      for (const [metricKey, targetValue] of Object.entries(target.metrics)) {
        if (targetValue === undefined) continue;

        const metric = metricKey as keyof PatchMetrics;
        const beforeValue = beforeSnapshot?.metrics[metric] ?? 0;
        const afterValue = afterSnapshot.metrics[metric] ?? 0;
        const delta = afterValue - beforeValue;
        const deltaPercent = beforeValue > 0 ? (delta / beforeValue) * 100 : (afterValue > 0 ? 100 : 0);

        // Determine tolerance based on metric type
        const isValueMetric = metric === 'closedWonValue' || metric === 'pipelineAddedValue';
        const tolerance = isValueMetric ? tolerances.valueTolerance : tolerances.countTolerance;

        // Check if target is met within tolerance
        let passed: boolean;
        if (isValueMetric) {
          // Value tolerance is a percentage (e.g., 0.005 = 0.5%)
          const allowedDiff = Math.abs(targetValue) * tolerance;
          passed = Math.abs(afterValue - (beforeValue + targetValue)) <= allowedDiff;
        } else {
          // Count tolerance is absolute (e.g., 0 = exact match, 1 = off by 1)
          passed = Math.abs(afterValue - (beforeValue + targetValue)) <= tolerance;
        }

        totalMetrics++;
        if (passed) {
          passedMetrics++;
        } else {
          failedMetrics++;
          monthAllPassed = false;
        }

        entries.push({
          metric,
          before: beforeValue,
          after: afterValue,
          delta,
          deltaPercent,
          target: targetValue,
          passed,
        });
      }

      months.push({
        month: target.month,
        entries,
        allPassed: monthAllPassed,
      });
    }

    return {
      months,
      overallPassed: failedMetrics === 0,
      totalMetrics,
      passedMetrics,
      failedMetrics,
    };
  }
}

/**
 * Factory function to create a KPI aggregator for a tenant
 */
export function createKpiAggregator(tenantId: string): KpiAggregator {
  return new KpiAggregator(tenantId);
}
