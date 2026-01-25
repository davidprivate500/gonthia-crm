import { NextRequest } from 'next/server';
import { db, contacts, companies, deals, activities, pipelineStages } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { successResponse, internalError, badRequestError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, lt } from 'drizzle-orm';
import {
  type DatePresetKey,
  parseDateRange,
  resolvePreset,
} from '@/lib/dates';

/**
 * GET /api/v1/reports/metrics
 *
 * Returns detailed performance metrics for a date range.
 *
 * Query Parameters:
 * - preset: DatePresetKey (optional) - Quick preset like 'this_month', 'last_week', etc.
 * - from: YYYY-MM-DD (required if no preset) - Start date (inclusive)
 * - to: YYYY-MM-DD (required if no preset) - End date (inclusive, converted to exclusive internally)
 *
 * Metric Definitions:
 * - newContacts: Count of contacts.createdAt within range
 * - newCustomers: Count of contacts.createdAt where status='customer' within range
 * - newCompanies: Count of companies.createdAt within range
 * - newDeals: Count of deals.createdAt within range
 * - wonDeals: Count of deals.createdAt where stage.isWon=true within range
 * - lostDeals: Count of deals.createdAt where stage.isLost=true within range
 * - newPipelineValue: Sum of deals.value for deals.createdAt within range
 * - wonValue: Sum of deals.value for won deals within range
 * - activities: Count of activities.createdAt within range (by type)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    // Parse date range from query params
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
      dateRange = resolvePreset('this_month');
    }

    const { from: rangeFrom, to: rangeTo } = dateRange;

    // Get all pipeline stages to identify won/lost stages
    const allStages = await db.query.pipelineStages.findMany({
      where: and(
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
    });

    const wonStageIds = allStages.filter(s => s.isWon).map(s => s.id);
    const lostStageIds = allStages.filter(s => s.isLost).map(s => s.id);

    // Parallel queries for all metrics
    const [
      // Contact metrics
      newContactsResult,
      newCustomersResult,
      contactsByStatusResult,

      // Company metrics
      newCompaniesResult,

      // Deal metrics
      newDealsResult,
      wonDealsResult,
      lostDealsResult,
      newPipelineValueResult,
      wonValueResult,

      // Activity metrics
      activitiesCountResult,
      activitiesByTypeResult,
    ] = await Promise.all([
      // New contacts
      db.select({ count: count() })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt),
          gte(contacts.createdAt, rangeFrom),
          lt(contacts.createdAt, rangeTo)
        )),

      // New customers (contacts with status='customer')
      db.select({ count: count() })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt),
          eq(contacts.status, 'customer'),
          gte(contacts.createdAt, rangeFrom),
          lt(contacts.createdAt, rangeTo)
        )),

      // Contacts by status
      db.select({
        status: contacts.status,
        count: count(),
      })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt),
          gte(contacts.createdAt, rangeFrom),
          lt(contacts.createdAt, rangeTo)
        ))
        .groupBy(contacts.status),

      // New companies
      db.select({ count: count() })
        .from(companies)
        .where(and(
          eq(companies.tenantId, auth.tenantId),
          isNull(companies.deletedAt),
          gte(companies.createdAt, rangeFrom),
          lt(companies.createdAt, rangeTo)
        )),

      // New deals
      db.select({ count: count() })
        .from(deals)
        .where(and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt),
          gte(deals.createdAt, rangeFrom),
          lt(deals.createdAt, rangeTo)
        )),

      // Won deals
      wonStageIds.length > 0
        ? db.select({ count: count() })
            .from(deals)
            .where(and(
              eq(deals.tenantId, auth.tenantId),
              isNull(deals.deletedAt),
              sql`${deals.stageId} IN (${sql.join(wonStageIds.map(id => sql`${id}`), sql`, `)})`,
              gte(deals.createdAt, rangeFrom),
              lt(deals.createdAt, rangeTo)
            ))
        : Promise.resolve([{ count: 0 }]),

      // Lost deals
      lostStageIds.length > 0
        ? db.select({ count: count() })
            .from(deals)
            .where(and(
              eq(deals.tenantId, auth.tenantId),
              isNull(deals.deletedAt),
              sql`${deals.stageId} IN (${sql.join(lostStageIds.map(id => sql`${id}`), sql`, `)})`,
              gte(deals.createdAt, rangeFrom),
              lt(deals.createdAt, rangeTo)
            ))
        : Promise.resolve([{ count: 0 }]),

      // New pipeline value
      db.select({
        total: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
      })
        .from(deals)
        .where(and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt),
          gte(deals.createdAt, rangeFrom),
          lt(deals.createdAt, rangeTo)
        )),

      // Won value
      wonStageIds.length > 0
        ? db.select({
            total: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
          })
            .from(deals)
            .where(and(
              eq(deals.tenantId, auth.tenantId),
              isNull(deals.deletedAt),
              sql`${deals.stageId} IN (${sql.join(wonStageIds.map(id => sql`${id}`), sql`, `)})`,
              gte(deals.createdAt, rangeFrom),
              lt(deals.createdAt, rangeTo)
            ))
        : Promise.resolve([{ total: '0' }]),

      // Activities count
      db.select({ count: count() })
        .from(activities)
        .where(and(
          eq(activities.tenantId, auth.tenantId),
          isNull(activities.deletedAt),
          gte(activities.createdAt, rangeFrom),
          lt(activities.createdAt, rangeTo)
        )),

      // Activities by type
      db.select({
        type: activities.type,
        count: count(),
      })
        .from(activities)
        .where(and(
          eq(activities.tenantId, auth.tenantId),
          isNull(activities.deletedAt),
          gte(activities.createdAt, rangeFrom),
          lt(activities.createdAt, rangeTo)
        ))
        .groupBy(activities.type),
    ]);

    // Format response
    const metrics = {
      dateRange: {
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
        preset: dateRange.preset,
      },
      contacts: {
        new: newContactsResult[0].count,
        newCustomers: newCustomersResult[0].count,
        byStatus: Object.fromEntries(
          contactsByStatusResult.map(r => [r.status, r.count])
        ),
      },
      companies: {
        new: newCompaniesResult[0].count,
      },
      deals: {
        new: newDealsResult[0].count,
        won: wonDealsResult[0].count,
        lost: lostDealsResult[0].count,
        pipelineValue: parseFloat(newPipelineValueResult[0].total),
        wonValue: parseFloat(wonValueResult[0].total),
        winRate: newDealsResult[0].count > 0
          ? Math.round((wonDealsResult[0].count / newDealsResult[0].count) * 100)
          : 0,
      },
      activities: {
        total: activitiesCountResult[0].count,
        byType: Object.fromEntries(
          activitiesByTypeResult.map(r => [r.type, r.count])
        ),
      },
    };

    return successResponse(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    return internalError();
  }
}
