import { NextRequest } from 'next/server';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { successResponse, badRequestError, notFoundError, internalError } from '@/lib/api/response';
import { kpiQuerySchema } from '@/validations/demo-patch';
import { KpiAggregator } from '@/lib/demo-generator/engine/kpi-aggregator';
import { validateDemoTenant } from '@/lib/demo-generator/engine/patch-validator';

interface RouteParams {
  params: Promise<{ tenantId: string }>;
}

// GET /api/master/demo-generator/tenants/:tenantId/kpis
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await params;

    // Validate tenant is demo-generated
    const tenantValidation = await validateDemoTenant(tenantId);
    if (!tenantValidation.valid) {
      return badRequestError(tenantValidation.error!);
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const queryResult = kpiQuerySchema.safeParse({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    });

    if (!queryResult.success) {
      return badRequestError(
        `Invalid query parameters: ${queryResult.error.issues.map((e) => e.message).join(', ')}`
      );
    }

    const { from, to } = queryResult.data;

    // Query KPIs
    const aggregator = new KpiAggregator(tenantId);
    const kpis = await aggregator.queryMonthlyKpis(from, to);

    return successResponse({
      tenantId,
      months: kpis,
      rangeStart: from,
      rangeEnd: to,
    });
  } catch (error) {
    console.error('Get tenant KPIs error:', error);
    return internalError();
  }
}
