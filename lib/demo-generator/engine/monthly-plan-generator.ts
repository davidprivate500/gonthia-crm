/**
 * Monthly Plan Generator
 *
 * Extends the demo generator to support monthly-plan mode with exact
 * target matching for count and value metrics.
 */

import { db } from '@/lib/db';
import {
  tenants, users, contacts, companies, deals, pipelineStages,
  activities, tags, demoGenerationJobs, demoTenantMetadata,
} from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';
import { SeededRNG, generateSeed } from './rng';
import { MonthlyAllocator, type AllocationPlan, type MonthAllocation } from './monthly-allocator';
import { ValueAllocator, type ValueConstraints } from './value-allocator';
import { getProvider } from '../localization';
import { getTemplate } from '../templates';
import type {
  DemoGenerationConfigV2,
  MonthlyPlan,
  GenerationResult,
  GenerationMetrics,
  MonthlyMetrics,
  LogEntry,
  LocalizationProvider,
  IndustryTemplate,
  VerificationReport,
  ToleranceConfig,
} from '../types';

// Transaction type
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const BATCH_SIZE = 500;
const DEFAULT_PASSWORD = 'Demo123!';

export class MonthlyPlanGenerator {
  private rng: SeededRNG;
  private config: DemoGenerationConfigV2;
  private monthlyPlan: MonthlyPlan;
  private jobId: string;
  private seed: string;
  private localization: LocalizationProvider;
  private template: IndustryTemplate;
  private allocator: MonthlyAllocator;
  private valueAllocator: ValueAllocator;
  private allocationPlan: AllocationPlan;
  private logs: LogEntry[] = [];

  // Generated data references
  private tenantId: string = '';
  private userIds: string[] = [];
  private stageMap: Map<string, string> = new Map();
  private wonStageId: string = '';
  private lostStageId: string = '';
  private openStageIds: string[] = [];
  private companyIds: string[] = [];
  private contactIds: string[] = [];
  private dealIds: string[] = [];

  // Metrics tracking by month
  private monthlyActuals: Map<string, MonthlyMetrics> = new Map();
  private metrics: GenerationMetrics;

  constructor(jobId: string, config: DemoGenerationConfigV2, seed?: string) {
    if (config.mode !== 'monthly-plan' || !config.monthlyPlan) {
      throw new Error('MonthlyPlanGenerator requires mode=monthly-plan and a monthlyPlan');
    }

    this.jobId = jobId;
    this.config = config;
    this.monthlyPlan = config.monthlyPlan;
    this.seed = seed || generateSeed();
    this.rng = new SeededRNG(this.seed);
    this.localization = getProvider(config.country, this.rng.child('loc'));
    this.template = getTemplate(config.industry);
    this.allocator = new MonthlyAllocator(this.rng.child('alloc'));
    this.valueAllocator = new ValueAllocator(this.rng.child('values'));

    // Create allocation plan
    this.allocationPlan = this.allocator.createAllocationPlan(this.monthlyPlan);

    // Initialize metrics
    this.metrics = {
      tenantId: '',
      users: 0,
      contacts: 0,
      companies: 0,
      deals: 0,
      activities: 0,
      pipelineStages: 0,
      tags: 0,
      totalPipelineValue: 0,
      totalClosedWonValue: 0,
      closedWonCount: 0,
      monthlyBreakdown: [],
    };

    // Initialize monthly actuals
    for (const month of this.monthlyPlan.months) {
      this.monthlyActuals.set(month.month, {
        month: month.month,
        leads: 0,
        contacts: 0,
        companies: 0,
        deals: 0,
        closedWonDeals: 0,
        pipelineValue: 0,
        closedWonValue: 0,
      });
    }
  }

  /**
   * Execute the full generation process
   */
  async generate(): Promise<GenerationResult> {
    this.log('info', `Starting monthly-plan generation with seed: ${this.seed}`);

    try {
      await this.updateJobStatus('running', 0, 'Initializing');

      await db.transaction(async (tx) => {
        // Step 1: Create tenant (5%)
        await this.updateJobStatus('running', 5, 'Creating tenant');
        await this.createTenant(tx);

        // Step 2: Create users (10%)
        await this.updateJobStatus('running', 10, 'Creating team members');
        await this.createUsers(tx);

        // Step 3: Create pipeline (15%)
        await this.updateJobStatus('running', 15, 'Setting up pipeline');
        await this.createPipeline(tx);

        // Step 4: Create tags (18%)
        await this.updateJobStatus('running', 18, 'Creating tags');
        await this.createTags(tx);

        // Step 5: Create companies (30%)
        await this.updateJobStatus('running', 20, 'Creating companies');
        await this.createCompanies(tx);

        // Step 6: Create contacts with leads (55%)
        await this.updateJobStatus('running', 30, 'Creating contacts');
        await this.createContacts(tx);

        // Step 7: Create deals with exact values (80%)
        await this.updateJobStatus('running', 55, 'Creating deals');
        await this.createDeals(tx);

        // Step 8: Create activities (95%)
        await this.updateJobStatus('running', 80, 'Creating activities');
        await this.createActivities(tx);

        // Step 9: Create demo metadata
        await this.updateJobStatus('running', 95, 'Finalizing');
        await this.createDemoMetadata(tx);
      });

      // Calculate final metrics
      this.finalizeMetrics();
      this.metrics.tenantId = this.tenantId;

      // Generate verification report
      const verificationReport = this.generateVerificationReport();

      // Update job to completed with verification
      await this.updateJobStatus('completed', 100, 'Complete', undefined, verificationReport);

      this.log('info', `Generation complete. Tenant ID: ${this.tenantId}`);

      return {
        tenantId: this.tenantId,
        metrics: this.metrics,
      };
    } catch (error) {
      this.log('error', `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.updateJobStatus('failed', 0, 'Failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async createTenant(tx: DbTransaction): Promise<void> {
    const [tenant] = await tx.insert(tenants).values({
      name: this.config.tenantName,
    }).returning();

    this.tenantId = tenant.id;
    this.log('info', `Created tenant: ${tenant.name} (${tenant.id})`);
  }

  private async createUsers(tx: DbTransaction): Promise<void> {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    const teamSize = this.config.teamSize;
    const rng = this.rng.child('users');

    // Get earliest date from plan
    const startDate = new Date(this.monthlyPlan.months[0].month + '-01');

    const usersToCreate = [];

    // Create owner
    const ownerGender = rng.bool() ? 'male' : 'female';
    usersToCreate.push({
      tenantId: this.tenantId,
      email: `owner@${this.localization.companyDomain(this.config.tenantName)}`,
      passwordHash,
      role: 'owner' as const,
      firstName: this.localization.firstName(ownerGender),
      lastName: this.localization.lastName(),
      createdAt: startDate,
    });

    // Create team members
    const roles: Array<'admin' | 'member'> = ['admin', 'member', 'member', 'member'];
    for (let i = 1; i < teamSize; i++) {
      const gender = rng.bool() ? 'male' : 'female';
      const firstName = this.localization.firstName(gender);
      const lastName = this.localization.lastName();
      const role = roles[Math.min(i - 1, roles.length - 1)];

      usersToCreate.push({
        tenantId: this.tenantId,
        email: this.localization.email(firstName, lastName, this.localization.companyDomain(this.config.tenantName)),
        passwordHash,
        role,
        firstName,
        lastName,
        createdAt: startDate,
      });
    }

    const created = await tx.insert(users).values(usersToCreate).returning({ id: users.id });
    this.userIds = created.map((u) => u.id);
    this.metrics.users = this.userIds.length;
    this.log('info', `Created ${this.userIds.length} users`);
  }

  private async createPipeline(tx: DbTransaction): Promise<void> {
    const stages = this.template.pipeline.stages;

    const stagesToCreate = stages.map((stage, index) => ({
      tenantId: this.tenantId,
      name: stage.name,
      color: stage.color || '#6366f1',
      position: index,
      isWon: stage.type === 'won',
      isLost: stage.type === 'lost',
    }));

    const created = await tx.insert(pipelineStages).values(stagesToCreate).returning({
      id: pipelineStages.id,
      name: pipelineStages.name,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
    });

    for (const stage of created) {
      this.stageMap.set(stage.name, stage.id);
      if (stage.isWon) this.wonStageId = stage.id;
      else if (stage.isLost) this.lostStageId = stage.id;
      else this.openStageIds.push(stage.id);
    }

    this.metrics.pipelineStages = created.length;
    this.log('info', `Created ${created.length} pipeline stages`);
  }

  private async createTags(tx: DbTransaction): Promise<void> {
    const tagDefs = [
      { name: 'High Value', color: '#22c55e' },
      { name: 'Enterprise', color: '#3b82f6' },
      { name: 'VIP', color: '#f59e0b' },
      { name: 'At Risk', color: '#ef4444' },
      { name: 'New', color: '#8b5cf6' },
      { name: 'Follow Up', color: '#ec4899' },
      { name: 'Hot Lead', color: '#f97316' },
      { name: 'Cold', color: '#6b7280' },
    ];

    const tagsToCreate = tagDefs.map((tag) => ({
      tenantId: this.tenantId,
      name: tag.name,
      color: tag.color,
    }));

    await tx.insert(tags).values(tagsToCreate);
    this.metrics.tags = tagDefs.length;
    this.log('info', `Created ${tagDefs.length} tags`);
  }

  private async createCompanies(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('companies');
    const companiesToCreate = [];

    for (const month of this.allocationPlan.months) {
      for (const day of month.days) {
        if (!day.isBusinessDay) continue;

        const count = Math.round(day.metrics.companiesCreated || 0);
        for (let i = 0; i < count; i++) {
          const address = this.localization.fullAddress();
          const name = this.localization.companyName(this.config.industry);

          companiesToCreate.push({
            tenantId: this.tenantId,
            name,
            domain: this.localization.companyDomain(name),
            industry: this.template.name,
            size: rng.pick(['1-10', '11-50', '51-200', '201-500', '500+']),
            ownerId: rng.pick(this.userIds),
            address: address.street,
            city: address.city,
            state: address.state,
            country: address.country,
            postalCode: address.postalCode,
            phone: this.localization.phone(),
            website: `https://${this.localization.companyDomain(name)}`,
            createdAt: this.allocator.generateTimestamp(day.date),
          });

          // Update monthly actuals
          const actuals = this.monthlyActuals.get(month.month);
          if (actuals) actuals.companies++;
        }
      }
    }

    // Batch insert
    for (let i = 0; i < companiesToCreate.length; i += BATCH_SIZE) {
      const batch = companiesToCreate.slice(i, i + BATCH_SIZE);
      const created = await tx.insert(companies).values(batch).returning({ id: companies.id });
      this.companyIds.push(...created.map((c) => c.id));
    }

    this.metrics.companies = this.companyIds.length;
    this.log('info', `Created ${this.companyIds.length} companies`);
  }

  private async createContacts(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('contacts');
    const contactsToCreate = [];

    for (const month of this.allocationPlan.months) {
      const monthTarget = this.monthlyPlan.months.find(m => m.month === month.month);
      if (!monthTarget) continue;

      const leadsNeeded = monthTarget.targets.leadsCreated;
      const contactsNeeded = monthTarget.targets.contactsCreated;
      let leadsCreated = 0;

      for (const day of month.days) {
        if (!day.isBusinessDay) continue;

        const count = Math.round(day.metrics.contactsCreated || 0);
        const leadsForDay = Math.round(day.metrics.leadsCreated || 0);
        let dayLeads = 0;

        for (let i = 0; i < count; i++) {
          const gender = rng.bool() ? 'male' : 'female';
          const firstName = this.localization.firstName(gender);
          const lastName = this.localization.lastName();
          const hasCompany = rng.bool(0.7) && this.companyIds.length > 0;

          // Determine status - ensure leads are properly distributed
          let status: 'lead' | 'prospect' | 'customer' | 'churned' | 'other';
          if (leadsCreated < leadsNeeded && dayLeads < leadsForDay) {
            status = 'lead';
            leadsCreated++;
            dayLeads++;
          } else {
            status = rng.pick(['prospect', 'prospect', 'customer', 'churned', 'other']);
          }

          contactsToCreate.push({
            tenantId: this.tenantId,
            firstName,
            lastName,
            email: this.localization.email(firstName, lastName),
            phone: this.localization.phone(),
            companyId: hasCompany ? rng.pick(this.companyIds) : null,
            ownerId: rng.pick(this.userIds),
            status,
            createdAt: this.allocator.generateTimestamp(day.date),
          });

          // Update monthly actuals
          const actuals = this.monthlyActuals.get(month.month);
          if (actuals) {
            actuals.contacts++;
            if (status === 'lead') actuals.leads++;
          }
        }
      }
    }

    // Batch insert
    for (let i = 0; i < contactsToCreate.length; i += BATCH_SIZE) {
      const batch = contactsToCreate.slice(i, i + BATCH_SIZE);
      const created = await tx.insert(contacts).values(batch).returning({ id: contacts.id });
      this.contactIds.push(...created.map((c) => c.id));
    }

    this.metrics.contacts = this.contactIds.length;
    this.log('info', `Created ${this.contactIds.length} contacts`);
  }

  private async createDeals(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('deals');
    const dealsToCreate = [];
    const constraints: ValueConstraints = {
      minValue: this.template.deals.minValue,
      maxValue: this.template.deals.maxValue,
      avgValue: this.template.deals.avgValue,
      whaleRatio: this.config.realism.whaleRatio / 100,
    };

    let totalPipelineValue = 0;
    let totalClosedWonValue = 0;
    let totalClosedWonCount = 0;

    for (const month of this.allocationPlan.months) {
      const monthTarget = this.monthlyPlan.months.find(m => m.month === month.month);
      if (!monthTarget) continue;

      const { dealsCreated, closedWonCount, closedWonValue, pipelineAddedValue } = monthTarget.targets;

      // Allocate values for this month
      const allocation = this.valueAllocator.allocatePipelineValues(
        dealsCreated,
        closedWonCount,
        pipelineAddedValue,
        closedWonValue,
        constraints
      );

      let closedWonIdx = 0;
      let openIdx = 0;
      let monthClosedWonValue = 0;
      let monthPipelineValue = 0;

      for (const day of month.days) {
        if (!day.isBusinessDay) continue;

        const dayDeals = Math.round(day.metrics.dealsCreated || 0);
        const dayClosedWon = Math.round(day.metrics.closedWonCount || 0);
        let dayClosedWonCreated = 0;

        for (let i = 0; i < dayDeals; i++) {
          let stageId: string;
          let value: number;
          let probability: number;

          // Determine if this deal should be closed won
          if (dayClosedWonCreated < dayClosedWon && closedWonIdx < allocation.closedWonValues.length) {
            stageId = this.wonStageId;
            value = allocation.closedWonValues[closedWonIdx];
            probability = 100;
            closedWonIdx++;
            dayClosedWonCreated++;
            monthClosedWonValue += value;
            totalClosedWonValue += value;
            totalClosedWonCount++;
          } else if (openIdx < allocation.pipelineValues.length) {
            // Open or lost deal
            const isLost = rng.bool(0.35); // 35% lost
            stageId = isLost ? this.lostStageId : rng.pick(this.openStageIds);
            value = allocation.pipelineValues[openIdx];
            probability = isLost ? 0 : rng.int(20, 80);
            openIdx++;

            if (!isLost) {
              monthPipelineValue += value;
              totalPipelineValue += value;
            }
          } else {
            // Fallback
            stageId = rng.pick(this.openStageIds);
            value = this.valueAllocator.generateSingleValue(constraints);
            probability = rng.int(20, 80);
          }

          const contactId = this.contactIds.length > 0 ? rng.pick(this.contactIds) : null;
          const companyId = this.companyIds.length > 0 ? rng.pick(this.companyIds) : null;
          const createdAt = this.allocator.generateTimestamp(day.date);
          const expectedClose = new Date(createdAt);
          expectedClose.setDate(expectedClose.getDate() + rng.int(14, 56));

          dealsToCreate.push({
            tenantId: this.tenantId,
            title: `${this.localization.companyName(this.config.industry)} - ${rng.pick(['Opportunity', 'Deal', 'Contract', 'Project'])}`,
            value: value.toFixed(2),
            currency: this.config.currency,
            stageId,
            position: i,
            ownerId: rng.pick(this.userIds),
            contactId,
            companyId,
            expectedCloseDate: expectedClose,
            probability,
            createdAt,
          });

          // Update monthly actuals
          const actuals = this.monthlyActuals.get(month.month);
          if (actuals) {
            actuals.deals++;
            if (stageId === this.wonStageId) {
              actuals.closedWonDeals++;
              actuals.closedWonValue += value;
            }
          }
        }
      }

      // Update actuals with pipeline value
      const actuals = this.monthlyActuals.get(month.month);
      if (actuals) {
        actuals.pipelineValue = monthPipelineValue + monthClosedWonValue;
      }
    }

    // Batch insert
    for (let i = 0; i < dealsToCreate.length; i += BATCH_SIZE) {
      const batch = dealsToCreate.slice(i, i + BATCH_SIZE);
      const created = await tx.insert(deals).values(batch).returning({ id: deals.id });
      this.dealIds.push(...created.map((d) => d.id));
    }

    this.metrics.deals = this.dealIds.length;
    this.metrics.totalPipelineValue = totalPipelineValue;
    this.metrics.totalClosedWonValue = totalClosedWonValue;
    this.metrics.closedWonCount = totalClosedWonCount;
    this.log('info', `Created ${this.dealIds.length} deals`);
  }

  private async createActivities(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('activities');
    const activitiesToCreate = [];
    const { callToEmailRatio, avgPerContact } = this.template.activities;

    const activityTypes: Array<'note' | 'call' | 'email' | 'meeting' | 'task'> = ['note', 'call', 'email', 'meeting', 'task'];
    const typeWeights = [15, callToEmailRatio * 30, (1 - callToEmailRatio) * 30, 15, 10];

    const subjects = {
      note: ['Follow-up notes', 'Meeting summary', 'Client feedback', 'Status update'],
      call: ['Discovery call', 'Follow-up call', 'Demo call', 'Check-in'],
      email: ['Introduction', 'Proposal sent', 'Follow-up', 'Thank you'],
      meeting: ['Initial meeting', 'Demo session', 'Review meeting', 'Strategy session'],
      task: ['Send proposal', 'Schedule demo', 'Update CRM', 'Prepare presentation'],
    };

    const sampleSize = Math.min(this.contactIds.length, Math.ceil(this.contactIds.length * 0.6));
    const sampledContacts = rng.pickMultiple(this.contactIds, sampleSize);

    for (const contactId of sampledContacts) {
      const activityCount = rng.int(1, avgPerContact * 2);

      for (let i = 0; i < activityCount; i++) {
        const type = rng.pickWeighted(activityTypes, typeWeights);
        const subject = rng.pick(subjects[type]);
        const userId = rng.pick(this.userIds);
        const month = rng.pick(this.allocationPlan.months);
        const day = rng.pick(month.days.filter(d => d.isBusinessDay));
        const createdAt = this.allocator.generateTimestamp(day.date);
        const dealId = this.dealIds.length > 0 && rng.bool(0.3) ? rng.pick(this.dealIds) : null;

        activitiesToCreate.push({
          tenantId: this.tenantId,
          type,
          subject,
          description: `${subject} - auto-generated activity`,
          contactId,
          dealId,
          createdById: userId,
          scheduledAt: type === 'task' || type === 'meeting' ? createdAt : null,
          completedAt: rng.bool(0.7) ? createdAt : null,
          durationMinutes: type === 'call' ? rng.int(5, 45) : type === 'meeting' ? rng.int(30, 120) : null,
          createdAt,
        });
      }
    }

    // Batch insert
    for (let i = 0; i < activitiesToCreate.length; i += BATCH_SIZE) {
      const batch = activitiesToCreate.slice(i, i + BATCH_SIZE);
      await tx.insert(activities).values(batch);
    }

    this.metrics.activities = activitiesToCreate.length;
    this.log('info', `Created ${activitiesToCreate.length} activities`);
  }

  private async createDemoMetadata(tx: DbTransaction): Promise<void> {
    const startDate = new Date(this.monthlyPlan.months[0].month + '-01');

    await tx.insert(demoTenantMetadata).values({
      tenantId: this.tenantId,
      generationJobId: this.jobId,
      country: this.config.country,
      industry: this.config.industry,
      startDate,
      isDemoGenerated: true,
      excludedFromAnalytics: true,
    });

    this.log('info', 'Created demo tenant metadata');
  }

  private finalizeMetrics(): void {
    this.metrics.monthlyBreakdown = Array.from(this.monthlyActuals.values());
  }

  private generateVerificationReport(): VerificationReport {
    const tolerances = this.monthlyPlan.tolerances;
    const months = [];
    let totalPassed = 0;
    let totalFailed = 0;

    for (const target of this.monthlyPlan.months) {
      const actual = this.monthlyActuals.get(target.month);
      if (!actual) continue;

      const metrics = [
        this.verifyMetric('leadsCreated', target.targets.leadsCreated, actual.leads, tolerances, true),
        this.verifyMetric('contactsCreated', target.targets.contactsCreated, actual.contacts, tolerances, true),
        this.verifyMetric('companiesCreated', target.targets.companiesCreated, actual.companies, tolerances, true),
        this.verifyMetric('dealsCreated', target.targets.dealsCreated, actual.deals, tolerances, true),
        this.verifyMetric('closedWonCount', target.targets.closedWonCount, actual.closedWonDeals, tolerances, true),
        this.verifyMetric('closedWonValue', target.targets.closedWonValue, actual.closedWonValue, tolerances, false),
        this.verifyMetric('pipelineAddedValue', target.targets.pipelineAddedValue, actual.pipelineValue, tolerances, false),
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
      jobId: this.jobId,
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

  private verifyMetric(
    metric: string,
    target: number,
    actual: number,
    tolerances: ToleranceConfig,
    isCount: boolean
  ) {
    const diff = actual - target;
    const diffPercent = target > 0 ? (diff / target) * 100 : 0;
    const tolerance = isCount ? tolerances.countTolerance : tolerances.valueTolerance;
    const toleranceAmount = isCount ? tolerance : tolerance * target;
    const passed = Math.abs(diff) <= toleranceAmount;

    return {
      metric: metric as any,
      target,
      actual,
      diff,
      diffPercent,
      passed,
      tolerance,
    };
  }

  private async updateJobStatus(
    status: 'pending' | 'running' | 'completed' | 'failed',
    progress: number,
    currentStep: string,
    errorMessage?: string,
    verificationReport?: VerificationReport
  ): Promise<void> {
    const updates: any = {
      status,
      progress,
      currentStep,
      logs: this.logs,
      updatedAt: new Date(),
    };

    if (status === 'running' && progress === 0) {
      updates.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
      updates.metrics = this.metrics;
    }

    if (status === 'completed') {
      updates.createdTenantId = this.tenantId;
    }

    if (verificationReport) {
      updates.verificationReport = verificationReport;
      updates.verificationPassed = verificationReport.overallPassed;
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await db.update(demoGenerationJobs)
      .set(updates)
      .where(eq(demoGenerationJobs.id, this.jobId));
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
  }

  getSeed(): string {
    return this.seed;
  }
}
