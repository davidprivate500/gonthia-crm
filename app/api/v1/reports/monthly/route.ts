import { NextRequest } from 'next/server';
import { db, contacts, companies, deals, activities } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { successResponse, internalError, badRequestError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, lt } from 'drizzle-orm';
import { format, addMonths } from 'date-fns';
import {
  type DatePresetKey,
  parseDateRange,
  resolvePreset,
  getMonthsInRange,
  formatMonthKey,
} from '@/lib/dates';

export interface MonthlyMetrics {
  month: string;       // YYYY-MM
  monthLabel: string;  // Jan 2024
  contacts: number;
  companies: number;
  deals: number;
  activities: number;
  pipelineValue: number;
}

/**
 * GET /api/v1/reports/monthly
 *
 * Returns monthly aggregated metrics for billing purposes.
 * Groups counts by month within the specified date range.
 *
 * Query Parameters:
 * - preset: DatePresetKey (optional)
 * - from: YYYY-MM-DD (required if no preset)
 * - to: YYYY-MM-DD (required if no preset)
 *
 * Returns:
 * - months: Array of monthly metrics
 * - totals: Aggregated totals for the entire range
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    // Parse date range
    const searchParams = request.nextUrl.searchParams;
    const preset = searchParams.get('preset') as DatePresetKey | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

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
      // Default to last 6 months
      dateRange = resolvePreset('last_90_days');
    }

    // Get all months in the range
    const months = getMonthsInRange(dateRange);

    // Query metrics for each month in parallel
    const monthlyResults = await Promise.all(
      months.map(async ({ start, end, key, label }) => {
        const [
          contactsResult,
          companiesResult,
          dealsResult,
          activitiesResult,
          pipelineValueResult,
        ] = await Promise.all([
          // Contacts
          db.select({ count: count() })
            .from(contacts)
            .where(and(
              eq(contacts.tenantId, auth.tenantId),
              isNull(contacts.deletedAt),
              gte(contacts.createdAt, start),
              lt(contacts.createdAt, end)
            )),

          // Companies
          db.select({ count: count() })
            .from(companies)
            .where(and(
              eq(companies.tenantId, auth.tenantId),
              isNull(companies.deletedAt),
              gte(companies.createdAt, start),
              lt(companies.createdAt, end)
            )),

          // Deals
          db.select({ count: count() })
            .from(deals)
            .where(and(
              eq(deals.tenantId, auth.tenantId),
              isNull(deals.deletedAt),
              gte(deals.createdAt, start),
              lt(deals.createdAt, end)
            )),

          // Activities
          db.select({ count: count() })
            .from(activities)
            .where(and(
              eq(activities.tenantId, auth.tenantId),
              isNull(activities.deletedAt),
              gte(activities.createdAt, start),
              lt(activities.createdAt, end)
            )),

          // Pipeline value
          db.select({
            total: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
          })
            .from(deals)
            .where(and(
              eq(deals.tenantId, auth.tenantId),
              isNull(deals.deletedAt),
              gte(deals.createdAt, start),
              lt(deals.createdAt, end)
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

    return successResponse({
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        preset: dateRange.preset,
      },
      months: monthlyResults,
      totals,
    });
  } catch (error) {
    console.error('Monthly metrics error:', error);
    return internalError();
  }
}
