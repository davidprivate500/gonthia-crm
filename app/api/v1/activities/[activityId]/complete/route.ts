import { NextRequest } from 'next/server';
import { db, activities } from '@/lib/db';
import { requireWriteAccess } from '@/lib/auth/middleware';
import { successResponse, notFoundError, internalError } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ activityId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { activityId } = await params;

    if (!auth.tenantId) {
      return notFoundError('Activity not found');
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

    // Mark as completed
    await db.update(activities)
      .set({
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(activities.id, activityId))
      .returning();

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
    console.error('Complete activity error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { activityId } = await params;

    if (!auth.tenantId) {
      return notFoundError('Activity not found');
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

    // Mark as incomplete
    const [updatedActivity] = await db.update(activities)
      .set({
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(activities.id, activityId))
      .returning();

    return successResponse({ activity: updatedActivity });
  } catch (error) {
    console.error('Uncomplete activity error:', error);
    return internalError();
  }
}
