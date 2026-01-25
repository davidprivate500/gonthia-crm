import { NextRequest } from 'next/server';
import { db, contacts, companies, deals, activities, pipelineStages } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { successResponse, internalError, badRequestError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, lt, asc } from 'drizzle-orm';
import {
  type DatePresetKey,
  parseDateRange,
  resolvePreset,
} from '@/lib/dates';

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
      // Use preset
      dateRange = resolvePreset(preset);
    } else if (from && to) {
      // Use custom date range
      const result = parseDateRange({ from, to, preset: 'custom' });
      if ('error' in result) {
        return badRequestError(result.error);
      }
      dateRange = result;
    } else {
      // Default to this month
      dateRange = resolvePreset('this_month');
    }

    const { from: rangeFrom, to: rangeTo } = dateRange;

    // Get counts in parallel - filtered by date range
    const [
      contactCount,
      companyCount,
      dealCount,
      activityCount,
      recentContacts,
      stages,
      dealsByStage,
      pipelineValue,
      // Also get all-time totals for comparison
      totalContactsAllTime,
      totalCompaniesAllTime,
      totalDealsAllTime,
    ] = await Promise.all([
      // Contacts created in date range
      db.select({ count: count() })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt),
          gte(contacts.createdAt, rangeFrom),
          lt(contacts.createdAt, rangeTo)
        )),

      // Companies created in date range
      db.select({ count: count() })
        .from(companies)
        .where(and(
          eq(companies.tenantId, auth.tenantId),
          isNull(companies.deletedAt),
          gte(companies.createdAt, rangeFrom),
          lt(companies.createdAt, rangeTo)
        )),

      // Deals created in date range
      db.select({ count: count() })
        .from(deals)
        .where(and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt),
          gte(deals.createdAt, rangeFrom),
          lt(deals.createdAt, rangeTo)
        )),

      // Activities created in date range
      db.select({ count: count() })
        .from(activities)
        .where(and(
          eq(activities.tenantId, auth.tenantId),
          isNull(activities.deletedAt),
          gte(activities.createdAt, rangeFrom),
          lt(activities.createdAt, rangeTo)
        )),

      // Recent contacts (last 5)
      db.query.contacts.findMany({
        where: and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt)
        ),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          createdAt: true,
        },
        limit: 5,
        orderBy: (contacts, { desc }) => [desc(contacts.createdAt)],
      }),

      // Pipeline stages
      db.query.pipelineStages.findMany({
        where: and(
          eq(pipelineStages.tenantId, auth.tenantId),
          isNull(pipelineStages.deletedAt)
        ),
        orderBy: [asc(pipelineStages.position)],
      }),

      // Deals by stage (created in date range)
      db.select({
        stageId: deals.stageId,
        count: count(),
        totalValue: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
      })
        .from(deals)
        .where(and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt),
          gte(deals.createdAt, rangeFrom),
          lt(deals.createdAt, rangeTo)
        ))
        .groupBy(deals.stageId),

      // Total pipeline value (for deals created in date range)
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

      // All-time totals for context
      db.select({ count: count() })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt)
        )),

      db.select({ count: count() })
        .from(companies)
        .where(and(
          eq(companies.tenantId, auth.tenantId),
          isNull(companies.deletedAt)
        )),

      db.select({ count: count() })
        .from(deals)
        .where(and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt)
        )),
    ]);

    // Map deals to stages
    const stagesWithDeals = stages.map(stage => {
      const stageData = dealsByStage.find(d => d.stageId === stage.id);
      return {
        ...stage,
        dealCount: stageData?.count || 0,
        totalValue: parseFloat(stageData?.totalValue || '0'),
      };
    });

    return successResponse({
      dateRange: {
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
        preset: dateRange.preset,
      },
      summary: {
        // Period metrics (filtered by date range)
        newContacts: contactCount[0].count,
        newCompanies: companyCount[0].count,
        newDeals: dealCount[0].count,
        activitiesCount: activityCount[0].count,
        periodPipelineValue: parseFloat(pipelineValue[0].total),
        // All-time totals
        totalContacts: totalContactsAllTime[0].count,
        totalCompanies: totalCompaniesAllTime[0].count,
        totalDeals: totalDealsAllTime[0].count,
      },
      recentContacts,
      pipeline: stagesWithDeals,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return internalError();
  }
}
