import { NextRequest } from 'next/server';
import { db, companies } from '@/lib/db';
import { requireAuth, requireWriteAccess } from '@/lib/auth/middleware';
import { createCompanySchema, companyQuerySchema } from '@/validations/company';
import { successResponse, validationError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, isNull, ilike, or, count } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = companyQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, sortBy, sortOrder, search, industry, size, ownerId } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [
      eq(companies.tenantId, auth.tenantId),
      isNull(companies.deletedAt),
    ];

    if (search) {
      // BUG-008 FIX: Escape SQL LIKE wildcards in search term
      const searchPattern = toSearchPattern(search);
      conditions.push(
        or(
          ilike(companies.name, searchPattern),
          ilike(companies.domain, searchPattern)
        )!
      );
    }

    if (industry) {
      conditions.push(eq(companies.industry, industry));
    }

    if (size) {
      conditions.push(eq(companies.size, size));
    }

    if (ownerId) {
      conditions.push(eq(companies.ownerId, ownerId));
    }

    const [companyList, totalResult] = await Promise.all([
      db.query.companies.findMany({
        where: and(...conditions),
        with: {
          owner: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        limit: pageSize,
        offset,
        orderBy: (companies, { asc, desc }) => {
          const orderFn = sortOrder === 'asc' ? asc : desc;
          return [orderFn(companies[sortBy])];
        },
      }),
      db.select({ count: count() })
        .from(companies)
        .where(and(...conditions)),
    ]);

    return paginatedResponse(companyList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List companies error:', error);
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
    const result = createCompanySchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const [company] = await db.insert(companies).values({
      ...result.data,
      tenantId: auth.tenantId,
      ownerId: result.data.ownerId || auth.userId,
    }).returning();

    // Fetch with relations
    const completeCompany = await db.query.companies.findFirst({
      where: eq(companies.id, company.id),
      with: {
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return successResponse({ company: completeCompany });
  } catch (error) {
    console.error('Create company error:', error);
    return internalError();
  }
}
