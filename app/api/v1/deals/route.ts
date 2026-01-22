import { NextRequest } from 'next/server';
import { db, deals, pipelineStages } from '@/lib/db';
import { requireAuth, requireWriteAccess } from '@/lib/auth/middleware';
import { createDealSchema, dealQuerySchema } from '@/validations/deal';
import { successResponse, validationError, notFoundError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, isNull, ilike, count, gte, lte } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = dealQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, sortBy, sortOrder, search, stageId, ownerId, contactId, companyId, minValue, maxValue, closeDateFrom, closeDateTo } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [
      eq(deals.tenantId, auth.tenantId),
      isNull(deals.deletedAt),
    ];

    if (search) {
      // BUG-008 FIX: Escape SQL LIKE wildcards in search term
      conditions.push(ilike(deals.title, toSearchPattern(search)));
    }

    if (stageId) {
      conditions.push(eq(deals.stageId, stageId));
    }

    if (ownerId) {
      conditions.push(eq(deals.ownerId, ownerId));
    }

    if (contactId) {
      conditions.push(eq(deals.contactId, contactId));
    }

    if (companyId) {
      conditions.push(eq(deals.companyId, companyId));
    }

    if (minValue !== undefined) {
      conditions.push(gte(deals.value, String(minValue)));
    }

    if (maxValue !== undefined) {
      conditions.push(lte(deals.value, String(maxValue)));
    }

    if (closeDateFrom) {
      conditions.push(gte(deals.expectedCloseDate, closeDateFrom));
    }

    if (closeDateTo) {
      conditions.push(lte(deals.expectedCloseDate, closeDateTo));
    }

    const [dealList, totalResult] = await Promise.all([
      db.query.deals.findMany({
        where: and(...conditions),
        with: {
          stage: true,
          contact: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
          company: {
            columns: { id: true, name: true },
          },
          owner: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        limit: pageSize,
        offset,
        orderBy: (deals, { asc, desc }) => {
          const orderFn = sortOrder === 'asc' ? asc : desc;
          return [orderFn(deals[sortBy])];
        },
      }),
      db.select({ count: count() })
        .from(deals)
        .where(and(...conditions)),
    ]);

    return paginatedResponse(dealList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List deals error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = createDealSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Verify stage exists and belongs to tenant
    const stage = await db.query.pipelineStages.findFirst({
      where: and(
        eq(pipelineStages.id, result.data.stageId),
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
    });

    if (!stage) {
      return notFoundError('Pipeline stage not found');
    }

    // Get max position in stage
    const maxPositionResult = await db.query.deals.findFirst({
      where: and(
        eq(deals.stageId, result.data.stageId),
        isNull(deals.deletedAt)
      ),
      orderBy: (deals, { desc }) => [desc(deals.position)],
    });

    const position = (maxPositionResult?.position ?? -1) + 1;

    const [deal] = await db.insert(deals).values({
      ...result.data,
      value: result.data.value ? String(result.data.value) : null,
      tenantId: auth.tenantId,
      ownerId: result.data.ownerId || auth.userId,
      position,
    }).returning();

    // Fetch complete deal
    const completeDeal = await db.query.deals.findFirst({
      where: eq(deals.id, deal.id),
      with: {
        stage: true,
        contact: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        company: {
          columns: { id: true, name: true },
        },
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return successResponse({ deal: completeDeal });
  } catch (error) {
    console.error('Create deal error:', error);
    return internalError();
  }
}
