import { NextRequest } from 'next/server';
import { db, deals, pipelineStages } from '@/lib/db';
import { requireTenantAuth } from '@/lib/auth/middleware';
import { successResponse, internalError, badRequestError } from '@/lib/api/response';
import { eq, and, isNull, count, sql, gte, lt, asc } from 'drizzle-orm';
import {
  type DatePresetKey,
  parseDateRange,
  resolvePreset,
  getMonthsInRange,
} from '@/lib/dates';

export interface PipelineStageInfo {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelinePivotRow {
  month: string;       // YYYY-MM
  monthLabel: string;  // Jan 2024
  stages: Record<string, {
    count: number;
    value: number;
  }>;
  total: {
    count: number;
    value: number;
  };
}

export interface PipelinePivotData {
  dateRange: {
    from: string;
    to: string;
    preset?: DatePresetKey;
  };
  stages: PipelineStageInfo[];
  rows: PipelinePivotRow[];
  totals: {
    byStage: Record<string, { count: number; value: number }>;
    overall: { count: number; value: number };
  };
}

/**
 * GET /api/v1/reports/pipeline-pivot
 *
 * Returns pipeline data in a pivot table format:
 * - Rows: Months
 * - Columns: Pipeline Stages
 * - Values: Deal count and value
 *
 * Query Parameters:
 * - preset: DatePresetKey (optional)
 * - from: YYYY-MM-DD (required if no preset)
 * - to: YYYY-MM-DD (required if no preset)
 * - metric: 'count' | 'value' | 'both' (default: 'both')
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

    // Get all pipeline stages for this tenant (ordered by position)
    const stagesData = await db.select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      color: pipelineStages.color,
      position: pipelineStages.position,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
    })
      .from(pipelineStages)
      .where(and(
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ))
      .orderBy(asc(pipelineStages.position));

    // Get all months in the range
    const months = getMonthsInRange(dateRange);

    // Build pivot data - for each month, get deals grouped by stage
    const rows: PipelinePivotRow[] = await Promise.all(
      months.map(async ({ start, end, key, label }) => {
        // Get deal counts and values grouped by stage for this month
        const stageMetrics = await db.select({
          stageId: deals.stageId,
          count: count(),
          value: sql<string>`COALESCE(SUM(CAST(${deals.value} AS DECIMAL)), 0)`,
        })
          .from(deals)
          .where(and(
            eq(deals.tenantId, auth.tenantId),
            isNull(deals.deletedAt),
            gte(deals.createdAt, start),
            lt(deals.createdAt, end)
          ))
          .groupBy(deals.stageId);

        // Build stages record
        const stagesRecord: Record<string, { count: number; value: number }> = {};
        let totalCount = 0;
        let totalValue = 0;

        // Initialize all stages with zeros
        for (const stage of stagesData) {
          stagesRecord[stage.id] = { count: 0, value: 0 };
        }

        // Fill in actual values
        for (const metric of stageMetrics) {
          stagesRecord[metric.stageId] = {
            count: metric.count,
            value: parseFloat(metric.value),
          };
          totalCount += metric.count;
          totalValue += parseFloat(metric.value);
        }

        return {
          month: key,
          monthLabel: label,
          stages: stagesRecord,
          total: { count: totalCount, value: totalValue },
        };
      })
    );

    // Calculate totals by stage and overall
    const totalsByStage: Record<string, { count: number; value: number }> = {};
    let overallCount = 0;
    let overallValue = 0;

    // Initialize
    for (const stage of stagesData) {
      totalsByStage[stage.id] = { count: 0, value: 0 };
    }

    // Sum up from rows
    for (const row of rows) {
      for (const [stageId, metrics] of Object.entries(row.stages)) {
        if (totalsByStage[stageId]) {
          totalsByStage[stageId].count += metrics.count;
          totalsByStage[stageId].value += metrics.value;
        }
      }
      overallCount += row.total.count;
      overallValue += row.total.value;
    }

    const response: PipelinePivotData = {
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        preset: dateRange.preset,
      },
      stages: stagesData,
      rows,
      totals: {
        byStage: totalsByStage,
        overall: { count: overallCount, value: overallValue },
      },
    };

    return successResponse(response);
  } catch (error) {
    console.error('Pipeline pivot error:', error);
    return internalError();
  }
}
