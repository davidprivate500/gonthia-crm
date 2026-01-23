import { db } from '@/lib/db';
import {
  tenants, users, contacts, companies, deals, pipelineStages,
  activities, tags, contactTags, demoGenerationJobs, demoTenantMetadata,
} from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';
import { SeededRNG, generateSeed } from './rng';
import { GrowthPlanner } from './growth-planner';
import { getProvider } from '../localization';
import { getTemplate } from '../templates';
import type {
  DemoGenerationConfig, GenerationResult, GenerationMetrics,
  MonthlyTargets, MonthlyMetrics, LogEntry, LocalizationProvider, IndustryTemplate,
} from '../types';

// Transaction type extracted from db.transaction callback parameter
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const BATCH_SIZE = 500;
const DEFAULT_PASSWORD = 'Demo123!'; // Default password for all demo users

export class DemoGenerator {
  private rng: SeededRNG;
  private config: DemoGenerationConfig;
  private jobId: string;
  private seed: string;
  private localization: LocalizationProvider;
  private template: IndustryTemplate;
  private growthPlan: MonthlyTargets[];
  private logs: LogEntry[] = [];

  // Generated data references
  private tenantId: string = '';
  private userIds: string[] = [];
  private stageMap: Map<string, string> = new Map(); // stage name -> id
  private companyIds: string[] = [];
  private contactIds: string[] = [];
  private dealIds: string[] = [];

  // Metrics tracking
  private metrics: GenerationMetrics = {
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

  constructor(jobId: string, config: DemoGenerationConfig, seed?: string) {
    this.jobId = jobId;
    this.config = config;
    this.seed = seed || generateSeed();
    this.rng = new SeededRNG(this.seed);
    this.localization = getProvider(config.country, this.rng.child('loc'));
    this.template = getTemplate(config.industry);

    const planner = new GrowthPlanner(config);
    this.growthPlan = planner.plan();
  }

  /**
   * Execute the full generation process
   */
  async generate(): Promise<GenerationResult> {
    this.log('info', `Starting generation with seed: ${this.seed}`);

    try {
      // Update job to running
      await this.updateJobStatus('running', 0, 'Initializing');

      // Use a transaction for atomicity
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

        // Step 6: Create contacts (55%)
        await this.updateJobStatus('running', 30, 'Creating contacts');
        await this.createContacts(tx);

        // Step 7: Create deals (80%)
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
      this.calculateMonthlyBreakdown();
      this.metrics.tenantId = this.tenantId;

      // Update job to completed
      await this.updateJobStatus('completed', 100, 'Complete');

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

  /**
   * Create the tenant
   */
  private async createTenant(tx: DbTransaction): Promise<void> {
    const [tenant] = await tx.insert(tenants).values({
      name: this.config.tenantName,
    }).returning();

    this.tenantId = tenant.id;
    this.log('info', `Created tenant: ${tenant.name} (${tenant.id})`);
  }

  /**
   * Create team members
   */
  private async createUsers(tx: DbTransaction): Promise<void> {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    const teamSize = this.config.teamSize;

    const usersToCreate = [];
    const rng = this.rng.child('users');

    // Create owner first
    const ownerGender = rng.bool() ? 'male' : 'female';
    usersToCreate.push({
      tenantId: this.tenantId,
      email: `owner@${this.localization.companyDomain(this.config.tenantName)}`,
      passwordHash,
      role: 'owner' as const,
      firstName: this.localization.firstName(ownerGender),
      lastName: this.localization.lastName(),
      createdAt: new Date(this.config.startDate),
    });

    // Create remaining team members
    const roles: Array<'admin' | 'member'> = ['admin', 'member', 'member', 'member'];

    for (let i = 1; i < teamSize; i++) {
      const gender = rng.bool() ? 'male' : 'female';
      const firstName = this.localization.firstName(gender);
      const lastName = this.localization.lastName();
      const role = roles[Math.min(i - 1, roles.length - 1)];

      // Spread creation dates
      const monthIndex = Math.floor((i / teamSize) * this.growthPlan.length);
      const month = this.growthPlan[Math.min(monthIndex, this.growthPlan.length - 1)];
      const createdAt = rng.date(month.startDate, month.endDate);

      usersToCreate.push({
        tenantId: this.tenantId,
        email: this.localization.email(firstName, lastName, this.localization.companyDomain(this.config.tenantName)),
        passwordHash,
        role,
        firstName,
        lastName,
        createdAt,
      });
    }

    // Batch insert
    const created = await tx.insert(users).values(usersToCreate).returning({ id: users.id });
    this.userIds = created.map((u) => u.id);
    this.metrics.users = this.userIds.length;
    this.log('info', `Created ${this.userIds.length} users`);
  }

  /**
   * Create pipeline stages from template
   */
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

    const created = await tx.insert(pipelineStages).values(stagesToCreate).returning({ id: pipelineStages.id, name: pipelineStages.name });

    for (const stage of created) {
      this.stageMap.set(stage.name, stage.id);
    }

    this.metrics.pipelineStages = created.length;
    this.log('info', `Created ${created.length} pipeline stages`);
  }

  /**
   * Create tags
   */
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

  /**
   * Create companies
   */
  private async createCompanies(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('companies');
    const companiesToCreate = [];

    for (const month of this.growthPlan) {
      const count = month.targets.companies;

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
          createdAt: rng.businessDate(month.startDate, month.endDate),
        });
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

  /**
   * Create contacts
   */
  private async createContacts(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('contacts');
    const contactsToCreate = [];
    const { dropOffRate } = this.config.realism;

    const statuses: Array<'lead' | 'prospect' | 'customer' | 'churned' | 'other'> = [
      'lead', 'lead', 'lead', 'prospect', 'prospect', 'customer', 'churned', 'other',
    ];

    for (const month of this.growthPlan) {
      const count = month.targets.contacts;

      for (let i = 0; i < count; i++) {
        // Apply drop-off rate
        if (rng.bool(dropOffRate / 100)) {
          continue;
        }

        const gender = rng.bool() ? 'male' : 'female';
        const firstName = this.localization.firstName(gender);
        const lastName = this.localization.lastName();
        const hasCompany = rng.bool(0.7); // 70% have a company
        const companyId = hasCompany && this.companyIds.length > 0
          ? rng.pick(this.companyIds)
          : null;

        contactsToCreate.push({
          tenantId: this.tenantId,
          firstName,
          lastName,
          email: this.localization.email(firstName, lastName),
          phone: this.localization.phone(),
          companyId,
          ownerId: rng.pick(this.userIds),
          status: rng.pick(statuses),
          createdAt: rng.businessDate(month.startDate, month.endDate),
        });
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

  /**
   * Create deals
   */
  private async createDeals(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('deals');
    const dealsToCreate = [];
    const { whaleRatio } = this.config.realism;
    const { minValue, maxValue, avgValue, winRate } = this.template.deals;

    // Get stage IDs for distribution
    const openStages = this.template.pipeline.stages.filter((s) => s.type === 'open');
    const wonStages = this.template.pipeline.stages.filter((s) => s.type === 'won');
    const lostStages = this.template.pipeline.stages.filter((s) => s.type === 'lost');

    let totalPipelineValue = 0;
    let totalClosedWonValue = 0;
    let closedWonCount = 0;

    for (const month of this.growthPlan) {
      const count = month.targets.deals;

      for (let i = 0; i < count; i++) {
        const value = rng.dealValue(minValue, maxValue, avgValue, whaleRatio / 100);
        const isWon = rng.bool(winRate);
        const isLost = !isWon && rng.bool(0.5); // 50% of non-won are lost

        let stageName: string;
        if (isWon) {
          stageName = rng.pick(wonStages).name;
          totalClosedWonValue += value;
          closedWonCount++;
        } else if (isLost) {
          stageName = rng.pick(lostStages).name;
        } else {
          // Open deal - pick a stage based on probability weights
          const weights = openStages.map((s) => s.probability);
          stageName = rng.pickWeighted(openStages, weights).name;
          totalPipelineValue += value;
        }

        const stageId = this.stageMap.get(stageName);
        if (!stageId) continue;

        const contactId = this.contactIds.length > 0 ? rng.pick(this.contactIds) : null;
        const companyId = this.companyIds.length > 0 ? rng.pick(this.companyIds) : null;
        const createdAt = rng.businessDate(month.startDate, month.endDate);

        // Expected close date is 2-8 weeks from creation
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
          probability: isWon ? 100 : isLost ? 0 : rng.int(20, 80),
          createdAt,
        });
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
    this.metrics.closedWonCount = closedWonCount;
    this.log('info', `Created ${this.dealIds.length} deals`);
  }

  /**
   * Create activities
   */
  private async createActivities(tx: DbTransaction): Promise<void> {
    const rng = this.rng.child('activities');
    const activitiesToCreate = [];
    const { callToEmailRatio, avgPerContact } = this.template.activities;

    const activityTypes: Array<'note' | 'call' | 'email' | 'meeting' | 'task'> = ['note', 'call', 'email', 'meeting', 'task'];
    const typeWeights = [15, callToEmailRatio * 30, (1 - callToEmailRatio) * 30, 15, 10];

    const subjects = {
      note: ['Follow-up notes', 'Meeting summary', 'Client feedback', 'Status update', 'Action items'],
      call: ['Discovery call', 'Follow-up call', 'Demo call', 'Check-in', 'Onboarding call'],
      email: ['Introduction', 'Proposal sent', 'Follow-up', 'Thank you', 'Contract details'],
      meeting: ['Initial meeting', 'Demo session', 'Review meeting', 'Strategy session', 'Quarterly review'],
      task: ['Send proposal', 'Schedule demo', 'Update CRM', 'Prepare presentation', 'Follow up'],
    };

    // Create activities for a sample of contacts
    const sampleSize = Math.min(this.contactIds.length, Math.ceil(this.contactIds.length * 0.6));
    const sampledContacts = rng.pickMultiple(this.contactIds, sampleSize);

    for (const contactId of sampledContacts) {
      const activityCount = rng.int(1, avgPerContact * 2);

      for (let i = 0; i < activityCount; i++) {
        const type = rng.pickWeighted(activityTypes, typeWeights);
        const subject = rng.pick(subjects[type]);
        const userId = rng.pick(this.userIds);

        // Pick a random month for this activity
        const month = rng.pick(this.growthPlan);
        const createdAt = rng.businessDate(month.startDate, month.endDate);

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

  /**
   * Create demo tenant metadata
   */
  private async createDemoMetadata(tx: DbTransaction): Promise<void> {
    await tx.insert(demoTenantMetadata).values({
      tenantId: this.tenantId,
      generationJobId: this.jobId,
      country: this.config.country,
      industry: this.config.industry,
      startDate: new Date(this.config.startDate),
      isDemoGenerated: true,
      excludedFromAnalytics: true,
    });

    this.log('info', 'Created demo tenant metadata');
  }

  /**
   * Calculate monthly breakdown metrics
   */
  private calculateMonthlyBreakdown(): void {
    // Simplified calculation based on growth plan
    this.metrics.monthlyBreakdown = this.growthPlan.map((month) => ({
      month: `${month.year}-${String(month.month + 1).padStart(2, '0')}`,
      leads: month.targets.leads,
      contacts: month.targets.contacts,
      companies: month.targets.companies,
      deals: month.targets.deals,
      closedWonDeals: Math.round(month.targets.deals * this.template.deals.winRate),
      pipelineValue: Math.round(month.targets.pipelineValue),
      closedWonValue: Math.round(month.targets.closedWonValue),
    }));
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    status: 'pending' | 'running' | 'completed' | 'failed',
    progress: number,
    currentStep: string,
    errorMessage?: string
  ): Promise<void> {
    const updates: Partial<typeof demoGenerationJobs.$inferInsert> = {
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

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await db.update(demoGenerationJobs)
      .set(updates)
      .where(eq(demoGenerationJobs.id, this.jobId));
  }

  /**
   * Add log entry
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
  }

  /**
   * Get the seed used for this generation
   */
  getSeed(): string {
    return this.seed;
  }
}
