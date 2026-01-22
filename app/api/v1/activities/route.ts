import { NextRequest } from 'next/server';
import { db, activities } from '@/lib/db';
import { requireTenantAuth, requireTenantWriteAccess } from '@/lib/auth/middleware';
import { createActivitySchema, activityQuerySchema } from '@/validations/activity';
import { successResponse, validationError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, isNull, count, gte, lte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = activityQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, sortBy, sortOrder, type, contactId, companyId, dealId, createdById, scheduledFrom, scheduledTo, isCompleted } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [
      eq(activities.tenantId, auth.tenantId),
      isNull(activities.deletedAt),
    ];

    if (type) {
      conditions.push(eq(activities.type, type));
    }

    if (contactId) {
      conditions.push(eq(activities.contactId, contactId));
    }

    if (companyId) {
      conditions.push(eq(activities.companyId, companyId));
    }

    if (dealId) {
      conditions.push(eq(activities.dealId, dealId));
    }

    if (createdById) {
      conditions.push(eq(activities.createdById, createdById));
    }

    if (scheduledFrom) {
      conditions.push(gte(activities.scheduledAt, scheduledFrom));
    }

    if (scheduledTo) {
      conditions.push(lte(activities.scheduledAt, scheduledTo));
    }

    if (isCompleted !== undefined) {
      if (isCompleted) {
        conditions.push(isNull(activities.completedAt)!);
      } else {
        // completedAt is NOT null
        conditions.push(eq(activities.completedAt, activities.completedAt)); // This is a workaround
      }
    }

    const [activityList, totalResult] = await Promise.all([
      db.query.activities.findMany({
        where: and(...conditions),
        with: {
          contact: {
            columns: { id: true, firstName: true, lastName: true },
          },
          company: {
            columns: { id: true, name: true },
          },
          deal: {
            columns: { id: true, title: true },
          },
          createdBy: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        limit: pageSize,
        offset,
        orderBy: (activities, { asc, desc }) => {
          const orderFn = sortOrder === 'asc' ? asc : desc;
          return [orderFn(activities[sortBy])];
        },
      }),
      db.select({ count: count() })
        .from(activities)
        .where(and(...conditions)),
    ]);

    return paginatedResponse(activityList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List activities error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTenantWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = createActivitySchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const [activity] = await db.insert(activities).values({
      ...result.data,
      tenantId: auth.tenantId,
      createdById: auth.userId,
    }).returning();

    // Fetch complete activity
    const completeActivity = await db.query.activities.findFirst({
      where: eq(activities.id, activity.id),
      with: {
        contact: {
          columns: { id: true, firstName: true, lastName: true },
        },
        company: {
          columns: { id: true, name: true },
        },
        deal: {
          columns: { id: true, title: true },
        },
        createdBy: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return successResponse({ activity: completeActivity });
  } catch (error) {
    console.error('Create activity error:', error);
    return internalError();
  }
}
