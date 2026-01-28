import { NextRequest } from 'next/server';
import { db, contacts, companies, deals, activities, pipelineStages, demoMetricOverrides } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { successResponse, internalError, badRequestError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, lt, lte } from 'drizzle-orm';
import {
  type DatePresetKey,
  parseDateRange,
  resolvePreset,
} from '@/lib/dates';
import { format, startOfMonth, endOfMonth } from 'date-fns';

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

    // Query metric overrides for the date range
    // Overrides are stored by month (YYYY-MM), so we need to determine which months overlap
    const startMonth = format(rangeFrom, 'yyyy-MM');
    const endMonth = format(rangeTo, 'yyyy-MM');

    const overridesResult = await db.select({
      contactsCreatedOverride: demoMetricOverrides.contactsCreatedOverride,
      companiesCreatedOverride: demoMetricOverrides.companiesCreatedOverride,
      dealsCreatedOverride: demoMetricOverrides.dealsCreatedOverride,
      closedWonCountOverride: demoMetricOverrides.closedWonCountOverride,
      closedWonValueOverride: demoMetricOverrides.closedWonValueOverride,
      activitiesCreatedOverride: demoMetricOverrides.activitiesCreatedOverride,
    })
      .from(demoMetricOverrides)
      .where(and(
        eq(demoMetricOverrides.tenantId, auth.tenantId),
        gte(demoMetricOverrides.month, startMonth),
        lte(demoMetricOverrides.month, endMonth)
      ));

    // Process overrides - for metrics-only mode, these are ABSOLUTE target values
    // A value of -1 means "not set, use base"
    // Any other value is the target to display directly
    let contactsTarget: number | null = null;
    let companiesTarget: number | null = null;
    let dealsTarget: number | null = null;
    let wonCountTarget: number | null = null;
    let wonValueTarget: number | null = null;
    let activitiesTarget: number | null = null;

    for (const override of overridesResult) {
      const contacts = Number(override.contactsCreatedOverride);
      const companies = Number(override.companiesCreatedOverride);
      const deals = Number(override.dealsCreatedOverride);
      const wonCount = Number(override.closedWonCountOverride);
      const wonValue = parseFloat(String(override.closedWonValueOverride));
      const activities = Number(override.activitiesCreatedOverride);

      // Use override if it's a valid target (not -1 sentinel)
      if (contacts >= 0) contactsTarget = (contactsTarget ?? 0) + contacts;
      if (companies >= 0) companiesTarget = (companiesTarget ?? 0) + companies;
      if (deals >= 0) dealsTarget = (dealsTarget ?? 0) + deals;
      if (wonCount >= 0) wonCountTarget = (wonCountTarget ?? 0) + wonCount;
      if (wonValue >= 0) wonValueTarget = (wonValueTarget ?? 0) + wonValue;
      if (activities >= 0) activitiesTarget = (activitiesTarget ?? 0) + activities;
    }

    // Use override target if set, otherwise use base query result
    const totalContacts = contactsTarget ?? newContactsResult[0].count;
    const totalCompanies = companiesTarget ?? newCompaniesResult[0].count;
    const totalDeals = dealsTarget ?? newDealsResult[0].count;
    const totalWonDeals = wonCountTarget ?? wonDealsResult[0].count;
    const totalWonValue = wonValueTarget ?? parseFloat(wonValueResult[0].total);
    const totalActivities = activitiesTarget ?? activitiesCountResult[0].count;

    // Format response
    const metrics = {
      dateRange: {
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
        preset: dateRange.preset,
      },
      contacts: {
        new: totalContacts,
        newCustomers: newCustomersResult[0].count,
        byStatus: Object.fromEntries(
          contactsByStatusResult.map(r => [r.status, r.count])
        ),
      },
      companies: {
        new: totalCompanies,
      },
      deals: {
        new: totalDeals,
        won: totalWonDeals,
        lost: lostDealsResult[0].count,
        pipelineValue: parseFloat(newPipelineValueResult[0].total),
        wonValue: totalWonValue,
        winRate: totalDeals > 0
          ? Math.round((totalWonDeals / totalDeals) * 100)
          : 0,
      },
      activities: {
        total: totalActivities,
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
