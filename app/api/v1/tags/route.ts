import { NextRequest } from 'next/server';
import { db, tags } from '@/lib/db';
import { requireTenantAuth, requireTenantWriteAccess } from '@/lib/auth/middleware';
import { createTagSchema, tagQuerySchema } from '@/validations/tag';
import { successResponse, validationError, conflictError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull, ilike } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = tagQuerySchema.parse(Object.fromEntries(searchParams));

    const conditions = [
      eq(tags.tenantId, auth.tenantId),
      isNull(tags.deletedAt),
    ];

    if (query.search) {
      // BUG-008 FIX: Escape SQL LIKE wildcards in search term
      conditions.push(ilike(tags.name, toSearchPattern(query.search)));
    }

    const tagList = await db.query.tags.findMany({
      where: and(...conditions),
      orderBy: (tags, { asc }) => [asc(tags.name)],
    });

    return successResponse({ tags: tagList });
  } catch (error) {
    console.error('List tags error:', error);
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
    const result = createTagSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Check for duplicate name
    const existing = await db.query.tags.findFirst({
      where: and(
        eq(tags.tenantId, auth.tenantId),
        eq(tags.name, result.data.name),
        isNull(tags.deletedAt)
      ),
    });

    if (existing) {
      return conflictError('A tag with this name already exists');
    }

    const [tag] = await db.insert(tags).values({
      ...result.data,
      tenantId: auth.tenantId,
    }).returning();

    return successResponse({ tag });
  } catch (error) {
    console.error('Create tag error:', error);
    return internalError();
  }
}
