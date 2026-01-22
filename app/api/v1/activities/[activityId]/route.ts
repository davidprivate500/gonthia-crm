import { NextRequest } from 'next/server';
import { db, activities } from '@/lib/db';
import { requireAuth, requireWriteAccess, requireDeleteAccess } from '@/lib/auth/middleware';
import { updateActivitySchema } from '@/validations/activity';
import { successResponse, validationError, notFoundError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ activityId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { activityId } = await params;

    const activity = await db.query.activities.findFirst({
      where: and(
        eq(activities.id, activityId),
        eq(activities.tenantId, auth.tenantId),
        isNull(activities.deletedAt)
      ),
      with: {
        contact: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        company: {
          columns: { id: true, name: true },
        },
        deal: {
          columns: { id: true, title: true },
          with: {
            stage: true,
          },
        },
        createdBy: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!activity) {
      return notFoundError('Activity not found');
    }

    return successResponse({ activity });
  } catch (error) {
    console.error('Get activity error:', error);
    return internalError();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { activityId } = await params;
    const body = await request.json();
    const result = updateActivitySchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Verify activity exists
    const existing = await db.query.activities.findFirst({
      where: and(
        eq(activities.id, activityId),
        eq(activities.tenantId, auth.tenantId),
        isNull(activities.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Activity not found');
    }

    await db.update(activities)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(activities.id, activityId));

    // Fetch complete activity
    const completeActivity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
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
    console.error('Update activity error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireDeleteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { activityId } = await params;

    const existing = await db.query.activities.findFirst({
      where: and(
        eq(activities.id, activityId),
        eq(activities.tenantId, auth.tenantId),
        isNull(activities.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Activity not found');
    }

    // Soft delete
    await db.update(activities)
      .set({ deletedAt: new Date() })
      .where(eq(activities.id, activityId));

    return successResponse({ message: 'Activity deleted' });
  } catch (error) {
    console.error('Delete activity error:', error);
    return internalError();
  }
}
