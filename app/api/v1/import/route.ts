import { NextRequest } from 'next/server';
import { db, importJobs } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth/middleware';
import { createImportJobSchema, importJobQuerySchema } from '@/validations/import';
import { successResponse, validationError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = importJobQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, entityType, status } = query;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(importJobs.tenantId, auth.tenantId)];

    if (entityType) {
      conditions.push(eq(importJobs.entityType, entityType));
    }

    if (status) {
      conditions.push(eq(importJobs.status, status));
    }

    const [jobList, totalResult] = await Promise.all([
      db.query.importJobs.findMany({
        where: and(...conditions),
        with: {
          createdBy: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        limit: pageSize,
        offset,
        orderBy: (importJobs, { desc }) => [desc(importJobs.createdAt)],
      }),
      db.select({ count: count() })
        .from(importJobs)
        .where(and(...conditions)),
    ]);

    return paginatedResponse(jobList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List import jobs error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTenantAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string;
    const mappingsStr = formData.get('mappings') as string;

    if (!file) {
      return validationError({ file: ['File is required'] });
    }

    const result = createImportJobSchema.safeParse({
      entityType,
      fileName: file.name,
      mappings: mappingsStr ? JSON.parse(mappingsStr) : undefined,
    });

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Read file contents
    const fileContents = await file.text();
    const lines = fileContents.split('\n').filter(line => line.trim());
    const totalRows = lines.length - 1; // Subtract header row

    // Create import job
    const [job] = await db.insert(importJobs).values({
      entityType: result.data.entityType,
      fileName: result.data.fileName,
      totalRows,
      status: 'pending',
      tenantId: auth.tenantId,
      createdById: auth.userId,
      // Store mappings and file data for processing
      // In production, this would be stored in a blob storage
    }).returning();

    // TODO: Trigger async processing of the import
    // For MVP, we'll process synchronously in a simplified manner

    return successResponse({
      job: {
        ...job,
        message: 'Import job created. Processing will begin shortly.',
      },
    });
  } catch (error) {
    console.error('Create import job error:', error);
    return internalError();
  }
}
