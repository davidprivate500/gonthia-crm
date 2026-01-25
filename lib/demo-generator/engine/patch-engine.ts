/**
 * Patch Engine - Orchestrates patch execution for demo tenants
 *
 * Execution flow:
 * 1. Load job and tenant context
 * 2. Validate (fail fast)
 * 3. Snapshot before
 * 4. Execute within transaction
 * 5. Snapshot after
 * 6. Generate diff report
 * 7. Update job with results
 */

import { db, demoPatchJobs, contacts, companies, deals, activities, users, pipelineStages, tags, demoTenantMetadata } from '@/lib/db';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { KpiAggregator } from './kpi-aggregator';
import { computeDeltas, generatePreview } from './patch-validator';
import { MonthlyAllocator } from './monthly-allocator';
import { ValueAllocator } from './value-allocator';
import { SeededRNG } from './rng';
import type {
  PatchPlan,
  PatchMonthTarget,
  PatchMetrics,
  MonthlyKpiSnapshot,
  PatchDiffReport,
  PatchJobMetrics,
  LogEntry,
  ToleranceConfig,
} from '../types';
import type { DemoPatchJob, User, PipelineStage, Tag, Company, Contact } from '@/drizzle/schema';
import { getProvider } from '../localization';
import { getTemplate } from '../templates';
import type { IndustryType, LocalizationProvider, IndustryTemplate } from '../types';

interface PatchContext {
  tenantId: string;
  patchJobId: string;
  users: User[];
  wonStageIds: string[];
  lostStageIds: string[];
  openStageIds: string[];
  tags: Tag[];
  rng: SeededRNG;
  localization: LocalizationProvider;
  template: IndustryTemplate;
  currency: string;
}

interface DayAllocation {
  date: Date;
  month: string;
  metrics: {
    leadsCreated: number;
    contactsCreated: number;
    companiesCreated: number;
    dealsCreated: number;
    closedWonCount: number;
    closedWonValue: number;
    pipelineAddedValue: number;
    activitiesCreated: number;
  };
}

export class PatchEngine {
  private jobId: string;
  private job: DemoPatchJob | null = null;
  private ctx: PatchContext | null = null;
  private metrics: PatchJobMetrics = {
    recordsCreated: 0,
    recordsModified: 0,
    recordsDeleted: 0,
    byEntity: {
      contacts: { created: 0, modified: 0, deleted: 0 },
      companies: { created: 0, modified: 0, deleted: 0 },
      deals: { created: 0, modified: 0, deleted: 0 },
      activities: { created: 0, modified: 0, deleted: 0 },
    },
  };

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  /**
   * Execute the patch job
   */
  async execute(): Promise<void> {
    try {
      console.log(`[PatchEngine] Starting execute() for job ${this.jobId}`);

      // Load job
      await this.loadJob();
      if (!this.job) {
        throw new Error(`Patch job ${this.jobId} not found`);
      }
      console.log(`[PatchEngine] Job loaded: ${this.job.id}, status: ${this.job.status}`);

      // Check idempotency - if already completed, return early
      if (this.job.status === 'completed') {
        await this.log('info', 'Job already completed. Returning cached results.');
        return;
      }

      // Mark as running
      await this.updateStatus('running', 0, 'Initializing');
      await this.log('info', `Starting patch job ${this.jobId}`);
      console.log(`[PatchEngine] Status updated to running`);

      // Load context
      console.log(`[PatchEngine] Loading context for tenant ${this.job.tenantId}`);
      await this.loadContext();
      await this.updateProgress(5, 'Context loaded');
      console.log(`[PatchEngine] Context loaded successfully`);

      // Parse plan
      const plan = this.job.patchPlanJson as PatchPlan;
      const tolerances: ToleranceConfig = (this.job.toleranceConfig as ToleranceConfig) ?? {
        countTolerance: 0,
        valueTolerance: 0.005,
      };

      // Take before snapshot
      await this.log('info', 'Taking KPI snapshot (before)');
      const kpiAggregator = new KpiAggregator(this.job.tenantId);
      const beforeKpis = await kpiAggregator.queryMonthlyKpis(
        this.job.rangeStartMonth,
        this.job.rangeEndMonth
      );
      await this.updateProgress(15, 'Before snapshot complete');

      // Store before KPIs
      await db.update(demoPatchJobs)
        .set({ beforeKpisJson: beforeKpis })
        .where(eq(demoPatchJobs.id, this.jobId));

      // Compute deltas
      await this.log('info', 'Computing deltas');
      const { deltas, blockers } = computeDeltas(plan, beforeKpis);

      // In additive mode, blockers are hard stops. In reconcile mode, we handle negative deltas.
      if (plan.mode === 'additive' && blockers.length > 0) {
        throw new Error(`Patch blocked: ${blockers.join('; ')}`);
      }

      await this.updateProgress(20, 'Deltas computed');

      // Check idempotency - verify no records exist with this job ID
      const existingCount = await this.checkExistingRecords();
      if (existingCount > 0) {
        await this.log('warn', `Idempotency detected: ${existingCount} records already exist for this job`);
        // Continue to after snapshot to get current state
      } else {
        // RECONCILE MODE: Execute deletions first for negative deltas
        if (plan.mode === 'reconcile') {
          console.log(`[PatchEngine] Reconcile mode: starting deletions`);
          await this.log('info', 'Reconcile mode: executing deletions for negative deltas');
          await this.executeReconcileDeletions(plan, beforeKpis);
          await this.updateProgress(40, 'Deletions complete');
          console.log(`[PatchEngine] Reconcile mode: deletions complete`);
        }

        // Execute additions (positive deltas)
        await this.log('info', 'Executing patch (additions)');
        await this.executePatch(deltas);
      }

      await this.updateProgress(80, 'Patch execution complete');

      // Take after snapshot
      await this.log('info', 'Taking KPI snapshot (after)');
      const afterKpis = await kpiAggregator.queryMonthlyKpis(
        this.job.rangeStartMonth,
        this.job.rangeEndMonth
      );
      await this.updateProgress(90, 'After snapshot complete');

      // Compute diff report
      const diffReport = kpiAggregator.computeDiff(
        beforeKpis,
        afterKpis,
        plan.months,
        tolerances
      );

      // Update job with results
      await db.update(demoPatchJobs)
        .set({
          afterKpisJson: afterKpis,
          diffReportJson: diffReport,
          metricsJson: this.metrics,
          status: 'completed',
          progress: 100,
          currentStep: 'Complete',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(demoPatchJobs.id, this.jobId));

      await this.log('info', `Patch completed. ${this.metrics.recordsCreated} records created.`);

      if (!diffReport.overallPassed) {
        await this.log('warn', `KPI verification: ${diffReport.failedMetrics}/${diffReport.totalMetrics} metrics failed`);
      }
    } catch (error) {
      await this.handleError(error);
      throw error;
    }
  }

  /**
   * Load job from database
   */
  private async loadJob(): Promise<void> {
    const jobs = await db.select()
      .from(demoPatchJobs)
      .where(eq(demoPatchJobs.id, this.jobId))
      .limit(1);

    this.job = jobs[0] ?? null;
  }

  /**
   * Load tenant context (users, pipeline, tags)
   */
  private async loadContext(): Promise<void> {
    if (!this.job) throw new Error('Job not loaded');

    // Get tenant metadata for industry/country
    const metadata = await db.query.demoTenantMetadata.findFirst({
      where: eq(demoTenantMetadata.tenantId, this.job.tenantId),
    });

    if (!metadata) {
      throw new Error('Tenant metadata not found');
    }

    // Load users
    const tenantUsers = await db.select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, this.job.tenantId),
          isNull(users.deletedAt)
        )
      );

    if (tenantUsers.length === 0) {
      throw new Error('No active users found for tenant');
    }

    // Load pipeline stages
    const stages = await db.select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.tenantId, this.job.tenantId),
          isNull(pipelineStages.deletedAt)
        )
      );

    if (stages.length === 0) {
      throw new Error('No pipeline stages found for tenant');
    }

    const wonStageIds = stages.filter(s => s.isWon).map(s => s.id);
    const lostStageIds = stages.filter(s => s.isLost).map(s => s.id);
    const openStageIds = stages.filter(s => !s.isWon && !s.isLost).map(s => s.id);

    // Load tags
    const tenantTags = await db.select()
      .from(tags)
      .where(
        and(
          eq(tags.tenantId, this.job.tenantId),
          isNull(tags.deletedAt)
        )
      );

    // Initialize RNG
    const rng = new SeededRNG(this.job.seed);

    // Get localization and template
    const localization = getProvider(metadata.country, rng);
    const template = getTemplate(metadata.industry as IndustryType);

    this.ctx = {
      tenantId: this.job.tenantId,
      patchJobId: this.jobId,
      users: tenantUsers,
      wonStageIds,
      lostStageIds,
      openStageIds,
      tags: tenantTags,
      rng,
      localization,
      template,
      currency: localization.currency,
    };
  }

  /**
   * Check if records already exist with this job ID (idempotency)
   */
  private async checkExistingRecords(): Promise<number> {
    const results = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(contacts)
        .where(eq(contacts.demoJobId, this.jobId)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(companies)
        .where(eq(companies.demoJobId, this.jobId)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(deals)
        .where(eq(deals.demoJobId, this.jobId)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(activities)
        .where(eq(activities.demoJobId, this.jobId)),
    ]);

    return results.reduce((sum, r) => sum + (r[0]?.count ?? 0), 0);
  }

  /**
   * Execute reconcile deletions for negative deltas
   * Deletes demo-generated records to achieve target values
   */
  private async executeReconcileDeletions(
    plan: PatchPlan,
    currentKpis: MonthlyKpiSnapshot[]
  ): Promise<void> {
    if (!this.ctx) throw new Error('Context not loaded');

    for (const monthTarget of plan.months) {
      const currentKpi = currentKpis.find(k => k.month === monthTarget.month);
      if (!currentKpi) continue;

      const targetMetrics = monthTarget.metrics;
      const currentMetrics = currentKpi.metrics;

      // Calculate what needs to be deleted (negative deltas)
      const deletions = {
        activities: Math.max(0, (currentMetrics.activitiesCreated ?? 0) - (targetMetrics.activitiesCreated ?? currentMetrics.activitiesCreated ?? 0)),
        deals: Math.max(0, (currentMetrics.dealsCreated ?? 0) - (targetMetrics.dealsCreated ?? currentMetrics.dealsCreated ?? 0)),
        contacts: Math.max(0, (currentMetrics.contactsCreated ?? 0) - (targetMetrics.contactsCreated ?? currentMetrics.contactsCreated ?? 0)),
        companies: Math.max(0, (currentMetrics.companiesCreated ?? 0) - (targetMetrics.companiesCreated ?? currentMetrics.companiesCreated ?? 0)),
        closedWonValue: Math.max(0, (currentMetrics.closedWonValue ?? 0) - (targetMetrics.closedWonValue ?? currentMetrics.closedWonValue ?? 0)),
        closedWonCount: Math.max(0, (currentMetrics.closedWonCount ?? 0) - (targetMetrics.closedWonCount ?? currentMetrics.closedWonCount ?? 0)),
      };

      // Skip if nothing to delete
      if (Object.values(deletions).every(v => v === 0)) continue;

      await this.log('info', `Reconcile ${monthTarget.month}: deleting ${JSON.stringify(deletions)}`);

      // Delete in FK-safe order: activities → deals → contacts → companies
      // 1. Delete activities
      if (deletions.activities > 0) {
        const deleted = await this.deleteActivitiesForMonth(monthTarget.month, deletions.activities);
        this.metrics.recordsDeleted += deleted;
        this.metrics.byEntity.activities.deleted += deleted;
      }

      // 2. Delete deals (for count reduction)
      if (deletions.deals > 0) {
        const deleted = await this.deleteDealsForMonth(monthTarget.month, deletions.deals);
        this.metrics.recordsDeleted += deleted;
        this.metrics.byEntity.deals.deleted += deleted;
      }
      // 2b. Delete won deals for value reduction (if closedWonValue needs reduction but deals count is ok)
      else if (deletions.closedWonValue > 0 || deletions.closedWonCount > 0) {
        const deleted = await this.deleteWonDealsForValue(
          monthTarget.month,
          deletions.closedWonValue,
          deletions.closedWonCount
        );
        this.metrics.recordsDeleted += deleted;
        this.metrics.byEntity.deals.deleted += deleted;
      }

      // 3. Delete contacts
      if (deletions.contacts > 0) {
        const deleted = await this.deleteContactsForMonth(monthTarget.month, deletions.contacts);
        this.metrics.recordsDeleted += deleted;
        this.metrics.byEntity.contacts.deleted += deleted;
      }

      // 4. Delete companies
      if (deletions.companies > 0) {
        const deleted = await this.deleteCompaniesForMonth(monthTarget.month, deletions.companies);
        this.metrics.recordsDeleted += deleted;
        this.metrics.byEntity.companies.deleted += deleted;
      }
    }
  }

  /**
   * Get date range for a month string (YYYY-MM)
   */
  private getMonthDateRange(month: string): { start: Date; end: Date } {
    const [year, monthNum] = month.split('-').map(Number);
    const start = new Date(year, monthNum - 1, 1); // First day of month
    const end = new Date(year, monthNum, 1); // First day of next month
    return { start, end };
  }

  /**
   * Delete activities for a specific month
   */
  private async deleteActivitiesForMonth(month: string, count: number): Promise<number> {
    if (!this.ctx || count <= 0) return 0;

    const { start, end } = this.getMonthDateRange(month);

    // Find activities to delete (newest first, demo-generated only, from this month)
    // Match by demoSourceMonth OR by createdAt date range (for legacy records)
    const toDelete = await db.select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.tenantId, this.ctx.tenantId),
          eq(activities.demoGenerated, true),
          sql`(${activities.demoSourceMonth} = ${month} OR (${activities.demoSourceMonth} IS NULL AND ${activities.createdAt} >= ${start} AND ${activities.createdAt} < ${end}))`
        )
      )
      .orderBy(sql`${activities.createdAt} DESC`)
      .limit(count);

    if (toDelete.length === 0) return 0;

    const ids = toDelete.map(r => r.id);
    await db.delete(activities)
      .where(
        and(
          eq(activities.tenantId, this.ctx.tenantId),
          inArray(activities.id, ids)
        )
      );

    await this.log('info', `Deleted ${toDelete.length} activities for ${month}`);
    return toDelete.length;
  }

  /**
   * Delete deals for a specific month (by count)
   */
  private async deleteDealsForMonth(month: string, count: number): Promise<number> {
    if (!this.ctx || count <= 0) return 0;

    const { start, end } = this.getMonthDateRange(month);

    // Find deals to delete (newest first, demo-generated only, from this month)
    const toDelete = await db.select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.tenantId, this.ctx.tenantId),
          eq(deals.demoGenerated, true),
          sql`(${deals.demoSourceMonth} = ${month} OR (${deals.demoSourceMonth} IS NULL AND ${deals.createdAt} >= ${start} AND ${deals.createdAt} < ${end}))`
        )
      )
      .orderBy(sql`${deals.createdAt} DESC`)
      .limit(count);

    if (toDelete.length === 0) return 0;

    const ids = toDelete.map(r => r.id);
    await db.delete(deals)
      .where(
        and(
          eq(deals.tenantId, this.ctx.tenantId),
          inArray(deals.id, ids)
        )
      );

    await this.log('info', `Deleted ${toDelete.length} deals for ${month}`);
    return toDelete.length;
  }

  /**
   * Delete won deals to reduce closedWonValue
   */
  private async deleteWonDealsForValue(
    month: string,
    valueToReduce: number,
    countToReduce: number
  ): Promise<number> {
    if (!this.ctx || (valueToReduce <= 0 && countToReduce <= 0)) return 0;

    const { start, end } = this.getMonthDateRange(month);

    // Find won deals (smallest value first to minimize count impact)
    const wonDeals = await db.select({ id: deals.id, value: deals.value })
      .from(deals)
      .where(
        and(
          eq(deals.tenantId, this.ctx.tenantId),
          eq(deals.demoGenerated, true),
          sql`(${deals.demoSourceMonth} = ${month} OR (${deals.demoSourceMonth} IS NULL AND ${deals.createdAt} >= ${start} AND ${deals.createdAt} < ${end}))`,
          inArray(deals.stageId, this.ctx.wonStageIds)
        )
      )
      .orderBy(sql`CAST(${deals.value} AS numeric) ASC`);

    if (wonDeals.length === 0) return 0;

    // Select deals to delete until we meet the reduction targets
    const toDelete: string[] = [];
    let deletedValue = 0;
    let deletedCount = 0;

    for (const deal of wonDeals) {
      const dealValue = deal.value ? parseFloat(deal.value) : 0;

      // Check if we've met both targets
      if (deletedValue >= valueToReduce && deletedCount >= countToReduce) break;

      toDelete.push(deal.id);
      deletedValue += dealValue;
      deletedCount++;
    }

    if (toDelete.length === 0) return 0;

    await db.delete(deals)
      .where(
        and(
          eq(deals.tenantId, this.ctx.tenantId),
          inArray(deals.id, toDelete)
        )
      );

    await this.log('info', `Deleted ${toDelete.length} won deals ($${deletedValue.toFixed(2)}) for ${month}`);
    return toDelete.length;
  }

  /**
   * Delete contacts for a specific month
   */
  private async deleteContactsForMonth(month: string, count: number): Promise<number> {
    if (!this.ctx || count <= 0) return 0;

    const { start, end } = this.getMonthDateRange(month);

    // Find contacts to delete (newest first, demo-generated only, from this month)
    // Exclude contacts that have deals or activities referencing them
    const toDelete = await db.select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, this.ctx.tenantId),
          eq(contacts.demoGenerated, true),
          sql`(${contacts.demoSourceMonth} = ${month} OR (${contacts.demoSourceMonth} IS NULL AND ${contacts.createdAt} >= ${start} AND ${contacts.createdAt} < ${end}))`,
          // Exclude contacts with remaining deals
          sql`NOT EXISTS (SELECT 1 FROM deals WHERE deals.contact_id = contacts.id AND deals.tenant_id = ${this.ctx.tenantId})`,
          // Exclude contacts with remaining activities
          sql`NOT EXISTS (SELECT 1 FROM activities WHERE activities.contact_id = contacts.id AND activities.tenant_id = ${this.ctx.tenantId})`
        )
      )
      .orderBy(sql`${contacts.createdAt} DESC`)
      .limit(count);

    if (toDelete.length === 0) return 0;

    const ids = toDelete.map(r => r.id);
    await db.delete(contacts)
      .where(
        and(
          eq(contacts.tenantId, this.ctx.tenantId),
          inArray(contacts.id, ids)
        )
      );

    await this.log('info', `Deleted ${toDelete.length} contacts for ${month}`);
    return toDelete.length;
  }

  /**
   * Delete companies for a specific month
   */
  private async deleteCompaniesForMonth(month: string, count: number): Promise<number> {
    if (!this.ctx || count <= 0) return 0;

    const { start, end } = this.getMonthDateRange(month);

    // Find companies to delete (newest first, demo-generated only, from this month)
    // Exclude companies that have contacts or deals referencing them
    const toDelete = await db.select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, this.ctx.tenantId),
          eq(companies.demoGenerated, true),
          sql`(${companies.demoSourceMonth} = ${month} OR (${companies.demoSourceMonth} IS NULL AND ${companies.createdAt} >= ${start} AND ${companies.createdAt} < ${end}))`,
          // Exclude companies with remaining contacts
          sql`NOT EXISTS (SELECT 1 FROM contacts WHERE contacts.company_id = companies.id AND contacts.tenant_id = ${this.ctx.tenantId})`,
          // Exclude companies with remaining deals
          sql`NOT EXISTS (SELECT 1 FROM deals WHERE deals.company_id = companies.id AND deals.tenant_id = ${this.ctx.tenantId})`
        )
      )
      .orderBy(sql`${companies.createdAt} DESC`)
      .limit(count);

    if (toDelete.length === 0) return 0;

    const ids = toDelete.map(r => r.id);
    await db.delete(companies)
      .where(
        and(
          eq(companies.tenantId, this.ctx.tenantId),
          inArray(companies.id, ids)
        )
      );

    await this.log('info', `Deleted ${toDelete.length} companies for ${month}`);
    return toDelete.length;
  }

  /**
   * Execute the patch - create entities
   */
  private async executePatch(deltas: PatchMonthTarget[]): Promise<void> {
    if (!this.ctx) throw new Error('Context not loaded');

    const totalMonths = deltas.length;
    let processedMonths = 0;

    for (const monthDelta of deltas) {
      await this.log('info', `Processing month ${monthDelta.month}`);

      // Create daily allocations for this month
      const allocations = this.createDailyAllocations(monthDelta);

      // Create entities for each day
      for (const dayAlloc of allocations) {
        await this.createEntitiesForDay(dayAlloc);
      }

      processedMonths++;
      const progress = 20 + Math.round((processedMonths / totalMonths) * 60);
      await this.updateProgress(progress, `Processed ${processedMonths}/${totalMonths} months`);
    }
  }

  /**
   * Create daily allocations for a month
   */
  private createDailyAllocations(monthDelta: PatchMonthTarget): DayAllocation[] {
    if (!this.ctx) throw new Error('Context not loaded');

    const [year, monthNum] = monthDelta.month.split('-').map(Number);
    const allocations: DayAllocation[] = [];

    // Get business days in month
    const businessDays: Date[] = [];
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day);
      const dayOfWeek = date.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays.push(date);
      }
    }

    if (businessDays.length === 0) {
      // Edge case: month with no business days - use first day
      businessDays.push(new Date(year, monthNum - 1, 1));
    }

    // Weekday weights: Mon(0.8), Tue-Thu(1.2), Fri(0.6)
    const weights: number[] = businessDays.map(d => {
      const dow = d.getDay();
      if (dow === 1) return 0.8; // Monday
      if (dow === 5) return 0.6; // Friday
      return 1.2; // Tue-Thu
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Distribute counts across days
    const metrics = monthDelta.metrics;
    const countMetrics = ['leadsCreated', 'contactsCreated', 'companiesCreated', 'dealsCreated', 'closedWonCount', 'activitiesCreated'] as const;

    // Initialize allocations
    for (let i = 0; i < businessDays.length; i++) {
      allocations.push({
        date: businessDays[i],
        month: monthDelta.month,
        metrics: {
          leadsCreated: 0,
          contactsCreated: 0,
          companiesCreated: 0,
          dealsCreated: 0,
          closedWonCount: 0,
          closedWonValue: 0,
          pipelineAddedValue: 0,
          activitiesCreated: 0,
        },
      });
    }

    // Distribute each count metric
    for (const metric of countMetrics) {
      const total = metrics[metric] ?? 0;
      if (total === 0) continue;

      let remaining = total;

      for (let i = 0; i < businessDays.length; i++) {
        const proportion = weights[i] / totalWeight;
        let count: number;

        if (i === businessDays.length - 1) {
          // Last day gets remainder
          count = remaining;
        } else {
          count = Math.round(total * proportion);
          // Add variance
          const variance = Math.round(this.ctx.rng.next() * 0.3 * count - 0.15 * count);
          count = Math.max(0, count + variance);
          count = Math.min(count, remaining);
        }

        allocations[i].metrics[metric] = count;
        remaining -= count;
      }
    }

    // Distribute values across days with deals
    const closedWonValue = metrics.closedWonValue ?? 0;
    const pipelineAddedValue = metrics.pipelineAddedValue ?? 0;

    if (closedWonValue > 0 || pipelineAddedValue > 0) {
      // Find days with deals
      const daysWithDeals = allocations.filter(a => a.metrics.closedWonCount > 0 || a.metrics.dealsCreated > 0);

      if (daysWithDeals.length > 0) {
        // Distribute closed won value across days with won deals
        const daysWithWonDeals = allocations.filter(a => a.metrics.closedWonCount > 0);
        if (daysWithWonDeals.length > 0 && closedWonValue > 0) {
          const totalWonDeals = daysWithWonDeals.reduce((s, a) => s + a.metrics.closedWonCount, 0);
          let remainingValue = closedWonValue;

          for (let i = 0; i < daysWithWonDeals.length; i++) {
            const proportion = daysWithWonDeals[i].metrics.closedWonCount / totalWonDeals;
            const value = i === daysWithWonDeals.length - 1
              ? remainingValue
              : Math.round(closedWonValue * proportion);

            daysWithWonDeals[i].metrics.closedWonValue = value;
            remainingValue -= value;
          }
        }

        // Distribute pipeline value across days with deals
        if (pipelineAddedValue > 0) {
          const totalDeals = daysWithDeals.reduce((s, a) => s + a.metrics.dealsCreated, 0);
          let remainingValue = pipelineAddedValue;

          for (let i = 0; i < daysWithDeals.length; i++) {
            const proportion = daysWithDeals[i].metrics.dealsCreated / totalDeals;
            const value = i === daysWithDeals.length - 1
              ? remainingValue
              : Math.round(pipelineAddedValue * proportion);

            daysWithDeals[i].metrics.pipelineAddedValue = value;
            remainingValue -= value;
          }
        }
      }
    }

    return allocations;
  }

  /**
   * Create entities for a single day
   */
  private async createEntitiesForDay(allocation: DayAllocation): Promise<void> {
    if (!this.ctx) throw new Error('Context not loaded');

    const { date, month, metrics } = allocation;
    const createdCompanies: Company[] = [];
    const createdContacts: Contact[] = [];

    // Create companies
    if (metrics.companiesCreated > 0) {
      const companiesData = [];

      for (let i = 0; i < metrics.companiesCreated; i++) {
        const timestamp = this.generateTimestamp(date);
        const owner = this.ctx.rng.pick(this.ctx.users);
        const companyName = this.ctx.localization.companyName(this.ctx.template.id);

        companiesData.push({
          tenantId: this.ctx.tenantId,
          name: companyName,
          domain: this.ctx.localization.companyDomain(companyName),
          industry: this.ctx.template.name,
          ownerId: owner.id,
          country: this.ctx.localization.countryName,
          city: this.ctx.localization.city(),
          demoGenerated: true,
          demoJobId: this.ctx.patchJobId,
          demoSourceMonth: month,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      if (companiesData.length > 0) {
        const inserted = await db.insert(companies).values(companiesData).returning();
        createdCompanies.push(...inserted);
        this.metrics.recordsCreated += inserted.length;
        this.metrics.byEntity.companies.created += inserted.length;
      }
    }

    // Create contacts (including leads)
    if (metrics.contactsCreated > 0) {
      const contactsData = [];

      for (let i = 0; i < metrics.contactsCreated; i++) {
        const timestamp = this.generateTimestamp(date);
        const owner = this.ctx.rng.pick(this.ctx.users);
        const isLead = i < metrics.leadsCreated;
        const gender = this.ctx.rng.next() < 0.5 ? 'male' : 'female';
        const firstName = this.ctx.localization.firstName(gender);
        const lastName = this.ctx.localization.lastName();

        // 70% have a company
        let companyId: string | null = null;
        if (this.ctx.rng.next() < 0.7 && createdCompanies.length > 0) {
          companyId = this.ctx.rng.pick(createdCompanies).id;
        }

        contactsData.push({
          tenantId: this.ctx.tenantId,
          firstName,
          lastName,
          email: this.ctx.localization.email(firstName, lastName),
          phone: this.ctx.localization.phone(),
          status: isLead ? 'lead' as const : this.ctx.rng.pick(['prospect', 'customer'] as const),
          ownerId: owner.id,
          companyId,
          demoGenerated: true,
          demoJobId: this.ctx.patchJobId,
          demoSourceMonth: month,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      if (contactsData.length > 0) {
        const inserted = await db.insert(contacts).values(contactsData).returning();
        createdContacts.push(...inserted);
        this.metrics.recordsCreated += inserted.length;
        this.metrics.byEntity.contacts.created += inserted.length;
      }
    }

    // Create deals
    if (metrics.dealsCreated > 0) {
      await this.createDealsForDay(
        date,
        month,
        metrics.dealsCreated,
        metrics.closedWonCount,
        metrics.closedWonValue,
        metrics.pipelineAddedValue,
        createdContacts,
        createdCompanies
      );
    }

    // Create activities
    if (metrics.activitiesCreated > 0 || metrics.contactsCreated > 0) {
      await this.createActivitiesForDay(
        date,
        month,
        metrics.activitiesCreated || Math.round(metrics.contactsCreated * 2),
        createdContacts
      );
    }
  }

  /**
   * Create deals for a day with value allocation
   */
  private async createDealsForDay(
    date: Date,
    month: string,
    totalDeals: number,
    closedWonCount: number,
    closedWonValue: number,
    pipelineAddedValue: number,
    contactPool: Contact[],
    companyPool: Company[]
  ): Promise<void> {
    if (!this.ctx || totalDeals === 0) return;

    const dealsData = [];
    const valueAllocator = new ValueAllocator(this.ctx.rng);

    // Allocate values to deals
    const { closedWonValues, openDealValues } = valueAllocator.allocatePipelineValues(
      closedWonCount,
      totalDeals - closedWonCount,
      closedWonValue,
      pipelineAddedValue - closedWonValue,
      {
        minValue: this.ctx.template.deals.minValue,
        maxValue: this.ctx.template.deals.maxValue,
        avgValue: this.ctx.template.deals.avgValue,
        whaleRatio: 0.1,
      }
    );

    // Create closed won deals
    for (let i = 0; i < closedWonCount; i++) {
      const timestamp = this.generateTimestamp(date);
      const owner = this.ctx.rng.pick(this.ctx.users);
      const contact = contactPool.length > 0 ? this.ctx.rng.pick(contactPool) : null;
      const company = companyPool.length > 0 ? this.ctx.rng.pick(companyPool) : null;

      dealsData.push({
        tenantId: this.ctx.tenantId,
        title: `${contact?.firstName ?? 'Deal'} ${contact?.lastName ?? ''} - ${this.ctx.template.name}`.trim(),
        value: String(Math.round(closedWonValues[i])),
        currency: this.ctx.currency,
        stageId: this.ctx.rng.pick(this.ctx.wonStageIds),
        position: i,
        ownerId: owner.id,
        contactId: contact?.id ?? null,
        companyId: company?.id ?? null,
        demoGenerated: true,
        demoJobId: this.ctx.patchJobId,
        demoSourceMonth: month,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    // Create open deals
    const openDealCount = totalDeals - closedWonCount;
    for (let i = 0; i < openDealCount; i++) {
      const timestamp = this.generateTimestamp(date);
      const owner = this.ctx.rng.pick(this.ctx.users);
      const contact = contactPool.length > 0 ? this.ctx.rng.pick(contactPool) : null;
      const company = companyPool.length > 0 ? this.ctx.rng.pick(companyPool) : null;

      // 70% open, 30% lost
      const isLost = this.ctx.rng.next() < 0.3;
      const stageId = isLost
        ? this.ctx.rng.pick(this.ctx.lostStageIds.length > 0 ? this.ctx.lostStageIds : this.ctx.openStageIds)
        : this.ctx.rng.pick(this.ctx.openStageIds.length > 0 ? this.ctx.openStageIds : this.ctx.wonStageIds);

      dealsData.push({
        tenantId: this.ctx.tenantId,
        title: `${contact?.firstName ?? 'Deal'} ${contact?.lastName ?? ''} - ${this.ctx.template.name}`.trim(),
        value: String(Math.round(openDealValues[i] ?? this.ctx.template.deals.avgValue)),
        currency: this.ctx.currency,
        stageId,
        position: closedWonCount + i,
        ownerId: owner.id,
        contactId: contact?.id ?? null,
        companyId: company?.id ?? null,
        demoGenerated: true,
        demoJobId: this.ctx.patchJobId,
        demoSourceMonth: month,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    if (dealsData.length > 0) {
      const inserted = await db.insert(deals).values(dealsData).returning();
      this.metrics.recordsCreated += inserted.length;
      this.metrics.byEntity.deals.created += inserted.length;
    }
  }

  /**
   * Create activities for a day
   */
  private async createActivitiesForDay(
    date: Date,
    month: string,
    count: number,
    contactPool: Contact[]
  ): Promise<void> {
    if (!this.ctx || count === 0) return;

    const activitiesData: Array<{
      tenantId: string;
      type: 'note' | 'call' | 'email' | 'meeting' | 'task';
      subject: string;
      description: null;
      contactId: string | null;
      companyId: string | null;
      dealId: null;
      createdById: string;
      scheduledAt: Date;
      completedAt: Date | null;
      durationMinutes: number | null;
      demoGenerated: boolean;
      demoJobId: string;
      demoSourceMonth: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    const activityTypes: Array<'note' | 'call' | 'email' | 'meeting' | 'task'> = ['note', 'call', 'email', 'meeting', 'task'];

    for (let i = 0; i < count; i++) {
      const timestamp = this.generateTimestamp(date);
      const creator = this.ctx.rng.pick(this.ctx.users);
      const contact = contactPool.length > 0 ? this.ctx.rng.pick(contactPool) : null;
      const type = this.ctx.rng.pick(activityTypes);

      const subjects: Record<'note' | 'call' | 'email' | 'meeting' | 'task', string[]> = {
        note: ['Follow-up notes', 'Meeting summary', 'Client feedback', 'Action items'],
        call: ['Discovery call', 'Follow-up call', 'Demo call', 'Check-in call'],
        email: ['Introduction email', 'Proposal sent', 'Follow-up email', 'Quote request'],
        meeting: ['Initial meeting', 'Product demo', 'Negotiation meeting', 'Contract review'],
        task: ['Send proposal', 'Update CRM', 'Schedule call', 'Review contract'],
      };

      activitiesData.push({
        tenantId: this.ctx.tenantId,
        type,
        subject: this.ctx.rng.pick(subjects[type]),
        description: null,
        contactId: contact?.id ?? null,
        companyId: contact?.companyId ?? null,
        dealId: null,
        createdById: creator.id,
        scheduledAt: timestamp,
        completedAt: this.ctx.rng.next() < 0.8 ? timestamp : null,
        durationMinutes: type === 'call' ? Math.round(this.ctx.rng.next() * 30 + 5) : null,
        demoGenerated: true,
        demoJobId: this.ctx.patchJobId,
        demoSourceMonth: month,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    if (activitiesData.length > 0) {
      const inserted = await db.insert(activities).values(activitiesData).returning();
      this.metrics.recordsCreated += inserted.length;
      this.metrics.byEntity.activities.created += inserted.length;
    }
  }

  /**
   * Generate a timestamp within business hours for a given date
   */
  private generateTimestamp(date: Date): Date {
    if (!this.ctx) throw new Error('Context not loaded');

    // Business hours: 9am - 6pm, weighted towards mid-day
    // 80% between 10am-4pm, 20% at edges
    let hour: number;
    if (this.ctx.rng.next() < 0.8) {
      // Core hours: 10am - 4pm
      hour = 10 + Math.floor(this.ctx.rng.next() * 6);
    } else {
      // Edge hours
      hour = this.ctx.rng.next() < 0.5 ? 9 : (16 + Math.floor(this.ctx.rng.next() * 2));
    }

    const minute = Math.floor(this.ctx.rng.next() * 60);
    const second = Math.floor(this.ctx.rng.next() * 60);

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour,
      minute,
      second
    );
  }

  /**
   * Update job status
   */
  private async updateStatus(status: string, progress: number, step: string): Promise<void> {
    await db.update(demoPatchJobs)
      .set({
        status: status as any,
        progress,
        currentStep: step,
        startedAt: status === 'running' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(demoPatchJobs.id, this.jobId));
  }

  /**
   * Update job progress
   */
  private async updateProgress(progress: number, step: string): Promise<void> {
    await db.update(demoPatchJobs)
      .set({
        progress,
        currentStep: step,
        updatedAt: new Date(),
      })
      .where(eq(demoPatchJobs.id, this.jobId));
  }

  /**
   * Add log entry
   */
  private async log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    await db.execute(sql`
      UPDATE demo_patch_jobs
      SET logs = (logs::jsonb || ${JSON.stringify([entry])}::jsonb)::json,
          updated_at = NOW()
      WHERE id = ${this.jobId}::uuid
    `);
  }

  /**
   * Handle execution error
   */
  private async handleError(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error(`[PatchEngine] Error in job ${this.jobId}:`, message);
    console.error(`[PatchEngine] Stack:`, stack);

    await this.log('error', message);

    await db.update(demoPatchJobs)
      .set({
        status: 'failed',
        errorMessage: message,
        errorStack: stack,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(demoPatchJobs.id, this.jobId));
  }
}
