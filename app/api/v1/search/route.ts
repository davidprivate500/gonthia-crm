import { NextRequest } from 'next/server';
import { db, contacts, companies, deals } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { globalSearchSchema } from '@/validations/search';
import { successResponse, validationError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull, ilike, or, sql } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const result = globalSearchSchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { q, types, limit } = result.data;
    const searchTypes = types ? types.split(',') : ['contacts', 'companies', 'deals'];
    // BUG-008 FIX: Escape SQL LIKE wildcards in search term
    const searchTerm = toSearchPattern(q);

    const results: {
      contacts?: Array<{ id: string; type: string; displayName: string; email?: string | null; status?: string }>;
      companies?: Array<{ id: string; type: string; displayName: string; domain?: string | null }>;
      deals?: Array<{ id: string; type: string; displayName: string; value?: string | null }>;
    } = {};

    // Search contacts
    if (searchTypes.includes('contacts')) {
      const contactResults = await db.query.contacts.findMany({
        where: and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt),
          or(
            ilike(contacts.firstName, searchTerm),
            ilike(contacts.lastName, searchTerm),
            ilike(contacts.email, searchTerm),
            sql`concat(${contacts.firstName}, ' ', ${contacts.lastName}) ILIKE ${searchTerm}`
          )
        ),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
        with: {
          company: {
            columns: { id: true, name: true },
          },
        },
        limit,
      });

      results.contacts = contactResults.map(c => ({
        ...c,
        type: 'contact',
        displayName: `${c.firstName} ${c.lastName}`.trim(),
      }));
    }

    // Search companies
    if (searchTypes.includes('companies')) {
      const companyResults = await db.query.companies.findMany({
        where: and(
          eq(companies.tenantId, auth.tenantId),
          isNull(companies.deletedAt),
          or(
            ilike(companies.name, searchTerm),
            ilike(companies.domain, searchTerm)
          )
        ),
        columns: {
          id: true,
          name: true,
          domain: true,
          industry: true,
        },
        limit,
      });

      results.companies = companyResults.map(c => ({
        ...c,
        type: 'company',
        displayName: c.name,
      }));
    }

    // Search deals
    if (searchTypes.includes('deals')) {
      const dealResults = await db.query.deals.findMany({
        where: and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt),
          ilike(deals.title, searchTerm)
        ),
        columns: {
          id: true,
          title: true,
          value: true,
        },
        with: {
          stage: {
            columns: { id: true, name: true, color: true },
          },
          contact: {
            columns: { id: true, firstName: true, lastName: true },
          },
          company: {
            columns: { id: true, name: true },
          },
        },
        limit,
      });

      results.deals = dealResults.map(d => ({
        ...d,
        type: 'deal',
        displayName: d.title,
      }));
    }

    // Combine and sort by relevance (simple: exact match first)
    const allResults = [
      ...(results.contacts || []),
      ...(results.companies || []),
      ...(results.deals || []),
    ].slice(0, limit);

    return successResponse({
      query: q,
      results: allResults,
      grouped: results,
    });
  } catch (error) {
    console.error('Global search error:', error);
    return internalError();
  }
}
