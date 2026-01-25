/**
 * Chunked Monthly Plan Generator
 *
 * A resumable, timeout-safe version of the monthly plan generator.
 * Processes data in chunks and self-continues before serverless timeout.
 */

import { db } from '@/lib/db';
import {
  tenants, users, contacts, companies, deals, pipelineStages,
  activities, tags, demoGenerationJobs, demoTenantMetadata,
} from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';
import { SeededRNG } from './rng';
import { MonthlyAllocator, type AllocationPlan } from './monthly-allocator';
import { ValueAllocator, type ValueConstraints } from './value-allocator';
import { getProvider } from '../localization';
import { getTemplate } from '../templates';
import type {
  DemoGenerationConfigV2,
  MonthlyPlan,
  GenerationMetrics,
  MonthlyMetrics,
  LogEntry,
  LocalizationProvider,
  IndustryTemplate,
} from '../types';

const BATCH_SIZE = 200; // Smaller batches for better checkpoint granularity
const MAX_EXECUTION_TIME_MS = 50000; // 50 seconds - leave buffer before 60s timeout
const DEFAULT_PASSWORD = 'Demo123!';

// Generation phases in order
type GenerationPhase =
  | 'init'
  | 'tenant'
  | 'users'
  | 'pipeline'
  | 'tags'
  | 'companies'
  | 'contacts'
  | 'deals'
  | 'activities'
  | 'verify'
  | 'completed';

interface GenerationState {
  // IDs created so far
  tenantId?: string;
  userIds?: string[];
  stageMap?: Record<string, string>;
  wonStageId?: string;
  lostStageId?: string;
  openStageIds?: string[];
  companyIds?: string[];
  contactIds?: string[];
  dealIds?: string[];
  // Batch progress within current phase
  currentBatch?: number;
  totalBatches?: number;
  // Metrics tracking
  monthlyActuals?: Record<string, MonthlyMetrics>;
  metrics?: GenerationMetrics;
  // Prepared data for batch processing
  pendingCompanies?: any[];
  pendingContacts?: any[];
  pendingDeals?: any[];
  pendingActivities?: any[];
}

export class ChunkedMonthlyPlanGenerator {
  private jobId: string;
  private startTime: number = 0;
  private job: any = null;
  private config: DemoGenerationConfigV2 | null = null;
  private monthlyPlan: MonthlyPlan | null = null;
  private seed: string = '';
  private rng: SeededRNG | null = null;
  private localization: LocalizationProvider | null = null;
  private template: IndustryTemplate | null = null;
  private allocator: MonthlyAllocator | null = null;
  private valueAllocator: ValueAllocator | null = null;
  private allocationPlan: AllocationPlan | null = null;
  private state: GenerationState = {};
  private logs: LogEntry[] = [];

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  /**
   * Continue generation from current phase
   */
  async continueGeneration(): Promise<void> {
    this.startTime = Date.now();

    try {
      // Load job and state
      await this.loadJob();

      if (!this.job || this.job.status !== 'running') {
        console.log(`[Chunked] Job ${this.jobId} is not running, skipping`);
        return;
      }

      // Initialize from state
      await this.initializeFromState();

      // Process phases until timeout or completion
      await this.processPhases();

    } catch (error: any) {
      console.error(`[Chunked] Generation error for ${this.jobId}:`, error);
      await this.markFailed(error);
    }
  }

  private async loadJob(): Promise<void> {
    this.job = await db.query.demoGenerationJobs.findFirst({
      where: eq(demoGenerationJobs.id, this.jobId),
    });

    if (!this.job) {
      throw new Error(`Job ${this.jobId} not found`);
    }

    this.config = this.job.config as DemoGenerationConfigV2;
    this.monthlyPlan = this.config.monthlyPlan!;
    this.seed = this.job.seed;
    this.state = (this.job.generationState as GenerationState) || {};
    this.logs = (this.job.logs as LogEntry[]) || [];
  }

  private async initializeFromState(): Promise<void> {
    // Initialize RNG and helpers
    this.rng = new SeededRNG(this.seed);
    this.localization = getProvider(this.config!.country, this.rng.child('loc'));
    this.template = getTemplate(this.config!.industry);
    this.allocator = new MonthlyAllocator(this.rng.child('alloc'));
    this.valueAllocator = new ValueAllocator(this.rng.child('values'));
    this.allocationPlan = this.allocator.createAllocationPlan(this.monthlyPlan!);

    // Restore state
    if (!this.state.metrics) {
      this.state.metrics = {
        tenantId: this.state.tenantId || '',
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
    }

    if (!this.state.monthlyActuals) {
      this.state.monthlyActuals = {};
      for (const month of this.allocationPlan!.months) {
        this.state.monthlyActuals[month.month] = {
          month: month.month,
          leads: 0,
          contacts: 0,
          companies: 0,
          deals: 0,
          closedWonDeals: 0,
          closedWonValue: 0,
          pipelineValue: 0,
        };
      }
    }
  }

  private shouldContinueLater(): boolean {
    const elapsed = Date.now() - this.startTime;
    return elapsed > MAX_EXECUTION_TIME_MS;
  }

  private async processPhases(): Promise<void> {
    const phase = (this.job.generationPhase as GenerationPhase) || 'init';
    this.log('info', `Continuing from phase: ${phase}`);

    // Process phases in order
    const phases: GenerationPhase[] = [
      'init', 'tenant', 'users', 'pipeline', 'tags',
      'companies', 'contacts', 'deals', 'activities', 'verify', 'completed'
    ];

    const startIdx = phases.indexOf(phase);

    for (let i = startIdx; i < phases.length; i++) {
      const currentPhase = phases[i];

      if (this.shouldContinueLater()) {
        this.log('info', `Timeout approaching, scheduling continuation at phase: ${currentPhase}`);
        await this.saveStateAndContinue(currentPhase);
        return;
      }

      await this.executePhase(currentPhase);
    }
  }

  private async executePhase(phase: GenerationPhase): Promise<void> {
    switch (phase) {
      case 'init':
        await this.updatePhase('tenant', 5, 'Creating tenant');
        break;

      case 'tenant':
        await this.createTenant();
        await this.updatePhase('users', 10, 'Creating users');
        break;

      case 'users':
        await this.createUsers();
        await this.updatePhase('pipeline', 15, 'Creating pipeline');
        break;

      case 'pipeline':
        await this.createPipeline();
        await this.updatePhase('tags', 20, 'Creating tags');
        break;

      case 'tags':
        await this.createTags();
        await this.updatePhase('companies', 25, 'Preparing companies');
        break;

      case 'companies':
        await this.createCompaniesChunked();
        if (!this.state.pendingCompanies?.length) {
          await this.updatePhase('contacts', 40, 'Preparing contacts');
        }
        break;

      case 'contacts':
        await this.createContactsChunked();
        if (!this.state.pendingContacts?.length) {
          await this.updatePhase('deals', 55, 'Preparing deals');
        }
        break;

      case 'deals':
        await this.createDealsChunked();
        if (!this.state.pendingDeals?.length) {
          await this.updatePhase('activities', 70, 'Preparing activities');
        }
        break;

      case 'activities':
        await this.createActivitiesChunked();
        if (!this.state.pendingActivities?.length) {
          await this.updatePhase('verify', 90, 'Verifying');
        }
        break;

      case 'verify':
        await this.finalizeGeneration();
        break;

      case 'completed':
        // Already done
        break;
    }
  }

  private async createTenant(): Promise<void> {
    if (this.state.tenantId) {
      this.log('info', `Tenant already exists: ${this.state.tenantId}`);
      return;
    }

    const tenantName = this.config!.tenantName ||
      `Demo - ${this.config!.industry} (${this.config!.country})`;

    const [tenant] = await db.insert(tenants).values({
      name: tenantName,
    }).returning();

    this.state.tenantId = tenant.id;
    this.state.metrics!.tenantId = tenant.id;

    // Update job with tenant ID
    await db.update(demoGenerationJobs)
      .set({ createdTenantId: tenant.id })
      .where(eq(demoGenerationJobs.id, this.jobId));

    // Create metadata
    await db.insert(demoTenantMetadata).values({
      tenantId: tenant.id,
      generationJobId: this.jobId,
      country: this.config!.country,
      industry: this.config!.industry,
      startDate: new Date(this.config!.startDate),
    });

    this.log('info', `Created tenant: ${tenantName} (${tenant.id})`);
  }

  private async createUsers(): Promise<void> {
    if (this.state.userIds?.length) {
      this.log('info', `Users already exist: ${this.state.userIds.length}`);
      return;
    }

    const rng = this.rng!.child('users');
    const teamSize = this.config!.teamSize || 5;
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    const usersToCreate = [];
    for (let i = 0; i < teamSize; i++) {
      const gender = rng.bool() ? 'male' : 'female';
      const firstName = this.localization!.firstName(gender);
      const lastName = this.localization!.lastName();

      usersToCreate.push({
        tenantId: this.state.tenantId!,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo.gonthia.com`,
        passwordHash,
        role: i === 0 ? 'owner' as const : 'member' as const,
        firstName,
        lastName,
      });
    }

    const created = await db.insert(users).values(usersToCreate).returning({ id: users.id });
    this.state.userIds = created.map(u => u.id);
    this.state.metrics!.users = this.state.userIds.length;
    this.log('info', `Created ${this.state.userIds.length} users`);
  }

  private async createPipeline(): Promise<void> {
    if (this.state.stageMap && Object.keys(this.state.stageMap).length > 0) {
      this.log('info', `Pipeline already exists`);
      return;
    }

    const stages = this.template!.pipeline.stages;
    const stageMap: Record<string, string> = {};
    const openStageIds: string[] = [];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const isWon = stage.name.toLowerCase().includes('won') || stage.name.toLowerCase() === 'closed won';
      const isLost = stage.name.toLowerCase().includes('lost') || stage.name.toLowerCase() === 'closed lost';

      const [created] = await db.insert(pipelineStages).values({
        tenantId: this.state.tenantId!,
        name: stage.name,
        position: i,
        color: stage.color || '#6b7280',
        isWon,
        isLost,
      }).returning();

      stageMap[stage.name] = created.id;

      if (isWon) {
        this.state.wonStageId = created.id;
      } else if (isLost) {
        this.state.lostStageId = created.id;
      } else {
        openStageIds.push(created.id);
      }
    }

    this.state.stageMap = stageMap;
    this.state.openStageIds = openStageIds;
    this.state.metrics!.pipelineStages = stages.length;
    this.log('info', `Created ${stages.length} pipeline stages`);
  }

  private async createTags(): Promise<void> {
    const tagDefs = [
      { name: 'VIP', color: '#fbbf24' },
      { name: 'Enterprise', color: '#3b82f6' },
      { name: 'SMB', color: '#10b981' },
      { name: 'Partner', color: '#8b5cf6' },
      { name: 'Referral', color: '#f97316' },
      { name: 'Inbound', color: '#06b6d4' },
      { name: 'Hot Lead', color: '#ef4444' },
      { name: 'Cold', color: '#6b7280' },
    ];

    await db.insert(tags).values(
      tagDefs.map(tag => ({
        tenantId: this.state.tenantId!,
        name: tag.name,
        color: tag.color,
      }))
    );

    this.state.metrics!.tags = tagDefs.length;
    this.log('info', `Created ${tagDefs.length} tags`);
  }

  private async createCompaniesChunked(): Promise<void> {
    // Prepare all companies if not already done
    if (!this.state.pendingCompanies) {
      this.state.pendingCompanies = this.prepareCompanies();
      this.state.companyIds = [];
      this.log('info', `Prepared ${this.state.pendingCompanies.length} companies for creation`);
    }

    // Process in batches
    while (this.state.pendingCompanies.length > 0 && !this.shouldContinueLater()) {
      const batch = this.state.pendingCompanies.splice(0, BATCH_SIZE);
      const created = await db.insert(companies).values(batch).returning({ id: companies.id });
      this.state.companyIds!.push(...created.map(c => c.id));

      const progress = 25 + Math.round((1 - this.state.pendingCompanies.length / (this.state.pendingCompanies.length + this.state.companyIds!.length)) * 15);
      await this.updateProgress(progress, `Creating companies (${this.state.companyIds!.length} created)`);
    }

    if (this.state.pendingCompanies.length === 0) {
      this.state.metrics!.companies = this.state.companyIds!.length;
      this.log('info', `Created ${this.state.companyIds!.length} companies`);
    }
  }

  private prepareCompanies(): any[] {
    const rng = this.rng!.child('companies');
    const companiesToCreate: any[] = [];

    for (const month of this.allocationPlan!.months) {
      for (const day of month.days) {
        if (!day.isBusinessDay) continue;

        const count = Math.round(day.metrics.companiesCreated || 0);
        for (let i = 0; i < count; i++) {
          const address = this.localization!.fullAddress();
          const name = this.localization!.companyName(this.config!.industry);

          companiesToCreate.push({
            tenantId: this.state.tenantId!,
            name,
            domain: this.localization!.companyDomain(name),
            industry: this.template!.name,
            size: rng.pick(['1-10', '11-50', '51-200', '201-500', '500+']),
            ownerId: rng.pick(this.state.userIds!),
            address: address.street,
            city: address.city,
            state: address.state,
            country: address.country,
            postalCode: address.postalCode,
            phone: this.localization!.phone(),
            website: `https://${this.localization!.companyDomain(name)}`,
            createdAt: this.allocator!.generateTimestamp(day.date),
          });
        }
      }
    }

    return companiesToCreate;
  }

  private async createContactsChunked(): Promise<void> {
    if (!this.state.pendingContacts) {
      this.state.pendingContacts = this.prepareContacts();
      this.state.contactIds = [];
      this.log('info', `Prepared ${this.state.pendingContacts.length} contacts for creation`);
    }

    while (this.state.pendingContacts.length > 0 && !this.shouldContinueLater()) {
      const batch = this.state.pendingContacts.splice(0, BATCH_SIZE);
      const created = await db.insert(contacts).values(batch).returning({ id: contacts.id });
      this.state.contactIds!.push(...created.map(c => c.id));

      const progress = 40 + Math.round((1 - this.state.pendingContacts.length / (this.state.pendingContacts.length + this.state.contactIds!.length)) * 15);
      await this.updateProgress(progress, `Creating contacts (${this.state.contactIds!.length} created)`);
    }

    if (this.state.pendingContacts.length === 0) {
      this.state.metrics!.contacts = this.state.contactIds!.length;
      this.log('info', `Created ${this.state.contactIds!.length} contacts`);
    }
  }

  private prepareContacts(): any[] {
    const rng = this.rng!.child('contacts');
    const contactsToCreate: any[] = [];

    for (const month of this.allocationPlan!.months) {
      const monthTarget = this.monthlyPlan!.months.find(m => m.month === month.month);
      if (!monthTarget) continue;

      const leadsNeeded = monthTarget.targets.leadsCreated;
      let leadsCreated = 0;

      for (const day of month.days) {
        if (!day.isBusinessDay) continue;

        const count = Math.round(day.metrics.contactsCreated || 0);
        const leadsForDay = Math.round(day.metrics.leadsCreated || 0);
        let dayLeads = 0;

        for (let i = 0; i < count; i++) {
          const gender = rng.bool() ? 'male' : 'female';
          const firstName = this.localization!.firstName(gender);
          const lastName = this.localization!.lastName();
          const hasCompany = rng.bool(0.7) && this.state.companyIds!.length > 0;

          let status: 'lead' | 'prospect' | 'customer' | 'churned' | 'other';
          if (leadsCreated < leadsNeeded && dayLeads < leadsForDay) {
            status = 'lead';
            leadsCreated++;
            dayLeads++;
          } else {
            status = rng.pick(['prospect', 'prospect', 'customer', 'churned', 'other']);
          }

          contactsToCreate.push({
            tenantId: this.state.tenantId!,
            firstName,
            lastName,
            email: this.localization!.email(firstName, lastName),
            phone: this.localization!.phone(),
            companyId: hasCompany ? rng.pick(this.state.companyIds!) : null,
            ownerId: rng.pick(this.state.userIds!),
            status,
            createdAt: this.allocator!.generateTimestamp(day.date),
          });
        }
      }
    }

    return contactsToCreate;
  }

  private async createDealsChunked(): Promise<void> {
    if (!this.state.pendingDeals) {
      this.state.pendingDeals = this.prepareDeals();
      this.state.dealIds = [];
      this.log('info', `Prepared ${this.state.pendingDeals.length} deals for creation`);
    }

    while (this.state.pendingDeals.length > 0 && !this.shouldContinueLater()) {
      const batch = this.state.pendingDeals.splice(0, BATCH_SIZE);
      const created = await db.insert(deals).values(batch).returning({ id: deals.id });
      this.state.dealIds!.push(...created.map(d => d.id));

      const progress = 55 + Math.round((1 - this.state.pendingDeals.length / (this.state.pendingDeals.length + this.state.dealIds!.length)) * 15);
      await this.updateProgress(progress, `Creating deals (${this.state.dealIds!.length} created)`);
    }

    if (this.state.pendingDeals.length === 0) {
      this.state.metrics!.deals = this.state.dealIds!.length;
      this.log('info', `Created ${this.state.dealIds!.length} deals`);
    }
  }

  private prepareDeals(): any[] {
    const rng = this.rng!.child('deals');
    const dealsToCreate: any[] = [];
    const constraints: ValueConstraints = {
      minValue: this.template!.deals.minValue,
      maxValue: this.template!.deals.maxValue,
      avgValue: this.template!.deals.avgValue,
      whaleRatio: (this.config!.realism?.whaleRatio || 5) / 100,
    };

    for (const month of this.allocationPlan!.months) {
      const monthTarget = this.monthlyPlan!.months.find(m => m.month === month.month);
      if (!monthTarget) continue;

      const { dealsCreated, closedWonCount, closedWonValue, pipelineAddedValue } = monthTarget.targets;

      const allocation = this.valueAllocator!.allocatePipelineValues(
        dealsCreated,
        closedWonCount,
        pipelineAddedValue,
        closedWonValue,
        constraints
      );

      // Combine all deal values
      const allDealValues = [
        ...allocation.closedWonValues,
        ...allocation.openDealValues,
        ...allocation.pipelineValues.slice(0, Math.max(0, dealsCreated - allocation.closedWonValues.length - allocation.openDealValues.length)),
      ];

      let dealsCreatedCount = 0;

      for (const day of month.days) {
        if (!day.isBusinessDay) continue;

        const count = Math.round(day.metrics.dealsCreated || 0);

        for (let i = 0; i < count && dealsCreatedCount < dealsCreated; i++) {
          const dealIdx = dealsCreatedCount;
          const isWon = dealIdx < closedWonCount;
          const isLost = !isWon && rng.bool(0.2);
          const value = allDealValues[dealIdx] || this.template!.deals.avgValue;

          let stageId: string;
          let closedAt: Date | null = null;

          if (isWon) {
            stageId = this.state.wonStageId!;
            closedAt = this.allocator!.generateTimestamp(day.date);
          } else if (isLost) {
            stageId = this.state.lostStageId!;
            closedAt = this.allocator!.generateTimestamp(day.date);
          } else {
            stageId = rng.pick(this.state.openStageIds!);
          }

          const dealTypes = ['New Business', 'Upsell', 'Renewal', 'Expansion'];

          dealsToCreate.push({
            tenantId: this.state.tenantId!,
            name: `${this.localization!.companyName(this.config!.industry)} - ${rng.pick(dealTypes)}`,
            value,
            stageId,
            contactId: this.state.contactIds!.length > 0 ? rng.pick(this.state.contactIds!) : null,
            companyId: this.state.companyIds!.length > 0 ? rng.pick(this.state.companyIds!) : null,
            ownerId: rng.pick(this.state.userIds!),
            expectedCloseDate: new Date(day.date.getTime() + rng.int(7, 90) * 24 * 60 * 60 * 1000),
            closedAt,
            createdAt: this.allocator!.generateTimestamp(day.date),
          });

          dealsCreatedCount++;
        }
      }
    }

    return dealsToCreate;
  }

  private async createActivitiesChunked(): Promise<void> {
    if (!this.state.pendingActivities) {
      this.state.pendingActivities = this.prepareActivities();
      this.log('info', `Prepared ${this.state.pendingActivities.length} activities for creation`);
    }

    let activitiesCreated = this.state.metrics!.activities || 0;

    while (this.state.pendingActivities.length > 0 && !this.shouldContinueLater()) {
      const batch = this.state.pendingActivities.splice(0, BATCH_SIZE);
      await db.insert(activities).values(batch);
      activitiesCreated += batch.length;

      const progress = 70 + Math.round((1 - this.state.pendingActivities.length / (this.state.pendingActivities.length + activitiesCreated)) * 20);
      await this.updateProgress(progress, `Creating activities (${activitiesCreated} created)`);
    }

    this.state.metrics!.activities = activitiesCreated;

    if (this.state.pendingActivities.length === 0) {
      this.log('info', `Created ${activitiesCreated} activities`);
    }
  }

  private prepareActivities(): any[] {
    const rng = this.rng!.child('activities');
    const activityTypes: string[] = ['call', 'email', 'meeting', 'note', 'task'];
    const activitiesToCreate: any[] = [];

    // Create activities for deals
    for (const dealId of this.state.dealIds!) {
      const activityCount = rng.int(2, 8);
      for (let i = 0; i < activityCount; i++) {
        const type = rng.pick(activityTypes);
        activitiesToCreate.push({
          tenantId: this.state.tenantId!,
          type,
          subject: this.getActivitySubject(type),
          description: `Demo activity for ${type}`,
          dealId,
          ownerId: rng.pick(this.state.userIds!),
          completed: rng.bool(0.7),
          createdAt: new Date(),
        });
      }
    }

    return activitiesToCreate;
  }

  private getActivitySubject(type: string): string {
    const subjects: Record<string, string[]> = {
      call: ['Discovery call', 'Follow-up call', 'Demo call', 'Check-in call'],
      email: ['Introduction email', 'Proposal sent', 'Follow-up email', 'Thank you email'],
      meeting: ['Initial meeting', 'Product demo', 'Negotiation meeting', 'Contract review'],
      note: ['Meeting notes', 'Call summary', 'Client feedback', 'Internal notes'],
      task: ['Send proposal', 'Schedule demo', 'Prepare contract', 'Follow up'],
    };
    return this.rng!.pick(subjects[type] || ['Activity']);
  }

  private async finalizeGeneration(): Promise<void> {
    this.log('info', 'Finalizing generation');

    // Update metrics
    await db.update(demoGenerationJobs)
      .set({
        status: 'completed',
        generationPhase: 'completed',
        progress: 100,
        currentStep: 'Completed',
        metrics: this.state.metrics,
        generationState: this.state,
        logs: this.logs,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(demoGenerationJobs.id, this.jobId));

    this.log('info', `Generation completed: ${this.state.metrics!.contacts} contacts, ${this.state.metrics!.companies} companies, ${this.state.metrics!.deals} deals`);
  }

  private async updatePhase(phase: GenerationPhase, progress: number, step: string): Promise<void> {
    await db.update(demoGenerationJobs)
      .set({
        generationPhase: phase,
        progress,
        currentStep: step,
        generationState: this.state,
        logs: this.logs,
        updatedAt: new Date(),
      })
      .where(eq(demoGenerationJobs.id, this.jobId));
  }

  private async updateProgress(progress: number, step: string): Promise<void> {
    await db.update(demoGenerationJobs)
      .set({
        progress,
        currentStep: step,
        generationState: this.state,
        updatedAt: new Date(),
      })
      .where(eq(demoGenerationJobs.id, this.jobId));
  }

  private async saveStateAndContinue(phase: GenerationPhase): Promise<void> {
    // Save current state
    await db.update(demoGenerationJobs)
      .set({
        generationPhase: phase,
        generationState: this.state,
        logs: this.logs,
        updatedAt: new Date(),
      })
      .where(eq(demoGenerationJobs.id, this.jobId));

    // Schedule continuation
    this.scheduleContinuation();
  }

  private scheduleContinuation(): void {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (!appUrl) {
      console.error('[Chunked] No app URL configured for continuation');
      return;
    }

    const url = `${appUrl.startsWith('http') ? appUrl : `https://${appUrl}`}/api/master/demo-generator/${this.jobId}/continue`;
    const token = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET;

    this.log('info', `Scheduling continuation at ${url}`);

    // Fire-and-forget call
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-continuation-token': token || '',
      },
    }).catch((error) => {
      console.error('[Chunked] Failed to schedule continuation:', error);
    });
  }

  private async markFailed(error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.log('error', `Generation failed: ${errorMessage}`);

    await db.update(demoGenerationJobs)
      .set({
        status: 'failed',
        errorMessage,
        errorStack,
        generationState: this.state,
        logs: this.logs,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(demoGenerationJobs.id, this.jobId));
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    this.logs.push(entry);
    console.log(`[Chunked ${this.jobId}] ${level}: ${message}`);
  }
}
