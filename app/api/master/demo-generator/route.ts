import { NextRequest } from 'next/server';
import { db, demoGenerationJobs, demoTenantMetadata, tenants } from '@/lib/db';
import { requireMasterAdmin, requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { createDemoSchema, listJobsQuerySchema } from '@/validations/demo-generator';
import {
  successResponse, validationError, formatZodErrors,
  paginatedResponse, internalError, badRequestError,
} from '@/lib/api/response';
import { eq, desc, asc, ilike, and, sql } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';
import { DemoGenerator, mergeWithDefaults, generateSeed } from '@/lib/demo-generator';

// POST /api/master/demo-generator - Start a new demo generation
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = createDemoSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Merge with defaults
    const config = mergeWithDefaults(result.data);

    // Generate or use provided seed
    const seed = result.data.seed || generateSeed();

    // Create job record
    const [job] = await db.insert(demoGenerationJobs).values({
      createdById: auth.userId,
      status: 'pending',
      config,
      seed,
      progress: 0,
      currentStep: 'Queued',
      logs: [],
    }).returning();

    // Start generation (synchronous for now, could be async later)
    const generator = new DemoGenerator(job.id, config, seed);

    // Run generation in the background but respond immediately
    // For simplicity, we run synchronously here
    // In production, you might want to use a job queue
    generator.generate().catch((error) => {
      console.error('Demo generation failed:', error);
    });

    return successResponse({
      jobId: job.id,
      status: 'running',
      seed,
      estimatedSeconds: Math.ceil(
        (config.targets.leads + config.targets.contacts + config.targets.companies) / 5000
      ),
    });
  } catch (error) {
    console.error('Create demo generation error:', error);
    return internalError();
  }
}

// GET /api/master/demo-generator - List demo generation jobs
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = listJobsQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, status, country, industry, search, sortBy, sortOrder } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(demoGenerationJobs.status, status));
    }

    // For country/industry filter, we need to join with metadata or parse config JSON
    // For simplicity, we'll search in config JSON
    if (country) {
      conditions.push(
        sql`${demoGenerationJobs.config}->>'country' = ${country}`
      );
    }

    if (industry) {
      conditions.push(
        sql`${demoGenerationJobs.config}->>'industry' = ${industry}`
      );
    }

    if (search) {
      const searchPattern = toSearchPattern(search);
      conditions.push(
        sql`${demoGenerationJobs.config}->>'tenantName' ILIKE ${searchPattern}`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(demoGenerationJobs)
      .where(whereClause);

    // Build order by clause
    let orderByClause;
    switch (sortBy) {
      case 'completedAt':
        orderByClause = sortOrder === 'asc'
          ? asc(demoGenerationJobs.completedAt)
          : desc(demoGenerationJobs.completedAt);
        break;
      case 'tenantName':
        orderByClause = sortOrder === 'asc'
          ? asc(sql`${demoGenerationJobs.config}->>'tenantName'`)
          : desc(sql`${demoGenerationJobs.config}->>'tenantName'`);
        break;
      default:
        orderByClause = sortOrder === 'asc'
          ? asc(demoGenerationJobs.createdAt)
          : desc(demoGenerationJobs.createdAt);
    }

    // Get jobs with tenant info
    const jobs = await db.select({
      id: demoGenerationJobs.id,
      status: demoGenerationJobs.status,
      config: demoGenerationJobs.config,
      seed: demoGenerationJobs.seed,
      createdTenantId: demoGenerationJobs.createdTenantId,
      progress: demoGenerationJobs.progress,
      currentStep: demoGenerationJobs.currentStep,
      metrics: demoGenerationJobs.metrics,
      errorMessage: demoGenerationJobs.errorMessage,
      startedAt: demoGenerationJobs.startedAt,
      completedAt: demoGenerationJobs.completedAt,
      createdAt: demoGenerationJobs.createdAt,
    })
      .from(demoGenerationJobs)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(orderByClause);

    // Get tenant names for completed jobs
    const tenantIds = jobs
      .filter((j) => j.createdTenantId)
      .map((j) => j.createdTenantId!);

    let tenantMap = new Map<string, string>();
    if (tenantIds.length > 0) {
      const tenantList = await db.select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(sql`${tenants.id} IN (${sql.join(tenantIds.map(id => sql`${id}::uuid`), sql`, `)})`);
      tenantMap = new Map(tenantList.map((t) => [t.id, t.name]));
    }

    // Format response
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      status: job.status,
      config: job.config,
      seed: job.seed,
      createdTenantId: job.createdTenantId,
      tenantName: job.createdTenantId ? tenantMap.get(job.createdTenantId) : null,
      progress: job.progress,
      currentStep: job.currentStep,
      metrics: job.metrics,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    }));

    return paginatedResponse(formattedJobs, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List demo generation jobs error:', error);
    return internalError();
  }
}
