import { NextRequest } from 'next/server';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { validatePlanSchema } from '@/validations/demo-generator';
import { planValidator } from '@/lib/demo-generator/engine/plan-validator';
import {
  successResponse,
  validationError,
  formatZodErrors,
  internalError,
} from '@/lib/api/response';

// POST /api/master/demo-generator/validate-plan - Validate a monthly plan
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = validatePlanSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { monthlyPlan } = result.data;

    // Validate the plan using the plan validator
    const validationResult = planValidator.validate(monthlyPlan);

    return successResponse({
      valid: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      derived: validationResult.derived,
      estimatedGenerationSeconds: validationResult.estimatedGenerationSeconds,
    });
  } catch (error) {
    console.error('Validate plan error:', error);
    return internalError();
  }
}
