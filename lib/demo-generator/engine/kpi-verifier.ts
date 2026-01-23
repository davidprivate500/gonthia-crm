/**
 * KPI Verifier Service
 *
 * Queries actual metrics from database and compares to targets
 * to generate verification reports.
 */

import { db } from '@/lib/db';
import { contacts, companies, deals, pipelineStages } from '@/drizzle/schema';
import { eq, and, gte, lt, sql, isNull } from 'drizzle-orm';
import type {
  MonthlyPlan,
  ToleranceConfig,
  VerificationReport,
  MonthVerificationResult,
  MetricVerificationResult,
  MonthlyMetricTargets,
} from '../types';

export interface ActualMonthlyMetrics {
  month: string;
  leadsCreated: number;
  contactsCreated: number;
  companiesCreated: number;
  dealsCreated: number;
  closedWonCount: number;
  closedWonValue: number;
  pipelineAddedValue: number;
}

export class KPIVerifier {
  private tenantId: string;
  private plan: MonthlyPlan;

  constructor(tenantId: string, plan: MonthlyPlan) {
    this.tenantId = tenantId;
    this.plan = plan;
  }

  /**
   * Query actual metrics from database and generate verification report
   */
  async verify(jobId: string): Promise<VerificationReport> {
    const actuals = await this.queryActualMetrics();
    return this.compareToTargets(jobId, actuals);
  }

  /**
   * Query all actual metrics from the database by month
   */
  async queryActualMetrics(): Promise<Map<string, ActualMonthlyMetrics>> {
    const result = new Map<string, ActualMonthlyMetrics>();

    // Initialize with zeros for each month in the plan
    for (const month of this.plan.months) {
      result.set(month.month, {
        month: month.month,
        leadsCreated: 0,
        contactsCreated: 0,
        companiesCreated: 0,
        dealsCreated: 0,
        closedWonCount: 0,
        closedWonValue: 0,
        pipelineAddedValue: 0,
      });
    }

    // Query contacts by month
    await this.queryContactMetrics(result);

    // Query companies by month
    await this.queryCompanyMetrics(result);

    // Query deals by month
    await this.queryDealMetrics(result);

    return result;
  }

  /**
   * Query contact metrics (total contacts and leads)
   */
  private async queryContactMetrics(result: Map<string, ActualMonthlyMetrics>): Promise<void> {
    for (const month of this.plan.months) {
      const [startDate, endDate] = this.getMonthDateRange(month.month);

      // Total contacts
      const contactCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, this.tenantId),
          gte(contacts.createdAt, startDate),
          lt(contacts.createdAt, endDate),
          isNull(contacts.deletedAt)
        ));

      // Leads (contacts with status='lead')
      const leadCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, this.tenantId),
          eq(contacts.status, 'lead'),
          gte(contacts.createdAt, startDate),
          lt(contacts.createdAt, endDate),
          isNull(contacts.deletedAt)
        ));

      const actuals = result.get(month.month);
      if (actuals) {
        actuals.contactsCreated = Number(contactCountResult[0]?.count || 0);
        actuals.leadsCreated = Number(leadCountResult[0]?.count || 0);
      }
    }
  }

  /**
   * Query company metrics
   */
  private async queryCompanyMetrics(result: Map<string, ActualMonthlyMetrics>): Promise<void> {
    for (const month of this.plan.months) {
      const [startDate, endDate] = this.getMonthDateRange(month.month);

      const companyCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(and(
          eq(companies.tenantId, this.tenantId),
          gte(companies.createdAt, startDate),
          lt(companies.createdAt, endDate),
          isNull(companies.deletedAt)
        ));

      const actuals = result.get(month.month);
      if (actuals) {
        actuals.companiesCreated = Number(companyCountResult[0]?.count || 0);
      }
    }
  }

  /**
   * Query deal metrics (total deals, closed won count/value, pipeline value)
   */
  private async queryDealMetrics(result: Map<string, ActualMonthlyMetrics>): Promise<void> {
    // First, get won stage IDs for this tenant
    const wonStages = await db
      .select({ id: pipelineStages.id })
      .from(pipelineStages)
      .where(and(
        eq(pipelineStages.tenantId, this.tenantId),
        eq(pipelineStages.isWon, true)
      ));

    const wonStageIds = wonStages.map(s => s.id);

    for (const month of this.plan.months) {
      const [startDate, endDate] = this.getMonthDateRange(month.month);

      // Total deals created
      const dealCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(deals)
        .where(and(
          eq(deals.tenantId, this.tenantId),
          gte(deals.createdAt, startDate),
          lt(deals.createdAt, endDate),
          isNull(deals.deletedAt)
        ));

      // Closed won deals and value
      let closedWonCount = 0;
      let closedWonValue = 0;

      if (wonStageIds.length > 0) {
        const closedWonResult = await db
          .select({
            count: sql<number>`count(*)`,
            total: sql<number>`coalesce(sum(cast(${deals.value} as numeric)), 0)`,
          })
          .from(deals)
          .where(and(
            eq(deals.tenantId, this.tenantId),
            sql`${deals.stageId} = ANY(${wonStageIds})`,
            gte(deals.createdAt, startDate),
            lt(deals.createdAt, endDate),
            isNull(deals.deletedAt)
          ));

        closedWonCount = Number(closedWonResult[0]?.count || 0);
        closedWonValue = Number(closedWonResult[0]?.total || 0);
      }

      // Pipeline value (all deals not lost)
      const lostStages = await db
        .select({ id: pipelineStages.id })
        .from(pipelineStages)
        .where(and(
          eq(pipelineStages.tenantId, this.tenantId),
          eq(pipelineStages.isLost, true)
        ));

      const lostStageIds = lostStages.map(s => s.id);

      const pipelineResult = await db
        .select({
          total: sql<number>`coalesce(sum(cast(${deals.value} as numeric)), 0)`,
        })
        .from(deals)
        .where(and(
          eq(deals.tenantId, this.tenantId),
          lostStageIds.length > 0
            ? sql`${deals.stageId} != ALL(${lostStageIds})`
            : sql`1=1`,
          gte(deals.createdAt, startDate),
          lt(deals.createdAt, endDate),
          isNull(deals.deletedAt)
        ));

      const actuals = result.get(month.month);
      if (actuals) {
        actuals.dealsCreated = Number(dealCountResult[0]?.count || 0);
        actuals.closedWonCount = closedWonCount;
        actuals.closedWonValue = closedWonValue;
        actuals.pipelineAddedValue = Number(pipelineResult[0]?.total || 0);
      }
    }
  }

  /**
   * Compare actual metrics to targets and generate verification report
   */
  private compareToTargets(
    jobId: string,
    actuals: Map<string, ActualMonthlyMetrics>
  ): VerificationReport {
    const tolerances = this.plan.tolerances;
    const months: MonthVerificationResult[] = [];
    let totalPassed = 0;
    let totalFailed = 0;

    for (const target of this.plan.months) {
      const actual = actuals.get(target.month);
      if (!actual) continue;

      const metrics: MetricVerificationResult[] = [
        this.verifyMetric('leadsCreated', target.targets.leadsCreated, actual.leadsCreated, tolerances, true),
        this.verifyMetric('contactsCreated', target.targets.contactsCreated, actual.contactsCreated, tolerances, true),
        this.verifyMetric('companiesCreated', target.targets.companiesCreated, actual.companiesCreated, tolerances, true),
        this.verifyMetric('dealsCreated', target.targets.dealsCreated, actual.dealsCreated, tolerances, true),
        this.verifyMetric('closedWonCount', target.targets.closedWonCount, actual.closedWonCount, tolerances, true),
        this.verifyMetric('closedWonValue', target.targets.closedWonValue, actual.closedWonValue, tolerances, false),
        this.verifyMetric('pipelineAddedValue', target.targets.pipelineAddedValue, actual.pipelineAddedValue, tolerances, false),
      ];

      const passed = metrics.every(m => m.passed);
      totalPassed += metrics.filter(m => m.passed).length;
      totalFailed += metrics.filter(m => !m.passed).length;

      months.push({
        month: target.month,
        metrics,
        passed,
      });
    }

    return {
      jobId,
      tenantId: this.tenantId,
      generatedAt: new Date().toISOString(),
      overallPassed: totalFailed === 0,
      totalMetrics: totalPassed + totalFailed,
      passedMetrics: totalPassed,
      failedMetrics: totalFailed,
      months,
      tolerances,
    };
  }

  /**
   * Verify a single metric against its target
   */
  private verifyMetric(
    metric: keyof MonthlyMetricTargets,
    target: number,
    actual: number,
    tolerances: ToleranceConfig,
    isCount: boolean
  ): MetricVerificationResult {
    const diff = actual - target;
    const diffPercent = target > 0 ? (diff / target) * 100 : (actual > 0 ? 100 : 0);
    const tolerance = isCount ? tolerances.countTolerance : tolerances.valueTolerance;

    // For count metrics, tolerance is absolute; for value metrics, it's percentage
    const toleranceAmount = isCount ? tolerance : tolerance * target;
    const passed = Math.abs(diff) <= toleranceAmount;

    return {
      metric,
      target,
      actual,
      diff,
      diffPercent,
      passed,
      tolerance,
    };
  }

  /**
   * Get the start and end date for a month string (YYYY-MM)
   */
  private getMonthDateRange(month: string): [Date, Date] {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, m, 1, 0, 0, 0)); // First day of next month
    return [startDate, endDate];
  }
}

/**
 * Generate a verification report for a completed job
 */
export async function verifyGeneratedData(
  tenantId: string,
  jobId: string,
  plan: MonthlyPlan
): Promise<VerificationReport> {
  const verifier = new KPIVerifier(tenantId, plan);
  return verifier.verify(jobId);
}
