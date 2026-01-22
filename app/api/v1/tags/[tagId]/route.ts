import { NextRequest } from 'next/server';
import { db, tags, contactTags } from '@/lib/db';
import { requireTenantWriteAccess, requireTenantDeleteAccess } from '@/lib/auth/middleware';
import { updateTagSchema } from '@/validations/tag';
import { successResponse, validationError, notFoundError, conflictError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull, ne } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ tagId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tagId } = await params;
    const body = await request.json();
    const result = updateTagSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Verify tag exists
    const existing = await db.query.tags.findFirst({
      where: and(
        eq(tags.id, tagId),
        eq(tags.tenantId, auth.tenantId),
        isNull(tags.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Tag not found');
    }

    // Check for duplicate name if name is being changed
    if (result.data.name && result.data.name !== existing.name) {
      const duplicate = await db.query.tags.findFirst({
        where: and(
          eq(tags.tenantId, auth.tenantId),
          eq(tags.name, result.data.name),
          ne(tags.id, tagId),
          isNull(tags.deletedAt)
        ),
      });

      if (duplicate) {
        return conflictError('A tag with this name already exists');
      }
    }

    const [updated] = await db.update(tags)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(tags.id, tagId))
      .returning();

    return successResponse({ tag: updated });
  } catch (error) {
    console.error('Update tag error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantDeleteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tagId } = await params;

    const existing = await db.query.tags.findFirst({
      where: and(
        eq(tags.id, tagId),
        eq(tags.tenantId, auth.tenantId),
        isNull(tags.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Tag not found');
    }

    // Remove all contact associations
    await db.delete(contactTags)
      .where(eq(contactTags.tagId, tagId));

    // Soft delete
    await db.update(tags)
      .set({ deletedAt: new Date() })
      .where(eq(tags.id, tagId));

    return successResponse({ message: 'Tag deleted' });
  } catch (error) {
    console.error('Delete tag error:', error);
    return internalError();
  }
}
