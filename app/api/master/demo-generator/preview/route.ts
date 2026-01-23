import { NextRequest } from 'next/server';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { previewSchema } from '@/validations/demo-generator';
import { successResponse, validationError, formatZodErrors, internalError } from '@/lib/api/response';
import { mergeWithDefaults, GrowthPlanner, estimateGenerationTime } from '@/lib/demo-generator';

// POST /api/master/demo-generator/preview - Preview generation metrics
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = previewSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Merge with defaults
    const config = mergeWithDefaults(result.data);

    // Create growth planner and get preview
    const planner = new GrowthPlanner(config);
    const validation = planner.validate();

    if (!validation.valid) {
      return validationError({
        config: validation.errors,
      });
    }

    const preview = planner.preview();
    const estimatedSeconds = estimateGenerationTime(result.data);

    // Calculate totals from preview
    const totals = preview.reduce(
      (acc, month) => ({
        leads: acc.leads + month.leads,
        contacts: acc.contacts + month.contacts,
        companies: acc.leads, // Simplified
        pipelineValue: acc.pipelineValue + month.pipelineValue,
        closedWonValue: acc.closedWonValue + month.closedWonValue,
        closedWonCount: acc.closedWonCount + month.deals,
      }),
      {
        leads: 0,
        contacts: 0,
        companies: 0,
        pipelineValue: 0,
        closedWonValue: 0,
        closedWonCount: 0,
      }
    );

    // Fix companies estimate
    totals.companies = Math.round(totals.contacts * 0.4);

    return successResponse({
      monthlyProjection: preview,
      totals: {
        leads: config.targets.leads,
        contacts: config.targets.contacts,
        companies: config.targets.companies,
        pipelineValue: config.targets.pipelineValue,
        closedWonValue: config.targets.closedWonValue,
        closedWonCount: config.targets.closedWonCount,
      },
      estimatedGenerationSeconds: estimatedSeconds,
      monthCount: preview.length,
    });
  } catch (error) {
    console.error('Preview demo generation error:', error);
    return internalError();
  }
}
