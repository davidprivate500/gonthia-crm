import { NextRequest } from 'next/server';
import { db, contacts, companies, deals, activities, tenants } from '@/lib/db';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { successResponse, internalError, badRequestError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, lt } from 'drizzle-orm';
import {
  type DatePresetKey,
  parseDateRange,
  resolvePreset,
  getMonthsInRange,
} from '@/lib/dates';

/**
 * GET /api/master/reports/monthly
 *
 * Master Admin endpoint: Returns monthly metrics grouped for billing.
 * Can filter by tenantId for single-tenant billing analysis.
 *
 * Query Parameters:
 * - preset: DatePresetKey (optional)
 * - from: YYYY-MM-DD (required if no preset)
 * - to: YYYY-MM-DD (required if no preset)
 * - tenantId: UUID (optional) - Filter to specific tenant
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const searchParams = request.nextUrl.searchParams;
    const preset = searchParams.get('preset') as DatePresetKey | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const tenantId = searchParams.get('tenantId');

    let dateRange;

    if (preset && preset !== 'custom') {
      dateRange = resolvePreset(preset);
    } else if (from && to) {
      const result = parseDateRange({ from, to, preset: 'custom' });
      if ('error' in result) {
        return badRequestError(result.error);
      }
      dateRange = result;
    } else {
      dateRange = resolvePreset('last_90_days');
    }

    // Get all months in range
    const months = getMonthsInRange(dateRange);

    // Query per-month metrics
    const monthlyResults = await Promise.all(
      months.map(async ({ start, end, key, label }) => {
        const [
          contactsResult,
          companiesResult,
          dealsResult,
          activitiesResult,
          pipelineValueResult,
        ] = await Promise.all([
          db.select({ count: count() })
            .from(contacts)
            .where(and(
              isNull(contacts.deletedAt),
              gte(contacts.createdAt, start),
              lt(contacts.createdAt, end),
              tenantId ? eq(contacts.tenantId, tenantId) : undefined
            )),

          db.select({ count: count() })
            .from(companies)
            .where(and(
              isNull(companies.deletedAt),
              gte(companies.createdAt, start),
              lt(companies.createdAt, end),
              tenantId ? eq(companies.tenantId, tenantId) : undefined
            )),

          db.select({ count: count() })
            .from(deals)
            .where(and(
              isNull(deals.deletedAt),
              gte(deals.createdAt, start),
              lt(deals.createdAt, end),
              tenantId ? eq(deals.tenantId, tenantId) : undefined
            )),

          db.select({ count: count() })
            .from(activities)
            .where(and(
              isNull(activities.deletedAt),
              gte(activities.createdAt, start),
              lt(activities.createdAt, end),
              tenantId ? eq(activities.tenantId, tenantId) : undefined
            )),

          db.select({
            total: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
          })
            .from(deals)
            .where(and(
              isNull(deals.deletedAt),
              gte(deals.createdAt, start),
              lt(deals.createdAt, end),
              tenantId ? eq(deals.tenantId, tenantId) : undefined
            )),
        ]);

        return {
          month: key,
          monthLabel: label,
          contacts: contactsResult[0].count,
          companies: companiesResult[0].count,
          deals: dealsResult[0].count,
          activities: activitiesResult[0].count,
          pipelineValue: parseFloat(pipelineValueResult[0].total),
        };
      })
    );

    // Calculate totals
    const totals = monthlyResults.reduce(
      (acc, month) => ({
        contacts: acc.contacts + month.contacts,
        companies: acc.companies + month.companies,
        deals: acc.deals + month.deals,
        activities: acc.activities + month.activities,
        pipelineValue: acc.pipelineValue + month.pipelineValue,
      }),
      { contacts: 0, companies: 0, deals: 0, activities: 0, pipelineValue: 0 }
    );

    // Get tenant info if filtered
    let tenantInfo = null;
    if (tenantId) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: { id: true, name: true },
      });
      tenantInfo = tenant || null;
    }

    return successResponse({
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        preset: dateRange.preset,
      },
      tenant: tenantInfo,
      months: monthlyResults,
      totals,
    });
  } catch (error) {
    console.error('Master monthly metrics error:', error);
    return internalError();
  }
}
