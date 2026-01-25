import { NextRequest } from 'next/server';
import { db, contacts, companies, deals, activities, tenants } from '@/lib/db';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { successResponse, internalError, badRequestError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, lt } from 'drizzle-orm';
import {
  type DatePresetKey,
  parseDateRange,
  resolvePreset,
} from '@/lib/dates';

/**
 * GET /api/master/reports/metrics
 *
 * Master Admin endpoint: Returns platform-wide metrics.
 * Optionally filters by tenantId for single-tenant analysis.
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
      dateRange = resolvePreset('this_month');
    }

    const { from: rangeFrom, to: rangeTo } = dateRange;

    // Build tenant condition
    const tenantCondition = tenantId ? eq(contacts.tenantId, tenantId) : undefined;

    // Parallel queries for metrics
    const [
      // Platform-wide counts
      totalTenantsResult,
      activeTenantsResult,

      // Entity counts (optionally filtered by tenant)
      newContactsResult,
      newCompaniesResult,
      newDealsResult,
      newActivitiesResult,
      pipelineValueResult,

      // Per-tenant breakdown (top 10 by activity)
      topTenantsByContactsResult,
      topTenantsByDealsResult,
    ] = await Promise.all([
      // Total tenants
      db.select({ count: count() }).from(tenants),

      // Active tenants (with any activity in period)
      db.select({ count: sql<number>`COUNT(DISTINCT ${contacts.tenantId})` })
        .from(contacts)
        .where(and(
          isNull(contacts.deletedAt),
          gte(contacts.createdAt, rangeFrom),
          lt(contacts.createdAt, rangeTo)
        )),

      // New contacts
      db.select({ count: count() })
        .from(contacts)
        .where(and(
          isNull(contacts.deletedAt),
          gte(contacts.createdAt, rangeFrom),
          lt(contacts.createdAt, rangeTo),
          tenantCondition
        )),

      // New companies
      db.select({ count: count() })
        .from(companies)
        .where(and(
          isNull(companies.deletedAt),
          gte(companies.createdAt, rangeFrom),
          lt(companies.createdAt, rangeTo),
          tenantId ? eq(companies.tenantId, tenantId) : undefined
        )),

      // New deals
      db.select({ count: count() })
        .from(deals)
        .where(and(
          isNull(deals.deletedAt),
          gte(deals.createdAt, rangeFrom),
          lt(deals.createdAt, rangeTo),
          tenantId ? eq(deals.tenantId, tenantId) : undefined
        )),

      // New activities
      db.select({ count: count() })
        .from(activities)
        .where(and(
          isNull(activities.deletedAt),
          gte(activities.createdAt, rangeFrom),
          lt(activities.createdAt, rangeTo),
          tenantId ? eq(activities.tenantId, tenantId) : undefined
        )),

      // Pipeline value
      db.select({
        total: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
      })
        .from(deals)
        .where(and(
          isNull(deals.deletedAt),
          gte(deals.createdAt, rangeFrom),
          lt(deals.createdAt, rangeTo),
          tenantId ? eq(deals.tenantId, tenantId) : undefined
        )),

      // Top tenants by contacts
      tenantId ? Promise.resolve([]) : db.select({
        tenantId: contacts.tenantId,
        count: count(),
      })
        .from(contacts)
        .where(and(
          isNull(contacts.deletedAt),
          gte(contacts.createdAt, rangeFrom),
          lt(contacts.createdAt, rangeTo)
        ))
        .groupBy(contacts.tenantId)
        .orderBy(sql`count DESC`)
        .limit(10),

      // Top tenants by deals
      tenantId ? Promise.resolve([]) : db.select({
        tenantId: deals.tenantId,
        count: count(),
        value: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
      })
        .from(deals)
        .where(and(
          isNull(deals.deletedAt),
          gte(deals.createdAt, rangeFrom),
          lt(deals.createdAt, rangeTo)
        ))
        .groupBy(deals.tenantId)
        .orderBy(sql`count DESC`)
        .limit(10),
    ]);

    // Get tenant names for top tenants
    const topTenantIds = [
      ...new Set([
        ...topTenantsByContactsResult.map(t => t.tenantId),
        ...topTenantsByDealsResult.map(t => t.tenantId),
      ])
    ];

    let tenantNames: Record<string, string> = {};
    if (topTenantIds.length > 0) {
      const tenantList = await db.query.tenants.findMany({
        where: sql`${tenants.id} IN (${sql.join(topTenantIds.map(id => sql`${id}`), sql`, `)})`,
        columns: { id: true, name: true },
      });
      tenantNames = Object.fromEntries(tenantList.map(t => [t.id, t.name]));
    }

    return successResponse({
      dateRange: {
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
        preset: dateRange.preset,
      },
      tenantId: tenantId || null,
      platform: {
        totalTenants: totalTenantsResult[0].count,
        activeTenantsInPeriod: activeTenantsResult[0].count,
      },
      metrics: {
        contacts: newContactsResult[0].count,
        companies: newCompaniesResult[0].count,
        deals: newDealsResult[0].count,
        activities: newActivitiesResult[0].count,
        pipelineValue: parseFloat(pipelineValueResult[0].total),
      },
      topTenants: tenantId ? null : {
        byContacts: topTenantsByContactsResult.map(t => ({
          tenantId: t.tenantId,
          tenantName: tenantNames[t.tenantId] || 'Unknown',
          count: t.count,
        })),
        byDeals: topTenantsByDealsResult.map(t => ({
          tenantId: t.tenantId,
          tenantName: tenantNames[t.tenantId] || 'Unknown',
          count: t.count,
          value: parseFloat(t.value),
        })),
      },
    });
  } catch (error) {
    console.error('Master metrics error:', error);
    return internalError();
  }
}
