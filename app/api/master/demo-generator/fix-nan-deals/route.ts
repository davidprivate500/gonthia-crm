import { NextRequest } from 'next/server';
import { requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { successResponse, internalError } from '@/lib/api/response';
import { db, deals } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

// POST /api/master/demo-generator/fix-nan-deals
// Fixes deals with invalid "NaN" values
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    // Find all deals with NaN values
    const nanDeals = await db.select({ id: deals.id, tenantId: deals.tenantId })
      .from(deals)
      .where(eq(deals.value, 'NaN'));

    if (nanDeals.length === 0) {
      return successResponse({
        message: 'No deals with NaN values found',
        fixed: 0,
      });
    }

    // Delete the bad deals (they were created incorrectly)
    const result = await db.delete(deals)
      .where(eq(deals.value, 'NaN'));

    // Group by tenant for reporting
    const tenantCounts = nanDeals.reduce((acc, deal) => {
      acc[deal.tenantId] = (acc[deal.tenantId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return successResponse({
      message: `Fixed ${nanDeals.length} deals with NaN values`,
      fixed: nanDeals.length,
      byTenant: tenantCounts,
    });
  } catch (error) {
    console.error('Fix NaN deals error:', error);
    return internalError();
  }
}

// GET - Check how many bad deals exist
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const nanDeals = await db.select({
      tenantId: deals.tenantId,
      count: sql<number>`count(*)::int`,
    })
      .from(deals)
      .where(eq(deals.value, 'NaN'))
      .groupBy(deals.tenantId);

    const total = nanDeals.reduce((sum, row) => sum + row.count, 0);

    return successResponse({
      total,
      byTenant: nanDeals,
    });
  } catch (error) {
    console.error('Check NaN deals error:', error);
    return internalError();
  }
}
