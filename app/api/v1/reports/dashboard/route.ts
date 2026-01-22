import { NextRequest } from 'next/server';
import { db, contacts, companies, deals, activities, pipelineStages } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { successResponse, internalError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get counts in parallel
    const [
      contactCount,
      companyCount,
      dealCount,
      activityCount,
      recentContacts,
      stages,
      dealsByStage,
      pipelineValue,
    ] = await Promise.all([
      // Total contacts
      db.select({ count: count() })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.deletedAt)
        )),

      // Total companies
      db.select({ count: count() })
        .from(companies)
        .where(and(
          eq(companies.tenantId, auth.tenantId),
          isNull(companies.deletedAt)
        )),

      // Total deals
      db.select({ count: count() })
        .from(deals)
        .where(and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt)
        )),

      // Activities this month
      db.select({ count: count() })
        .from(activities)
        .where(and(
          eq(activities.tenantId, auth.tenantId),
          isNull(activities.deletedAt),
          gte(activities.createdAt, thirtyDaysAgo)
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

      // Deals by stage
      db.select({
        stageId: deals.stageId,
        count: count(),
        totalValue: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
      })
        .from(deals)
        .where(and(
          eq(deals.tenantId, auth.tenantId),
          isNull(deals.deletedAt)
        ))
        .groupBy(deals.stageId),

      // Total pipeline value
      db.select({
        total: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
      })
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
      summary: {
        totalContacts: contactCount[0].count,
        totalCompanies: companyCount[0].count,
        totalDeals: dealCount[0].count,
        activitiesThisMonth: activityCount[0].count,
        totalPipelineValue: parseFloat(pipelineValue[0].total),
      },
      recentContacts,
      pipeline: stagesWithDeals,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return internalError();
  }
}
